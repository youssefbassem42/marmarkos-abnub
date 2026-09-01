"""BR-15: RateLimitedError maps to 429 + Retry-After on the shared envelope."""

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.exceptions import RateLimitedError
from app.core.exceptions.handlers import register_exception_handlers


async def test_rate_limited_error_carries_retry_after_header() -> None:
    application = FastAPI()
    register_exception_handlers(application)

    @application.get("/limited")
    async def limited() -> None:
        raise RateLimitedError(retry_after=120)

    transport = ASGITransport(app=application)
    async with AsyncClient(transport=transport, base_url="http://test") as async_client:
        response = await async_client.get("/limited")

    assert response.status_code == 429
    assert response.headers["Retry-After"] == "120"
    assert response.json()["detail"]["code"] == "rate_limited"
    assert response.json()["detail"]["message"] == ("Too many messages. Please try again later")


async def test_other_app_errors_gain_no_retry_header() -> None:
    from app.core.exceptions import NotFoundError

    application = FastAPI()
    register_exception_handlers(application)

    @application.get("/missing")
    async def missing() -> None:
        raise NotFoundError("nope")

    transport = ASGITransport(app=application)
    async with AsyncClient(transport=transport, base_url="http://test") as async_client:
        response = await async_client.get("/missing")

    assert response.status_code == 404
    assert "Retry-After" not in response.headers


async def test_data_carrying_error_merges_data_into_detail() -> None:
    """P5-002: attempt_exists carries data.attempt_id in the envelope."""
    from app.core.exceptions import AttemptExistsError

    application = FastAPI()
    register_exception_handlers(application)

    @application.get("/attempt")
    async def attempt() -> None:
        raise AttemptExistsError(data={"attempt_id": "abc-123"})

    transport = ASGITransport(app=application)
    async with AsyncClient(transport=transport, base_url="http://test") as async_client:
        response = await async_client.get("/attempt")

    assert response.status_code == 409
    detail = response.json()["detail"]
    assert detail["code"] == "attempt_exists"
    assert detail["message"] == "You have already started this quiz"
    assert detail["data"] == {"attempt_id": "abc-123"}


async def test_plain_error_keeps_two_key_envelope() -> None:
    """P5-002: without data the envelope stays {code, message} exactly."""
    from app.core.exceptions import VerseNotReadError

    application = FastAPI()
    register_exception_handlers(application)

    @application.get("/gated")
    async def gated() -> None:
        raise VerseNotReadError()

    transport = ASGITransport(app=application)
    async with AsyncClient(transport=transport, base_url="http://test") as async_client:
        response = await async_client.get("/gated")

    body = response.json()
    assert response.status_code == 403
    assert set(body["detail"].keys()) == {"code", "message"}
