import os
import logging
from contextlib import asynccontextmanager
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.app.core.config import settings
from backend.app.db.session import engine, Base, SessionLocal
from backend.app.services.routing_engine import seed_road_networks
from backend.app.services.realtime_poller import start_realtime_polling_loop, stop_realtime_polling_loop

# API Endpoint Routers
from backend.app.api.v1.endpoints import forecast, routing, alerts, reports, corridors, telemetry
from backend.app.services.sentinel_detection import router as sentinel_router
from backend.app.services.mosdac_feed import router as mosdac_router

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Resolve local paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.join(BASE_DIR, "static")
uploads_dir = os.path.join(STATIC_DIR, "uploads")
os.makedirs(uploads_dir, exist_ok=True)


# Lifespan Context Manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Database Creation
    logger.info("Initializing database schemas...")
    Base.metadata.create_all(bind=engine)

    # 2. Database Seeding
    db = SessionLocal()
    try:
        seed_road_networks(db)
    except Exception as e:
        logger.error(f"Failed database seeding on startup: {str(e)}")
    finally:
        db.close()

    # 3. Start Ingestion Poller Background Worker
    # Set to run weather grid updates every 30 seconds for local demo responsiveness
    polling_task = None  # Satellite detection is manual/on-demand; no simulated background updater.

    yield

    # 4. Shutdown Actions
    logger.info("Stopping telemetry background poller...")
    stop_realtime_polling_loop()
    if polling_task is not None:
        await polling_task


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

# CORS Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Static File System for Uploads
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Bind API Routers
app.include_router(forecast.router, prefix=f"{settings.API_V1_STR}/forecast", tags=["Early Warning Forecast"])
app.include_router(routing.router, prefix=f"{settings.API_V1_STR}/routing", tags=["Safe Dynamic Routing"])
app.include_router(alerts.router, prefix=f"{settings.API_V1_STR}/alerts", tags=["OASIS CAP Alerts"])
app.include_router(reports.router, prefix=f"{settings.API_V1_STR}/reports", tags=["Citizen Crowdsource Blockages"])
app.include_router(corridors.router, prefix=f"{settings.API_V1_STR}/corridors", tags=["NH Corridor Status"])
app.include_router(telemetry.router, prefix=f"{settings.API_V1_STR}/telemetry", tags=["IoT Telemetry Ingestion"])
app.include_router(mosdac_router, prefix=f"{settings.API_V1_STR}/mosdac", tags=["Live MOSDAC INSAT data"])


@app.get("/")
def read_root():
    return {
        "status": "ONLINE",
        "system": settings.PROJECT_NAME,
        "api_documentation": "/docs",
    }


app.include_router(sentinel_router, prefix="/api/v1/sentinel", tags=["Sentinel detection"])
