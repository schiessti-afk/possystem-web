"""POS Remote Sync & Observation API — FastAPI entrypoint.

Run locally:   uvicorn main:app --reload --port 8000
Production is served via systemd + Caddy (see README.md).
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import close_db_pool, get_pool, init_db_pool
from app.routes import auth, dashboard, ingestion

logger = logging.getLogger("pos.backend")


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.using_dev_credentials():
        logger.warning(
            "Running with development credentials! Set API_BEARER_TOKEN and "
            "DASHBOARD_API_KEY to strong random values before exposing this "
            "server publicly."
        )
    await init_db_pool()
    yield
    await close_db_pool()


app = FastAPI(
    title="POS Remote Sync & Observation API",
    description=(
        "Idempotent one-way ingestion of POS event streams plus read-only "
        "analytics. The backend observes shop activity; it can never push "
        "state or alter local register operations."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    # The dashboard authenticates with a header key, not cookies, so
    # credentials are never needed; wildcard origin + allow_credentials
    # would be an invalid/rejected combination by browsers anyway.
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "X-API-Key", "Content-Type"],
)

app.include_router(auth.router)
app.include_router(ingestion.router)
app.include_router(dashboard.router)


@app.get("/health")
async def health_check():
    database = "ok"
    try:
        pool = get_pool()
        await pool.fetchval("SELECT 1")
    except Exception:
        database = "unavailable"
    return {"status": "online", "database": database}
