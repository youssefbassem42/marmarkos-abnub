from fastapi import APIRouter, Request, Response

from app.config import settings
from app.core.exceptions import UnauthorizedError
from app.modules.auth.application.dto import (
    AuthResponse,
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    TokenResponse,
)
from app.modules.auth.application.services import AuthenticationService, RegistrationService
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
