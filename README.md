# Marmarkos ABNUB Platform

Marmarkos A management platform containing:

- Authentication
- User profiles
- Personal QR codes
- QR attendance
- Attendance analytics
- Mini blog
- Likes
- Comments
- Comment replies
- Notifications
- Email notifications
- Anonymous feedback
- Telegram integration
- Weekly Bible verses
- Landing page media management
- Admin dashboard

## Architecture

- Modular Monolith
- Clean Architecture
- Domain-Driven Design (lightweight)
- CQRS-lite
- Repository Pattern
- Unit of Work
- Domain Events
- Outbox Pattern
- Adapter Pattern
- Strategy Pattern

## Backend

- FastAPI
- Python 3.12+
- PostgreSQL
- Neon
- SQLAlchemy 2
- Alembic
- Pytest

## Frontend

- React
- TypeScript
- Vite
- TanStack Query
- React Router
- React Hook Form
- Zod

## Local Development

### Backend

```bash
cd backend

python -m venv .venv
source .venv/bin/activate

pip install -e ".[dev]"

cp .env.example .env

uvicorn app.main:app --reload

## Scheduled Publication (Phase 5)

Automatic Bible-verse publishing runs from an internal endpoint driven by an
external cron — no worker container, no in-process loop. Point any
minute-frequency scheduler (cron, Vercel Cron, Railway Cron, uptime pinger)
at:

```bash
curl -fsS -X POST \
  -H "X-Cron-Secret: $CRON_SECRET" \
  https://<host>/api/v1/internal/scheduler/tick
```

The tick publishes due schedules, auto-finishes expired quiz attempts and
drains the notification outbox. It is idempotent, safe to run every minute
and safe to run concurrently. `CRON_SECRET` is required: without it the
endpoint answers `503 scheduler_disabled` (an ADMIN bearer token also works,
for the manual trigger button). Rotate the secret by setting a new
`CRON_SECRET` and redeploying; in-flight calls with the old value fail closed
with 401.
