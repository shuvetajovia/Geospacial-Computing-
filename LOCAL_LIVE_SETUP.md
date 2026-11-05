# MindMeld live satellite console

The original MindMeld dashboard and its existing pages remain in place. The additional **Live Satellite** tab is `frontend/src/pages/LiveConsole.tsx`; it reads the MOSDAC product catalog and starts Sentinel-2 screening on demand. Existing backend routes and database behavior remain available to the original pages.

## Run locally

In one PowerShell window from the project folder:

```powershell
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

In another PowerShell window:

```powershell
cd frontend
$env:VITE_API_URL = "http://127.0.0.1:8000"
npm run dev -- --host 127.0.0.1 --port 5173
```

Open `http://localhost:5173/mindmeld/`.

## Live source behavior

- **MOSDAC / INSAT-3DR:** the backend reads `3RIMG_L2B_HEM` catalog metadata for the Northeast bounds when the UI refreshes (every 15 minutes). MOSDAC's product cadence is 30 minutes. The card shows the returned granule timestamp and age. Catalog visibility does not mean the app has downloaded or processed the HDF raster; registered access is required for downloads. No credentials or raster granules are stored by this feature.
- **Sentinel-2:** the detector searches the public Earth Search STAC API on demand. It reads public scene rasters and runs the local 14-channel Sentinel checkpoint when every required input can be read. The current endpoint returns an error instead of a mask if the raster stack is incomplete. This is research screening, not an operational warning.
- **Ground telemetry:** no physical IoT endpoint is configured. The new console does not fabricate live measurements. The original dashboard's existing demo content is unchanged.

The current Sentinel page uses `models/landslide_sentinel_resunet.pt`. The separate ResUNet and BiLSTM checkpoints in `updated v2` are not wired to live inputs by this change: their input pipelines and validated live data mappings are still needed. The original API retains its existing database behavior, so this is not a live-only backend.
