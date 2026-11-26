"""Read-only inspection of the production database (the session of the member).

The script never writes: it only reads the version of the schema, the
width of the columns that hold the hashes, and the state of the rows of
the refresh tokens.
"""

import asyncio
import os
import re
import sys
from urllib.parse import urlsplit, urlunsplit

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _dsn() -> str:
    """The DATABASE_URL of the environment (or of the .env file)."""
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        with open(".env", encoding="utf-8") as handle:
            match = re.search(r"^DATABASE_URL=(.+)$", handle.read(), re.M)
            if match:
                url = match.group(1).strip()
    parts = urlsplit(url)
    return urlunsplit(("postgresql", parts.netloc, parts.path, parts.query, parts.fragment))


async def main() -> None:
    import asyncpg

    connection = await asyncpg.connect(_dsn())
    try:
        print("== the version of the schema ==")
        rows = await connection.fetch("SELECT version_num FROM alembic_version")
        print("  alembic_version:", [r["version_num"] for r in rows] or "the table is empty")

        print("== the width of the columns of the hashes ==")
        rows = await connection.fetch(
            """
            SELECT table_name, column_name, character_maximum_length, data_type
            FROM information_schema.columns
            WHERE table_name IN ('refresh_tokens', 'auth_tokens')
              AND column_name IN ('token_hash', 'persistent')
            ORDER BY table_name, column_name
            """
        )
        for row in rows:
            print(f"  {row['table_name']}.{row['column_name']}: {row['data_type']}"
                  f"({row['character_maximum_length']})")

        print("== the tables that exist ==")
        rows = await connection.fetch(
            """
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name LIKE '%token%'
            ORDER BY table_name
            """
        )
        print("  ", [r["table_name"] for r in rows])

        print("== the state of the refresh tokens ==")
        rows = await connection.fetch(
            """
            SELECT count(*) AS total,
                   count(*) FILTER (WHERE revoked_at IS NOT NULL) AS revoked,
                   count(*) FILTER (WHERE expires_at <= now()) AS expired,
                   count(*) FILTER (WHERE token_hash LIKE 'v2:%') AS v2,
                   count(*) FILTER (WHERE token_hash NOT LIKE 'v2:%') AS legacy,
                   max(length(token_hash)) AS longest
            FROM refresh_tokens
            """
        )
        print("  ", dict(rows[0]))

        print("== the ten last sessions ==")
        rows = await connection.fetch(
            """
            SELECT created_at, expires_at, revoked_at, length(token_hash) AS len,
                   left(token_hash, 3) AS prefix, user_id
            FROM refresh_tokens ORDER BY created_at DESC LIMIT 10
            """
        )
        for row in rows:
            print("  ", dict(row))
    finally:
        await connection.close()


if __name__ == "__main__":
    asyncio.run(main())
