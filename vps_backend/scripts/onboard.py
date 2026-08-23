#!/usr/bin/env python3
"""First-install onboarding: create the dashboard admin account.

Interactive by design — run it once right after deploying:

    # against the Docker stack from the host:
    DATABASE_URL=postgresql://pos_user:pos_dev_password@localhost:15432/pos_remote_db \
        python scripts/onboard.py

    # from inside the running backend container:
    docker compose exec backend python scripts/onboard.py

You will be prompted for a username and password; the password is
hashed with scrypt and only the hash is stored.

Automation flags (skip all prompts):
    python scripts/onboard.py --username owner --password-env ADMIN_PW
    python scripts/onboard.py --reset            # replace existing admin(s)
"""
import argparse
import asyncio
import getpass
import os
import re
import sys
from pathlib import Path

# Make `app.*` importable no matter where the script is invoked from.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

USERNAME_RE = re.compile(r"^[A-Za-z0-9_.-]{3,32}$")
MIN_PASSWORD_LEN = 8

ENSURE_SCHEMA = """
CREATE TABLE IF NOT EXISTS admin_users (
    username      VARCHAR(32) PRIMARY KEY,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS sessions (
    token_hash CHAR(64) PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);
"""


def prompt_username(existing_hint=None) -> str:
    while True:
        default = f" [{existing_hint}]" if existing_hint else ""
        raw = input(f"Admin username{default}: ").strip() or (existing_hint or "")
        if USERNAME_RE.match(raw):
            return raw
        print("  ! Use 3-32 characters: letters, digits, dot, dash, underscore.")


def prompt_password() -> str:
    while True:
        pw1 = getpass.getpass("Admin password (input hidden): ")
        if len(pw1) < MIN_PASSWORD_LEN:
            print(f"  ! Minimum {MIN_PASSWORD_LEN} characters.")
            continue
        pw2 = getpass.getpass("Confirm password: ")
        if pw1 == pw2:
            return pw1
        print("  ! Passwords do not match, try again.")


async def run(args) -> int:
    # Imported lazily so `--help` works even without env configured.
    import asyncpg

    from app.config import settings
    from app.security import hash_password

    dsn = args.database_url or settings.DATABASE_URL
    try:
        conn = await asyncpg.connect(dsn, timeout=10)
    except Exception as exc:
        print(f"Cannot reach PostgreSQL ({exc.__class__.__name__}).")
        print("Is the stack up?  ->  docker compose up -d")
        print(f"Tried DSN host: {dsn.split('@')[-1]}")
        return 2

    try:
        await conn.execute(ENSURE_SCHEMA)

        existing = await conn.fetch(
            "SELECT username, created_at FROM admin_users ORDER BY created_at"
        )

        print()
        if existing:
            names = ", ".join(r["username"] for r in existing)
            print(f"Existing admin account(s): {names}")
            if not args.reset:
                print("Nothing to do. Re-run with --reset to set a new password.")
                return 0
        else:
            print("No admin account found — first-install onboarding.")

        # Resolve credentials: flags first, then prompts.
        username = args.username
        if args.password_env:
            password = os.environ.get(args.password_env, "")
            if not password:
                print(f"Environment variable {args.password_env} is empty.")
                return 2
        else:
            password = None  # prompted below (interactive mode only)

        if not username:
            if args.password_env:
                print("--password-env requires --username in non-interactive mode.")
                return 2
            hint = existing[0]["username"] if existing else None
            username = prompt_username(hint)
            password = prompt_password()
        elif not password:
            password = prompt_password()

        if not USERNAME_RE.match(username):
            print("Invalid username (3-32 chars: letters, digits, ., -, _).")
            return 2
        if len(password) < MIN_PASSWORD_LEN:
            print(f"Password must be at least {MIN_PASSWORD_LEN} characters.")
            return 2

        pw_hash = hash_password(password)
        await conn.execute(
            """
            INSERT INTO admin_users (username, password_hash)
            VALUES ($1, $2)
            ON CONFLICT (username) DO UPDATE
                SET password_hash = EXCLUDED.password_hash,
                    updated_at = NOW()
            """,
            username,
            pw_hash,
        )
        if args.reset:
            # A reset revokes every issued session: start clean.
            await conn.execute("DELETE FROM sessions")

        print()
        print(f"Admin ready: {username}")
        print(f"Login endpoint : POST /api/v1/auth/login "
              f"(session TTL {settings.SESSION_TTL_HOURS}h)")
        print("Try it:")
        print("  curl -X POST <base-url>/api/v1/auth/login "
              '-H "Content-Type: application/json" '
              '-d \'{"username": "<name>", "password": "<pw>"}\'')
        return 0
    finally:
        await conn.close()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="First-install onboarding for the POS remote dashboard."
    )
    parser.add_argument(
        "--username",
        help="admin username (skips the interactive prompt)",
    )
    parser.add_argument(
        "--password-env",
        help="read the password from this environment variable instead of prompting",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="allow replacing an existing admin's password; also revokes all sessions",
    )
    parser.add_argument(
        "--database-url",
        default=os.getenv("DATABASE_URL"),
        help="override the PostgreSQL DSN (defaults to DATABASE_URL / .env)",
    )
    args = parser.parse_args()

    if args.password_env and not args.username and sys.stdin.isatty():
        print("--password-env requires --username.")
        return 2

    try:
        return asyncio.run(run(args))
    except KeyboardInterrupt:
        print("\nAborted.")
        return 130


if __name__ == "__main__":
    sys.exit(main())
