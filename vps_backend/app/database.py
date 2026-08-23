"""asyncpg connection pool manager with JSONB decoding.

A jsonb type codec is installed on every new connection so query
results return parsed Python objects instead of raw JSON strings —
dashboard endpoints can therefore serialize event payloads directly.
"""
import json
import logging
from typing import Optional

import asyncpg

from app.config import settings

logger = logging.getLogger("pos.backend.db")

pool: Optional[asyncpg.Pool] = None


async def _init_connection(conn: asyncpg.Connection) -> None:
    await conn.set_type_codec(
        "jsonb",
        encoder=json.dumps,
        decoder=json.loads,
        schema="pg_catalog",
    )


async def init_db_pool() -> None:
    global pool
    pool = await asyncpg.create_pool(
        dsn=settings.DATABASE_URL,
        min_size=2,
        max_size=10,
        init=_init_connection,
    )
    logger.info("Database pool ready.")


async def close_db_pool() -> None:
    global pool
    if pool:
        await pool.close()
        pool = None
        logger.info("Database pool closed.")


def get_pool() -> asyncpg.Pool:
    if pool is None:
        raise RuntimeError("Database pool is not initialized")
    return pool
