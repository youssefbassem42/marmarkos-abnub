import pytest
from pydantic import ValidationError

from app.config import Settings


def test_settings_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("APP_ENV", raising=False)
    monkeypatch.delenv("DEBUG", raising=False)
    settings = Settings(
        _env_file=None,
        DATABASE_URL="postgresql+asyncpg://user:pass@host/db",
        JWT_SECRET="secret",
        JWT_REFRESH_SECRET="refresh",
    )

    assert settings.APP_NAME == "Marmarkos ABNUB API"
    assert settings.APP_ENV == "development"
    assert settings.DEBUG is True
    assert settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES == 30
    assert settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS == 30
    assert settings.CORS_ORIGINS == "http://localhost:5173"
    assert settings.TELEGRAM_BOT_TOKEN is None
    assert settings.BREVO_API_KEY is None
    assert settings.CLOUDINARY_CLOUD_NAME is None

    # -- Notifications & anonymous messages (Phase 4, plan §3.1) -------------
    assert settings.NOTIFICATIONS_PAGE_SIZE == 20
    assert settings.NOTIFICATIONS_MAX_PAGE_SIZE == 100
    assert settings.NOTIFICATION_EMAIL_CONCURRENCY == 10
    assert settings.ANONYMOUS_MESSAGE_MIN_LENGTH == 10
    assert settings.ANONYMOUS_MESSAGE_MAX_LENGTH == 1000
    assert settings.ANONYMOUS_MESSAGE_RATE_LIMIT_PER_IP == 5  # per hour
    assert settings.ANONYMOUS_MESSAGE_RATE_LIMIT_PER_USER == 10  # per day
    assert settings.TELEGRAM_TIMEOUT_SECONDS == 15.0
    assert settings.TELEGRAM_SEND_ATTEMPTS == 2
    assert settings.TRUST_PROXY_HEADERS is False


def test_settings_require_database_and_jwt_secrets(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("JWT_SECRET", raising=False)
    monkeypatch.delenv("JWT_REFRESH_SECRET", raising=False)

    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_settings_read_from_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_NAME", "Custom API")
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://u:p@h/d")
    monkeypatch.setenv("JWT_SECRET", "env-secret")
    monkeypatch.setenv("JWT_REFRESH_SECRET", "env-refresh")

    settings = Settings(_env_file=None)

    assert settings.APP_NAME == "Custom API"
