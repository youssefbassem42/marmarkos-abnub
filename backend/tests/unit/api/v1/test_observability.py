"""Request ids and the metrics endpoint (SEC-014 / OPS-004)."""

from httpx import AsyncClient

from app.core.observability import REQUEST_ID_HEADER
from app.core.observability.context import get_request_id
from app.core.observability.metrics import counter_value, increment, reset

METRICS_URL = "/api/v1/internal/metrics"
HEALTH_URL = "/api/v1/health"


async def test_every_response_carries_a_request_id(client: AsyncClient) -> None:
    response = await client.get(HEALTH_URL)

    assert response.status_code == 200
    assert response.headers[REQUEST_ID_HEADER]


async def test_a_client_supplied_request_id_is_kept(client: AsyncClient) -> None:
    response = await client.get(HEALTH_URL, headers={REQUEST_ID_HEADER: "abc-123"})

    assert response.headers[REQUEST_ID_HEADER] == "abc-123"


async def test_a_hostile_request_id_is_replaced(client: AsyncClient) -> None:
    """The id ends up in a header and in the logs - it must stay harmless."""
    response = await client.get(HEALTH_URL, headers={REQUEST_ID_HEADER: "bad id with spaces"})

    assert response.headers[REQUEST_ID_HEADER] != "bad id with spaces"
    assert len(response.headers[REQUEST_ID_HEADER]) == 32


async def test_the_request_id_is_bound_to_the_context() -> None:
    """A handler sees the id of its own request."""
    from httpx import ASGITransport
    from starlette.applications import Starlette
    from starlette.responses import JSONResponse
    from starlette.routing import Route

    from app.core.observability import RequestContextMiddleware

    async def handler(request):  # type: ignore[no-untyped-def]
        return JSONResponse({"request_id": get_request_id()})

    app = Starlette(routes=[Route("/probe", handler)])
    app.add_middleware(RequestContextMiddleware)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as probe:
        response = await probe.get("/probe", headers={REQUEST_ID_HEADER: "ctx-1"})

    assert response.json()["request_id"] == "ctx-1"
    assert response.headers[REQUEST_ID_HEADER] == "ctx-1"


async def test_the_metrics_endpoint_is_protected(client: AsyncClient) -> None:
    response = await client.get(METRICS_URL)

    # No cron secret and no admin token in the test environment.
    assert response.status_code in (401, 503)


async def test_the_metrics_endpoint_exposes_the_counters(client: AsyncClient) -> None:
    from app.config import settings

    reset()
    increment("marmarkos_test_counter", {"kind": "demo"}, 3)
    # A request that is counted before the metrics are read.
    await client.get(HEALTH_URL)

    settings.CRON_SECRET = "test-cron-secret"
    try:
        response = await client.get(METRICS_URL, headers={"X-Cron-Secret": "test-cron-secret"})
    finally:
        settings.CRON_SECRET = None

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/plain")
    body = response.text
    assert "marmarkos_test_counter" in body
    assert 'kind="demo"' in body
    # The request counter was filled by the requests of this test.
    assert "marmarkos_http_requests_total" in body
    # The durable gauge is read from the database.
    assert "marmarkos_outbox_pending" in body


async def test_the_rate_limited_counter_is_filled(client: AsyncClient) -> None:
    from app.config import settings

    reset()
    monkey_limit = settings.AUTH_LOGIN_FAILURES_PER_ACCOUNT
    settings.AUTH_LOGIN_FAILURES_PER_ACCOUNT = 1
    try:
        for _ in range(3):
            await client.post(
                "/api/v1/auth/login",
                json={"email": "nobody@example.com", "password": "wrong-password"},
            )
    finally:
        settings.AUTH_LOGIN_FAILURES_PER_ACCOUNT = monkey_limit

    assert counter_value("marmarkos_rate_limited_total", {"limiter": "auth_login_account"}) >= 1
