"""Owner dashboard analytics endpoints.

All routes require the X-API-Key header to equal DASHBOARD_API_KEY.
Read-only by design: nothing here can push state to a register.

Aggregations are computed from the raw event log. The queries rely on
the exact payload contract staged by possystem's app/pos_service.py:

  REGISTER_OPENED  data: session_id, opening_float
  SALE             data: transaction_id, session_id, gross_amount,
                         payment_method ('cash' | 'debit' | 'credit' | 'pix')
  REFUND           data: original_transaction_id, refund_amount, reason
                   (NOTE: no payment_method — cash-ness is resolved by
                    joining back to the original SALE event)
  CASH_IN/OUT      data: adjustment_id, session_id, amount, reason
  REGISTER_CLOSED  data: session_id, counted_cash, expected_cash,
                         variance
                         + Z-report summary since register v1.3
                         (ALL OPTIONAL — older closes lack them):
                         sales_count, refunded_count, tender_totals
                         {method: reais}, cash_in_total, cash_out_total.
                         Amounts arrive as reais with exactly 2 decimals:
                         the register computes in integer cents and
                         converts only at the wire boundary.
"""
import secrets
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status

from app.config import settings
from app.database import get_pool
from app.routes.auth import session_is_valid


async def verify_dashboard_access(
    x_api_key: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
) -> None:
    """Accepts EITHER the static owner key (X-API-Key, server-to-server)
    OR an admin session token ("Authorization: Bearer ...") issued by
    POST /api/v1/auth/login."""
    if x_api_key and secrets.compare_digest(
        x_api_key, settings.DASHBOARD_API_KEY
    ):
        return
    if authorization and authorization.startswith("Bearer "):
        raw_token = authorization[len("Bearer "):].strip()
        if raw_token and await session_is_valid(raw_token):
            return
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid dashboard credentials",
    )


router = APIRouter(
    prefix="/api/v1/dashboard",
    tags=["Dashboard"],
    dependencies=[Depends(verify_dashboard_access)],
)


# ---------------------------------------------------------------- summary

_SUMMARY_METRICS = """
SELECT
    COALESCE(SUM((data->>'gross_amount')::numeric)
        FILTER (WHERE event_type = 'SALE'), 0)                          AS total_revenue,
    COALESCE(SUM((data->>'refund_amount')::numeric)
        FILTER (WHERE event_type = 'REFUND'), 0)                        AS total_refunds,
    COALESCE(SUM((data->>'gross_amount')::numeric)
        FILTER (WHERE event_type = 'SALE'), 0)
    - COALESCE(SUM((data->>'refund_amount')::numeric)
        FILTER (WHERE event_type = 'REFUND'), 0)                        AS net_revenue,
    COUNT(*) FILTER (WHERE event_type = 'SALE')                         AS total_sales_count,
    COALESCE(SUM((data->>'gross_amount')::numeric)
        FILTER (WHERE event_type = 'SALE'
                AND data->>'payment_method' = 'cash'), 0)               AS cash_revenue,
    COALESCE(SUM((data->>'gross_amount')::numeric)
        FILTER (WHERE event_type = 'SALE'
                AND data->>'payment_method' = 'debit'), 0)              AS debit_revenue,
    COALESCE(SUM((data->>'gross_amount')::numeric)
        FILTER (WHERE event_type = 'SALE'
                AND data->>'payment_method' = 'credit'), 0)             AS credit_revenue,
    COALESCE(SUM((data->>'gross_amount')::numeric)
        FILTER (WHERE event_type = 'SALE'
                AND data->>'payment_method' = 'pix'), 0)                AS pix_revenue,
    COUNT(*) FILTER (WHERE event_type = 'REGISTER_OPENED')              AS shifts_opened,
    COUNT(*) FILTER (WHERE event_type = 'REGISTER_CLOSED')              AS shifts_closed,
    MIN(occurred_at) FILTER (WHERE event_type = 'REGISTER_OPENED')      AS first_login_at,
    MAX(occurred_at) FILTER (WHERE event_type = 'REGISTER_CLOSED')      AS last_logout_at
FROM events
WHERE occurred_at::date >= COALESCE($1::date, $2::date, CURRENT_DATE)
  AND occurred_at::date <= COALESCE($2::date, $1::date, CURRENT_DATE);
"""

# Gross revenue for the calendar month we are actually in. Deliberately
# independent of the summary window: the owner wants the running month
# total next to the day (or filtered) figure, not a second copy of it.
_MONTH_REVENUE = """
SELECT COALESCE(SUM((data->>'gross_amount')::numeric)
    FILTER (WHERE event_type = 'SALE'), 0) AS month_revenue
FROM events
WHERE occurred_at >= date_trunc('month', CURRENT_DATE)
  AND occurred_at < date_trunc('month', CURRENT_DATE) + interval '1 month';
"""

# Expected physical cash for the most recent still-open register session.
#
#   float + cash sales of this session + CASH_IN - CASH_OUT
#         - cash refunds that occurred during the shift window
#
# A REFUND event does not carry a payment method, so "cash refund" is
# resolved via EXISTS against the original SALE event's payment_method.
# Refunds are time-scoped (not session-scoped): money refunded during
# the current shift leaves *this* drawer even if it reverses an older
# session's sale. Components use scalar subqueries instead of joins to
# avoid cartesian fan-out between event kinds.
_EXPECTED_CASH = """
WITH open_session AS (
    SELECT e.data->>'session_id'                 AS session_id,
           (e.data->>'opening_float')::numeric   AS opening_float,
           e.occurred_at                         AS opened_at
    FROM events e
    WHERE e.event_type = 'REGISTER_OPENED'
      AND NOT EXISTS (
            SELECT 1
            FROM events ec
            WHERE ec.event_type = 'REGISTER_CLOSED'
              AND ec.data->>'session_id' = e.data->>'session_id')
    ORDER BY e.occurred_at DESC
    LIMIT 1
)
SELECT
    os.session_id                                                        AS open_session_id,
    os.opened_at                                                         AS opened_at,
    os.opening_float
    + (SELECT COALESCE(SUM((s.data->>'gross_amount')::numeric), 0)
       FROM events s
       WHERE s.event_type = 'SALE'
         AND s.data->>'payment_method' = 'cash'
         AND s.data->>'session_id' = os.session_id)
    + (SELECT COALESCE(SUM((i.data->>'amount')::numeric), 0)
       FROM events i
       WHERE i.event_type = 'CASH_IN'
         AND i.data->>'session_id' = os.session_id)
    - (SELECT COALESCE(SUM((o.data->>'amount')::numeric), 0)
       FROM events o
       WHERE o.event_type = 'CASH_OUT'
         AND o.data->>'session_id' = os.session_id)
    - (SELECT COALESCE(SUM((r.data->>'refund_amount')::numeric), 0)
       FROM events r
       WHERE r.event_type = 'REFUND'
         AND r.occurred_at >= os.opened_at
         AND EXISTS (
               SELECT 1 FROM events sa
               WHERE sa.event_type = 'SALE'
                 AND sa.data->>'transaction_id'
                     = r.data->>'original_transaction_id'
                 AND sa.data->>'payment_method' = 'cash'))
                                                                         AS expected_cash_in_drawer
FROM open_session os;
"""


def _parse_date_or_422(date: Optional[str]) -> Optional[datetime.date]:
    """asyncpg's date codec expects datetime.date for a ::date param."""
    if date is None:
        return None
    try:
        return datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="date must be formatted YYYY-MM-DD",
        )


@router.get("/summary")
async def get_summary_metrics(
    date: Optional[str] = None,
    date_from: Optional[str] = Query(None, alias="from"),
    date_to: Optional[str] = Query(None, alias="to"),
):
    """Revenue, refund and payment-split metrics, plus expected cash in
    the currently open drawer.

    The window defaults to today. `from` / `to` (YYYY-MM-DD) widen it to
    an inclusive range — passing only one bounds that side and pins the
    other to the same day. `date` is the legacy single-day alias.
    If `from` and `to` are inverted, they are swapped.

    `month_revenue` always covers the current calendar month, whatever
    the requested window is.
    """
    start = _parse_date_or_422(date_from) or _parse_date_or_422(date)
    end = _parse_date_or_422(date_to) or _parse_date_or_422(date)
    if start and end and start > end:
        start, end = end, start
    pool = get_pool()
    async with pool.acquire() as conn:
        metrics_row = await conn.fetchrow(_SUMMARY_METRICS, start, end)
        month_row = await conn.fetchrow(_MONTH_REVENUE)
        cash_row = await conn.fetchrow(_EXPECTED_CASH)

    metrics = dict(metrics_row) if metrics_row else {}
    metrics["month_revenue"] = month_row["month_revenue"] if month_row else 0
    return {
        "date": date or "today",
        "from": start.isoformat() if start else None,
        "to": end.isoformat() if end else None,
        "metrics": metrics,
        "drawer": {
            "open_session_id": cash_row["open_session_id"] if cash_row else None,
            "opened_at": cash_row["opened_at"] if cash_row else None,
            # None when no session is currently open — distinct from 0.
            "expected_cash_in_drawer": (
                float(cash_row["expected_cash_in_drawer"]) if cash_row else None
            ),
        },
    }


@router.get("/activity")
async def get_recent_activity(
    limit: int = Query(50, ge=1, le=200),
    date_from: Optional[str] = Query(None, alias="from"),
    date_to: Optional[str] = Query(None, alias="to"),
):
    """Most recent stream of business actions across all registers.

    Optional `from` / `to` (YYYY-MM-DD) bound `occurred_at` inclusively.
    If both are set and inverted, they are swapped.
    """
    start = _parse_date_or_422(date_from)
    end = _parse_date_or_422(date_to)
    if start and end and start > end:
        start, end = end, start

    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT event_id, event_type, occurred_at, received_at,
                   user_id, register_id, data
            FROM events
            WHERE ($2::date IS NULL OR occurred_at::date >= $2::date)
              AND ($3::date IS NULL OR occurred_at::date <= $3::date)
            ORDER BY occurred_at DESC
            LIMIT $1;
            """,
            limit,
            start,
            end,
        )
    return [dict(r) for r in rows]


@router.get("/shifts")
async def get_recent_shifts(limit: int = Query(20, ge=1, le=100)):
    """Register sessions reconstructed from OPENED/CLOSED event pairs.

    counted_cash / expected_cash / variance are the values computed on
    the register at closing time — the authoritative close-out record.
    Sessions still open have NULL closing fields.

    When the register closed with v1.3+ firmware, the Z-report summary
    (sales_count, refunded_count, tender_totals, cash_in_total,
    cash_out_total) is included too; older closes return NULL there.
    """
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT o.data->>'session_id'              AS session_id,
                   o.user_id,
                   o.register_id,
                   (o.data->>'opening_float')::numeric AS opening_float,
                   o.occurred_at                       AS opened_at,
                   c.occurred_at                       AS closed_at,
                   (c.data->>'counted_cash')::numeric  AS counted_cash,
                   (c.data->>'expected_cash')::numeric AS expected_cash,
                   (c.data->>'variance')::numeric      AS variance,
                   -- Z-report summary (optional since register v1.3):
                   (c.data->>'sales_count')::int       AS sales_count,
                   (c.data->>'refunded_count')::int    AS refunded_count,
                   c.data->'tender_totals'             AS tender_totals,
                   (c.data->>'cash_in_total')::numeric AS cash_in_total,
                   (c.data->>'cash_out_total')::numeric AS cash_out_total
            FROM events o
            LEFT JOIN events c
                   ON c.event_type = 'REGISTER_CLOSED'
                  AND c.data->>'session_id' = o.data->>'session_id'
            WHERE o.event_type = 'REGISTER_OPENED'
            ORDER BY o.occurred_at DESC
            LIMIT $1;
            """,
            limit,
        )
    return [dict(r) for r in rows]
