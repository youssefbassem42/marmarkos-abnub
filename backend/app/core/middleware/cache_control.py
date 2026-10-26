"""Cache-Control for the API responses (PERF-004).

The audit recommended a 30-second cache on the "public feed". The feed
of this platform is **not** public: it carries the viewer's own read and
quiz flags, and a shared cache would show one member the read state of
another. The cache headers therefore say:

* ``private, max-age=30`` on the member feed - the *browser* may reuse
  it for 30 seconds, no shared cache ever sees it,
* ``no-store`` on the endpoints with personal or administrative data -
  the browser must not keep a copy of it (a shared computer, a proxy).

Everything else is left untouched, and the whole mechanism is switched
off with one setting (``CACHE_CONTROL_ENABLED=false``) or by making the
max-age 0.
"""

from collections.abc import Awaitable, Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings

#: Member feed: stable content, personalised flags. Browser-only cache.
_PRIVATE_CACHE_PREFIXES: tuple[str, ...] = (
    "/api/v1/bible-verses/published",
    "/api/v1/bible-verses/current",
)

#: Personal or administrative data: never cached anywhere.
_NO_STORE_PREFIXES: tuple[str, ...] = (
    "/api/v1/users/me",
    "/api/v1/notifications",
    "/api/v1/attendance",
    "/api/v1/quiz-analytics",
    "/api/v1/quizzes/analytics",
    "/api/v1/quizzes",
    "/api/v1/anonymous-messages",
)


class CacheControlMiddleware(BaseHTTPMiddleware):
    """Set the cache policy of the well-known routes."""

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        response = await call_next(request)
        if not settings.CACHE_CONTROL_ENABLED:
            return response
        # A route that already decided (e.g. a 304) keeps its own header.
        if "cache-control" in response.headers:
            return response

        path = request.url.path
        max_age = settings.FEED_CACHE_MAX_AGE_SECONDS

        if max_age > 0 and path.startswith(_PRIVATE_CACHE_PREFIXES):
            response.headers["Cache-Control"] = f"private, max-age={max_age}"
        elif path.startswith(_NO_STORE_PREFIXES):
            response.headers["Cache-Control"] = "no-store"
        return response
