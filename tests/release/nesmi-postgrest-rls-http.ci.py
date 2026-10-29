#!/usr/bin/env python3
"""Nesmi release gate: real HTTP/JWT/PostgREST A/B RLS against ephemeral CI only.

The accompanying GitHub Actions job creates a disposable PostgreSQL database,
applies the actual checked-in owner-isolation migration, and runs PostgREST
locally. This test deliberately never reads Supabase env vars or uses a remote URL.
"""
import base64
import hashlib
import hmac
import json
import os
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:3000"
SECRET = b"nesmi-ci-only-postgrest-jwt-secret-32"
A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
A_ROWS = {
    "team_members": "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
    "chores": "aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa",
    "categories": "aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa",
    "chore_completions": "aaaaaaaa-4444-4444-8444-aaaaaaaaaaaa",
    "member_availability": "aaaaaaaa-5555-4555-8555-aaaaaaaaaaaa",
}
B_ROWS = {
    "team_members": "bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb",
    "chores": "bbbbbbbb-3333-4333-8333-bbbbbbbbbbbb",
}
NEW_CHORE = "aaaaaaaa-6666-4666-8666-aaaaaaaaaaaa"


def jwt_for(sub):
    def encoded(value):
        raw = json.dumps(value, separators=(",", ":"), sort_keys=True).encode()
        return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()

    header = encoded({"alg": "HS256", "typ": "JWT"})
    payload = encoded({"role": "authenticated", "sub": sub, "exp": 1893456000})
    content = f"{header}.{payload}".encode()
    signature = base64.urlsafe_b64encode(hmac.new(SECRET, content, hashlib.sha256).digest()).rstrip(b"=").decode()
    return f"{header}.{payload}.{signature}"


def call(method, path, user=None, payload=None, prefer=None):
    headers = {"Accept": "application/json"}
    if user is not None:
        headers["Authorization"] = "Bearer " + jwt_for(user)
    if payload is not None:
        headers["Content-Type"] = "application/json"
    if prefer is not None:
        headers["Prefer"] = prefer
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=12) as r:
            status, body = r.status, r.read().decode()
    except urllib.error.HTTPError as err:
        status, body = err.code, err.read().decode()
    try:
        parsed = json.loads(body) if body else None
    except ValueError:
        parsed = body
    return status, parsed


def check(ok, message):
    if not ok:
        raise AssertionError(message)


def get_rows(table, user, filter_by=""):
    status, rows = call("GET", f"/{table}?select=id,owner_id{filter_by}", user)
    check(status == 200 and isinstance(rows, list),
          f"{table} GET for {user[:8]} failed: HTTP {status}, {rows!r}")
    return rows


def main():
    check("SUPABASE_URL" not in os.environ and "SUPABASE_SERVICE_ROLE_KEY" not in os.environ,
          "This isolated CI script must not inherit remote Supabase credentials")
    # The unauthenticated role has no table grants and must not see household data.
    status, data = call("GET", "/chores?select=id")
    check(status in (401, 403), f"Anonymous chore access unexpectedly accepted: {status} {data!r}")

    # Five real PostgREST GETs per account, executing the migration's RLS policies.
    for table, a_id in A_ROWS.items():
        a_rows = get_rows(table, A)
        b_rows = get_rows(table, B)
        check([row["id"] for row in a_rows] == [a_id],
              f"A could not read exactly own {table}: {a_rows!r}")
        expected_b = [B_ROWS[table]] if table in B_ROWS else []
        check([row["id"] for row in b_rows] == expected_b,
              f"B leaked A data or lost own {table}: {b_rows!r}")
        check(all(row["owner_id"] == A for row in a_rows) and
              all(row["owner_id"] == B for row in b_rows),
              f"Incorrect returned tenant owner for {table}")
    print("PASS: anonymous denied and A/B isolated across all five tables via real PostgREST JWT HTTP")

    # B's targeted cross-owner writes must touch ZERO rows.
    status, rows = call("PATCH", f"/chores?id=eq.{A_ROWS['chores']}", B,
                        {"title": "B must never overwrite A"}, "return=representation")
    check(status == 200 and rows == [],
          f"B PATCH affected A chore: {status} {rows!r}")
    status, rows = call("DELETE", f"/chores?id=eq.{A_ROWS['chores']}", B,
                        prefer="return=representation")
    check(status == 200 and rows == [],
          f"B DELETE affected A chore: {status} {rows!r}")

    # An attacker cannot impersonate A by supplying owner_id in an HTTP POST.
    status, body = call("POST", "/team_members", B, {
        "id": "bbbbbbbb-9999-4999-8999-bbbbbbbbbbbb",
        "owner_id": A, "name": "spoofed", "color": "#222222",
    }, "return=representation")
    check(status == 403, f"B owner_id spoof was not forbidden: HTTP {status} {body!r}")
    print("PASS: cross-account PATCH/DELETE are zero-row; explicit owner_id spoof rejected")

    # A may create an owned chore, and B cannot see that committed API write.
    status, rows = call("POST", "/chores", A, {
        "id": NEW_CHORE, "title": "HTTP acceptance chore",
        "date": "2026-10-28", "assignee_id": A_ROWS["team_members"],
    }, "return=representation")
    check(status == 201 and isinstance(rows, list) and len(rows) == 1 and
          rows[0]["id"] == NEW_CHORE and rows[0]["owner_id"] == A,
          f"A own chore creation receipt failed: HTTP {status} {rows!r}")
    check(len(get_rows("chores", A, f"&id=eq.{NEW_CHORE}")) == 1,
          "A cannot re-read persisted HTTP-created chore")
    check(get_rows("chores", B, f"&id=eq.{NEW_CHORE}") == [],
          "B can see A's newly created chore")

    # Verify B's earlier mutation could not change A's baseline chore.
    status, rows = call("GET", f"/chores?id=eq.{A_ROWS['chores']}&select=title", A)
    check(status == 200 and rows == [{"title": "A chore"}],
          f"Cross-account attempts altered A's original chore: HTTP {status} {rows!r}")
    status, rows = call("DELETE", f"/chores?id=eq.{NEW_CHORE}", A,
                        prefer="return=representation")
    check(status == 200 and isinstance(rows, list) and len(rows) == 1 and
          rows[0]["id"] == NEW_CHORE, f"A precise synthetic cleanup failed: {status} {rows!r}")
    check(get_rows("chores", A, f"&id=eq.{NEW_CHORE}") == [],
          "Created synthetic chore remains after own DELETE")
    print("PASS: A HTTP create/read/cleanup persisted; B could not read; A baseline remained intact")
    print("PASS: isolated JWT/PostgREST HTTP integration (synthetic CI DB only; NOT Supabase Auth or iPhone)")


if __name__ == "__main__":
    main()
