# Vercel catalog API fix

Deploy this repository with Root Directory `frontend` and framework preset Vite.
Leave `VITE_API_URL` unset for the same-origin MOSDAC function. Remove any existing
localhost value, then redeploy: Vite embeds environment variables at build time.

Verify `/api/v1/mosdac/latest` returns JSON, then open the Live Satellite tab.
This endpoint reads the real MOSDAC catalog and returns 502 on upstream failure.
It does not download satellite rasters or fabricate observations.

Only the MOSDAC catalog endpoint is provided by this Vercel deployment. The Python
forecast, telemetry, reports, routing and Sentinel APIs still require a separately
configured backend with its ML dependencies, persistent database and storage.
When that full backend is deployed, set `VITE_API_URL` to its HTTPS origin and
redeploy. It already implements the MOSDAC endpoint too.
