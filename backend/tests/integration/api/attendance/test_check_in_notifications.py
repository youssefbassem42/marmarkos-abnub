"""BR-10 regression: a check-in produces exactly one ATTENDANCE notification."""

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncEngine

from app.modules.notifications.domain.enums.notification_type import NotificationType
from app.modules.notifications.infrastructure.persistence.models import Notification
from app.modules.users.domain.enums.role_name import RoleName
from tests.integration.api.attendance.conftest import _headers_for
from tests.utils import ATTENDANCE_CHECK_IN_URL


@pytest.mark.asyncio
async def test_check_in_creates_one_notification_for_the_attendee(
    client: AsyncClient,
    db_engine: AsyncEngine,
    member_with_qr: tuple,
):
    admin = await _headers_for(client, db_engine, "notify.a@test.com", RoleName.ADMIN)
    member_id, token = member_with_qr

    response = await client.post(
        ATTENDANCE_CHECK_IN_URL,
        json={"qr_code": token},
        headers=admin,
    )
    assert response.status_code == 201, response.text

    async with db_engine.connect() as conn:
        attendee_rows = (
            await conn.execute(
                select(func.count())
                .select_from(Notification)
                .where(
                    Notification.user_id == member_id,
                    Notification.type == NotificationType.ATTENDANCE,
                )
            )
        ).scalar_one()
        total_rows = (
            await conn.execute(select(func.count()).select_from(Notification))
        ).scalar_one()

    # Exactly one row overall: per-user for the attendee; nobody else,
    # not even the recording admin, gets one.
    assert attendee_rows == 1
    assert total_rows == 1

    feed = await client.get("/api/v1/notifications", headers=admin)
    assert feed.status_code == 200
    assert all(item["type"] != "ATTENDANCE" for item in feed.json()["items"])
