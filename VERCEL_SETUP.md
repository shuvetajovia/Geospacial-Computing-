# Vercel catalog API fix

Deploy this repository with Root Directory `frontend` and framework preset Vite.
Leave `VITE_API_URL` unset for the same-origin MOSDAC function. Remove any existing
localhost value, then redeploy: Vite embeds environment variables at build time.

Verify `/api/v1/mosdac/latest` returns JSON, then open the Live Satellite tab.
This endpoint reads the real MOSDAC catalog and returns 502 on upstream failure.
It does not download satellite rasters or fabricate observations.

Vercel provides the MOSDAC catalog, district lookup and synchronous Sentinel screening
endpoints. Forecast, telemetry, reports and routing still require the full Python
backend with a persistent database and storage.
When that full backend is deployed, set `VITE_API_URL` to its HTTPS origin and
redeploy. It already implements the MOSDAC endpoint too.

## Sentinel screening on Vercel

`frontend/api/v1/sentinel/detect.py` processes one POST with latitude/longitude.
It uses the supplied 14-channel checkpoint packed for NumPy inference;
`scripts/export_sentinel_numpy.py` verifies outputs against the original PyTorch model.
Run `python -m unittest discover -s tests -v` from frontend to check the adapter.
Runtime dependencies are pinned in frontend/requirements.txt for Python 3.14.
The function returns COMPLETE or FAILED in the same request, with inline PNGs,
so no background worker or in-memory job persistence is required. The duration
limit is 300 seconds; unavailable bands/cloud mask/terrain withhold inference.
Raster reading, normalization and threshold match the existing research pipeline;
Numerical parity is a packaging check, not scientific or field validation.

District lookup uses administrative level 5. On upstream failure the UI loads
132 reference districts across eight states, with visible source/date/limitations
and ODbL attribution. Those coordinates are approximate bounding-box midpoints.

