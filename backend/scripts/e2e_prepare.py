"""Prepare the database of the end-to-end tests.

The E2E stack needs a database that is **built by the migrations**
(the test suite builds its schema from the metadata - QA-003) and that
holds the accounts and the data of the golden paths.

The script:

1. creates the database when it does not exist (the name must contain
   "e2e" - a production database is never touched),
2. applies the migrations with Alembic,
3. seeds the member, the admin, the verse and the quiz.

It is idempotent: it can run before every E2E execution.

Usage::

    python scripts/e2e_prepare.py
"""

from __future__ import annotations

import asyncio
import os
import subprocess
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))


def _e2e_database_url() -> str:
    """The URL of the E2E database, derived from DATABASE_URL."""
    raw = os.environ.get("E2E_DATABASE_URL") or os.environ.get("DATABASE_URL", "")
    if not raw:
        raise SystemExit("DATABASE_URL (or E2E_DATABASE_URL) is not set")
    if "e2e" not in raw and "test" not in raw:
        raise SystemExit(
            f"refusing to prepare {raw!r}: the name of the database must contain 'e2e' or 'test'"
        )
    return raw


async def _create_database_if_missing(url: str) -> None:
    """Create the database when it does not exist yet."""
    import asyncpg

    # "postgresql+asyncpg://..." -> "postgresql://..."
    dsn = url.replace("postgresql+asyncpg://", "postgresql://")
    name = dsn.rsplit("/", 1)[-1].split("?")[0]
    admin_dsn = dsn.rsplit("/", 1)[0] + "/postgres"

    connection = await asyncpg.connect(admin_dsn)
    try:
        exists = await connection.fetchval("SELECT 1 FROM pg_database WHERE datname = $1", name)
        if not exists:
            await connection.execute(f'CREATE DATABASE "{name}"')
            print(f"created the database {name}")
        else:
            print(f"the database {name} exists")
    finally:
        await connection.close()


def _run_migrations(url: str) -> None:
    env = {**os.environ, "DATABASE_URL": url}
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=BACKEND_ROOT,
        env=env,
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(result.stdout)
        print(result.stderr, file=sys.stderr)
        raise SystemExit("the migrations failed")
    print("the migrations are up to date")


def _seed(url: str) -> None:
    env = {**os.environ, "DATABASE_URL": url}
    result = subprocess.run(
        [sys.executable, "scripts/seed_e2e.py"],
        cwd=BACKEND_ROOT,
        env=env,
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(result.stdout)
        print(result.stderr, file=sys.stderr)
        raise SystemExit("the seed failed")
    print(result.stdout.strip())


async def main() -> None:
    url = _e2e_database_url()
    await _create_database_if_missing(url)
    _run_migrations(url)
    _seed(url)


if __name__ == "__main__":  # pragma: no cover - the entry point
    asyncio.run(main())
