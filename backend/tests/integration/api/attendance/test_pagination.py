"""History pagination: totals, has_next, size cap (TASK-702 #5)."""

import uuid as uuid_module
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import insert
from sqlalchemy.ext.asyncio import AsyncEngine

from app.modules.attendance.infrastructure.persistence.weekly_models import (
    WeeklyAttendanceRecord,
)
from app.modules.attendance.domain.meeting_schedule import (
    current_meeting_date,
    meeting_dates_between,
)
from app.core.time import today_local
from tests.integration.api.attendance.conftest import _headers_for
from tests.utils import ATTENDANCE_HISTORY_URL, create_user_direct
from app.modules.users.domain.enums.role_name import RoleName


@pytest.mark.asyncio
async def test_pagination_metadata_and_pages(
    client: AsyncClient, db_engine: AsyncEngine
):
    admin_email = "page.a@test.com"
    admin_id = await create_user_direct(db_engine, email=admin_email, role_name=RoleName.ADMIN)

    open_meeting = current_meeting_date(today_local())
    meetings = meeting_dates_between(
        open_meeting - timedelta(days=7 * 3), open_meeting
    )[-3:]

    member_ids = []
    for index in range(5):
        member_ids.append(
            await create_user_direct(
                db_engine,
                email=f"page.m{index}@test.com",
                role_name=RoleName.MEMBER,
                created_at=datetime(2026, 1, 1, tzinfo=UTC),
            )
        )

    rows = []
    for meeting_index, meeting in enumerate(meetings):
        for user_index, user_id in enumerate(member_ids[: 2 + meeting_index]):
            rows.append(
                {
                    "id": uuid_module.uuid4(),
                    "user_id": user_id,
                    "meeting_date": meeting,
                    "check_in_at": datetime(2026, 8, 19 + meeting_index, 19, 0, tzinfo=UTC),
                    "status": "PRESENT",
                    "method": "QR_SCAN",
                    "recorded_by": admin_id,
                }
            )

    async with db_engine.begin() as conn:
        await conn.execute(insert(WeeklyAttendanceRecord).values(rows))

    headers = await _headers_for(client, db_engine, admin_email, RoleName.ADMIN)

    page_one = await client.get(f"{ATTENDANCE_HISTORY_URL}?size=5&page=1", headers=headers)
    assert page_one.status_code == 200, page_one.text
    body = page_one.json()
    assert body["total_count"] == len(rows)
    assert body["page"] == 1
    assert body["size"] == 5
    assert body["pages"] == -(-len(rows) // 5)
    assert body["has_next"] is True

    last_page = body["pages"]
    final = await client.get(
        f"{ATTENDANCE_HISTORY_URL}?size=5&page={last_page}", headers=headers
    )
    assert final.status_code == 200
    assert final.json()["has_next"] is False
    assert len(final.json()["attendance_records"]) > 0

    beyond = await client.get(
        f"{ATTENDANCE_HISTORY_URL}?size=5&page={last_page + 1}", headers=headers
    )
    assert beyond.status_code == 200
    assert beyond.json()["attendance_records"] == []
    assert beyond.json()["total_count"] == len(rows)


@pytest.mark.asyncio
async def test_size_above_max_is_rejected(client: AsyncClient, db_engine: AsyncEngine):
    from app.config import settings

    admin = await _headers_for(client, db_engine, "cap.a@test.com", RoleName.ADMIN)
    response = await client.get(
        f"{ATTENDANCE_HISTORY_URL}?size={settings.ATTENDANCE_HISTORY_MAX_PAGE_SIZE + 1}",
        headers=admin,
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_status_and_user_filters_are_sql_side(
    client: AsyncClient, db_engine: AsyncEngine
):
    """Filters combine in SQL: a status filter narrows the same range."""
    admin_email = "filter.a@test.com"
    admin_id = await create_user_direct(db_engine, email=admin_email, role_name=RoleName.ADMIN)
    open_meeting = current_meeting_date(today_local())

    member_id = await create_user_direct(
        db_engine, email="filter.m@test.com", role_name=RoleName.MEMBER,
        created_at=datetime(2026, 1, 1, tzinfo=UTC),
    )
    record_id = uuid_module.uuid4()

    async with db_engine.begin() as conn:
        await conn.execute(
            insert(WeeklyAttendanceRecord).values(
                id=record_id,
                user_id=member_id,
                meeting_date=open_meeting,
                check_in_at=datetime.now(UTC),
                status="PRESENT",
                method="MANUAL",
                recorded_by=admin_id,
            )
        )

    headers = await _headers_for(client, db_engine, admin_email, RoleName.ADMIN)
    filtered = await client.get(
        f"{ATTENDANCE_HISTORY_URL}?user_id={member_id}&status=LATE", headers=headers
    )
    assert filtered.status_code == 200
    assert filtered.json()["total_count"] == 0

    present = await client.get(
        f"{ATTENDANCE_HISTORY_URL}?user_id={member_id}&status=PRESENT", headers=headers
    )
    assert present.status_code == 200
    assert present.json()["total_count"] == 1
    assert present.json()["attendance_records"][0]["method"] == "MANUAL"
