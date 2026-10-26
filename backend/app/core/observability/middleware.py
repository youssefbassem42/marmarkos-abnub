"""The request-id middleware (SEC-014).

Every request gets an id: the one the client sent (a proxy or the
frontend can correlate it) or a fresh one. The id is bound to the
context (so every log line carries it) and echoed in the response, so a
member can quote it in a bug report.
"""

import re
import time
from collections.abc import Awaitable, Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.observability.context import new_request_id, reset_request_id, set_request_id
from app.core.observability.metrics import increment

REQUEST_ID_HEADER = "X-Request-ID"

# A request id is a short opaque string; anything longer or with control
# characters is ignored (it would end up in the logs and in the headers).
_SAFE_REQUEST_ID = re.compile(r"^[A-Za-z0-9._\-]{1,64}$")


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Attach a request id, time the request and count it."""

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        incoming = request.headers.get(REQUEST_ID_HEADER, "")
        request_id = incoming if _SAFE_REQUEST_ID.match(incoming) else new_request_id()

        token = set_request_id(request_id)
        request.state.request_id = request_id
        started = time.perf_counter()
        try:
            response = await call_next(request)
        finally:
            reset_request_id(token)

        elapsed_ms = (time.perf_counter() - started) * 1000
        response.headers[REQUEST_ID_HEADER] = request_id
        increment(
            "marmarkos_http_requests_total",
            {
                "method": request.method,
                "path": request.url.path,
                "status": str(response.status_code),
            },
        )
        increment("marmarkos_http_request_duration_ms_sum", {"path": request.url.path}, elapsed_ms)
        return response
