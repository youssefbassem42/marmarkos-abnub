"""Security headers on every response (SEC-009)."""

import pytest
from httpx import AsyncClient

from app.config import settings

HEALTH_URL = "/api/v1/health"


async def test_responses_carry_the_hardening_headers(client: AsyncClient) -> None:
    response = await client.get(HEALTH_URL)

    assert response.status_code == 200
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"
    assert response.headers["Cross-Origin-Opener-Policy"] == "same-origin"
    assert response.headers["Cross-Origin-Resource-Policy"] == "same-origin"
    # The camera stays available: the check-in scans a QR code.
    assert "camera=(self)" in response.headers["Permissions-Policy"]
    assert "geolocation=()" in response.headers["Permissions-Policy"]


async def test_the_api_policy_forbids_everything(client: AsyncClient) -> None:
    response = await client.get(HEALTH_URL)

    policy = response.headers["Content-Security-Policy"]
    assert policy.startswith("default-src 'none'")
    assert "frame-ancestors 'none'" in policy
    assert "base-uri 'none'" in policy


async def test_the_policy_can_be_switched_to_report_only(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "CSP_REPORT_ONLY", True)

    response = await client.get(HEALTH_URL)

    assert "Content-Security-Policy-Report-Only" in response.headers
    assert "Content-Security-Policy" not in response.headers


async def test_hsts_is_only_sent_over_https(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    response = await client.get(HEALTH_URL)
    assert "Strict-Transport-Security" not in response.headers

    monkeypatch.setattr(settings, "TRUST_PROXY_HEADERS", True)
    proxied = await client.get(HEALTH_URL, headers={"X-Forwarded-Proto": "https"})
    assert proxied.headers["Strict-Transport-Security"].startswith("max-age=31536000")


async def test_the_headers_can_be_switched_off(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "SECURITY_HEADERS_ENABLED", False)

    response = await client.get(HEALTH_URL)

    assert "X-Content-Type-Options" not in response.headers
    assert "Content-Security-Policy" not in response.headers
