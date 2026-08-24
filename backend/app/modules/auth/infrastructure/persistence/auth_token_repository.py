import uuid
from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.domain.enums.auth_token_purpose import AuthTokenPurpose
from app.modules.auth.infrastructure.persistence.models import AuthToken


class AuthTokenRepository:
    """Persistence for single-use email action tokens."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, token: AuthToken) -> None:
        self._session.add(token)
        await self._session.flush()

    async def get_valid(
        self, token_hash: str, purpose: AuthTokenPurpose, now: datetime
    ) -> AuthToken | None:
        """Return the token only when unused and unexpired."""
        result = await self._session.execute(
            select(AuthToken).where(
                AuthToken.token_hash == token_hash,
                AuthToken.purpose == purpose,
                AuthToken.used_at.is_(None),
                AuthToken.expires_at > now,
            )
        )
        return result.scalar_one_or_none()

    async def mark_used(self, token: AuthToken, used_at: datetime) -> None:
        token.used_at = used_at
        await self._session.flush()

    async def invalidate_all_for_user(
        self, user_id: uuid.UUID, purpose: AuthTokenPurpose, at: datetime
    ) -> None:
        """Consume every pending link of this purpose (old links die when a new one is issued)."""
        await self._session.execute(
            update(AuthToken)
            .where(
                AuthToken.user_id == user_id,
                AuthToken.purpose == purpose,
                AuthToken.used_at.is_(None),
            )
            .values(used_at=at)
        )

    async def delete_expired(self, before: datetime) -> int:
        from sqlalchemy import delete
        from sqlalchemy.engine import CursorResult

        result = await self._session.execute(delete(AuthToken).where(AuthToken.expires_at < before))
        assert isinstance(result, CursorResult)
        return result.rowcount or 0
