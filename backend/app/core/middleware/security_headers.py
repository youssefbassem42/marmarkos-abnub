"""Security headers for every API response (SEC-009).

The API only ever returns JSON, so the policy can be strict: no scripts,
no styles, no frames, no form targets. The browser never renders an API
response, so `default-src 'none'` costs nothing and closes the whole
"the JSON contained markup" class of problems.

The same headers are sent for the Swagger/ReDoc pages, with a relaxed
policy - those pages really do load scripts and styles from a CDN, and
they are only served when DEBUG is on.

HSTS is only sent over HTTPS (directly or through a trusted proxy), so a
plain-HTTP development server is not pinned to TLS by mistake.
"""

from collections.abc import Awaitable, Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings

#: Policy for the JSON API: nothing may be loaded from the response.
API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"

#: Policy for the Swagger/ReDoc pages (served only when DEBUG is on).
DOCS_CSP = (
    "default-src 'none'; "
    "script-src 'unsafe-inline' https://cdn.jsdelivr.net; "
    "style-src 'unsafe-inline' https://cdn.jsdelivr.net; "
    "img-src data: https://fastapi.tiangolo.com; "
    "font-src data: https://cdn.jsdelivr.net; "
    "connect-src 'self'; "
    "frame-ancestors 'none'; base-uri 'none'"
)

#: Permissions the platform does not need. The camera stays available for
#: the same origin because the attendance check-in scans a QR code.
PERMISSIONS_POLICY = (
    "camera=(self), geolocation=(), microphone=(), payment=(), usb=(), interest-cohort=()"
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add the standard hardening headers to every response."""

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        response = await call_next(request)
        self.apply(request, response)
        return response

    @staticmethod
    def apply(request: Request, response: Response) -> None:
        if not settings.SECURITY_HEADERS_ENABLED:
            return

        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = PERMISSIONS_POLICY
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
        response.headers["Cross-Origin-Resource-Policy"] = "same-origin"

        if settings.CSP_ENABLED:
            is_docs = request.url.path in ("/docs", "/redoc", "/docs/oauth2-redirect")
            policy = DOCS_CSP if is_docs else API_CSP
            header = (
                "Content-Security-Policy-Report-Only"
                if settings.CSP_REPORT_ONLY
                else "Content-Security-Policy"
            )
            response.headers[header] = policy

        if settings.HSTS_ENABLED and _is_https(request):
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"


def _is_https(request: Request) -> bool:
    """True when the client reached this app over TLS.

    Behind a TLS-terminating proxy the scheme is http, so the forwarded
    protocol is honoured - but only when the deployment says the proxy
    headers are trustworthy.
    """
    if request.url.scheme == "https":
        return True
    if settings.TRUST_PROXY_HEADERS:
        return request.headers.get("X-Forwarded-Proto", "").split(",")[0].strip() == "https"
    return False
