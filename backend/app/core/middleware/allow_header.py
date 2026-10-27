"""The ``Allow`` header of a 405 answer (QA-005).

When a path exists but the method does not, Starlette answers 405 and
writes an ``Allow`` header with the methods of the **first** route it
finds for that path. On a path that carries several methods - the quiz
list answers both ``GET`` and ``POST`` - the header therefore names only
one of them, although RFC 9110 asks for every method the resource
supports.

The middleware computes the real list from the routing table and
completes the header. It only ever *adds* methods: a header that is
already complete stays as it is.
"""

import re
from collections.abc import Awaitable, Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

#: The methods that are never announced (they are not part of the
#: resource contract of the API).
_IGNORED_METHODS = frozenset({"HEAD", "OPTIONS"})

#: A path parameter of the schema ("/verses/{verse_id}").
_PARAMETER = re.compile(r"\{[^}]+\}")


def _path_pattern(template: str) -> re.Pattern[str]:
    """The matcher of a path template ("/verses/{id}" -> "/verses/[^/]+")."""
    parts = _PARAMETER.split(template)
    pattern = "[^/]+".join(re.escape(part) for part in parts)
    return re.compile(f"^{pattern}$")


class AllowHeaderMiddleware(BaseHTTPMiddleware):
    """Complete the ``Allow`` header of every 405 answer."""

    def __init__(self, app: ASGIApp, allowed_methods: dict[str, set[str]]) -> None:
        super().__init__(app)
        self._allowed_methods = allowed_methods
        # The schema carries the templates ("/verses/{verse_id}"), the
        # request carries the concrete path ("/verses/8f0e...").
        self._patterns = [
            (_path_pattern(template), methods) for template, methods in allowed_methods.items()
        ]

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        response = await call_next(request)
        if response.status_code != 405:
            return response

        existing = {
            method.strip().upper()
            for method in response.headers.get("Allow", "").split(",")
            if method.strip()
        }
        methods: set[str] = set()
        for pattern, path_methods in self._patterns:
            if pattern.match(request.url.path):
                methods = path_methods
                break
        complete = sorted((existing | methods) - _IGNORED_METHODS)
        if complete:
            response.headers["Allow"] = ", ".join(complete)
        return response
