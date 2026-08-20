import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.modules.users.infrastructure.persistence.models import User
from app.modules.users.infrastructure.persistence.user_repository import UserRepository
from app.modules.users.infrastructure.services import (
    QRService,
    generate_qr_payload,
    hash_qr_payload,
)
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork


class ProfileQueryService:
    def __init__(self, session: AsyncSession) -> None:
        self._uow = UnitOfWork(session)
        self._users = UserRepository(session)
        self._qr = QRService()

    async def get_profile(self, user_id: uuid.UUID) -> User:
        user = await self._users.get_by_id(user_id)
        if user is None:
            raise NotFoundError("User not found")
        return user

    async def get_qr(self, user: User) -> str:
        """Issue a fresh, revocable QR token and render it as SVG.

        Issuing a new token deactivates the previous one, so QR codes are
        revocable and regeneratable. Only the token hash is persisted; the
        payload carries no personal data.
        """
        payload = generate_qr_payload()
        await self._uow.qr_codes.create_for_user(user.id, hash_qr_payload(payload))
        await self._uow.commit()
        return self._qr.generate_svg(payload)

    async def list_users(self) -> list[User]:
        return await self._users.list_all()
