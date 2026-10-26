from uuid import UUID

from httpx import AsyncClient
from sqlalchemy import NullPool, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.orm import selectinload

from app.config import settings
from app.core.database import sanitize_database_url
from app.modules.auth.infrastructure.security import verify_password
from app.modules.users.domain.enums.role_name import RoleName
from app.modules.users.domain.enums.user_status import UserStatus
from app.modules.users.infrastructure.persistence.models import Role, User
from tests.utils import REGISTER_URL, register_user

REGISTER_MESSAGE = "If this address can be registered, a verification email has been sent"


async def _registered_user(email: str) -> User:
    """The account as it is stored, read back with its role loaded."""
    engine = create_async_engine(sanitize_database_url(settings.DATABASE_URL), poolclass=NullPool)
    try:
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        async with session_factory() as session:
            user = (
                await session.execute(
                    select(User).where(User.email == email.lower()).options(selectinload(User.role))
                )
            ).scalar_one()
            session.expunge(user)
            return user
    finally:
        await engine.dispose()


_SENSITIVE_FIELDS = {"password", "password_hash", "refresh_token", "access_token", "token_hash"}


async def test_register_success_creates_active_user(client: AsyncClient) -> None:
    """The answer is uniform (202 + a fixed body), the account is created."""
    response = await client.post(
        REGISTER_URL,
        json={
            "email": "new@example.com",
            "password": "StrongPass123!",
            "first_name": "New",
            "last_name": "User",
            "phone": "+201234567890",
            "date_of_birth": "2000-01-01",
            "address": "Abnub, Asyut, Egypt",
        },
    )

    assert response.status_code == 202
    assert response.json()["message"] == REGISTER_MESSAGE

    user = await _registered_user("new@example.com")
    assert user.email == "new@example.com"
    assert user.first_name == "New"
    assert user.last_name == "User"
    assert user.phone == "+201234567890"
    assert user.role.name == RoleName.MEMBER
    assert user.status == UserStatus.ACTIVE
    assert user.public_id.startswith("USR_")


async def test_register_response_excludes_sensitive_fields(client: AsyncClient) -> None:
    user = await register_user(client)

    assert _SENSITIVE_FIELDS.isdisjoint(user.keys())


async def test_register_answers_a_duplicate_email_like_a_fresh_one(
    client: AsyncClient,
) -> None:
    """A known address must not be distinguishable from an unknown one.

    The old answer was 409 "An account with this email already exists",
    which turned the endpoint into an account oracle (SEC-007/SEC-013).
    """
    await register_user(client, email="dup@example.com")

    response = await client.post(
        REGISTER_URL,
        json={
            "email": "dup@example.com",
            "password": "StrongPass123!",
            "first_name": "Dup",
            "last_name": "User",
            "phone": "+201255566677",
            "date_of_birth": "2000-01-01",
            "address": "Abnub, Asyut, Egypt",
        },
    )

    assert response.status_code == 202
    assert response.json()["message"] == REGISTER_MESSAGE
    # The existing account is untouched.
    user = await _registered_user("dup@example.com")
    assert user.first_name == "Test"


async def test_register_rejects_invalid_email(client: AsyncClient) -> None:
    response = await client.post(
        REGISTER_URL, json={"email": "not-an-email", "password": "StrongPass123!"}
    )

    assert response.status_code == 422


async def test_register_rejects_weak_password(client: AsyncClient) -> None:
    response = await client.post(
        REGISTER_URL, json={"email": "weak@example.com", "password": "short"}
    )

    assert response.status_code == 422


async def test_register_stores_password_hashed(client: AsyncClient, db_engine) -> None:
    await register_user(client, email="hash@example.com", password="StrongPass123!")

    async with db_engine.connect() as conn:
        password_hash = (
            await conn.execute(select(User.password_hash).where(User.email == "hash@example.com"))
        ).scalar_one()

    assert password_hash != "StrongPass123!"
    assert verify_password("StrongPass123!", password_hash)


async def test_register_assigns_member_role(client: AsyncClient, db_engine) -> None:
    user = await register_user(client, email="role@example.com")

    async with db_engine.connect() as conn:
        role_name = (
            await conn.execute(
                select(Role.name)
                .select_from(User)
                .join(Role, User.role_id == Role.id)
                .where(User.id == UUID(user["id"]))
            )
        ).scalar_one()

    assert role_name == RoleName.MEMBER


async def test_register_writes_outbox_event(client: AsyncClient, db_engine) -> None:
    from sqlalchemy import select as sa_select

    from app.shared.infrastructure.persistence.outbox import OutboxEvent

    await register_user(client, email="outbox@example.com")

    async with db_engine.connect() as conn:
        events = list(
            (
                await conn.execute(
                    sa_select(OutboxEvent.event_type, OutboxEvent.aggregate_type).where(
                        OutboxEvent.event_type == "user.registered"
                    )
                )
            ).all()
        )

    assert len(events) == 1
    assert events[0][0] == "user.registered"
    assert events[0][1] == "user"
