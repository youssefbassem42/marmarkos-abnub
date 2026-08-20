"""Repository interfaces for the users module.

Application services depend on these protocols, not on the SQLAlchemy
implementations. The ORM models are the entity representations for the
MVP (see docs/database/DATABASE_DESIGN.md, "Architecture decisions").
"""

import uuid
from datetime import datetime
from typing import Protocol

from app.modules.users.domain.enums.role_name import RoleName
from app.modules.users.infrastructure.persistence.models import Role, User, UserQrCode


class RoleRepository(Protocol):
    async def get_by_name(self, name: RoleName) -> Role | None: ...

    async def add(self, role: Role) -> None: ...


class UserRepository(Protocol):
    async def get_by_id(self, user_id: uuid.UUID) -> User | None: ...

    async def get_by_email(self, email: str) -> User | None: ...

    async def get_by_public_id(self, public_id: str) -> User | None: ...

    async def exists_by_email(self, email: str) -> bool: ...

    async def list_all(self) -> list[User]: ...

    async def add(self, user: User) -> None: ...

    async def set_last_login(self, user: User, at: datetime) -> None: ...


class UserQrCodeRepository(Protocol):
    async def create_for_user(self, user_id: uuid.UUID, token_hash: str) -> UserQrCode: ...

    async def get_active_by_token_hash(self, token_hash: str) -> UserQrCode | None: ...

    async def deactivate(self, code: UserQrCode, at: datetime) -> None: ...
