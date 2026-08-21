from typing import Annotated

from fastapi import APIRouter, Depends, File, Response, UploadFile

from app.core.exceptions import ValidationError
from app.modules.auth.presentation.dependencies import (
    SessionDependency,
    get_current_user,
    require_role,
)
from app.modules.users.application.dto import UserResponse
from app.modules.users.application.dto.profile_update import (
    ChangePasswordRequest,
    UpdateProfileRequest,
)
from app.modules.users.application.mappers.user_mapper import map_user_to_response
from app.modules.users.application.services import ProfileCommandService, ProfileQueryService
from app.modules.users.domain.enums.role_name import RoleName
from app.modules.users.infrastructure.persistence.models import User
from app.shared.infrastructure.services.image_upload import upload_image

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: Annotated[User, Depends(get_current_user)],
    session: SessionDependency,
) -> UserResponse:
    user = await ProfileQueryService(session).get_profile(current_user.id)
    return map_user_to_response(user)


@router.patch("/me", response_model=UserResponse)
async def update_me(
    payload: UpdateProfileRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    session: SessionDependency,
) -> UserResponse:
    """Update the authenticated user's own profile fields."""
    user = await ProfileCommandService(session).update_profile(current_user, payload)
    return map_user_to_response(user)


@router.post("/me/password", response_model=UserResponse)
async def change_password(
    payload: ChangePasswordRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    session: SessionDependency,
) -> UserResponse:
    """Change the account password; all other sessions are signed out."""
    await ProfileCommandService(session).change_password(current_user, payload)
    return map_user_to_response(current_user)


AvatarFile = Annotated[UploadFile, File(...)]


@router.post("/me/avatar", response_model=UserResponse)
async def upload_avatar(
    current_user: Annotated[User, Depends(get_current_user)],
    session: SessionDependency,
    file: AvatarFile,
) -> UserResponse:
    """Upload a profile photo (stored on Cloudinary; only the URL is kept)."""
    content_type = file.content_type or ""
    data = await file.read()
    if len(data) > 2 * 1024 * 1024:
        raise ValidationError("Image must be 2 MB or smaller")

    avatar_url = await upload_image(data, content_type)
    user = await ProfileCommandService(session).set_avatar(current_user.id, avatar_url)
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
