"""Reproduce the refresh failure of the production, exactly.

The hypothesis: the production database never received the migration
``b2e5c7a91d34`` (the widening of the token hash columns), so the
column is still ``varchar(64)`` while the v2 hash is 67 characters
("v2:" + 64 hex). PostgreSQL truncates the value on insert, and the
lookup computes the full 67 characters - so the token is never found
again and every silent refresh answers "Invalid or expired refresh
token".

The script:
  1. downgrades the database to the revision before the widening,
  2. shows the length of the column,
  3. signs a member in and asks for a refresh,
  4. upgrades the database and asks for a refresh again.
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.core.database import engine  # noqa: E402
from app.main import create_app  # noqa: E402

DB = os.environ.get("DATABASE_URL", "")
_BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ALEMBIC = Config(os.path.join(_BACKEND, "alembic.ini"))
ALEMBIC.set_main_option("script_location", os.path.join(_BACKEND, "alembic"))


async def column_length() -> int | None:
    async with engine.begin() as connection:
        result = await connection.execute(
            text(
                "SELECT character_maximum_length FROM information_schema.columns "
                "WHERE table_name = 'refresh_tokens' AND column_name = 'token_hash'"
            )
        )
        return result.scalar_one_or_none()


async def try_refresh() -> None:
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # A member that exists and is verified.
        async with engine.begin() as connection:
            await connection.execute(
                text(
                    "UPDATE users SET email_verified = true, status = 'ACTIVE' "
                    "WHERE email = 'probe-refresh@example.com'"
                )
            )
        register = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "probe-refresh@example.com",
                "password": "Test1234!Aa",
                "first_name": "Probe",
                "last_name": "Refresh",
                "phone": "+201000000001",
                "date_of_birth": "2000-01-01",
                "address": "Ainoub",
            },
        )
        print(f"  the register: {register.status_code}")
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": "probe-refresh@example.com", "password": "Test1234!Aa"},
        )
        print(f"  the login: {login.status_code}")
        cookie = login.headers.get("set-cookie", "")
        print(f"  the cookie of the login: {cookie[:80]}")
        refresh = await client.post("/api/v1/auth/refresh")
        print(f"  the refresh: {refresh.status_code} {refresh.text[:140]}")


def main() -> None:
    """Sign a member in and ask for a refresh (the schema is the state)."""
    asyncio.run(probe())


async def probe() -> None:
    print("  the length of the column:", await column_length())
    await try_refresh()


if __name__ == "__main__":
    main()
