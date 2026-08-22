import uuid

from httpx import AsyncClient
from sqlalchemy import insert, select
from sqlalchemy.ext.asyncio import AsyncEngine

from app.modules.auth.infrastructure.security import hash_password
from app.modules.users.domain.enums.role_name import RoleName
from app.modules.users.domain.enums.user_status import UserStatus
from app.modules.users.infrastructure.persistence.models import Role, User
from app.modules.users.infrastructure.services import generate_public_id

REGISTER_URL = "/api/v1/auth/register"
LOGIN_URL = "/api/v1/auth/login"
GOOGLE_LOGIN_URL = "/api/v1/auth/google/login"
GOOGLE_CALLBACK_URL = "/api/v1/auth/google/callback"
REFRESH_URL = "/api/v1/auth/refresh"
LOGOUT_URL = "/api/v1/auth/logout"
ME_URL = "/api/v1/users/me"
QR_URL = "/api/v1/users/me/qr"
USERS_URL = "/api/v1/users"

# -- Attendance (Phase 2) ----------------------------------------------------
ATTENDANCE_CHECK_IN_URL = "/api/v1/attendance/check-in"
ATTENDANCE_MEETING_URL = "/api/v1/attendance/meeting"
ATTENDANCE_MEETINGS_URL = "/api/v1/attendance/meetings"
ATTENDANCE_ABSENT_URL = "/api/v1/attendance/absent"
ATTENDANCE_STATS_MEETING_URL = "/api/v1/attendance/statistics/meeting"
ATTENDANCE_STATS_MONTHLY_URL = "/api/v1/attendance/statistics/monthly"
ATTENDANCE_HISTORY_URL = "/api/v1/attendance"
ATTENDANCE_ME_URL = "/api/v1/attendance/me"
ATTENDANCE_EXCUSE_URL = "/api/v1/attendance/{attendance_id}/excuse"


def attendance_excuse_url(attendance_id: str) -> str:
    return ATTENDANCE_EXCUSE_URL.format(attendance_id=attendance_id)


DEFAULT_PASSWORD = "StrongPass123!"


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def create_qr_for_user(
    engine: AsyncEngine,
    user_id: uuid.UUID,
    token: str,
    *,
    is_active: bool = True,
) -> None:
    """Insert an active QR identity for a directly-created user."""
    import hashlib

    from app.modules.users.infrastructure.persistence.models import UserQrCode

    token_hash = hashlib.sha256(token.encode()).hexdigest()
    async with engine.begin() as conn:
        await conn.execute(
            insert(UserQrCode).values(
                id=uuid.uuid4(),
                user_id=user_id,
                token_hash=token_hash,
                is_active=is_active,
            )
        )


async def register_user(
    client: AsyncClient,
    email: str = "user@example.com",
    password: str = DEFAULT_PASSWORD,
    **overrides: object,
) -> dict:
    # Phone is unique per user: derive a pseudo-random local number.
    default_phone = f"+2010{uuid.uuid4().int % 10**8:08d}"
    payload: dict = {
        "email": email,
        "password": password,
        "first_name": "Test",
        "last_name": "User",
        "phone": default_phone,
        "date_of_birth": "2000-01-01",
        "address": "Abnub, Asyut, Egypt",
        **overrides,
    }
    response = await client.post(REGISTER_URL, json=payload)
    assert response.status_code == 201, response.text
    return response.json()


async def login(
    client: AsyncClient, email: str = "user@example.com", password: str = DEFAULT_PASSWORD
) -> dict:
    response = await client.post(LOGIN_URL, json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response.json()


async def register_and_login(
    client: AsyncClient,
    email: str = "user@example.com",
    password: str = DEFAULT_PASSWORD,
    **overrides: object,
) -> tuple[dict, dict]:
    user = await register_user(client, email=email, password=password, **overrides)
    auth = await login(client, email=email, password=password)
    return auth, user


async def create_user_direct(
    engine: AsyncEngine,
    email: str = "admin@example.com",
    password: str = DEFAULT_PASSWORD,
    role_name: RoleName = RoleName.MEMBER,
    status: UserStatus = UserStatus.ACTIVE,
) -> uuid.UUID:
    async with engine.begin() as conn:
        role_id = (await conn.execute(select(Role.id).where(Role.name == role_name))).scalar_one()
        user_id = uuid.uuid4()
        await conn.execute(
            insert(User).values(
                id=user_id,
                email=email,
                password_hash=hash_password(password),
                public_id=generate_public_id(),
                status=status,
                role_id=role_id,
            )
        )
        return user_id
