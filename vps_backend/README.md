# POS Remote Sync & Observation API (vps_backend)

Remote observation backend for the `possystem` register. Receives the
one-way event stream that each register's sync worker drains from its
SQLite `sync_outbox`, stores it in PostgreSQL, and serves read-only
analytics for the owner's dashboard.

**Zero modification power:** the backend can never push state to a
shop; registers only ever POST events outbound.

---

## Event contract (as implemented by possystem)

Source of truth: `possystem/app/events.py`, `app/pos_service.py`,
`app/sync_worker.py`.

Transport: `POST /api/v1/sync/events` with
`Authorization: Bearer <API_BEARER_TOKEN>` (the POS sends its
`POS_API_TOKEN`; the two must be identical), body
`{"events": [...]}`, batches of up to 50 (`SYNC_BATCH_SIZE`). HTTP 200
marks outbox rows synced — so always return 200 once durably handled.

| event_type | data keys |
|---|---|
| `REGISTER_OPENED` | `session_id`, `opening_float` |
| `SALE` | `transaction_id`, `session_id`, `gross_amount`, `payment_method` (`cash`/`card`/`other`) |
| `REFUND` | `original_transaction_id`, `refund_amount`, `reason` — **no payment_method** |
| `CASH_IN` / `CASH_OUT` | `adjustment_id`, `session_id`, `amount`, `reason` |
| `REGISTER_CLOSED` | `session_id`, `counted_cash`, `expected_cash`, `variance` |

Envelope per event: `event_id` (ULID), `event_type`, `occurred_at`
(ISO-8601 UTC), `user_id`, `register_id`, `data`.

Idempotency: `events.event_id` is the primary key and ingestion uses
`ON CONFLICT (event_id) DO NOTHING`, so retried batches are harmless.
The response reports both `received` and `new_events` (post-dedup).

## Deviations from the original blueprint (all deliberate)

1. **SQL injection removed.** The blueprint interpolated the `date`
   query parameter into SQL (`f"'{date}'::date"`). All queries are now
   fully parameterized (`COALESCE($1::date, CURRENT_DATE)`).
2. **Dashboard auth is actually enforced.** The blueprint defined
   `verify_dashboard_access()` but never wired it up. It is now a
   router-level dependency on every `/api/v1/dashboard/*` route, with a
   timing-safe comparison (`secrets.compare_digest`).
3. **Cash-drawer math fixed for real payloads.** The blueprint
   subtracted cash refunds via `data->>'payment_method' = 'cash'` on
   REFUND events — but REFUND events carry no payment method, so that
   branch could never fire. We join back to the original SALE event via
   `original_transaction_id = transaction_id`. Drawer movements are
   session-scoped (`data->>'session_id'`); refunds are time-scoped to
   the shift window because money refunded *now* leaves *this* drawer.
   The blueprint's `CROSS JOIN ... WHERE occurred_at >=` also fanned
   out rows across concurrent sessions; components are scalar
   subqueries instead.
4. **JSONB decoded server-side.** A jsonb codec is installed per
   connection, so `/activity` returns payload objects, not strings.
5. **Payment split includes `other`.** The POS allows it; the blueprint
   only summed cash/card.
6. **Shift summaries added** (`GET /shifts`) using REGISTER_OPENED/
   CLOSED pairs with the register-computed variance.
7. **CORS hardened**: wildcard origin combined with
   `allow_credentials=True` (blueprint) is an invalid browser combo;
   credentials aren't needed since auth is header-based.
8. **Batch cap** (`MAX_BATCH_EVENTS`, default 200) rejects oversized
   bodies with 413 instead of silently accepting unbounded input.

## Layout

```
vps_backend/
├── app/
│   ├── config.py            # pydantic-settings env loader
│   ├── database.py          # asyncpg pool + jsonb codec
│   ├── models.py            # wire schemas (mirror of outbox payloads)
│   └── routes/
│       ├── ingestion.py     # POST /api/v1/sync/events
│       └── dashboard.py     # GET summary | activity | shifts
├── main.py                  # FastAPI app + lifespan pool management
├── schema.sql               # PostgreSQL DDL (incl. data->> indexes)
├── scripts/smoke_test.py    # stdlib end-to-end check
├── requirements.txt
└── .env.example
```

## Endpoints

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /api/v1/sync/events` | Bearer token (POS) | Idempotent batch ingestion |
| `POST /api/v1/auth/login` | none (rate-damped) | Exchange admin credentials for a session token |
| `GET /api/v1/dashboard/summary?date=YYYY-MM-DD` | `X-API-Key` or Bearer session | Daily revenue/refunds/payment split + expected drawer cash |
| `GET /api/v1/dashboard/activity?limit=50` | `X-API-Key` or Bearer session | Latest raw events |
| `GET /api/v1/dashboard/shifts?limit=20` | `X-API-Key` or Bearer session | Register sessions w/ close-out variance |
| `GET /health` | none | Liveness + DB ping |

## Onboarding & admin accounts

On first installation, create the dashboard admin interactively:

```bash
# against the Docker stack from the host (note the 15432 host port):
DATABASE_URL=postgresql://pos_user:pos_dev_password@localhost:15432/pos_remote_db \
    python scripts/onboard.py

# or from inside the running backend container:
docker compose exec backend python scripts/onboard.py
```

The script self-creates its tables (`admin_users`, `sessions`), so it
also upgrades databases initialized before this feature existed.

- Passwords are hashed with **scrypt** (stdlib, memory-hard); only the
  hash is stored.
- `POST /api/v1/auth/login` returns an opaque bearer session
  (`SESSION_TTL_HOURS`, default 24). Only SHA-256 digests of tokens are
  stored, so a DB leak cannot be replayed.
- Dashboard routes accept either credential: the static `X-API-Key`
  (server-to-server, unchanged) or `Authorization: Bearer <session>`.
- Non-interactive / automation:
  `python scripts/onboard.py --username owner --password-env ADMIN_PW`
- Forgot the password? Re-run with `--reset` — it also revokes all
  issued sessions.

### Example

```bash
curl -H "Authorization: Bearer $API_BEARER_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"events":[{"event_id":"01HW...","event_type":"SALE",
          "occurred_at":"2025-01-15T10:00:00+00:00",
          "user_id":"usr_...","register_id":"reg_front_01",
          "data":{"transaction_id":"tx_...","session_id":"ses_...",
                  "gross_amount":19.9,"payment_method":"card"}}]}' \
     https://your-vps.com/api/v1/sync/events
```

## Local development

### Docker (recommended)

From the repo root (`possystem-web/`):

```bash
docker compose up --build
```

This starts PostgreSQL 16 and the API. The schema is applied
automatically on first start; dev credentials match possystem's
defaults so a register pairs with zero config. Then run the smoke test
against it:

```bash
python scripts/smoke_test.py http://127.0.0.1:8000 \
    your_secure_bearer_token owner_secure_access_key
```

### Bare metal

```bash
cd vps_backend
python -m venv venv && venv\Scripts\activate      # Windows
pip install -r requirements.txt
copy .env.example .env                            # fill in values
psql "$DATABASE_URL" -f schema.sql
uvicorn main:app --reload --port 8000
```

Point a scratch register at it:

```bash
# on the possystem side
set VPS_SYNC_URL=http://127.0.0.1:8000/api/v1/sync/events
set POS_API_TOKEN=<same as backend API_BEARER_TOKEN>
python main.py   # sync worker starts with the app
```

Then verify end-to-end: `python scripts/smoke_test.py http://127.0.0.1:8000 <SYNC_TOKEN> <DASH_KEY>`

The app logs a startup warning if either token is still a known dev
default.

## VPS deployment

1. Upload the folder (e.g. `/home/ubuntu/vps_backend`), create venv,
   `pip install -r requirements.txt`, copy `.env.example` → `.env`
   with strong random tokens (`python -c "import secrets; print(secrets.token_hex(32))"`),
   and apply `schema.sql`.
2. systemd unit — `/etc/systemd/system/pos-backend.service`:

```ini
[Unit]
Description=POS Remote Backend FastAPI
After=network.target postgresql.service

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/vps_backend
EnvironmentFile=/home/ubuntu/vps_backend/.env
ExecStart=/home/ubuntu/vps_backend/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable: `sudo systemctl daemon-reload && sudo systemctl enable --now pos-backend`

3. Caddy — `/etc/caddy/Caddyfile`:

```
your-vps-domain.com {
    reverse_proxy 127.0.0.1:8000
}
```

4. Pair the register(s): set `VPS_SYNC_URL=https://your-vps-domain.com/api/v1/sync/events`
   and matching `POS_API_TOKEN`, restart the POS. Outages need no
   attention — unsent batches stay queued in SQLite and retry with
   backoff.
5. Restrict PostgreSQL to localhost, keep automatic backups
   (`pg_dump` cron), and consider Caddy rate limiting / fail2ban on
   `/api/v1/sync/events`.
