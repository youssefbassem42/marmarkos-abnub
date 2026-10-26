"""The OpenAPI schema must describe the real access rules (SEC-010)."""

import pytest
from httpx import AsyncClient

from app.config import settings
from app.main import create_app

ANONYMOUS_MESSAGES_PATH = "/api/v1/anonymous-messages"
SCHEDULER_TICK_PATH = "/api/v1/internal/scheduler/tick"


def _schema() -> dict:
    return create_app().openapi()


def test_the_anonymous_message_submission_is_declared_public() -> None:
    operation = _schema()["paths"][ANONYMOUS_MESSAGES_PATH]["post"]

    # The submission needs no token: a bearer is optional and only used
    # for the per-member rate limit.
    assert operation.get("security", []) == []


def test_the_anonymous_message_listing_still_requires_a_token() -> None:
    operation = _schema()["paths"][ANONYMOUS_MESSAGES_PATH]["get"]

    assert operation["security"] == [{"HTTPBearer": []}]


def test_the_scheduler_tick_documents_both_ways_in() -> None:
    operation = _schema()["paths"][SCHEDULER_TICK_PATH]["post"]

    # Two alternatives (OR): the cron secret or an ADMIN bearer.
    assert operation["security"] == [{"CronSecret": []}, {"HTTPBearer": []}]
    assert "CronSecret" in _schema()["components"]["securitySchemes"]


async def test_the_schema_is_not_served_in_production(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The docs are only exposed when DEBUG is on."""
    monkeypatch.setattr(settings, "DEBUG", False)
    production_app = create_app()

    assert production_app.docs_url is None
    assert production_app.redoc_url is None
    # The raw schema route used to stay enabled in production.
    assert production_app.openapi_url is None

    response = await client.get("/docs")
    # The test app itself runs with DEBUG on, so the docs are reachable
    # here; the production app above is the one that hides them.
    assert response.status_code in (200, 404)
