"""Google OAuth 2.0 authorization-code (redirect) flow helpers.

The browser is redirected to Google, Google returns an authorization code to
``GET /api/v1/auth/google/callback``, and the backend exchanges that code —
so the client secret never reaches the frontend. Only httpx + python-jose are
used; no extra SDK dependency.
"""

from dataclasses import dataclass
from urllib.parse import urlencode

import httpx
from jose import jwt as jose_jwt

from app.config import settings
from app.core.exceptions import ForbiddenError, UnauthorizedError

_GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
_GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
_GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo"
_HTTP_TIMEOUT_SECONDS = 15.0


@dataclass(frozen=True)
class GoogleIdentity:
    """Verified identity claims of the Google account."""

    sub: str
    email: str
    first_name: str | None
    last_name: str | None
    picture: str | None


def require_google_client_id() -> str:
    """Return the configured Google OAuth client ID or raise 403."""
    client_id = settings.GOOGLE_CLIENT_ID
    if not client_id:
        raise ForbiddenError("Google sign-in is not configured")
    return client_id


def require_google_client_secret() -> str:
    secret = settings.GOOGLE_CLIENT_SECRET
    if not secret:
        raise ForbiddenError("Google sign-in is not configured")
    return secret


def build_google_authorize_url(state: str, redirect_uri: str) -> str:
    """The URL the browser is sent to for user consent."""
    params = {
        "client_id": require_google_client_id(),
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "prompt": "select_account",
        "access_type": "online",
    }
    return f"{_GOOGLE_AUTH_ENDPOINT}?{urlencode(params)}"


async def exchange_google_code(code: str, redirect_uri: str) -> GoogleIdentity:
    """Exchange an authorization code for identity claims.

    The token response comes directly from Google over TLS, so the returned
    ID token's claims can be read without re-verifying its signature.
    """
    try:
        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT_SECONDS) as client:
            token_response = await client.post(
                _GOOGLE_TOKEN_ENDPOINT,
                data={
                    "code": code,
                    "client_id": require_google_client_id(),
                    "client_secret": require_google_client_secret(),
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
            token_response.raise_for_status()
            id_token = token_response.json().get("id_token")
            if not isinstance(id_token, str):
                raise UnauthorizedError("Google did not return an identity")

            claims = jose_jwt.decode(
                id_token,
                "not-verified",  # token came directly from Google over TLS
                options={
                    "verify_signature": False,
                    "verify_aud": False,
                    "verify_iss": False,
                },
            )
    except httpx.HTTPError as exc:
        raise UnauthorizedError("Could not complete Google sign-in") from exc
    except Exception as exc:  # noqa: BLE001 - normalized below
        if isinstance(exc, UnauthorizedError):
            raise
        raise UnauthorizedError("Could not complete Google sign-in") from exc

    email = claims.get("email")
    subject = claims.get("sub")
    if (
        not isinstance(email, str)
        or not isinstance(subject, str)
        or claims.get("email_verified") is not True
    ):
        raise UnauthorizedError("The Google account has no verified email")

    given_name = claims.get("given_name")
    family_name = claims.get("family_name")
    picture = claims.get("picture")

    return GoogleIdentity(
        sub=subject,
        email=email,
        first_name=given_name if isinstance(given_name, str) else None,
        last_name=family_name if isinstance(family_name, str) else None,
        picture=picture if isinstance(picture, str) else None,
    )
