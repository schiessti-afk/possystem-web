"""End-to-end smoke test against a running backend.

Stdlib-only. Sends one synthetic shift's worth of events exactly the
way possystem's sync worker would, then reads the dashboard endpoints.

Usage:
    python scripts/smoke_test.py https://your-vps.com <SYNC_TOKEN> <DASH_KEY>
        [ADMIN_USER ADMIN_PASS]
"""
import json
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from uuid import uuid4


def call(url: str, token: str, path: str, body=None, header_name="Authorization"):
    headers = {"Content-Type": "application/json"}
    if token:
        if header_name == "Authorization":
            headers["Authorization"] = f"Bearer {token}"
        else:  # X-API-Key
            headers[header_name] = token
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url.rstrip("/") + path, data=data, headers=headers)
    with urllib.request.urlopen(req, timeout=10) as resp:
        return resp.status, json.loads(resp.read().decode())


def main() -> int:
    base, sync_token, dash_key = sys.argv[1], sys.argv[2], sys.argv[3]
    admin_user = sys.argv[4] if len(sys.argv) > 4 else None
    admin_pass = sys.argv[5] if len(sys.argv) > 5 else None
    now = datetime.now(timezone.utc)
    session = f"smoke_{uuid4().hex[:12]}"

    def ev(etype, offset_s, user, data):
        return {
            "event_id": uuid4().hex,
            "event_type": etype,
            "occurred_at": (now + timedelta(seconds=offset_s)).isoformat(),
            "user_id": user,
            "register_id": "reg_smoke_01",
            "data": data,
        }

    batch = {
        "events": [
            ev("REGISTER_OPENED", 0, "user_smoke",
               {"session_id": session, "opening_float": 100.0}),
            ev("SALE", 10, "user_smoke",
               {"transaction_id": f"tx_{uuid4().hex[:16]}", "session_id": session,
                "gross_amount": 25.5, "payment_method": "cash"}),
            ev("SALE", 20, "user_smoke",
               {"transaction_id": f"tx_{uuid4().hex[:16]}", "session_id": session,
                "gross_amount": 40.0, "payment_method": "pix"}),
        ]
    }
    cash_tx = batch["events"][1]["data"]["transaction_id"]

    status_, body = call(base, sync_token, "/api/v1/sync/events", batch)
    print(f"sync -> {status_} {body}")
    assert status_ == 200, "sync failed"

    status_, body = call(base, sync_token, "/api/v1/sync/events", batch)
    print(f"sync replay -> {status_} {body}  (new_events must be 0)")
    assert status_ == 200 and body.get("new_events") == 0, "idempotency failed"

    status_, body = call(base, dash_key, "/api/v1/dashboard/summary",
                         header_name="X-API-Key")
    print(f"summary -> {status_} {json.dumps(body, indent=2)}")

    status_, body = call(base, dash_key, "/api/v1/dashboard/shifts?limit=3",
                         header_name="X-API-Key")
    print(f"shifts -> {status_} {json.dumps(body[:1], indent=2)}")

    try:
        call(base, "", "/api/v1/dashboard/summary")
        print("FAIL: dashboard accessible without key!")
        return 1
    except urllib.error.HTTPError as e:
        print(f"dashboard without key -> HTTP {e.code} (expected 401) OK")

    if admin_user and admin_pass:
        # Admin login flow: bad password rejected, good one issues a
        # bearer session accepted by the dashboard routes.
        try:
            call(base, admin_user, "/api/v1/auth/login",
                 {"username": admin_user, "password": "definitely-wrong"})
            print("FAIL: login accepted a wrong password!")
            return 1
        except urllib.error.HTTPError as e:
            print(f"login wrong password -> HTTP {e.code} (expected 401) OK")

        status_, body = call(base, "", "/api/v1/auth/login",
                             {"username": admin_user, "password": admin_pass})
        print(f"login -> {status_}")
        assert status_ == 200 and body.get("access_token"), "admin login failed"

        token = body["access_token"]
        headers = {"Content-Type": "application/json",
                   "Authorization": f"Bearer {token}"}
        req = urllib.request.Request(base.rstrip("/") + "/api/v1/dashboard/summary",
                                     headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            print(f"summary via Bearer session -> {resp.status} "
                  "(expected 200) OK")
            assert resp.status == 200

    print("cash refund check: send REFUND for cash_tx to see the drawer drop.")
    _ = cash_tx
    print("SMOKE TEST PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
