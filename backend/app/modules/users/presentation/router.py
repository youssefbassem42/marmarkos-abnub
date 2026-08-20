from typing import Annotated

from fastapi import APIRouter, Depends, Response

from app.modules.auth.presentation.dependencies import (
    SessionDependency,
    get_current_user,
    require_role,
)
from app.modules.users.application.dto import UserResponse
from app.modules.users.application.mappers.user_mapper import map_user_to_response
from app.modules.users.application.services import ProfileQueryService
from app.modules.users.domain.enums.role_name import RoleName
from app.modules.users.infrastructure.persistence.models import User

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: Annotated[User, Depends(get_current_user)],
    session: SessionDependency,
) -> UserResponse:
    user = await ProfileQueryService(session).get_profile(current_user.id)
    return map_user_to_response(user)


@router.get("/me/qr")
async def get_me_qr(
    current_user: Annotated[User, Depends(get_current_user)],
    session: SessionDependency,
) -> Response:
    svg = await ProfileQueryService(session).get_qr(current_user)
    return Response(content=svg, media_type="image/svg+xml")


@router.get("", response_model=list[UserResponse])
async def list_users(
    _admin: Annotated[User, Depends(require_role(RoleName.ADMIN))],
    session: SessionDependency,
) -> list[UserResponse]:
    users = await ProfileQueryService(session).list_users()
    return [map_user_to_response(user) for user in users]
