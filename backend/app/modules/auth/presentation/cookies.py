from fastapi import Request, Response

from app.config import settings

REFRESH_TOKEN_COOKIE_NAME = "refresh_token"
_REFRESH_COOKIE_PATH = "/api/v1/auth"


def _is_secure(request: Request | None) -> bool:
    """True when the current request arrived over HTTPS or APP_ENV is
    explicitly set to 'production'.

    Checking the scheme directly means staging/preview deployments that
    run over HTTPS (Vercel, Railway, etc.) also get the Secure flag —
    regardless of whether APP_ENV was set to exactly "production".  The
    fallback to APP_ENV catches cases where the cookie is set outside a
    live request context (tests, scripts).
    """
    if request is not None:
        return request.url.scheme == "https"
    return settings.APP_ENV == "production"


def set_refresh_token_cookie(
    response: Response, token: str, max_age: int, *, request: Request | None = None
) -> None:
    response.set_cookie(
        key=REFRESH_TOKEN_COOKIE_NAME,
        value=token,
        max_age=max_age,
        path=_REFRESH_COOKIE_PATH,
        httponly=True,
        samesite="lax",
        secure=_is_secure(request),
    )


def clear_refresh_token_cookie(response: Response) -> None:
    response.delete_cookie(key=REFRESH_TOKEN_COOKIE_NAME, path=_REFRESH_COOKIE_PATH)
