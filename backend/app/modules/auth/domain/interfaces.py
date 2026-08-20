"""Repository interface for refresh-token persistence."""

import uuid
from datetime import datetime
from typing import Protocol

from app.modules.auth.infrastructure.persistence.models import RefreshToken


class RefreshTokenRepository(Protocol):
    async def get_by_hash(self, token_hash: str) -> RefreshToken | None: ...

    async def add(self, token: RefreshToken) -> None: ...

    async def revoke(self, token: RefreshToken, revoked_at: datetime) -> None: ...

    async def revoke_all_for_user(self, user_id: uuid.UUID, revoked_at: datetime) -> None: ...
