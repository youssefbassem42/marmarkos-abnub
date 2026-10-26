"""The production configuration guard (SEC-006)."""

import pytest
from pydantic import ValidationError

from app.config import Settings


def _settings(**overrides: object) -> Settings:
    base: dict[str, object] = {
        "APP_ENV": "production",
        "DATABASE_URL": "postgresql+asyncpg://user:pass@localhost:5432/app",
        "JWT_SECRET": "a" * 40,
        "JWT_REFRESH_SECRET": "b" * 40,
    }
    base.update(overrides)
    return Settings(**base)  # type: ignore[arg-type]


def test_production_refuses_to_start_without_an_attendance_pepper() -> None:
    with pytest.raises(ValidationError) as excinfo:
        _settings(ATTENDANCE_PIN_PEPPER="")

    message = str(excinfo.value)
    assert "ATTENDANCE_PIN_PEPPER" in message
    assert "production" in message


def test_production_starts_with_a_dedicated_attendance_pepper() -> None:
    settings = _settings(ATTENDANCE_PIN_PEPPER="c" * 40)

    assert settings.ATTENDANCE_PIN_PEPPER == "c" * 40


def test_development_still_falls_back_to_the_jwt_derivative() -> None:
    settings = _settings(APP_ENV="development", ATTENDANCE_PIN_PEPPER="")

    assert settings.ATTENDANCE_PIN_PEPPER == ""
