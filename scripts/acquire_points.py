"""Acquire independent source layers and preserve the newest successful record per site."""
import json
import math
import os
import re
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import requests
from persiann import sample_daily

ROOT = Path(__file__).resolve().parents[1]
STATIONS = json.loads((ROOT / 'frontend/src/services/stations.json').read_text())
OUTPUT = ROOT / 'frontend/public/point-snapshot.json'
SITE = 'https://geospacial-computing.vercel.app'
UTC = timezone.utc


def checked(url, **kwargs):
    response = requests.request(kwargs.pop('method', 'GET'), url, timeout=kwargs.pop('timeout', 40), **kwargs)
    response.raise_for_status()
    return response


def keep(row, layer, value, stamp):
    old = row.get(layer)
    if not old or value[stamp] >= old[stamp]:
        row[layer] = value


def weather(batch, rows):
    data = checked('https://api.open-meteo.com/v1/forecast', params={
        'latitude': ','.join(str(s['latitude']) for s in batch),
        'longitude': ','.join(str(s['longitude']) for s in batch),
        'hourly': 'precipitation,soil_moisture_0_to_1cm', 'past_days': 7,
        'forecast_days': 1, 'timezone': 'GMT', 'timeformat': 'unixtime',
    }).json()
    if isinstance(data, dict):
        data = [data]
    if len(data) != len(batch):
        raise ValueError('Incomplete station response')
    for index, (site, raw) in enumerate(zip(batch, data)):
        if raw.get('location_id', index) != index:
            raise ValueError('Unexpected station order')
        h = raw['hourly']
        end = max(i for i,t in enumerate(h['time']) if t <= datetime.now(UTC).timestamp())
        rain = h['precipitation'][end-167:end+1]
        times = h['time'][end-167:end+1]
        moisture = h['soil_moisture_0_to_1cm'][end]
        if (len(rain) != 168 or any(b-a != 3600 for a,b in zip(times,times[1:]))
            or any(v is None or not math.isfinite(v) or v < 0 for v in rain)
            or moisture is None or not 0 <= moisture <= 1):
            continue
        stamp = datetime.fromtimestamp(times[-1], UTC).isoformat()
        value = dict(last_updated=stamp, soil_moisture=round(moisture*100,2),
            rain_24h_obs=round(sum(rain[-24:]),2), rain_48h_prior=round(sum(rain[-48:]),2),
            rain_72h_prior=round(sum(rain[-72:]),2), rain_7d_prior=round(sum(rain),2),
            api_7d=round(sum(p*0.84**(i//24) for i,p in enumerate(reversed(rain))),2))
        keep(rows[site['id']], 'weather', value, 'last_updated')


def raster(rows):
    import h5py
    import numpy as np
    auth = {k:os.environ.get('MOSDAC_'+k.upper()) for k in ('username','password')}
    if not all(auth.values()):
        return 'Awaiting MOSDAC download credentials'
    latest = checked(SITE+'/api/v1/mosdac/latest').json()
    name = latest.get('filename') or ''
    match = re.fullmatch(r'3RIMG_(\d{2}[A-Z]{3}\d{4}_\d{4})_L2B_HEM_.*\.h5', name)
    if not match or not latest.get('record_id'):
        return 'No HEM granule available'
    stamp = datetime.strptime(match[1], '%d%b%Y_%H%M').replace(tzinfo=UTC).isoformat()
    if all(r.get('hem',{}).get('acquired_at','') >= stamp for r in rows.values()):
        return 'Latest raster already sampled'
    token = checked('https://mosdac.gov.in/download_api/gettoken', method='POST', json=auth).json()['access_token']
    with tempfile.TemporaryFile() as tmp:
        with checked('https://mosdac.gov.in/download_api/download', params={'id':latest['record_id']},
                     headers={'Authorization':'Bearer '+token}, stream=True,timeout=90) as response:
            for chunk in response.iter_content(262144):
                tmp.write(chunk)
        tmp.seek(0)
        with h5py.File(tmp,'r') as f:
            def grid(name):
                d = f[name]
                a = np.squeeze(d[...]).astype(float)
                for key in ('_FillValue','FillValue','missing_value'):
                    if key in d.attrs: a[a == np.asarray(d.attrs[key]).item()] = np.nan
                return a * float(np.asarray(d.attrs.get('scale_factor',1)).item()) + float(np.asarray(d.attrs.get('add_offset',0)).item())
            lat,lon,rain = [grid(k) for k in ('Latitude','Longitude','HEM')]
            units = np.asarray(f['HEM'].attrs.get('units','')).item()
            if isinstance(units,bytes): units = units.decode()
            if not units or lat.shape != lon.shape or lat.shape != rain.shape: raise ValueError('Unsupported HEM grid')
            for site in STATIONS:
                dist = (lat-site['latitude'])**2 + ((lon-site['longitude'])*math.cos(math.radians(site['latitude'])))**2
                idx = np.unravel_index(np.nanargmin(dist),dist.shape)
                if dist[idx] > .15**2 or not np.isfinite(rain[idx]) or rain[idx]<0: continue
                keep(rows[site['id']], 'hem', dict(acquired_at=stamp,filename=name,value=float(rain[idx]),units=units),'acquired_at')
    return 'Sampled available raster pixels'


def main():
    snapshot = json.loads(OUTPUT.read_text()) if OUTPUT.exists() else {'points':{}}
    rows = snapshot['points']
    for site in STATIONS: rows.setdefault(site['id'],{})
    status = {}
    for i in range(0,len(STATIONS),10):
        try: weather(STATIONS[i:i+10],rows)
        except (requests.RequestException,ValueError,KeyError) as exc: status['weather']='Partial or unavailable: '+type(exc).__name__
    status.setdefault('weather','Weather acquisition checked')
    try: status['persiann']=sample_daily(rows, STATIONS, checked, keep)
    except Exception as exc: status['persiann']='Satellite update failed: '+type(exc).__name__
    try: status['hem']=raster(rows)
    except Exception as exc: status['hem']='Raster acquisition failed: '+type(exc).__name__
    site = min(STATIONS, key=lambda s: rows[s['id']].get('screen_checked_at',''))
    row = rows[site['id']]
    try:
        job = checked(SITE+'/api/v1/sentinel/detect', method='POST', json={k:site[k] for k in ('latitude','longitude')},timeout=310).json()
        if job['state']=='COMPLETE':
            result=job['result']
            keep(row,'sentinel',{k:result[k] for k in ('scene_id','acquired_at','mean_slope_deg','mean_elevation_m','valid_pixels','candidate_pixels','candidate_pct','bounds','scene_url')},'acquired_at')
        row['screen_status']=job['state']
    except requests.RequestException: row['screen_status']='Source unavailable'
    row['screen_checked_at']=datetime.now(UTC).isoformat()
    snapshot.update(checked_at=row['screen_checked_at'], status=status)
    temp=OUTPUT.with_suffix('.tmp')
    temp.write_text(json.dumps(snapshot,indent=1,allow_nan=False)+'\n')
    temp.replace(OUTPUT)
    print('Weather snapshots:',sum('weather' in r for r in rows.values()),'of',len(rows),status,site['name'],row['screen_status'])

if __name__=='__main__': main()
