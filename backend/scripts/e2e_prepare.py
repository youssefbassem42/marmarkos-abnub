"""Prepare the database of the end-to-end tests.

The E2E stack needs a database that is **built by the migrations**
(the test suite builds its schema from the metadata - QA-003) and that
holds the accounts and the data of the golden paths.

The script:

1. rebuilds the database (the name must contain "e2e" - a production
   database is never touched),
2. applies the migrations with Alembic,
3. seeds the member, the admin, the verse and the quiz.

It is idempotent: it can run before every E2E execution.

Usage::

    python scripts/e2e_prepare.py [--keep]
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


def _database_name(url: str) -> str:
    """The name of the database in the URL."""
    dsn = url.replace("postgresql+asyncpg://", "postgresql://")
    return dsn.rsplit("/", 1)[-1].split("?")[0]


async def _rebuild_database(url: str, *, keep: bool) -> None:
    """Drop the database of the E2E and create it again.

    The database of a test run is **rebuilt from the migrations** on
    every run: the run is then hermetic, and it cannot inherit a row
    (or a constraint of the schema) from the previous one - the
    attendance of the last run, for instance, refers to the servant of
    the last run, and the schema refuses to delete that servant.

    Only a database whose name contains "e2e" is ever dropped. The
    database of the unit tests ("marmarkos_test") is **never** touched
    by this script.
    """
    import asyncpg

    dsn = url.replace("postgresql+asyncpg://", "postgresql://")
    name = _database_name(url)
    admin_dsn = dsn.rsplit("/", 1)[0] + "/postgres"

    if "e2e" not in name.lower():
        print(f"the database {name} is kept (only an 'e2e' database is rebuilt)")
        return

    connection = await asyncpg.connect(admin_dsn)
    try:
        if keep:
            print(f"the database {name} is kept (--keep)")
            return
        await connection.execute(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)')
        await connection.execute(f'CREATE DATABASE "{name}"')
        print(f"rebuilt the database {name}")
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
    keep = "--keep" in sys.argv[1:]
    await _rebuild_database(url, keep=keep)
    _run_migrations(url)
    _seed(url)


if __name__ == "__main__":  # pragma: no cover - the entry point
    asyncio.run(main())
