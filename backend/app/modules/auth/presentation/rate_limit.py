"""Rate limits for the unauthenticated auth endpoints (SEC-007).

Why this module exists
----------------------
``POST /auth/login`` was reachable without any limit, so a single client
could hammer the endpoint (credential stuffing) or keep the database busy
with password-hash comparisons. The same holds for the endpoints that
send an e-mail: registration, password reset and the verification
resend.

Design rules
------------
* **Login counts failures only.** A successful sign-in must never consume
  the budget, otherwise a whole church service signing in from one wifi
  address would lock the address out. Failed attempts are counted per IP
  *and* per account; a success clears the account window only.
* **The e-mail endpoints count every attempt**, because each one costs a
  message and an attacker does not need a wrong password to abuse them.
* **No lockout, ever.** The response is 429 with a ``Retry-After``
  header - a client can simply wait. A hard lock (an account that needs
  an admin to unlock) is a denial-of-service vector against the members.
* The windows live in the process memory (R-3), the same limitation the
  anonymous-message limits already have.
"""

from fastapi import Request

from app.config import settings
from app.core.exceptions.errors import RateLimitedError
from app.core.observability import increment
from app.core.rate_limit import (
    SlidingWindowRateLimiter,
    client_ip,
    hash_key,
    register_limiter,
)

_WINDOW = settings.AUTH_RATE_LIMIT_WINDOW_SECONDS

# -- login: failures only ----------------------------------------------------
# The limits are read at request time (a callable), so the settings stay
# the single source of truth and can be tuned without a code change.
_LOGIN_FAILURES_PER_IP = register_limiter(
    SlidingWindowRateLimiter(
        limit=lambda: settings.AUTH_LOGIN_FAILURES_PER_IP,
        window_seconds=_WINDOW,
        name="auth_login_ip",
    )
)
_LOGIN_FAILURES_PER_ACCOUNT = register_limiter(
    SlidingWindowRateLimiter(
        limit=lambda: settings.AUTH_LOGIN_FAILURES_PER_ACCOUNT,
        window_seconds=_WINDOW,
        name="auth_login_account",
    )
)

# -- e-mail sending endpoints: every attempt counts --------------------------
_REGISTER_PER_IP = register_limiter(
    SlidingWindowRateLimiter(
        limit=lambda: settings.AUTH_REGISTER_PER_IP, window_seconds=3600, name="auth_register"
    )
)
_PASSWORD_RESET_PER_IP = register_limiter(
    SlidingWindowRateLimiter(limit=lambda: settings.AUTH_PASSWORD_RESET_PER_IP, window_seconds=3600)
)
_RESEND_VERIFICATION_PER_IP = register_limiter(
    SlidingWindowRateLimiter(
        limit=lambda: settings.AUTH_RESEND_VERIFICATION_PER_IP,
        window_seconds=3600,
        name="auth_resend_verification",
    )
)

# -- token refresh: protects the database from a token-guessing loop --------
_REFRESH_PER_IP = register_limiter(
    SlidingWindowRateLimiter(
        limit=lambda: settings.AUTH_REFRESH_PER_IP, window_seconds=60, name="auth_refresh"
    )
)


def check_login_attempt(request: Request, email: str) -> None:
    """Charge one failed sign-in against the IP and the account windows."""
    ip_key = hash_key(client_ip(request))
    account_key = hash_key(f"account:{email.lower()}")

    ip_failures = _LOGIN_FAILURES_PER_IP.record(ip_key)
    account_failures = _LOGIN_FAILURES_PER_ACCOUNT.record(account_key)

    if ip_failures > settings.AUTH_LOGIN_FAILURES_PER_IP:
        increment("marmarkos_rate_limited_total", {"limiter": "auth_login_ip"})
        raise RateLimitedError(
            "Too many failed sign-in attempts from this address. Please try again later",
            retry_after=_LOGIN_FAILURES_PER_IP.retry_after(ip_key),
        )
    if account_failures > settings.AUTH_LOGIN_FAILURES_PER_ACCOUNT:
        increment("marmarkos_rate_limited_total", {"limiter": "auth_login_account"})
        raise RateLimitedError(
            "Too many failed sign-in attempts for this account. Please try again later",
            retry_after=_LOGIN_FAILURES_PER_ACCOUNT.retry_after(account_key),
        )


def clear_login_failures(email: str) -> None:
    """A successful sign-in clears the failures recorded for that account."""
    _LOGIN_FAILURES_PER_ACCOUNT.reset_key(hash_key(f"account:{email.lower()}"))


def check_register_attempt(request: Request) -> None:
    """Limit how many registrations one address may start."""
    _REGISTER_PER_IP.hit(hash_key(client_ip(request)))


def check_password_reset_attempt(request: Request) -> None:
    """Limit how many reset mails one address may trigger."""
    _PASSWORD_RESET_PER_IP.hit(hash_key(client_ip(request)))


def check_resend_verification_attempt(request: Request) -> None:
    """Limit how many verification mails one address may trigger."""
    _RESEND_VERIFICATION_PER_IP.hit(hash_key(client_ip(request)))


def check_refresh_attempt(request: Request) -> None:
    """Limit the refresh endpoint so it cannot be used as a hash oracle."""
    _REFRESH_PER_IP.hit(hash_key(client_ip(request)))
