# Backend

FastAPI + SQLAlchemy 2 + PostgreSQL modular monolith.

## Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
# Edit .env — set DATABASE_URL, GOOGLE_CLIENT_ID, CRON_SECRET
```

### Database

```bash
# Apply migrations
alembic upgrade head

# Create a new migration
alembic revision --autogenerate -m "description"

# Verify models == schema
alembic check
```

### Run

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Phase 5 Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `CRON_SECRET` | `None` | Bearer token for `/internal/scheduler/tick` |
| `SCHEDULER_TICK_MAX_BATCH` | `50` | Max items processed per tick invocation |
| `VERSE_OPEN_DEDUPE_SECONDS` | `300` | Dedup window for open tracking |
| `QUIZ_ANALYTICS_PAGE_SIZE` | `10` | Default analytics page size |
| `ANALYTICS_EXPORT_MAX_ROWS` | `5000` | Max rows in CSV export |
| `BIBLE_VERSES_PAGE_SIZE` | `12` | Default verse list page size |

## Cron Setup

The scheduler tick endpoint publishes due verses, expires stale attempts, and
dispatches pending outbox events.  Invoke it every minute via cron:

```bash
# Crontab entry (every minute)
* * * * * curl -s -X POST http://localhost:8000/api/v1/internal/scheduler/tick \
  -H "Authorization: Bearer $CRON_SECRET"
```

### CRON_SECRET rotation

1. Generate a new secret: `openssl rand -hex 32`
2. Update `CRON_SECRET` in `.env` (and Railway/Vercel env vars)
3. Update the crontab entry with the new token
4. Old token is invalid immediately — no rollback window needed

## Secrets & rotation

**Never commit real credentials.** `backend/.env` is gitignored and must only
contain *local development* values. Production secrets live in the deployment
platform's secret store (Vercel env vars / Railway variables / GitHub Actions
secrets) and are injected as environment variables at runtime.

| Secret | Used by | Rotation impact |
|---|---|---|
| `DATABASE_URL` | asyncpg | Connections fail until the new URL is deployed everywhere |
| `JWT_SECRET` | access tokens | All access tokens invalid → users sign in again |
| `JWT_REFRESH_SECRET` | refresh tokens | All refresh tokens invalid → users sign in again |
| `ATTENDANCE_PIN_PEPPER` | attendance PIN hashes | **Every member's PIN stops working** → announce + reset flow |
| `CRON_SECRET` | scheduler tick | The tick answers 503 until the scheduler is updated |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth login | Google sign-in stops |
| `CLOUDINARY_*` | image uploads | New uploads fail; existing URLs keep working |
| `GMAIL_*` / `BREVO_*` | e-mail delivery | Outbound mail stops |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | anonymous-message forwarding | Forwarding stops |

Rotation procedure (one secret at a time, never in the same deploy as a code
change):

```bash
# 1. Generate a new value
python -c "import secrets; print(secrets.token_urlsafe(48))"

# 2. Put it in the platform's secret store, redeploy, verify.
# 3. For local development only, update the gitignored backend/.env.
# 4. Confirm no secret ever reached git history:
git log --all --full-history -- backend/.env     # must print nothing
```

The test suite is **hermetic**: `tests/conftest.py` blanks every third-party
credential and blocks outbound sockets, so running the tests can never send a
real e-mail, post to the production Telegram chat or upload to the production
Cloudinary account. It also refuses to run against a database whose name does
not contain `test`.

## Testing

```bash
# Run all tests (requires Postgres on port 55432, database name must contain "test")
DEBUG=true APP_ENV=test .venv/bin/python -m pytest

# Run a specific test file
DEBUG=true APP_ENV=test .venv/bin/python -m pytest tests/unit/api/v1/test_query_counts.py -v

# Quality gates (the same commands CI runs)
.venv/bin/ruff check .
.venv/bin/ruff format --check .
DEBUG=true .venv/bin/mypy app
```

## Architecture

- **Modules**: `bible`, `quiz`, `points`, `attendance`, `users`, `auth`, `notifications`, `blog`, `anonymous_messages`, `media`, `internal`
- **Pattern**: 4-layer (router → query/command → service → repository)
- **Unit of Work**: `shared.infrastructure.persistence.unit_of_work.UnitOfWork`
- **Async everywhere**: `AsyncSession`, `AsyncClient`, `async def` handlers

## Key Entry Points

| File | Purpose |
|------|---------|
| `app/main.py` | FastAPI app factory |
| `app/config.py` | Pydantic settings |
| `app/shared/infrastructure/persistence/base.py` | Canonical SQLAlchemy `Base` |
| `app/shared/infrastructure/persistence/registry.py` | Imports every module's models (keeps `metadata` complete) |
| `app/api/v1/router.py` | V1 route registration |
| `app/modules/*/presentation/router.py` | Per-module endpoints |
| `app/modules/internal/presentation/router.py` | Internal tick endpoint |
