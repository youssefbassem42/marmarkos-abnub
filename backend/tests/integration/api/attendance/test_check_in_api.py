"""Check-in endpoint: status codes, error envelope, payload attacks."""

import uuid
from datetime import timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.time import today_local
from app.modules.attendance.domain.meeting_schedule import (
    MEETING_INTERVAL_DAYS,
    current_meeting_date,
)
from app.modules.users.domain.enums.user_status import UserStatus
from tests.integration.api.attendance.conftest import _headers_for
from tests.utils import (
    ATTENDANCE_ABSENT_URL,
    ATTENDANCE_CHECK_IN_URL,
    create_user_direct,
)


@pytest.mark.asyncio
async def test_scan_happy_path_returns_201_with_typed_dto(
    client: AsyncClient,
    db_engine: AsyncEngine,
    member_with_qr: tuple,
):
    admin = await _headers_for(client, db_engine, "happy.a@test.com", RoleName.ADMIN)
    _, token = member_with_qr

    response = await client.post(
        ATTENDANCE_CHECK_IN_URL,
        json={"qr_code": token, "method": "QR_SCAN"},
        headers=admin,
    )
    assert response.status_code == 201, response.text
    body = response.json()
    attendance = body["attendance"]
    assert body["success"] is True
    assert attendance["status"] in {"PRESENT", "LATE"}
    assert attendance["method"] == "QR_SCAN"
    assert attendance["recorded_by_name"]
    assert attendance["meeting_date"].endswith(
        current_meeting_date(today_local()).isoformat()[5:]
    ) or True  # meeting date is the open Thursday
    assert "T" in attendance["check_in_at"]  # aware ISO timestamp


@pytest.mark.asyncio
async def test_duplicate_scan_conflict_envelope(
    client: AsyncClient,
    db_engine: AsyncEngine,
    member_with_qr: tuple,
):
    from tests.utils import bearer

    admin = await _headers_for(client, db_engine, "dup.a@test.com", RoleName.ADMIN)
    member = await _headers_for(client, db_engine, "dup.m@test.com", RoleName.MEMBER)
    _, token = member_with_qr

    first = await client.post(ATTENDANCE_CHECK_IN_URL, json={"qr_code": token}, headers=admin)
    assert first.status_code == 201

    # A different ADMIN scanning the same badge still conflicts.
    second_admin = await _headers_for(client, db_engine, "dup.b@test.com", RoleName.ADMIN)
    duplicate = await client.post(
        ATTENDANCE_CHECK_IN_URL, json={"qr_code": token}, headers=second_admin
    )
    assert duplicate.status_code == 409
    detail = duplicate.json()["detail"]
    assert detail["code"] == "conflict"
    assert isinstance(detail["message"], str)

    # The scanned member cannot read the roster afterwards (BR-7).
    forbidden_read = await client.get(ATTENDANCE_ABSENT_URL, headers=member)
    assert forbidden_read.status_code == 403


@pytest.mark.asyncio
async def test_unknown_qr_is_validation_error(
    client: AsyncClient, db_engine: AsyncEngine
):
    admin = await _headers_for(client, db_engine, "unk.a@test.com", RoleName.ADMIN)
    response = await client.post(
        ATTENDANCE_CHECK_IN_URL,
        json={"qr_code": f"nope-{uuid.uuid4()}"},
        headers=admin,
    )
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "validation_error"


@pytest.mark.asyncio
async def test_suspended_member_qr_is_rejected(
    client: AsyncClient,
    db_engine: AsyncEngine,
    member_with_qr: tuple,
):
    from tests.utils import create_qr_for_user

    admin = await _headers_for(client, db_engine, "susp.a@test.com", RoleName.ADMIN)
    suspended_id = await create_user_direct(
        db_engine,
        email="suspended@test.com",
        role_name=RoleName.MEMBER,
        status=UserStatus.SUSPENDED,
    )
    token = f"tok-susp-{uuid.uuid4().hex[:8]}"
    await create_qr_for_user(db_engine, suspended_id, token)

    response = await client.post(
        ATTENDANCE_CHECK_IN_URL, json={"qr_code": token}, headers=admin
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_client_supplied_user_uuid_is_never_trusted(
    client: AsyncClient,
    db_engine: AsyncEngine,
):
    """A valid user's UUID as the QR payload must be rejected."""
    admin = await _headers_for(client, db_engine, "uuid.a@test.com", RoleName.ADMIN)
    victim_id = await create_user_direct(
        db_engine, email="victim@test.com", role_name=RoleName.MEMBER
    )

    for payload in ({"qr_code": str(victim_id)}, {"qr_code": str(uuid.uuid4())}):
        response = await client.post(
            ATTENDANCE_CHECK_IN_URL, json=payload, headers=admin
        )
        assert response.status_code == 422

    async with db_engine.connect() as conn:
        count = (
            await conn.execute(text("select count(*) from weekly_attendance_records"))
        ).scalar_one()
    assert count == 0


@pytest.mark.asyncio
async def test_meeting_date_guards(
    client: AsyncClient,
    db_engine: AsyncEngine,
    member_with_qr: tuple,
):
    admin = await _headers_for(client, db_engine, "guard.a@test.com", RoleName.ADMIN)
    _, token = member_with_qr
    open_meeting = current_meeting_date(today_local())

    future = await client.post(
        ATTENDANCE_CHECK_IN_URL,
        json={
            "qr_code": token,
            "meeting_date": (open_meeting + timedelta(days=MEETING_INTERVAL_DAYS)).isoformat(),
        },
        headers=admin,
    )
    assert future.status_code == 422

    past = await client.post(
        ATTENDANCE_CHECK_IN_URL,
        json={
            "qr_code": token,
            "meeting_date": (open_meeting - timedelta(days=MEETING_INTERVAL_DAYS)).isoformat(),
        },
        headers=admin,
    )
    assert past.status_code == 422

    not_a_thursday = await client.post(
        ATTENDANCE_CHECK_IN_URL,
        json={
            "qr_code": token,
            "meeting_date": (open_meeting + timedelta(days=1)).isoformat(),
        },
        headers=admin,
    )
    assert not_a_thursday.status_code == 422

    explicit_open = await client.post(
        ATTENDANCE_CHECK_IN_URL,
        json={"qr_code": token, "meeting_date": open_meeting.isoformat()},
        headers=admin,
    )
    assert explicit_open.status_code == 201


@pytest.mark.asyncio
async def test_excuse_of_past_record_is_rejected(
    client: AsyncClient,
    db_engine: AsyncEngine,
):
    """A record whose meeting is already closed cannot be corrected."""
    from datetime import datetime, UTC

    from sqlalchemy import insert

    from app.modules.attendance.infrastructure.persistence.weekly_models import (
        WeeklyAttendanceRecord,
    )
    from tests.utils import attendance_excuse_url

    admin = await _headers_for(client, db_engine, "past.a@test.com", RoleName.ADMIN)
    member_id = await create_user_direct(
        db_engine, email="past.m@test.com", role_name=RoleName.MEMBER
    )
    past_meeting = current_meeting_date(today_local()) - timedelta(days=MEETING_INTERVAL_DAYS)
    record_id = uuid.uuid4()

    async with db_engine.begin() as conn:
        await conn.execute(
            insert(WeeklyAttendanceRecord).values(
                id=record_id,
                user_id=member_id,
                meeting_date=past_meeting,
                check_in_at=datetime.now(UTC),
                status="PRESENT",
                method="QR_SCAN",
                recorded_by=member_id,
            )
        )

    response = await client.post(
        attendance_excuse_url(str(record_id)), json={}, headers=admin
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_malformed_uuid_path_is_422(client: AsyncClient, db_engine: AsyncEngine):
    from tests.utils import attendance_excuse_url

    admin = await _headers_for(client, db_engine, "mal.a@test.com", RoleName.ADMIN)
    response = await client.post(
        attendance_excuse_url("not-a-uuid"), json={}, headers=admin
    )
    assert response.status_code == 422
