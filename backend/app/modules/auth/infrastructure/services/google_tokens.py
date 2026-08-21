"""Google ID-token verification for "Sign in with Google".

The frontend obtains an ID token from Google Identity Services and posts it
to ``POST /auth/google``. The token's RS256 signature is verified against
Google's published JWKS, together with ``iss``, ``aud`` and expiry claims.
Only existing dependencies (httpx + python-jose) are used.
"""

import time
from dataclasses import dataclass
from typing import Any

import httpx
from jose import jwt as jose_jwt
from jose.exceptions import JOSEError

from app.config import settings
from app.core.exceptions import ForbiddenError, UnauthorizedError

_GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
_GOOGLE_ISSUERS = ("https://accounts.google.com", "accounts.google.com")
_JWKS_CACHE_SECONDS = 3600
_HTTP_TIMEOUT_SECONDS = 10.0


@dataclass(frozen=True)
class GoogleIdentity:
    """Verified identity claims extracted from a Google ID token."""

    sub: str
    email: str
    first_name: str | None
    last_name: str | None
    picture: str | None


class _JwksCache:
    """Tiny in-process cache of Google's signing keys (JWKS)."""

    def __init__(self) -> None:
        self._keys: dict[str, dict[str, Any]] = {}
        self._fetched_at: float = 0.0

    def is_fresh(self) -> bool:
        return bool(self._keys) and (time.monotonic() - self._fetched_at) < _JWKS_CACHE_SECONDS

    def store(self, keys: list[dict[str, Any]]) -> None:
        self._keys = {key["kid"]: key for key in keys if "kid" in key}
        self._fetched_at = time.monotonic()

    def get(self, kid: str) -> dict[str, Any] | None:
        return self._keys.get(kid)


_cache = _JwksCache()


async def _fetch_jwks(client: httpx.AsyncClient) -> list[dict[str, Any]]:
    response = await client.get(_GOOGLE_JWKS_URL)
    response.raise_for_status()
    keys: list[dict[str, Any]] = response.json().get("keys", [])
    return keys


def require_google_client_id() -> str:
    """Return the configured Google OAuth client ID or raise 403."""
    client_id = settings.GOOGLE_CLIENT_ID
    if not client_id:
        raise ForbiddenError("Google sign-in is not configured")
    return client_id


async def verify_google_id_token(credential: str) -> GoogleIdentity:
    """Verify a Google ID token and return its identity claims.

    Raises UnauthorizedError when the token is malformed, signed by an unknown
    key, expired, issued for another audience/issuer, or lacks verified email.
    """
    try:
        header = jose_jwt.get_unverified_header(credential)
    except JOSEError as exc:
        raise UnauthorizedError("Invalid Google credential") from exc

    kid = header.get("kid")
    if not kid:
        raise UnauthorizedError("Invalid Google credential")

    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT_SECONDS) as client:
        if not _cache.is_fresh() or _cache.get(kid) is None:
            try:
                _cache.store(await _fetch_jwks(client))
            except httpx.HTTPError as exc:
                raise UnauthorizedError(
                    "Could not verify the Google credential right now"
                ) from exc

        jwk_key = _cache.get(kid)
        if jwk_key is None:
            raise UnauthorizedError("Invalid Google credential")

        try:
            payload = jose_jwt.decode(
                credential,
                jwk_key,
                algorithms=["RS256"],
                audience=require_google_client_id(),
                issuer=_GOOGLE_ISSUERS,
                options={"require": ["exp", "iat", "aud", "iss", "sub", "email"]},
            )
        except JOSEError as exc:
            raise UnauthorizedError("Invalid or expired Google credential") from exc

    email: object = payload.get("email")
    subject: object = payload.get("sub")
    if (
        not isinstance(email, str)
        or not isinstance(subject, str)
        or payload.get("email_verified") is not True
    ):
        raise UnauthorizedError("The Google account has no verified email")

    given_name = payload.get("given_name")
    family_name = payload.get("family_name")
    picture = payload.get("picture")

    return GoogleIdentity(
        sub=subject,
        email=email,
        first_name=given_name if isinstance(given_name, str) else None,
        last_name=family_name if isinstance(family_name, str) else None,
        picture=picture if isinstance(picture, str) else None,
    )
