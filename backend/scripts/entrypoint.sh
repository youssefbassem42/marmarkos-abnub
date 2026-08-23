#!/bin/sh
# Apply pending migrations, then serve. Keeps the deployed image and the
# database schema in lockstep on every release.
set -e

echo "Running alembic upgrade head..."
alembic upgrade head

exec uvicorn app.main:app --host 0.0.0.0 --port 8000
