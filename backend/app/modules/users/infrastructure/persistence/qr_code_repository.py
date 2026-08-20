import uuid
from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.users.infrastructure.persistence.models import UserQrCode


class UserQrCodeRepository:
    """Revocable/regeneratable QR identity tokens.

    A new token deactivates the user's previous active token (at most one
    active token per user, enforced by a partial unique index).
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create_for_user(self, user_id: uuid.UUID, token_hash: str) -> UserQrCode:
        await self._session.execute(
            update(UserQrCode)
            .where(UserQrCode.user_id == user_id, UserQrCode.is_active.is_(True))
            .values(is_active=False, deactivated_at=datetime.now())
        )
        code = UserQrCode(user_id=user_id, token_hash=token_hash, is_active=True)
        self._session.add(code)
        await self._session.flush()
        return code

    async def get_active_by_token_hash(self, token_hash: str) -> UserQrCode | None:
        result = await self._session.execute(
            select(UserQrCode).where(
                UserQrCode.token_hash == token_hash, UserQrCode.is_active.is_(True)
            )
        )
        return result.scalar_one_or_none()

    async def get_active_for_user(self, user_id: uuid.UUID) -> UserQrCode | None:
        result = await self._session.execute(
            select(UserQrCode).where(UserQrCode.user_id == user_id, UserQrCode.is_active.is_(True))
        )
        return result.scalar_one_or_none()

    async def deactivate(self, code: UserQrCode, at: datetime) -> None:
        code.is_active = False
        code.deactivated_at = at
        await self._session.flush()
