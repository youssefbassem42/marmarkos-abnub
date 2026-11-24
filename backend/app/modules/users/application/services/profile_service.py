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
    """Read-only profile and QR queries.

    Uses ``UnitOfWork.from_session(session)`` where ``session`` is
    owned by the FastAPI ``get_db_session`` dependency. The single write path
    (``get_qr``) calls ``await self._uow.commit()`` explicitly.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._uow = UnitOfWork.from_session(session)
        self._users = UserRepository(session)
        self._qr = QRService()

    async def get_profile(self, user_id: uuid.UUID) -> User:
        user = await self._users.get_by_id(user_id)
        if user is None:
            raise NotFoundError("User not found")
        return user

    async def get_qr(self, user: User) -> str:
        """Render the QR code of the member, and keep it **the same**.

        The code of a member does not change when the page is opened
        again, when the browser is refreshed or when the member signs in
        again: the member saves it once and shows it to the servant
        without opening the platform (BR-83).

        The code is created the first time only. A code created before
        the payload was stored (only its hash was known) is replaced
        once, and only once.
        """
        existing = await self._uow.qr_codes.get_active_for_user(user.id)
        if existing is not None and existing.payload:
            return self._qr.generate_svg(existing.payload)

        payload = generate_qr_payload()
        await self._uow.qr_codes.create_for_user(user.id, hash_qr_payload(payload), payload=payload)
        await self._uow.commit()
        return self._qr.generate_svg(payload)

    async def regenerate_qr(self, user: User) -> str:
        """Replace the code of the member with a new one (BR-83).

        The old code stops working **immediately**: the copy that the
        member saved (a photo, a printed sheet) is refused by the
        check-in from this moment on.
        """
        payload = generate_qr_payload()
        await self._uow.qr_codes.create_for_user(user.id, hash_qr_payload(payload), payload=payload)
        await self._uow.commit()
        return self._qr.generate_svg(payload)

    async def list_users(self) -> list[User]:
        return await self._users.list_all()
