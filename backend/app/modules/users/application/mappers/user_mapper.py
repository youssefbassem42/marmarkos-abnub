from app.modules.users.application.dto.user_response import UserResponse
from app.modules.users.infrastructure.persistence.models import User


def map_user_to_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        phone=user.phone,
        first_name=user.first_name,
        last_name=user.last_name,
        date_of_birth=user.date_of_birth,
        address=user.address,
        avatar=user.avatar,
        role=user.role.name,
        status=user.status,
        public_id=user.public_id,
        created_at=user.created_at,
        has_password=user.has_password,
    )
