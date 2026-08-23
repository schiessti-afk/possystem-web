"""Admin authentication: login endpoint + session validation helpers.

POST /api/v1/auth/login exchanges an admin username/password (created
by scripts/onboard.py) for an opaque bearer session token. Tokens are
stored as SHA-256 digests with an expiry and can be revoked by deleting
the row.

The dashboard routes accept EITHER the static X-API-Key (backward
compatible, server-to-server) OR "Authorization: Bearer <session>" from
this flow.
"""
import asyncio
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, status

from app.config import settings
from app.database import get_pool
from app.models import LoginRequest, TokenResponse
from app.security import hash_password, hash_token, new_session_token, verify_password

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])

# Computed once; used to equalize response time for unknown usernames.
_DUMMY_HASH: Optional[str] = None


def _dummy_hash() -> str:
    global _DUMMY_HASH
    if _DUMMY_HASH is None:
        _DUMMY_HASH = hash_password("timing-equalizer")
    return _DUMMY_HASH


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest) -> TokenResponse:
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT password_hash FROM admin_users WHERE username = $1",
            payload.username,
        )

        stored = row["password_hash"] if row else None
        ok = verify_password(payload.password, stored) if stored else False
        if not ok:
            if not stored:
                # Unknown user: burn the same scrypt cost anyway.
                verify_password(payload.password, _dummy_hash())
            # Blunt brute-force damping.
            await asyncio.sleep(0.4)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )

        raw_token, token_hash = new_session_token()
        expires_at = datetime.now(timezone.utc) + timedelta(
            hours=settings.SESSION_TTL_HOURS
        )
        await conn.execute("DELETE FROM sessions WHERE expires_at < NOW()")
        await conn.execute(
            "INSERT INTO sessions (token_hash, expires_at) VALUES ($1, $2)",
            token_hash,
            expires_at,
        )

    return TokenResponse(access_token=raw_token, expires_at=expires_at)


async def session_is_valid(raw_token: str) -> bool:
    """Check a bearer token against the sessions table."""
    pool = get_pool()
    async with pool.acquire() as conn:
        found = await conn.fetchval(
            """
            SELECT 1 FROM sessions
            WHERE token_hash = $1 AND expires_at > NOW()
            """,
            hash_token(raw_token),
        )
    return found is not None
