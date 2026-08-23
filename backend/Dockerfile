FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install the project itself so dependencies stay defined in one place
# (pyproject.toml). python:3.12-slim has no OS zoneinfo database; the
# tzdata wheel pulled in here is what makes ZoneInfo("Africa/Cairo") work.
COPY pyproject.toml README.md ./
COPY app ./app
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir .

COPY alembic.ini ./
COPY alembic ./alembic
COPY scripts/entrypoint.sh ./scripts/entrypoint.sh
RUN chmod +x scripts/entrypoint.sh

EXPOSE 8000

CMD ["./scripts/entrypoint.sh"]
