"""Decisive diagnosis of the refresh failure, against the LIVE production API.

What we know (read-only facts):
  * the production database is at the head of the migration chain,
  * ``refresh_tokens.token_hash`` is ``varchar(128)`` and the stored
    hashes are 67 characters long ("v2:" + 64 hex) - nothing is
    truncated,
  * the newest sessions are alive (not revoked, not expired),
  * the browser **does** send the cookie, and the answer of the server
    is the message of the *service* ("Invalid or expired refresh
    token"), not the message of the *router* ("Not authenticated").

So the cookie arrives and the lookup still fails. Two things can make
that happen:

  A. the secret of the deployment differs from the one that signed the
     token (the v2 hash is keyed with ``JWT_REFRESH_SECRET``),
  B. the rotation is broken: the server hands out a new cookie but the
     next call with that cookie fails.

The script answers both, with a disposable session that is tagged and
deleted at the end. The rows it writes are ordinary sessions of the
owner's own account; they are removed before the script finishes.
"""

import asyncio
import os
import re
import secrets
import sys
from datetime import UTC, datetime, timedelta
from urllib.parse import urlsplit, urlunsplit

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import httpx  # noqa: E402

API = "https://marmarkos-abnub-ny1l.vercel.app/api/v1"
OWNER_EMAIL = "abnubyouth@gmail.com"
TAG = "marmarkos-diagnostic"


def _env() -> dict[str, str]:
    values: dict[str, str] = {}
    with open(".env", encoding="utf-8") as handle:
        for line in handle:
            match = re.match(r"^([A-Z_]+)=(.*)$", line.strip())
            if match:
                values[match.group(1)] = match.group(2).strip()
    return values


def _dsn(url: str) -> str:
    parts = urlsplit(url)
    return urlunsplit(("postgresql", parts.netloc, parts.path, parts.query, parts.fragment))


async def main() -> None:
    import asyncpg

    env = _env()
    secret = env.get("JWT_REFRESH_SECRET", "")
    if not secret:
        print("JWT_REFRESH_SECRET is empty in the local .env")
        return

    connection = await asyncpg.connect(_dsn(env["DATABASE_URL"]))
    try:
        owner = await connection.fetchrow(
            "SELECT id, email, status FROM users WHERE email = $1", OWNER_EMAIL
        )
        if owner is None:
            print("the owner is not in the production database")
            return
        print(f"the account: {owner['email']} ({owner['status']})")

        # Two disposable sessions: one in the v2 format (keyed with the
        # local secret) and one in the legacy format (plain SHA-256,
        # which does not depend on any secret).
        raw_v2 = secrets.token_urlsafe(48)
        raw_legacy = secrets.token_urlsafe(48)
        digest_v2 = hmac_hash(raw_v2, secret)
        digest_legacy = legacy_hash(raw_legacy)

        await connection.execute("DELETE FROM refresh_tokens WHERE user_agent = $1", TAG)
        for digest in (digest_v2, digest_legacy):
            await connection.execute(
                """
                INSERT INTO refresh_tokens
                    (id, user_id, token_hash, expires_at, user_agent, ip_address, persistent)
                VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, false)
                """,
                owner["id"],
                digest,
                datetime.now(UTC) + timedelta(hours=1),
                TAG,
                "127.0.0.1",
            )
        print("the two diagnostic sessions are written")

        async with httpx.AsyncClient(timeout=30) as client:
            # A. the v2 format: does the deployment sign with the local secret?
            answer = await client.post(
                f"{API}/auth/refresh",
                headers={"Origin": "https://marmarkosabnub.vercel.app", "User-Agent": TAG},
                cookies={"refresh_token": raw_v2},
            )
            print(f"\nA. the v2 format (the secret of the .env): {answer.status_code}")
            print(f"   the body: {answer.text[:160]}")
            set_cookie = answer.headers.get("set-cookie", "")
            print(f"   the cookie of the answer: {set_cookie[:220]}")

            # B. the legacy format: does the dual read work on the deployment?
            answer_legacy = await client.post(
                f"{API}/auth/refresh",
                headers={"Origin": "https://marmarkosabnub.vercel.app", "User-Agent": TAG},
                cookies={"refresh_token": raw_legacy},
            )
            print(f"\nB. the legacy format (no secret): {answer_legacy.status_code}")
            print(f"   the body: {answer_legacy.text[:160]}")

            # C. the rotation: is the cookie that the server hands out usable?
            rotated = ""
            match = re.search(r"refresh_token=([^;]+)", set_cookie)
            if match:
                rotated = match.group(1).strip('"')
            if rotated:
                again = await client.post(
                    f"{API}/auth/refresh",
                    headers={"Origin": "https://marmarkosabnub.vercel.app", "User-Agent": TAG},
                    cookies={"refresh_token": rotated},
                )
                print(f"\nC. the cookie that the server handed out: {again.status_code}")
                print(f"   the body: {again.text[:160]}")
                print(f"   the cookie of the answer: {again.headers.get('set-cookie', '')[:220]}")
            else:
                print("\nC. the server handed out no cookie - the rotation cannot work")

            # D. the same call through the rewrite of the frontend.
            async with httpx.AsyncClient(timeout=30) as through:
                raw = secrets.token_urlsafe(48)
                digest = hmac_hash(raw, secret)
                await connection.execute(
                    """
                    INSERT INTO refresh_tokens
                        (id, user_id, token_hash, expires_at, user_agent, ip_address, persistent)
                    VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, false)
                    """,
                    owner["id"],
                    digest,
                    datetime.now(UTC) + timedelta(hours=1),
                    TAG,
                    "127.0.0.1",
                )
                answer = await through.post(
                    "https://marmarkosabnub.vercel.app/api/v1/auth/refresh",
                    headers={"Origin": "https://marmarkosabnub.vercel.app", "User-Agent": TAG},
                    cookies={"refresh_token": raw},
                )
                print(f"\nD. through the rewrite of the frontend: {answer.status_code}")
                print(f"   the body: {answer.text[:160]}")
                print(f"   the cookie of the answer: {answer.headers.get('set-cookie', '')[:220]}")
    finally:
        # The diagnostic sessions never outlive the script.
        await connection.execute("DELETE FROM refresh_tokens WHERE user_agent = $1", TAG)
        print("\nthe diagnostic sessions are deleted")
        await connection.close()


def hmac_hash(token: str, secret: str) -> str:
    import hashlib
    import hmac

    digest = hmac.new(secret.encode("utf-8"), token.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"v2:{digest}"


def legacy_hash(token: str) -> str:
    import hashlib

    return hashlib.sha256(token.encode("utf-8")).hexdigest()


if __name__ == "__main__":
    asyncio.run(main())
