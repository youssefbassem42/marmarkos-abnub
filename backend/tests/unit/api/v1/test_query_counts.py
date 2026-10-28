"""Performance sanity tests (P5-060).

N+1 guards for analytics endpoints. Each test fires an HTTP request and
asserts that the database issues no more than a bounded number of SELECT/
INSERT/UPDATE statements.  Bounds are intentionally generous so they only
catch runaway N+1 regressions, not micro-optimise normal query counts.

Uses SQLAlchemy event listener on the async session factory to count queries
during each request.
"""

from __future__ import annotations

import typing

import pytest

from tests.query_counter import count_queries

if typing.TYPE_CHECKING:
    from httpx import AsyncClient

# The admin fixture and the statement counter live in tests/conftest.py
# and tests/query_counter.py, so every N+1 guard shares them.


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_bible_analytics_overview_query_count(
    client: AsyncClient, admin_auth_headers: dict[str, str]
):
    """GET /bible-verses/analytics/overview should use <= 7 queries."""
    async with count_queries() as get_count:
        resp = await client.get(
            "/api/v1/bible-verses/analytics/overview",
            headers=admin_auth_headers,
        )
    assert resp.status_code == 200
    count = get_count()
    assert count <= 7, f"Overview used {count} queries (expected <= 7)"


@pytest.mark.asyncio
async def test_quiz_analytics_overview_query_count(
    client: AsyncClient, admin_auth_headers: dict[str, str]
):
    """GET /quizzes/analytics/overview should use <= 8 queries."""
    async with count_queries() as get_count:
        resp = await client.get(
            "/api/v1/quizzes/analytics/overview",
            headers=admin_auth_headers,
        )
    assert resp.status_code == 200
    count = get_count()
    assert count <= 8, f"Overview used {count} queries (expected <= 8)"


@pytest.mark.asyncio
async def test_monthly_analytics_query_count(
    client: AsyncClient, admin_auth_headers: dict[str, str]
):
    """GET /quiz-analytics/monthly (2-month trend) should use <= 12 queries."""
    async with count_queries() as get_count:
        resp = await client.get(
            "/api/v1/quiz-analytics/monthly?month=2026-09",
            headers=admin_auth_headers,
        )
    assert resp.status_code == 200
    count = get_count()
    # _trend calls monthly_kpis 3 times (prev, current, next) + leaderboard + filters
    assert count <= 12, f"Monthly analytics used {count} queries (expected <= 12)"


@pytest.mark.asyncio
async def test_monthly_analytics_rejects_the_legacy_year_month_shape(
    client: AsyncClient, admin_auth_headers: dict[str, str]
):
    """The legacy `?year=2026&month=9` shape is gone (Phase 3.1).

    The shape was never published: the endpoint only ever accepted
    `month=YYYY-MM`, so no client can depend on it.
    """
    resp = await client.get(
        "/api/v1/quiz-analytics/monthly?year=2026&month=9",
        headers=admin_auth_headers,
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_monthly_analytics_rejects_an_unparsable_month(
    client: AsyncClient, admin_auth_headers: dict[str, str]
):
    """A month that is not YYYY-MM is a 422."""
    resp = await client.get(
        "/api/v1/quiz-analytics/monthly?month=not-a-month",
        headers=admin_auth_headers,
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_monthly_export_query_count(client: AsyncClient, admin_auth_headers: dict[str, str]):
    """GET /quiz-analytics/monthly/export should use <= 10 queries."""
    async with count_queries() as get_count:
        resp = await client.get(
            "/api/v1/quiz-analytics/monthly/export?month=2026-09",
            headers=admin_auth_headers,
        )
    # Export returns CSV (200) or empty (204)
    assert resp.status_code in (200, 204)
    count = get_count()
    assert count <= 10, f"Monthly export used {count} queries (expected <= 10)"
