import logging
import secrets

from fastapi import APIRouter, BackgroundTasks, Request, Response
from fastapi.responses import RedirectResponse

from app.config import settings
from app.core.exceptions import AppError, ConflictError, ForbiddenError, UnauthorizedError
from app.modules.auth.application.dto import (
    AuthResponse,
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    ResendVerificationRequest,
    ResetPasswordRequest,
    TokenResponse,
    VerifyEmailRequest,
)
from app.modules.auth.application.services import (
    AuthenticationService,
    EmailVerificationService,
    PasswordResetService,
    RegistrationService,
    resend_verification_in_background,
    send_password_reset_in_background,
    send_verification_email_in_background,
)
from app.modules.auth.infrastructure.services import (
    build_google_authorize_url,
    exchange_google_code,
)
from app.modules.auth.presentation.cookies import (
    REFRESH_TOKEN_COOKIE_NAME,
    clear_refresh_token_cookie,
    set_refresh_token_cookie,
)
from app.modules.auth.presentation.rate_limit import (
    check_login_attempt,
    check_password_reset_attempt,
    check_refresh_attempt,
    check_register_attempt,
    check_resend_verification_attempt,
    clear_login_failures,
)
from app.modules.users.application.mappers.user_mapper import map_user_to_response
from app.modules.users.presentation.dependencies import SessionDependency

router = APIRouter(prefix="/auth", tags=["Auth"])

logger = logging.getLogger(__name__)

_REFRESH_COOKIE_MAX_AGE = settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60
_OAUTH_STATE_COOKIE = "google_oauth_state"
_OAUTH_STATE_MAX_AGE = 600


def _frontend_url() -> str:
    """Frontend origin, tolerant of a scheme-less env value."""
    url = settings.FRONTEND_URL.rstrip("/")
    return url if url.startswith(("http://", "https://")) else f"https://{url}"


def _google_redirect_uri(request: Request) -> str:
    """Callback URL on this API deployment; must match Google Console."""
    base = str(request.base_url).rstrip("/")
    return f"{base}/api/v1/auth/google/callback"


@router.get(
    "/google/login",
    # The endpoint answers with a redirect to Google (or back to the
    # frontend when Google is not configured) - never with a body.
    responses={303: {"description": "Redirect to the Google sign-in page"}},
)
async def google_login_start(request: Request) -> RedirectResponse:
    """Kick off the OAuth redirect flow: send the browser to Google."""
    frontend = _frontend_url()
    if not (settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET):
        return RedirectResponse(f"{frontend}/google/callback#error=not_configured", status_code=303)

    state = secrets.token_urlsafe(32)
    response = RedirectResponse(
        build_google_authorize_url(state, _google_redirect_uri(request)),
        status_code=303,
    )
    response.set_cookie(
        _OAUTH_STATE_COOKIE,
        state,
        max_age=_OAUTH_STATE_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=request.url.scheme == "https",
        path="/api/v1/auth/google",
    )
    return response


@router.get(
    "/google/callback",
    # The endpoint answers with a redirect to the frontend (the access
    # token travels in the URL fragment) - never with a body.
    responses={303: {"description": "Redirect to the frontend with the access token"}},
)
async def google_login_callback(
    request: Request,
    session: SessionDependency,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
) -> RedirectResponse:
    """Handle Google's redirect: verify state, sign the user in, bounce home."""
    frontend = _frontend_url()

    def back(fragment: str) -> RedirectResponse:
        return RedirectResponse(f"{frontend}/google/callback{fragment}", status_code=303)

    if error:
        return back(f"#error={error}")

    expected_state = request.cookies.get(_OAUTH_STATE_COOKIE)
    if not code or not state or not expected_state or state != expected_state:
        return back("#error=invalid_state")

    try:
        identity = await exchange_google_code(code, _google_redirect_uri(request))
        result = await AuthenticationService(session).google_login(
            identity,
            user_agent=request.headers.get("user-agent"),
            ip_address=request.client.host if request.client else None,
        )
    except ForbiddenError as exc:
        logger.warning("Google sign-in rejected: %s", exc)
        return back("#error=account_inactive")
    except UnauthorizedError as exc:
        logger.warning("Google identity verification failed: %s", exc)
        return back("#error=identity_failed")
    except AppError:
        logger.exception("Google sign-in failed")
        return back("#error=sign_in_failed")

    success = back(f"#access_token={result.access_token}&expires_in={result.expires_in}")
    set_refresh_token_cookie(
        success,
        result.refresh_token,
        _REFRESH_COOKIE_MAX_AGE if result.persistent else None,
        request=request,
    )
    success.delete_cookie(_OAUTH_STATE_COOKIE, path="/api/v1/auth/google")
    return success


@router.post(
    "/register",
    response_model=MessageResponse,
    status_code=202,
    # The rate limiter of the registration (SEC-007).
    openapi_extra={"x-rate-limited": True},
)
async def register(
    payload: RegisterRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    session: SessionDependency,
) -> MessageResponse:
    """Create the account and answer with the same body in every case.

    A duplicate address used to answer 409 and a fresh one 201, which
    turned this endpoint into an account oracle (SEC-007/SEC-013). The
    answer is now always 202 with the same body; the verification mail
    is sent in the background, so the response time does not reveal the
    difference either.
    """
    check_register_attempt(request)
    try:
        user = await RegistrationService(session).register(payload)
    except ConflictError:
        # The address is taken: say exactly what a fresh registration says.
        return MessageResponse(
            message="If this address can be registered, a verification email has been sent"
        )
    background_tasks.add_task(send_verification_email_in_background, user.id)
    return MessageResponse(
        message="If this address can be registered, a verification email has been sent"
    )


@router.post(
    "/verify-email",
    response_model=MessageResponse,
    responses={401: {"description": "The token is invalid or has expired"}},
)
async def verify_email(payload: VerifyEmailRequest, session: SessionDependency) -> MessageResponse:
    """Consume the emailed token and activate the account."""
    await EmailVerificationService(session).confirm(payload.token)
    return MessageResponse(message="Email verified successfully")


@router.post(
    "/resend-verification",
    response_model=MessageResponse,
    status_code=202,
    # The rate limiter of the resend (SEC-007).
    openapi_extra={"x-rate-limited": True},
)
async def resend_verification(
    payload: ResendVerificationRequest,
    request: Request,
    background_tasks: BackgroundTasks,
) -> MessageResponse:
    """Re-send the verification link (quiet no-op for unknown addresses).

    The mail is sent in the background and the answer is always the
    same, so neither the body nor the response time reveals whether the
    address exists (SEC-013).
    """
    check_resend_verification_attempt(request)
    background_tasks.add_task(resend_verification_in_background, payload.email.lower())
    return MessageResponse(message="If the account exists, a verification email has been sent")


@router.post(
    "/password/forgot",
    response_model=MessageResponse,
    status_code=202,
    # The rate limiter of the password reset (SEC-007).
    openapi_extra={"x-rate-limited": True},
)
async def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    background_tasks: BackgroundTasks,
) -> MessageResponse:
    """Email a reset link; always succeeds to avoid address enumeration.

    The mail is sent in the background and the answer is always the
    same, so neither the body nor the response time reveals whether the
    address exists (SEC-013).
    """
    check_password_reset_attempt(request)
    background_tasks.add_task(send_password_reset_in_background, payload.email.lower())
    return MessageResponse(
        message="If an account exists for this email, a reset link has been sent"
    )


@router.post(
    "/password/reset",
    response_model=MessageResponse,
    responses={401: {"description": "The token is invalid or has expired"}},
)
async def reset_password(
    payload: ResetPasswordRequest, session: SessionDependency
) -> MessageResponse:
    """Consume the emailed token and set the new password."""
    await PasswordResetService(session).reset(payload)
    return MessageResponse(message="Password has been reset successfully")


@router.post(
    "/login",
    response_model=AuthResponse,
    responses={401: {"description": "Invalid credentials"}},
    # The rate limiter of the sign-in (SEC-007).
    openapi_extra={"x-rate-limited": True},
)
async def login(
    payload: LoginRequest, request: Request, response: Response, session: SessionDependency
) -> AuthResponse:
    try:
        result = await AuthenticationService(session).login(
            payload,
            user_agent=request.headers.get("user-agent"),
            ip_address=request.client.host if request.client else None,
        )
    except UnauthorizedError:
        # Only failed sign-ins are counted: a burst of successful sign-ins
        # (one shared address, a whole service) must never lock anyone out.
        check_login_attempt(request, payload.email)
        raise
    clear_login_failures(payload.email)
    set_refresh_token_cookie(
        response,
        result.refresh_token,
        _REFRESH_COOKIE_MAX_AGE if result.persistent else None,
        request=request,
    )
    return AuthResponse(
        access_token=result.access_token,
        expires_in=result.expires_in,
        user=map_user_to_response(result.user),
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    responses={401: {"description": "The refresh cookie is missing or invalid"}},
    # The rate limiter of the silent refresh (SEC-007).
    openapi_extra={"x-rate-limited": True},
)
async def refresh(
    request: Request, response: Response, session: SessionDependency
) -> TokenResponse:
    check_refresh_attempt(request)
    refresh_token = request.cookies.get(REFRESH_TOKEN_COOKIE_NAME)
    if refresh_token is None:
        raise UnauthorizedError("Not authenticated")
    result = await AuthenticationService(session).refresh(
        refresh_token,
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    set_refresh_token_cookie(
        response,
        result.refresh_token,
        _REFRESH_COOKIE_MAX_AGE if result.persistent else None,
        request=request,
    )
    return TokenResponse(
        access_token=result.access_token,
        expires_in=result.expires_in,
    )


@router.post("/logout", response_model=MessageResponse)
async def logout(
    request: Request, response: Response, session: SessionDependency
) -> MessageResponse:
    refresh_token = request.cookies.get(REFRESH_TOKEN_COOKIE_NAME)
    if refresh_token is not None:
        await AuthenticationService(session).logout(refresh_token)
    clear_refresh_token_cookie(response)
    return MessageResponse(message="Logged out successfully")
