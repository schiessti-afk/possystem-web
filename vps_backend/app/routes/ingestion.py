"""POS ingestion endpoint.

Receives batches drained from a register's sync_outbox by
possystem's app/sync_worker.py:

    POST /api/v1/sync/events
    Authorization: Bearer <API_BEARER_TOKEN>   (== POS_API_TOKEN on the POS)
    {"events": [...]}

The worker marks its outbox rows synced on HTTP 200 only, so this
endpoint must return 200 whenever the batch is safely durably handled.
Idempotency comes from the event_id primary key + ON CONFLICT DO
NOTHING: retried batches are harmless and never double-count.
"""
import json
import secrets
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, status

from app.config import settings
from app.database import get_pool
from app.models import BatchSyncPayload, SyncResponse

router = APIRouter(prefix="/api/v1/sync", tags=["Ingestion"])

_INSERT_BATCH = """
WITH expanded AS (
    SELECT *
    FROM unnest(
        $1::varchar[], $2::varchar[], $3::timestamptz[],
        $4::varchar[], $5::varchar[], $6::text[]
    ) AS t(event_id, event_type, occurred_at,
           user_id, register_id, data_json)
),
inserted AS (
    INSERT INTO events (event_id, event_type, occurred_at,
                        user_id, register_id, data)
    SELECT event_id, event_type, occurred_at,
           user_id, register_id, data_json::jsonb
    FROM expanded
    ON CONFLICT (event_id) DO NOTHING
    RETURNING 1
)
SELECT count(*) FROM inserted;
"""


@router.post("/events", response_model=SyncResponse)
async def receive_events(
    payload: BatchSyncPayload,
    authorization: Optional[str] = Header(default=None),
) -> SyncResponse:
    # Timing-safe comparison; the worker sends exactly "Bearer <token>".
    expected = f"Bearer {settings.API_BEARER_TOKEN}"
    if not authorization or not secrets.compare_digest(authorization, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing sync token",
        )

    if len(payload.events) > settings.MAX_BATCH_EVENTS:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Batch too large (max {settings.MAX_BATCH_EVENTS} events)",
        )

    if not payload.events:
        return SyncResponse(received=0, new_events=0)

    events = payload.events
    event_ids = [e.event_id for e in events]
    event_types = [e.event_type for e in events]
    occurred = [e.normalized_occurred_at() for e in events]
    user_ids = [e.user_id for e in events]
    register_ids = [e.register_id for e in events]
    data_json = [json.dumps(e.data) for e in events]

    pool = get_pool()
    async with pool.acquire() as conn:
        # Payloads travel as text[] and are cast to jsonb server-side,
        # so the connection's jsonb codec (used for query *results*)
        # never re-encodes inbound values.
        new_events = await conn.fetchval(
            _INSERT_BATCH,
            event_ids,
            event_types,
            occurred,
            user_ids,
            register_ids,
            data_json,
        )

    return SyncResponse(
        received=len(events),
        new_events=int(new_events or 0),
    )
