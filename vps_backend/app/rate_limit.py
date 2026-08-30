"""In-process rate limiting for the login endpoint.

Brute-force damping lives here rather than at the edge because the two
supported front-ends disagree: nginx has limit_req built in, but Caddy's
rate_limit is a third-party plugin absent from the official image. Enforcing
it in the application covers both, and covers a register or script that
reaches the API directly.

State is a per-key sliding window in memory. That is deliberate: a single
uvicorn process serves this backend, so there is nothing to share, and a
restart clearing the counters is an acceptable trade for having no Redis.
If this ever runs multi-worker, move the window into Postgres.
"""
import time
from collections import OrderedDict, deque
from typing import Deque, Optional

from fastapi import Request

# Bound the table so a flood of distinct source IPs cannot grow it without
# limit; the oldest key is evicted, and an attacker cannot cheaply evict their
# own entry without also giving up their attempts.
_MAX_KEYS = 4096

_hits: "OrderedDict[str, Deque[float]]" = OrderedDict()


def client_key(request: Request) -> str:
    """Identify the caller for rate-limiting purposes.

    Behind a reverse proxy, X-Forwarded-For ends with the address the proxy
    itself observed, so the RIGHTMOST entry is the one value a client cannot
    forge — anything it sends arrives to the left of it. Falls back to the
    socket peer when the header is absent (direct connection).
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        parts = [p.strip() for p in forwarded.split(",") if p.strip()]
        if parts:
            return parts[-1]
    return request.client.host if request.client else "unknown"


def _window(key: str, now: float, period: float) -> Deque[float]:
    hits = _hits.get(key)
    if hits is None:
        hits = deque()
        _hits[key] = hits
        if len(_hits) > _MAX_KEYS:
            _hits.popitem(last=False)
    while hits and now - hits[0] >= period:
        hits.popleft()
    return hits


def retry_after(key: str, limit: int, period: float) -> Optional[int]:
    """Seconds the caller must wait, or None when it is under the limit.

    Read-only: call record() to actually spend an attempt.
    """
    now = time.monotonic()
    hits = _window(key, now, period)
    if len(hits) < limit:
        return None
    return max(1, int(period - (now - hits[0])) + 1)


def record(key: str) -> None:
    """Charge one attempt against the key's window."""
    now = time.monotonic()
    _hits.setdefault(key, deque()).append(now)
    _hits.move_to_end(key)


def reset(key: str) -> None:
    """Forget a key's history — called after a successful login so a busy
    admin is never locked out by their own earlier typos."""
    _hits.pop(key, None)
