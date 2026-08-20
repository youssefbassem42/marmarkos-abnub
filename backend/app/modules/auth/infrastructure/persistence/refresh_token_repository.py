import uuid
from datetime import datetime

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.infrastructure.persistence.models import RefreshToken


class RefreshTokenRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_hash(self, token_hash: str) -> RefreshToken | None:
        result = await self._session.execute(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
        return result.scalar_one_or_none()

    async def add(self, token: RefreshToken) -> None:
        self._session.add(token)
        await self._session.flush()

    async def revoke(self, token: RefreshToken, revoked_at: datetime) -> None:
        token.revoked_at = revoked_at
        await self._session.flush()

    async def revoke_all_for_user(self, user_id: uuid.UUID, revoked_at: datetime) -> None:
        await self._session.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=revoked_at)
        )

    async def delete_expired(self, before: datetime) -> int:
        from sqlalchemy.engine import CursorResult

        result = await self._session.execute(
            delete(RefreshToken).where(RefreshToken.expires_at < before)
        )
        assert isinstance(result, CursorResult)
        return result.rowcount or 0
