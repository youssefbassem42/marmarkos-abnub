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
