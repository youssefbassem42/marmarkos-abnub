import pytest
from pydantic import ValidationError

from app.config import Settings


def test_settings_defaults() -> None:
    settings = Settings(
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


def test_settings_require_database_and_jwt_secrets(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("JWT_SECRET", raising=False)
    monkeypatch.delenv("JWT_REFRESH_SECRET", raising=False)

    with pytest.raises(ValidationError):
        Settings()


def test_settings_read_from_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_NAME", "Custom API")
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://u:p@h/d")
    monkeypatch.setenv("JWT_SECRET", "env-secret")
    monkeypatch.setenv("JWT_REFRESH_SECRET", "env-refresh")

    settings = Settings()

    assert settings.APP_NAME == "Custom API"
