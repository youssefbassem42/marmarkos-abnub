import secrets

from fastapi import APIRouter, Request, Response
from fastapi.responses import RedirectResponse

from app.config import settings
from app.core.exceptions import AppError, UnauthorizedError
from app.modules.auth.application.dto import (
    AuthResponse,
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    TokenResponse,
)
from app.modules.auth.application.services import AuthenticationService, RegistrationService
from app.modules.auth.infrastructure.services import (
    build_google_authorize_url,
    exchange_google_code,
)
from app.modules.auth.presentation.cookies import (
    REFRESH_TOKEN_COOKIE_NAME,
    clear_refresh_token_cookie,
    set_refresh_token_cookie,
)
from app.modules.auth.presentation.dependencies import SessionDependency
from app.modules.users.application.dto import UserResponse
from app.modules.users.application.mappers.user_mapper import map_user_to_response

router = APIRouter(prefix="/auth", tags=["Auth"])

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


@router.get("/google/login")
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


@router.get("/google/callback")
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
    except AppError:
        return back("#error=sign_in_failed")

    success = back(f"#access_token={result.access_token}&expires_in={result.expires_in}")
    set_refresh_token_cookie(success, result.refresh_token, _REFRESH_COOKIE_MAX_AGE)
    success.delete_cookie(_OAUTH_STATE_COOKIE, path="/api/v1/auth/google")
    return success


@router.post("/register", response_model=UserResponse, status_code=201)
async def register(payload: RegisterRequest, session: SessionDependency) -> UserResponse:
    user = await RegistrationService(session).register(payload)
    return map_user_to_response(user)


@router.post("/login", response_model=AuthResponse)
async def login(
    payload: LoginRequest, request: Request, response: Response, session: SessionDependency
) -> AuthResponse:
    result = await AuthenticationService(session).login(
        payload,
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    set_refresh_token_cookie(response, result.refresh_token, _REFRESH_COOKIE_MAX_AGE)
    return AuthResponse(
        access_token=result.access_token,
        expires_in=result.expires_in,
        user=map_user_to_response(result.user),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    request: Request, response: Response, session: SessionDependency
) -> TokenResponse:
    refresh_token = request.cookies.get(REFRESH_TOKEN_COOKIE_NAME)
    if refresh_token is None:
        raise UnauthorizedError("Not authenticated")
    result = await AuthenticationService(session).refresh(
        refresh_token,
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    set_refresh_token_cookie(response, result.refresh_token, _REFRESH_COOKIE_MAX_AGE)
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
