"""Pydantic schemas for the sync API.

The wire format mirrors exactly what possystem's app/events.py stages
into sync_outbox and what app/sync_worker.py posts:

    {"events": [{"event_id", "event_type", "occurred_at",
                 "user_id", "register_id", "data"}, ...]}
"""
from datetime import datetime, timezone
from typing import Any, Dict, List

from pydantic import BaseModel, Field


class EventItem(BaseModel):
    # ULIDs are 26 chars; column is VARCHAR(32) so allow some headroom.
    event_id: str = Field(min_length=8, max_length=32)
    event_type: str = Field(min_length=1, max_length=32)
    occurred_at: datetime
    user_id: str = Field(min_length=1, max_length=64)
    register_id: str = Field(min_length=1, max_length=64)
    data: Dict[str, Any]

    def normalized_occurred_at(self) -> datetime:
        """asyncpg requires tz-aware datetimes for TIMESTAMPTZ.

        The register always sends ISO-8601 with +00:00, but treat a
        naive timestamp defensively as UTC.
        """
        if self.occurred_at.tzinfo is None:
            return self.occurred_at.replace(tzinfo=timezone.utc)
        return self.occurred_at


class BatchSyncPayload(BaseModel):
    events: List[EventItem]


class SyncResponse(BaseModel):
    status: str = "ok"
    received: int
    new_events: int  # rows actually stored after ON CONFLICT dedup
