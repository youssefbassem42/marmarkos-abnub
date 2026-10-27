"""Apply the migrations under a PostgreSQL advisory lock (OPS-005).

Every container applies the pending migrations when it starts. With two
replicas (or a rolling deployment) that happens at the same moment, and
Alembic has no lock of its own: two processes would run the same
migration at the same time.

The fix is the database itself. The session takes a **PostgreSQL
advisory lock** before the migration starts and releases it afterwards;
the second process waits for the first one to finish and then finds
nothing left to do.

The lock is a plain integer key - it only has to be the same for every
process of this application, and different from the other applications
that share the database.
"""

from __future__ import annotations

import asyncio
import os
import sys
from urllib.parse import urlsplit, urlunsplit

from alembic.config import Config

from alembic import command

#: "MARM" in ASCII - the key of the advisory lock of this application.
LOCK_ID = 0x4D41524D


def _sync_dsn(database_url: str) -> str:
    """The URL of the database in the form asyncpg understands.

    The application speaks the async dialect
    (``postgresql+asyncpg://...``); asyncpg wants the plain scheme.
    """
    parts = urlsplit(database_url)
    scheme = "postgresql" if parts.scheme.startswith("postgresql") else parts.scheme
    return urlunsplit((scheme, parts.netloc, parts.path, parts.query, parts.fragment))


async def _run() -> None:
    import asyncpg

    database_url = os.environ.get("DATABASE_URL", "")
    if not database_url:
        raise SystemExit("DATABASE_URL is not set - cannot apply the migrations")

    connection = await asyncpg.connect(_sync_dsn(database_url))
    try:
        # The lock is released automatically when the session ends, even if
        # the migration crashes.
        await connection.execute("SELECT pg_advisory_lock($1)", LOCK_ID)
        try:
            config = Config("alembic.ini")
            config.set_main_option("script_location", "alembic")
            await asyncio.to_thread(command.upgrade, config, "head")
        finally:
            await connection.execute("SELECT pg_advisory_unlock($1)", LOCK_ID)
    finally:
        await connection.close()


def main() -> int:
    try:
        asyncio.run(_run())
    except Exception as exc:  # noqa: BLE001 - the exit code is the report
        print(f"Migration failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
