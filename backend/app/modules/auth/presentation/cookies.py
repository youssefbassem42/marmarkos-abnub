from typing import Literal
from urllib.parse import urlsplit

from fastapi import Request, Response

from app.config import settings

REFRESH_TOKEN_COOKIE_NAME = "refresh_token"
_REFRESH_COOKIE_PATH = "/api/v1/auth"

# The values the browser understands for SameSite.
SameSite = Literal["lax", "strict", "none"]
_SAMESITE_VALUES: tuple[str, ...] = ("lax", "strict", "none")


def _request_is_https(request: Request | None) -> bool:
    """True when the client reached the API over TLS.

    Behind a TLS-terminating proxy (Vercel, nginx, Railway) the scheme
    of the request is http, so the forwarded protocol is honoured - but
    only when the deployment says the proxy headers are trustworthy.
    The fallback to APP_ENV catches cases where the cookie is set
    outside a live request context (tests, scripts).
    """
    if request is None:
        return settings.APP_ENV == "production"
    if request.url.scheme == "https":
        return True
    if settings.TRUST_PROXY_HEADERS:
        forwarded = request.headers.get("X-Forwarded-Proto", "").split(",")[0].strip()
        return forwarded == "https"
    return False


def _is_cross_site(request: Request | None) -> bool:
    """True when the browser that calls the API sits on another origin.

    The frontend of the platform is served from one site and the API
    from another (two Vercel projects), so the browser calls the API
    **cross-site**. A SameSite=Lax cookie is then never sent with the
    silent refresh: the server answers "Not authenticated" and the
    member is logged out at every reload of the page.
    """
    if request is None:
        return False
    origin = request.headers.get("origin")
    if not origin:
        # No Origin header: the call is not a browser cross-site call
        # (a mobile app, a server-to-server call, curl).
        return False
    try:
        origin_host = urlsplit(origin).netloc.lower()
    except ValueError:
        return False
    if not origin_host:
        return False
    return origin_host != request.headers.get("host", "").lower()


def _samesite(request: Request | None) -> SameSite:
    """The SameSite of the refresh cookie.

    "lax" (the default) keeps the cookie first-party: the browser only
    sends it with a top-level navigation of the same site. A cross-site
    call needs "none" - and "none" is only accepted by the browser
    together with the Secure flag, which `_is_secure` then forces.
    """
    configured = (settings.COOKIE_SAMESITE or "auto").strip().lower()
    if configured == "none":
        return "none"
    if configured in ("lax", "strict"):
        # The operator knows the shape of the deployment: the explicit
        # setting wins over the automatic detection.
        return "lax" if configured == "lax" else "strict"
    # "auto" (the default): the cookie follows the shape of the call.
    if _is_cross_site(request):
        # The browser would drop a Lax cookie that arrives cross-site:
        # the session would end at every reload of the page.
        return "none"
    return "lax"


def _is_secure(request: Request | None, samesite: SameSite = "lax") -> bool:
    """True when the cookie must carry the Secure flag.

    A SameSite=None cookie is **refused** by the browser when it is not
    Secure, so the flag is forced in that case: the cookie then only
    travels over HTTPS, which is what the browser wants.
    """
    if settings.COOKIE_SECURE is not None:
        return settings.COOKIE_SECURE
    if samesite == "none":
        return True
    return _request_is_https(request)


def set_refresh_token_cookie(
    response: Response,
    token: str,
    max_age: int | None,
    *,
    request: Request | None = None,
) -> None:
    """Set the HttpOnly cookie of the refresh token.

    ``max_age=None`` makes it a **session cookie**: it dies with the
    browser, so the session ends when the window is closed. A number
    makes it outlive the browser (the member ticked "remember me").

    The SameSite of the cookie follows the shape of the deployment: a
    same-site frontend keeps the strict "lax" of the platform, a
    cross-site frontend (the API lives on another site) gets "none"
    with the Secure flag, otherwise the browser would never send the
    cookie back and the session would end at every reload.
    """
    samesite = _samesite(request)
    response.set_cookie(
        key=REFRESH_TOKEN_COOKIE_NAME,
        value=token,
        max_age=max_age,
        path=_REFRESH_COOKIE_PATH,
        httponly=True,
        samesite=samesite,
        secure=_is_secure(request, samesite),
    )


def clear_refresh_token_cookie(response: Response, *, request: Request | None = None) -> None:
    # The cookie is deleted with the same attributes it was set with,
    # so the browser really removes it.
    samesite = _samesite(request)
    response.delete_cookie(
        key=REFRESH_TOKEN_COOKIE_NAME,
        path=_REFRESH_COOKIE_PATH,
        httponly=True,
        samesite=samesite,
        secure=_is_secure(request, samesite),
    )
