#!/bin/sh
# Apply pending migrations, then serve. Keeps the deployed image and the
# database schema in lockstep on every release.
#
# The migration runs under a PostgreSQL advisory lock (scripts/migrate.py):
# with two replicas starting at the same moment, the second one waits for
# the first instead of running the same migration at the same time.
set -e

echo "Running alembic upgrade head (under an advisory lock)..."
python scripts/migrate.py

exec uvicorn app.main:app --host 0.0.0.0 --port 8000
