"""Performance sanity tests (P5-060).

N+1 guards for analytics endpoints. Each test fires an HTTP request and
asserts that the database issues no more than a bounded number of SELECT/
INSERT/UPDATE statements.  Bounds are intentionally generous so they only
catch runaway N+1 regressions, not micro-optimise normal query counts.

Uses SQLAlchemy event listener on the async session factory to count queries
during each request.
"""

from __future__ import annotations

import contextlib
import typing
from unittest.mock import patch

import pytest
from sqlalchemy import event

from app.db.base import async_session_factory

if typing.TYPE_CHECKING:
    from httpx import ASGITransport, AsyncClient

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_query_count: list[int] = [0]


def _before_cursor_execute(conn, stmt, params, context, executemany):  # noqa: ANN001
    _query_count[0] += 1


@pytest.fixture(autouse=True)
def _reset_query_count():
    _query_count[0] = 0
    yield
    _query_count[0] = 0


@contextlib.asynccontextmanager
async def count_queries():
    """Context manager that returns (session, count_fn).

    Attaches a SQLAlchemy event listener for the duration.  Call
    ``count()`` after the endpoint-under-test has finished to get the
    number of SQL statements issued.
    """
    # We need to use the real session factory, not a mock.
    with event.listens_for(
        async_session_factory.sync_session, "do_execute"
    ) as listener:
        listener(
            _before_cursor_execute,
            "before_cursor_execute",
        )
        _query_count[0] = 0
        try:
            yield lambda: _query_count[0]
        finally:
            try:
                event.remove(
                    async_session_factory.sync_session,
                    "do_execute",
                    _before_cursor_execute,
                )
            except ValueError:
                pass


# ---------------------------------------------------------------------------
# Fixtures — reuse existing auth helpers
# ---------------------------------------------------------------------------


@pytest.fixture()
async def _auth_headers(client: AsyncClient) -> dict[str, str]:
    """Register + login an ADMIN and return Bearer headers."""
    from tests.utils import register_and_login

    _, user = await register_and_login(client, "querycount-admin@test.com")
    # Promote to ADMIN via direct DB call (bypass API for speed)
    from app.db.base import async_session_factory
    from sqlalchemy import text

    async with async_session_factory() as session:
        from app.modules.users.infrastructure.persistence.models import User

        result = await session.execute(
            text("SELECT id FROM users WHERE email = :e"),
            {"e": "querycount-admin@test.com"},
        )
        uid = result.scalar_one()
        await session.execute(
            text(
                "UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'ADMIN') "
                "WHERE id = :uid"
            ),
            {"uid": uid},
        )
        await session.commit()

    auth, _ = await register_and_login(client, "querycount-admin@test.com")
    return {"Authorization": f"Bearer {auth['access_token']}"}


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_bible_analytics_overview_query_count(
    client: AsyncClient, _auth_headers: dict[str, str]
):
    """GET /bible-verses/analytics/overview should use <= 5 queries."""
    async with count_queries() as get_count:
        resp = await client.get(
            "/api/v1/bible-verses/analytics/overview",
            headers=_auth_headers,
        )
    assert resp.status_code == 200
    count = get_count()
    assert count <= 5, f"Overview used {count} queries (expected <= 5)"


@pytest.mark.asyncio
async def test_quiz_analytics_overview_query_count(
    client: AsyncClient, _auth_headers: dict[str, str]
):
    """GET /quizzes/analytics/overview should use <= 6 queries."""
    async with count_queries() as get_count:
        resp = await client.get(
            "/api/v1/quizzes/analytics/overview",
            headers=_auth_headers,
        )
    assert resp.status_code == 200
    count = get_count()
    assert count <= 6, f"Overview used {count} queries (expected <= 6)"


@pytest.mark.asyncio
async def test_monthly_analytics_query_count(
    client: AsyncClient, _auth_headers: dict[str, str]
):
    """GET /quiz-analytics/monthly (2-month trend) should use <= 12 queries."""
    async with count_queries() as get_count:
        resp = await client.get(
            "/api/v1/quiz-analytics/monthly?year=2026&month=9",
            headers=_auth_headers,
        )
    assert resp.status_code == 200
    count = get_count()
    # _trend calls monthly_kpis 3 times (prev, current, next) + leaderboard + filters
    assert count <= 12, f"Monthly analytics used {count} queries (expected <= 12)"


@pytest.mark.asyncio
async def test_monthly_export_query_count(
    client: AsyncClient, _auth_headers: dict[str, str]
):
    """GET /quiz-analytics/monthly/export should use <= 10 queries."""
    async with count_queries() as get_count:
        resp = await client.get(
            "/api/v1/quiz-analytics/monthly/export?year=2026&month=9",
            headers=_auth_headers,
        )
    # Export returns CSV (200) or empty (204)
    assert resp.status_code in (200, 204)
    count = get_count()
    assert count <= 10, f"Monthly export used {count} queries (expected <= 10)"
