import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.modules.users.domain.enums.role_name import RoleName
from app.modules.users.domain.enums.user_status import UserStatus


class UserResponse(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    id: uuid.UUID
    email: str
    phone: str | None
    first_name: str | None
    last_name: str | None
    date_of_birth: date | None
    address: str | None
    avatar: str | None
    role: RoleName
    status: UserStatus
    public_id: str
    created_at: datetime
    has_password: bool = True
