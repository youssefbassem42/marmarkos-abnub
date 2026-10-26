"""Hashing of the opaque tokens (refresh tokens, e-mail action links).

The raw token only ever travels inside the HttpOnly cookie or the
emailed link; the database stores its hash.

Two formats exist during the migration window:

* ``v2:<hmac-sha256>`` - the current format. The hash is *keyed* with
  ``JWT_REFRESH_SECRET``, so a leaked database is not enough to verify a
  guessed token: the key never leaves the server (SEC-005).
* the plain SHA-256 of the token - the legacy format. Tokens issued
  before the migration are still accepted (dual read) and are replaced
  by a v2 hash the next time they are used.
"""

import hashlib
import hmac
import secrets

from app.config import settings

#: Marker of the keyed hash format.
V2_PREFIX = "v2:"


def generate_refresh_token() -> str:
    """A fresh opaque token (384 bits of entropy)."""
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    """The keyed hash (HMAC-SHA-256) of a token.

    The key is the server-side ``JWT_REFRESH_SECRET`` - a secret that
    exists for exactly this purpose and was never stored anywhere else.
    """
    digest = hmac.new(
        settings.JWT_REFRESH_SECRET.encode("utf-8"),
        token.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"{V2_PREFIX}{digest}"


def hash_refresh_token_legacy(token: str) -> str:
    """The plain SHA-256 hash used before the keyed format.

    Read-only: it exists so a token issued before the migration can
    still be recognised. New tokens are never stored this way.
    """
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def is_legacy_hash(token_hash: str) -> bool:
    """True when a stored hash still uses the old, unkeyed format."""
    return not token_hash.startswith(V2_PREFIX)
