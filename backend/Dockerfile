FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1

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
COPY scripts/migrate.py ./scripts/migrate.py
RUN chmod +x scripts/entrypoint.sh

# The application never needs to be root (OPS-002): it only reads its own
# files and talks to the database. A dedicated user also makes a file
# written by the process impossible.
RUN useradd --system --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# The health endpoint is part of the public API and needs no credential.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health', timeout=4).status == 200 else 1)"

CMD ["./scripts/entrypoint.sh"]
