"""On-demand Sentinel-2 segmentation using real public rasters and the supplied L4S model."""
import io
import uuid
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path
import httpx
import numpy as np
from PIL import Image
import rasterio
from rasterio.enums import Resampling
from rasterio.vrt import WarpedVRT
from rasterio.transform import from_origin, from_bounds
from rasterio.warp import transform_bounds, reproject
from pyproj import Transformer
from fastapi import APIRouter,HTTPException
from pydantic import BaseModel,Field

router=APIRouter()
CATALOG='https://earth-search.aws.element84.com/v1'
BANDS=['coastal','blue','green','red','rededge1','rededge2','rededge3','nir','nir09','cirrus','swir16','swir22']
JOBS={}
MODEL=None
MODEL_LOCK=threading.Lock()
EXECUTOR=ThreadPoolExecutor(max_workers=1)


class DetectionRequest(BaseModel):
    latitude:float=Field(default=27.3389,ge=21.5,le=29.8)
    longitude:float=Field(default=88.6065,ge=88,le=97.5)


def asset_url(href):
    if href.startswith('s3://'):
        bucket,key=href[5:].split('/',1)
        href=f'https://{bucket}.s3.amazonaws.com/{key}'
    from urllib.parse import urlparse
    parsed=urlparse(href)
    if parsed.scheme!='https' or not parsed.hostname or not parsed.hostname.endswith('.amazonaws.com'):
        raise ValueError('Unsupported raster host')
    return href


def search(collection,longitude,latitude,limit=8):
    now=datetime.now(timezone.utc)
    body={'collections':[collection],'intersects':{'type':'Point','coordinates':[longitude,latitude]},'limit':limit}
    if collection.startswith('sentinel'):
        body.update(datetime=f'{(now-timedelta(days=90)).isoformat()}/{now.isoformat()}',sortby=[{'field':'properties.datetime','direction':'desc'}])
    response=httpx.post(CATALOG+'/search',json=body,timeout=30)
    response.raise_for_status()
    return response.json()['features']


def read_band(href,crs,transform,size=128,nearest=False):
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR',CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tif,.jp2',GDAL_HTTP_TIMEOUT='25',GDAL_HTTP_MAX_RETRY='1',VSI_CACHE=True):
        with rasterio.open(asset_url(href)) as source:
            with WarpedVRT(source,crs=crs,transform=transform,width=size,height=size,
                           resampling=Resampling.nearest if nearest else Resampling.bilinear) as vrt:
                data=vrt.read(1,masked=True)
                return data.filled(np.nan).astype(np.float32) if data.dtype.kind=='f' else np.where(np.ma.getmaskarray(data),np.nan,data).astype(np.float32)


def normalize(channels):
    result=[]
    for band in channels:
        low,high=float(np.nanmin(band)),float(np.nanmax(band))
        result.append(np.zeros_like(band) if high-low<=1e-4 else (band-low)/(high-low))
    return np.stack(result).astype(np.float32)


def model():
    global MODEL
    with MODEL_LOCK:
        if MODEL is None:
            import torch
            from .sentinel_model import LandslideResUNet
            loaded=LandslideResUNet(in_channels=14)
            loaded.load_state_dict(torch.load(Path(__file__).resolve().parents[3]/'models/landslide_sentinel_resunet.pt',map_location='cpu',weights_only=True),strict=True)
            MODEL=loaded.eval()
    return MODEL


def png(array):
    stream=io.BytesIO();Image.fromarray(array).save(stream,format='PNG');return stream.getvalue()


def geographic_png(array,crs,transform,bounds):
    # Warp the rendered raster as well, so map overlays use an actual geographic grid.
    height,width=array.shape[:2]
    output=np.zeros_like(array)
    target=from_bounds(*bounds,width,height)
    for band in range(array.shape[2]):
        reproject(array[:,:,band],output[:,:,band],src_transform=transform,src_crs=crs,
                  dst_transform=target,dst_crs='EPSG:4326',resampling=Resampling.nearest)
    return png(output)


def run(job_id,latitude,longitude):
    job=JOBS[job_id]
    try:
        job.update(state='SEARCHING',progress='Finding latest analysis-ready Sentinel-2 L2A acquisition')
        scenes=search('sentinel-2-l2a',longitude,latitude)
        usable=[s for s in scenes if s['properties'].get('eo:cloud_cover',100)<=70]
        if not usable:raise ValueError('No Sentinel scene with tile cloud cover <=70% in the last 90 days')
        scene=usable[0]
        # L2A is served as cloud-optimized GeoTIFF, but deliberately omits B10
        # (the cirrus band). Use B10 from the matching L1C acquisition so the
        # existing 14-channel model receives a complete same-time input stack.
        band_assets=dict(scene['assets'])
        if 'cirrus' not in band_assets:
            expected_l1c_id=scene['id'].replace('_L2A','_L1C')
            l1c_scenes=search('sentinel-2-l1c',longitude,latitude)
            l1c=next((item for item in l1c_scenes if item['id']==expected_l1c_id),None)
            if l1c and 'cirrus' in l1c.get('assets',{}):
                band_assets['cirrus']=l1c['assets']['cirrus']
        missing=[key for key in BANDS if key not in band_assets]
        if missing:raise ValueError('Scene is missing required spectral bands')
        elevation=search('cop-dem-glo-30',longitude,latitude,1)
        if not elevation:raise ValueError('No real elevation tile found')
        zone=int((longitude+180)//6)+1;crs=f'EPSG:{32600+zone}'
        x,y=Transformer.from_crs('EPSG:4326',crs,always_xy=True).transform(longitude,latitude)
        transform=from_origin(x-640,y+640,10,10)
        job.update(state='READING_RASTERS',progress=f'Reading 11 L2A bands plus same-acquisition B10 from {scene["id"]}',scene_id=scene['id'])
        def fetch(key):return read_band(band_assets[key]['href'],crs,transform)
        with ThreadPoolExecutor(max_workers=4) as pool:bands=list(pool.map(fetch,BANDS))
        dem_large=read_band(elevation[0]['assets']['data']['href'],crs,from_origin(x-650,y+650,10,10),130)
        dy,dx=np.gradient(dem_large,10,10)
        slope=np.degrees(np.arctan(np.hypot(dx,dy)))[1:-1,1:-1]
        dem=dem_large[1:-1,1:-1]
        channels=np.stack([*bands,slope,dem])
        valid=np.isfinite(channels).all(axis=0)&(np.stack(bands)>0).all(axis=0)
        if valid.mean()<.8:raise ValueError('Insufficient valid spectral/elevation coverage at this location')
        cloud_status='Unavailable'
        # Use the scene's own SCL asset, keeping the cloud mask acquisition-aligned.
        if 'scl' in scene.get('assets',{}):
            scl=read_band(scene['assets']['scl']['href'],crs,transform,nearest=True)
            valid &= ~np.isin(scl,[0,1,3,6,8,9,10,11]) & np.isfinite(scl)
            cloud_status='Same-acquisition Sentinel-2 L2A scene classification mask applied'
        else:
            raise ValueError('Same-acquisition cloud classification unavailable; detection withheld')
        if valid.sum()==0:raise ValueError('Selected patch is fully obscured by cloud, shadow, water or no-data')
        job.update(state='INFERENCE',progress='Running the 14-channel Sentinel ResUNet')
        import torch
        tensor=normalize(np.nan_to_num(channels))
        with torch.inference_mode():probability=torch.sigmoid(model()(torch.from_numpy(tensor).unsqueeze(0)))[0,0].numpy()
        candidate=(probability>=.35)&valid
        rgb=np.stack([bands[3],bands[2],bands[1]],axis=-1)
        low=np.percentile(rgb[np.isfinite(rgb)],2);high=np.percentile(rgb[np.isfinite(rgb)],98)
        rgb=(np.clip((np.nan_to_num(rgb)-low)/(high-low+1e-6),0,1)*255).astype(np.uint8)
        rgb=np.dstack([rgb,np.full((128,128),255,dtype=np.uint8)])
        overlay=np.zeros((128,128,4),dtype=np.uint8);overlay[candidate]=[239,68,68,180]
        bounds=transform_bounds(crs,'EPSG:4326',x-640,y-640,x+640,y+640)
        job['images']={'rgb':geographic_png(rgb,crs,transform,bounds),'mask':geographic_png(overlay,crs,transform,bounds)}
        job.update(state='COMPLETE',progress='Detection complete',result={
            'scene_id':scene['id'],'acquired_at':scene['properties']['datetime'],'tile_cloud_pct':scene['properties'].get('eo:cloud_cover'),
            'latitude':latitude,'longitude':longitude,'bounds':[[bounds[1],bounds[0]],[bounds[3],bounds[2]]],
            'pixel_size_m':10,'patch_size_m':1280,'valid_pixels':int(valid.sum()),'candidate_pixels':int(candidate.sum()),
            'candidate_area_m2':int(candidate.sum())*100,'candidate_pct':round(100*float(candidate.sum())/int(valid.sum()),2),
            'mean_slope_deg':round(float(np.nanmean(slope)),2),'mean_elevation_m':round(float(np.nanmean(dem)),1),
            'threshold':.35,'model':'Original Sentinel/Landslide4Sense ResUNet · 14 channels',
            'channels':['B01','B02','B03','B04','B05','B06','B07','B08','B09','B10','B11','B12','slope','DEM'],
            'cloud_mask':cloud_status,'terrain_source':'Copernicus GLO-30 elevation; slope derived in metres',
            'limitations':'Research segmentation candidates, not confirmed landslides. Terrain source differs from training ALOS; site validation required.',
            'scene_url':f'{CATALOG}/collections/sentinel-2-l2a/items/{scene["id"]}',
            'rgb_url':f'/api/v1/sentinel/jobs/{job_id}/image/rgb','mask_url':f'/api/v1/sentinel/jobs/{job_id}/image/mask'})
    except Exception as exc:
        detail=str(exc).splitlines()[0][:240]
        job.update(state='FAILED',progress=detail if isinstance(exc,ValueError) else f'Upstream raster/model operation failed ({type(exc).__name__}): {detail}')
        import logging;logging.getLogger(__name__).exception('Sentinel detection failed')


@router.post('/detect')
def detect(request:DetectionRequest):
    if any(j['state'] not in ('COMPLETE','FAILED') for j in JOBS.values()):
        raise HTTPException(409,'A Sentinel detection is already running')
    if len(JOBS)>=8:JOBS.pop(next(iter(JOBS)))
    job_id=str(uuid.uuid4());JOBS[job_id]={'job_id':job_id,'state':'QUEUED','progress':'Queued'}
    EXECUTOR.submit(run,job_id,request.latitude,request.longitude)
    return JOBS[job_id]


@router.get('/jobs/{job_id}')
def job(job_id:str):
    if job_id not in JOBS:raise HTTPException(404,'Job not found')
    return {key:value for key,value in JOBS[job_id].items() if key!='images'}


@router.get('/jobs/{job_id}/image/{kind}')
def image(job_id:str,kind:str):
    from fastapi import Response
    value=JOBS.get(job_id,{}).get('images',{}).get(kind)
    if value is None:raise HTTPException(404,'Image unavailable')
    return Response(content=value,media_type='image/png',headers={'Cache-Control':'no-store'})
