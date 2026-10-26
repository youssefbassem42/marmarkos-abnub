"""The cache policy of the API responses (PERF-004)."""

import pytest
from httpx import AsyncClient

from app.config import settings

FEED_URL = "/api/v1/bible-verses/published"
ME_URL = "/api/v1/users/me"
NOTIFICATIONS_URL = "/api/v1/notifications"


async def test_the_member_feed_is_cached_in_the_browser_only(client: AsyncClient) -> None:
    """The feed carries the viewer's read flags: never a shared cache."""
    response = await client.get(FEED_URL)

    assert response.status_code in (200, 401)
    if response.status_code == 200:
        cache_control = response.headers["Cache-Control"]
        assert cache_control == f"private, max-age={settings.FEED_CACHE_MAX_AGE_SECONDS}"
        assert "public" not in cache_control


async def test_the_personal_endpoints_are_never_stored(client: AsyncClient) -> None:
    for url in (ME_URL, NOTIFICATIONS_URL):
        response = await client.get(url)
        assert response.status_code in (200, 401, 403)
        assert response.headers.get("Cache-Control") == "no-store"


async def test_the_cache_can_be_switched_off(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "CACHE_CONTROL_ENABLED", False)

    response = await client.get(FEED_URL)

    assert "Cache-Control" not in response.headers


async def test_a_zero_max_age_switches_the_feed_cache_off(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "FEED_CACHE_MAX_AGE_SECONDS", 0)

    response = await client.get(FEED_URL)

    assert response.status_code in (200, 401)
    assert "Cache-Control" not in response.headers
