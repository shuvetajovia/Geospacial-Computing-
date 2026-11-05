"""Read live Northeast India INSAT product availability from MOSDAC's catalog API."""

from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, HTTPException

router = APIRouter()
MOSDAC_CATALOG = "https://mosdac.gov.in/apios/datasets.json"
HEM_DATASET = "3RIMG_L2B_HEM"
NE_BBOX = "88,21.5,97.5,29.8"  # minLon,minLat,maxLon,maxLat


@router.get("/latest")
def latest_insat_rainfall():
    now = datetime.now(timezone.utc)
    params = {
        "datasetId": HEM_DATASET,
        "startTime": (now - timedelta(days=1)).date().isoformat(),
        "endTime": now.date().isoformat(),
        "count": "10",
        "boundingBox": NE_BBOX,
    }
    try:
        response = httpx.get(MOSDAC_CATALOG, params=params, timeout=20.0)
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=f"MOSDAC catalog unavailable: {type(exc).__name__}") from exc

    entries = payload.get("entries", [])
    parsed = []
    for entry in entries:
        try:
            updated = datetime.fromisoformat(entry["updated"].replace("Z", "+00:00"))
            parsed.append((updated, entry))
        except (KeyError, ValueError, TypeError):
            continue
    if not parsed:
        return {
            "source": "MOSDAC / INSAT-3DR",
            "dataset_id": HEM_DATASET,
            "product": "Hydro-Estimator rainfall (HEM)",
            "cadence_minutes": 30,
            "coverage": "Northeast India search area",
            "state": "NO_CURRENT_GRANULE",
            "updated_at": None,
            "age_minutes": None,
            "filename": None,
            "download_requires_registered_login": True,
        }

    updated, entry = max(parsed, key=lambda row: row[0])
    age_minutes = max(0.0, (now - updated.astimezone(timezone.utc)).total_seconds() / 60.0)
    return {
        "source": "MOSDAC / INSAT-3DR",
        "dataset_id": HEM_DATASET,
        "product": "Hydro-Estimator rainfall (HEM)",
        "cadence_minutes": 30,
        "coverage": "Northeast India search area",
        "state": "CURRENT" if age_minutes <= 60 else "STALE",
        "updated_at": updated.astimezone(timezone.utc).isoformat(),
        "age_minutes": round(age_minutes, 1),
        "filename": entry.get("identifier"),
        "record_id": entry.get("id"),
        "download_requires_registered_login": True,
        "acquisition_is_georeferenced": True,
        "catalog_is_read_through": True,
    }
