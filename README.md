# POS Remote Web

**Remote observation layer for a local-first point-of-sale.** An idempotent
event-ingestion API on your VPS plus a live owner dashboard — shop activity is
visible from anywhere, while the backend stays structurally incapable of
touching shop operations.

![Python](https://img.shields.io/badge/python-3.12-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-ingestion-009688?logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![Docker Compose](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)

> The register itself lives in the companion repo **`possystem`**
> (offline-first Python/SQLite POS). The two repos share no code and no
> database — only a documented wire contract (below).

## What's inside

```
possystem-web/
├── app/                    # Next.js App Router pages
│   ├── page.tsx            # Overview: metrics, payment split, drawer, activity
│   ├── shifts/page.tsx     # Register shifts with close-out variance chips
│   └── layout.tsx          # Shell (topbar/nav)
├── components/             # MetricCard · PaymentSplit · DrawerPanel · ActivityFeed · AutoRefresh
├── lib/                    # Server-side backend client, wire types, formatters
├── docker-compose.yml      # PostgreSQL 16 + FastAPI backend stack
└── vps_backend/            # Ingestion & analytics service (details in vps_backend/README.md)
    ├── app/routes/         #   ingestion · dashboard · auth
    ├── scripts/onboard.py  #   first-install admin setup
    └── schema.sql          #   events log + admin/session tables
```

**Dashboard** — today's gross/net revenue, refund totals, payment split across
the register's four tenders (cash / debit / credit card / PIX), expected cash
in the currently open drawer, live activity feed, shift history with close-out
variance badges, auto-refresh.

**Backend** — idempotent batch ingestion (`ON CONFLICT DO NOTHING`), on-demand
aggregations computed from an append-only raw event log, admin accounts with
scrypt-hashed passwords and DB-backed bearer sessions, timing-safe auth
everywhere, fully parameterized SQL.

## How the two repos interconnect — and why

`possystem` is the **shop floor**; this repo is the **observation layer**.
Data flows strictly one way:

```
┌───────────────────────── SHOP (possystem) ────────────────────────┐
│ register action: sale / refund / drawer / PIX tender               │
│   └─ ONE SQLite transaction: business row + sync_outbox row        │
│        └─ sync worker drains outbox (batches ≤50, backoff retry)   │
└────────────────────────┬───────────────────────────────────────────┘
                         │ HTTPS POST /api/v1/sync/events
                         │ Authorization: Bearer <shared token>
                         ▼
┌──────────────── THIS REPO (possystem-web) ─────────────────────────┐
│ vps_backend (FastAPI) → append-only events log (PostgreSQL)        │
│     ON CONFLICT (event_id) DO NOTHING  ← retries can't double-count│
│          ▲ read-only aggregates, X-API-Key or admin session        │
│ Next.js dashboard — owner's browser (server-held secrets only)     │
└─────────────────────────────────────────────────────────────────────┘
```

Per business action on the register:

1. The sale/refund/adjustment row **and** its sync event are committed in one
   SQLite transaction (transactional outbox), so a state change and its audit
   trail can never diverge.
2. The register's background worker batches queued events and POSTs them;
   HTTP 200 marks them synced. Any failure keeps them queued with exponential
   backoff — the shop sells straight through outages.
3. The backend stores immutable raw events keyed by ULID; duplicates are
   dropped on conflict, making at-least-once delivery safe.
4. The dashboard renders aggregates fetched **server-side**; browsers never
   hold secrets, and nothing ever flows back toward shops.

Why split into two repos with this shape:

- **One-way trust.** A compromised VPS cannot push prices, void sales, or open
  a drawer — registers accept no inbound instructions at all.
- **Different lifecycles.** Offline-first retail runs stdlib-only Python on
  whatever hardware sits at the till; always-on analytics want Node,
  PostgreSQL and Docker. Separate repos keep runtimes, deployment targets,
  credentials and blast radius apart.
- **Raw event log over pre-aggregates.** New analytics (shift summaries,
  drawer expectations, the four-tender payment split) shipped without touching
  register code, and the log doubles as an off-site audit trail.

| possystem side | this repo side | meaning |
|---|---|---|
| `VPS_SYNC_URL` | `backend` service → `/api/v1/sync/events` | where events go |
| `POS_API_TOKEN` | `API_BEARER_TOKEN` | must be identical |
| `REGISTER_ID` | `events.register_id` column | which till sent what |
| tenders `cash / debit / credit / pix` | `payment_method` buckets in `/summary` | revenue split |
| drawer-gate sangria/suprimento | `CASH_OUT` / `CASH_IN` events | reconciliation trail |

Full wire contract and endpoint reference: [`vps_backend/README.md`](vps_backend/README.md).

## Quickstart

```bash
# 1 · Data plane — PostgreSQL + backend (schema applies itself on first start)
docker compose up --build
#    backend : http://127.0.0.1:8000   (health at /health)
#    postgres: localhost:15432 · pos_user/pos_dev_password · pos_remote_db

# 2 · Dashboard UI
npm install
copy .env.local.example .env.local      # defaults match the compose stack
npm run dev                             # http://localhost:3000

# 3 · First-install onboarding — create the owner admin
cd vps_backend
set DATABASE_URL=postgresql://pos_user:pos_dev_password@localhost:15432/pos_remote_db
python scripts\onboard.py               # prompts username + hidden password
cd ..

# 4 · Feed it data — a real register …
#     (in the possystem checkout:)
#     set VPS_SYNC_URL=http://127.0.0.1:8000/api/v1/sync/events
#     set POS_API_TOKEN=your_secure_bearer_token
#
#     … or a synthetic shift, no POS required:
python vps_backend\scripts\smoke_test.py http://127.0.0.1:8000 ^
       your_secure_bearer_token owner_secure_access_key
```

The smoke test ingests a small shift, replays the batch to prove idempotency
(`new_events: 0`), exercises the admin login flow, and checks that unauthenticated
requests are rejected.

## Configuration

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | backend | asyncpg DSN (compose default: `db:5432` internal) |
| `API_BEARER_TOKEN` | backend **and** register | shared ingestion secret — must match |
| `DASHBOARD_API_KEY` | backend only | server-to-server owner key (`X-API-Key`); the UI does not use it |
| `SESSION_TTL_HOURS` | backend | admin login session lifetime (default 24) |
| `MAX_BATCH_EVENTS` | backend | ingestion batch cap (default 200) |
| `BACKEND_URL` | frontend | backend base URL for server-side fetches |
| `DASHBOARD_ALLOWED_ORIGINS` | backend | CORS origins for direct browser calls |

## Security model

- The dashboard requires a sign-in. `/login` exchanges an admin password for a
  session token kept in an **httpOnly** cookie; `middleware.ts` bounces
  anonymous visitors, and every backend call then carries that token as a
  bearer credential, so a forged cookie is rejected by the backend rather than
  trusted by the UI.
- All backend calls happen inside React **Server Components**
  (`lib/backend.ts`). No key or token is ever sent to the browser — it receives
  rendered HTML and refresh triggers only.
- Admin passwords are scrypt-hashed (stdlib, memory-hard); login issues opaque
  bearer sessions stored only as SHA-256 digests. `--reset` revokes sessions.
- Dev credentials intentionally match possystem defaults so pairing is
  zero-config locally — replace them with strong random values on both sides
  before exposing anything publicly (`python -c "import secrets; print(secrets.token_hex(32))"`).
- Pages are `force-dynamic`: no business data is cached or prerendered.

## Production

<details>
<summary><strong>VPS deployment checklist</strong> (systemd + Caddy)</summary>

1. Upload `vps_backend/`, create a venv, `pip install -r requirements.txt`.
2. Copy `.env.example` → `.env`; generate strong tokens
   (`python -c "import secrets; print(secrets.token_hex(32))"`) and mirror the
   sync token into each register's `POS_API_TOKEN`.
3. Apply schema: `psql "$DATABASE_URL" -f schema.sql`
   (or let `scripts/onboard.py` self-migrate its tables).
4. systemd unit `pos-backend.service`
   (`EnvironmentFile=.env`, `uvicorn main:app --host 127.0.0.1 --port 8000`),
   then Caddy: `your-vps-domain.com { reverse_proxy 127.0.0.1:8000 }`.
5. Run `python scripts/onboard.py` to create the admin account.
6. Deploy this Next.js app (`npm run build && npm start`, or a standalone
   container) with `BACKEND_URL=https://your-vps-domain.com`, then sign in at
   `/login` with the account from step 5.

Full step-by-step: [`vps_backend/README.md`](vps_backend/README.md).

</details>

<details>
<summary><strong>All-in-one VPS stack</strong> (Docker + Caddy + DuckDNS)</summary>

Runs UI, backend and Postgres on a single host with automatic HTTPS. No paid
domain required: a free [DuckDNS](https://www.duckdns.org) subdomain is enough
for Let's Encrypt to issue a certificate.

1. Create the DuckDNS subdomain and point it at the VPS IP.
2. `cp .env.prod.example .env.prod`, then fill in every value
   (`openssl rand -hex 32` for the secrets). Mirror `API_BEARER_TOKEN` into
   each register's `POS_API_TOKEN`.
3. Open ports 80 and 443 in the firewall — and only those.
4. Build and start:

   ```
   docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
   ```

5. Create the admin account — the dashboard is unusable until one exists:
   `docker compose -f docker-compose.prod.yml exec backend python scripts/onboard.py`

Caddy publishes the dashboard at `https://$SITE_DOMAIN` and forwards only
`/api/v1/sync/*` to the backend, so registers can push events while the
analytics endpoints stay on the internal network. `BACKEND_URL` is
`http://backend:8000` — the dashboard API key never crosses the internet.
Back up the `pgdata` volume; it holds the entire event log.

</details>

## Known limits

- Business-day metrics use the database timezone (UTC in the default
  containers) — mind late-night closing times.
- *Expected cash in drawer* reflects the most recent still-open session;
  multi-register shops see the newest one.
- Variance chips: |Δ| ≤ 0.50 balanced · ≤ 2.00 warn · else bad.
