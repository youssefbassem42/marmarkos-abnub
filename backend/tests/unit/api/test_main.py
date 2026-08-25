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
