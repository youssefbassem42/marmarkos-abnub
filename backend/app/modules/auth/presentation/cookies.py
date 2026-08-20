from fastapi import Response

from app.config import settings

REFRESH_TOKEN_COOKIE_NAME = "refresh_token"
_REFRESH_COOKIE_PATH = "/api/v1/auth"


def set_refresh_token_cookie(response: Response, token: str, max_age: int) -> None:
    response.set_cookie(
        key=REFRESH_TOKEN_COOKIE_NAME,
        value=token,
        max_age=max_age,
        path=_REFRESH_COOKIE_PATH,
        httponly=True,
        samesite="lax",
        secure=settings.APP_ENV == "production",
    )


def clear_refresh_token_cookie(response: Response) -> None:
    response.delete_cookie(key=REFRESH_TOKEN_COOKIE_NAME, path=_REFRESH_COOKIE_PATH)
