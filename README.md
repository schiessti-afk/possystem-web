# possystem-web

Remote observation layer for the [`possystem`](../possystem) register:

- **`vps_backend/`** — FastAPI + PostgreSQL ingestion/analytics API
  (deployable on a VPS, runnable locally via Docker Compose)
- **root Next.js app** — owner-facing dashboard UI (this folder's
  `app/`, `components/`, `lib/`)

```
possystem-web/
├── app/                    # Next.js App Router pages
│   ├── page.tsx            # Overview: metrics, payment split, drawer, activity
│   ├── shifts/page.tsx     # Register shifts with close-out variance
│   └── layout.tsx          # Shell (topbar/nav)
├── components/             # MetricCard, PaymentSplit, DrawerPanel, ActivityFeed, AutoRefresh…
├── lib/                    # Server-side backend client, types, formatters
├── docker-compose.yml      # PostgreSQL 16 + FastAPI backend stack
└── vps_backend/            # Ingestion & analytics service (see its README)
```

## How the two repos interconnect — and why

`possystem` (the register, in `C:\projects\possystem`) and this repo
(the observation layer) are deliberately separate applications with
opposite network postures. They share no code and no database; the only
coupling is the event contract.

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

1. The sale/refund/adjustment row **and** its sync event are committed
   in one SQLite transaction (transactional outbox), so a state change
   and its audit trail can never diverge.
2. The register's background worker batches queued events and POSTs
   them; HTTP 200 marks them synced. Any failure keeps them queued with
   exponential backoff — the shop sells straight through outages.
3. The backend stores immutable raw events keyed by ULID; duplicates
   are dropped on conflict, making at-least-once delivery safe.
4. The dashboard renders aggregates fetched **server-side**; browsers
   never hold the API key, and nothing ever flows back toward shops.

Why split into two repos with this shape:

- **One-way trust.** Data flows shop → VPS only. A compromised VPS
  cannot push prices, void sales, or open a drawer — registers accept
  no inbound instructions at all.
- **Offline-first retail vs. always-on analytics have different
  needs.** The counter PC runs stdlib-only Python on whatever hardware
  exists at the till; this repo wants Node, PostgreSQL and Docker.
  Separate repos keep runtimes, deployment targets, credentials and
  blast radius apart.
- **Raw event log over pre-aggregates.** New analytics (shift
  summaries, drawer expectations, the four-tender payment split)
  shipped without touching register code, and the log doubles as an
  off-site audit trail.

Pairing points:

| possystem side | this repo side | meaning |
|---|---|---|
| `VPS_SYNC_URL` | `backend` service, `/api/v1/sync/events` | where events go |
| `POS_API_TOKEN` | `API_BEARER_TOKEN` | must be identical |
| `REGISTER_ID` | `events.register_id` column | which till sent what |
| tenders `cash/debit/credit/pix` | `payment_method` buckets in `/summary` | revenue split |
| drawer-gate sangria/suprimento | `CASH_OUT` / `CASH_IN` events | reconciliation trail |

Full wire contract: see `vps_backend/README.md`.

## Quickstart (local, three terminals)

**1. Data plane — PostgreSQL + backend via Docker:**

```bash
docker compose up --build
# backend:  http://127.0.0.1:8000  (health at /health)
# postgres: localhost:15432  pos_user/pos_dev_password  pos_remote_db
```

`vps_backend/schema.sql` is applied automatically on first start.

**2. Dashboard UI:**

```bash
npm install
copy .env.local.example .env.local   # defaults match the compose stack
npm run dev                          # http://localhost:3000
```

**3. Onboard the owner admin (first installation):**

```bash
cd vps_backend
set DATABASE_URL=postgresql://pos_user:pos_dev_password@localhost:15432/pos_remote_db
python scripts\onboard.py            # prompts for admin username + password (hidden)
cd ..
```

The admin logs in via `POST /api/v1/auth/login` and receives a 24h
bearer session accepted by every dashboard endpoint.

**4. Feed it data** — either point a real register at it:

```bash
# in the possystem checkout
set VPS_SYNC_URL=http://127.0.0.1:8000/api/v1/sync/events
set POS_API_TOKEN=your_secure_bearer_token
python main.py
```

…or send a synthetic shift without any POS:

```bash
cd vps_backend
python scripts\smoke_test.py http://127.0.0.1:8000 your_secure_bearer_token owner_secure_access_key
```

The smoke test ingests a small shift, replays the batch to prove
idempotency (`new_events: 0`), and checks dashboard auth.

## Security model

- The dashboard fetches everything inside React **Server Components**
  (`lib/backend.ts`). `DASHBOARD_API_KEY` lives only server-side; the
  browser receives rendered HTML + refresh triggers, never keys.
- Dev credentials intentionally match possystem defaults so pairing is
  zero-config. Before exposing anything publicly, set strong random
  tokens on **both** sides and mirror them.
- Pages are `force-dynamic`; no business data is cached or prerendered.

## Notes & known limits

- Business-day metrics use the database timezone (UTC in the default
  containers). If the shop closes near midnight, keep that in mind.
- "Expected cash in drawer" reflects the most recent still-open session;
  multi-register shops see the newest one.
- Variance chips: |Δ| ≤ 0.50 balanced · ≤ 2.00 warn · else bad.

## Production

Deploy `vps_backend/` per its README (systemd + Caddy), then deploy
this Next.js app (`npm run build && npm start`, or `output: "standalone"`
in a container) with `BACKEND_URL` pointing at the public backend URL
and the production `DASHBOARD_API_KEY`.
