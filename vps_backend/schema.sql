-- Remote observation backend schema (PostgreSQL)
-- Apply with:  psql "$DATABASE_URL" -f schema.sql

-- Raw append-only event log. One row per staged outbox event pushed
-- by a register's sync worker. Never updated, never deleted.
CREATE TABLE IF NOT EXISTS events (
    event_id     VARCHAR(32) PRIMARY KEY,      -- ULID from app/ulids.py
    event_type   VARCHAR(32) NOT NULL,         -- REGISTER_OPENED | SALE | REFUND | CASH_IN | CASH_OUT | REGISTER_CLOSED
    occurred_at  TIMESTAMPTZ NOT NULL,
    received_at  TIMESTAMPTZ DEFAULT NOW(),
    user_id      VARCHAR(64) NOT NULL,
    register_id  VARCHAR(64) NOT NULL,
    data         JSONB NOT NULL
);

-- Indexing for fast dashboard queries and range aggregations
CREATE INDEX IF NOT EXISTS idx_events_timeline ON events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_type     ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_user     ON events(user_id);

-- Session-scoped lookups: every drawer movement carries data->>'session_id'
-- and refunds reference data->>'original_transaction_id' on a SALE event.
CREATE INDEX IF NOT EXISTS idx_events_data_session ON events ((data->>'session_id'));
CREATE INDEX IF NOT EXISTS idx_events_data_tx      ON events ((data->>'transaction_id'));

-- Dashboard admin accounts (created by scripts/onboard.py).
CREATE TABLE IF NOT EXISTS admin_users (
    username      VARCHAR(32) PRIMARY KEY,
    password_hash TEXT NOT NULL,            -- scrypt$N$r$p$salt_hex$hash_hex
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Opaque bearer sessions issued by POST /api/v1/auth/login.
-- Only the SHA-256 digest of each token is stored, so a database leak
-- cannot be replayed against the API.
CREATE TABLE IF NOT EXISTS sessions (
    token_hash CHAR(64) PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

