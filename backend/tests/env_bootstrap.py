"""Hermetic test environment bootstrap.

This module is imported **before** ``app.config`` (the first import in
``tests/conftest.py``) and its whole purpose is to make sure the test suite
can never touch a production system.

Why this exists
---------------
``app.config.Settings`` declares ``env_file=".env"``, so every process that
imports the application settings picks up the developer's (or CI's) local
``.env`` file.  When that file holds real credentials, the test suite would

* send real e-mails through Gmail/Brevo,
* post anonymous messages to the production Telegram chat,
* upload images to the production Cloudinary account, and
* (worst case) run the destructive schema fixture against the production
  database.

Environment variables take priority over the dotenv file in Pydantic v2, so
blanking the integration variables here - before ``app.config`` is imported -
is enough to neutralise every external dependency.  On top of that the
bootstrap refuses to continue unless the configured database is explicitly a
test database.
"""

from __future__ import annotations

import os
from urllib.parse import urlparse

# --- Core test configuration ------------------------------------------------
# The suite always runs in "test" mode: this makes ``app.config`` skip the
# dotenv file entirely (see ``app/config.py::_dotenv_file``), so a developer's
# ``.env`` can never leak production values into the process.
os.environ["APP_ENV"] = "test"
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://marmarkos:marmarkos@localhost:55432/marmarkos_test"
)
os.environ.setdefault("JWT_SECRET", "test-jwt-secret")
os.environ.setdefault("JWT_REFRESH_SECRET", "test-jwt-refresh-secret")
# Hard assignment (not setdefault): no test may ever open a real mail socket.
os.environ["MAIL_PROVIDER"] = "console"

# --- No third-party credentials may reach the test process ------------------
INTEGRATION_ENV_VARS: tuple[str, ...] = (
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_CHAT_ID",
    "GMAIL_EMAIL",
    "GMAIL_APP_PASSWORD",
    "BREVO_API_KEY",
    "BREVO_SENDER_EMAIL",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "CRON_SECRET",
)

for _integration_var in INTEGRATION_ENV_VARS:
    # Removed (not blanked) so the settings fall back to their ``None``
    # defaults - exactly like a deployment without those integrations.
    os.environ.pop(_integration_var, None)

# Deterministic, non-secret pepper for the attendance PIN: avoids the
# JWT_SECRET fallback (and its warning log) while staying reproducible.
os.environ["ATTENDANCE_PIN_PEPPER"] = "test-attendance-pin-pepper"

# --- Never touch a non-test database ----------------------------------------
TEST_DATABASE_NAME = (urlparse(os.environ["DATABASE_URL"]).path or "").lstrip("/").lower()

if "test" not in TEST_DATABASE_NAME:
    raise RuntimeError(
        f"Refusing to run the test suite against non-test database {TEST_DATABASE_NAME!r}. "
        "DATABASE_URL must point at a database whose name contains 'test'."
    )
