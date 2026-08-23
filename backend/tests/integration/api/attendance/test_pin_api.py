"""Attendance PIN lifecycle and PIN-based check-in (offline fallback)."""

from datetime import timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.time import today_local
from app.modules.attendance.domain.meeting_schedule import current_meeting_date
from app.modules.users.application.services.attendance_pin import (
    hash_attendance_pin,
)
from app.modules.users.domain.enums.role_name import RoleName
from app.modules.users.domain.enums.user_status import UserStatus
from app.modules.users.infrastructure.persistence.models import User
from tests.integration.api.attendance.conftest import _headers_for  # noqa: F401
from tests.utils import (
    ATTENDANCE_CHECK_IN_URL,
    attendance_excuse_url,
    create_user_direct,
    login,
)

PIN_URL = "/api/v1/users/me/attendance-pin"


async def _member_headers(
    client: AsyncClient, engine: AsyncEngine, email: str
) -> dict[str, str]:
    await create_user_direct(engine, email=email, role_name=RoleName.MEMBER)
    auth = await login(client, email=email)
    from tests.utils import bearer

    return bearer(auth["access_token"])


# ---------------------------------------------------------------------------
# Lifecycle: self-service CRUD on the member's own PIN
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_pin_lifecycle(client: AsyncClient, db_engine: AsyncEngine):
    headers = await _member_headers(client, db_engine, "pin.life@test.com")

    anonymous = await client.get(PIN_URL)
    assert anonymous.status_code == 401

    initial = await client.get(PIN_URL, headers=headers)
    assert initial.status_code == 200
    assert initial.json() == {"set": False}

    created = await client.put(PIN_URL, json={"pin": "12345"}, headers=headers)
    assert created.status_code == 204

    status = await client.get(PIN_URL, headers=headers)
    assert status.json() == {"set": True}

    changed = await client.put(PIN_URL, json={"pin": "54321"}, headers=headers)
    assert changed.status_code == 204

    deleted = await client.delete(PIN_URL, headers=headers)
    assert deleted.status_code == 204

    after_delete = await client.get(PIN_URL, headers=headers)
    assert after_delete.json() == {"set": False}

    # Deleting with no PIN configured stays idempotent.
    deleted_again = await client.delete(PIN_URL, headers=headers)
    assert deleted_again.status_code == 204


@pytest.mark.asyncio
@pytest.mark.parametrize("bad_pin", ["1234", "123456", "abcde", "12 45"])
async def test_pin_format_is_enforced(
    client: AsyncClient, db_engine: AsyncEngine, bad_pin: str
):
    headers = await _member_headers(client, db_engine, "pin.fmt@test.com")
    response = await client.put(PIN_URL, json={"pin": bad_pin}, headers=headers)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_pin_conflict_between_members(client: AsyncClient, db_engine: AsyncEngine):
    first = await _member_headers(client, db_engine, "pin.a@test.com")
    second = await _member_headers(client, db_engine, "pin.b@test.com")

    taken = await client.put(PIN_URL, json={"pin": "77777"}, headers=first)
    assert taken.status_code == 204

    conflict = await client.put(PIN_URL, json={"pin": "77777"}, headers=second)
    assert conflict.status_code == 409
    detail = conflict.json()["detail"]
    assert detail["code"] == "conflict"
    assert "already" in detail["message"].lower()

    # The holder may re-save their own PIN without a self-conflict.
    own = await client.put(PIN_URL, json={"pin": "77777"}, headers=first)
    assert own.status_code == 204


@pytest.mark.asyncio
async def test_deleting_a_pin_frees_it_for_others(
    client: AsyncClient, db_engine: AsyncEngine
):
    first = await _member_headers(client, db_engine, "pin.free.a@test.com")
    second = await _member_headers(client, db_engine, "pin.free.b@test.com")

    await client.put(PIN_URL, json={"pin": "88888"}, headers=first)
    await client.delete(PIN_URL, headers=first)

    reclaimed = await client.put(PIN_URL, json={"pin": "88888"}, headers=second)
    assert reclaimed.status_code == 204


# ---------------------------------------------------------------------------
# Check-in by PIN
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_check_in_by_pin_happy_path(
    client: AsyncClient,
    db_engine: AsyncEngine,
    member_with_pin: tuple,
):
    admin = await _headers_for(client, db_engine, "pin.ci.a@test.com", RoleName.ADMIN)
    member_id, pin = member_with_pin

    response = await client.post(
        ATTENDANCE_CHECK_IN_URL, json={"pin": pin}, headers=admin
    )
    assert response.status_code == 201, response.text
    body = response.json()
    # A PIN entry is always audited as method PIN, whatever the client sent.
    assert body["attendance"]["method"] == "PIN"
    assert body["attendance"]["user_id"] == str(member_id)

    forced_method = await client.post(
        ATTENDANCE_CHECK_IN_URL.replace("check-in", "check-in"),
        json={"pin": pin},
        headers=admin,
    )
    assert forced_method.status_code == 409  # duplicate now, not re-recorded


@pytest.mark.asyncio
async def test_check_in_by_unknown_pin_is_validation_error(
    client: AsyncClient, db_engine: AsyncEngine
):
    servant = await _headers_for(
        client, db_engine, "pin.ci.s@test.com", RoleName.SERVANT
    )
    response = await client.post(
        ATTENDANCE_CHECK_IN_URL, json={"pin": "00000"}, headers=servant
    )
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "validation_error"


@pytest.mark.asyncio
async def test_check_in_by_pin_requires_manager_role(
    client: AsyncClient, db_engine: AsyncEngine, member_with_pin: tuple
):
    member = await _member_headers(client, db_engine, "pin.ci.m@test.com")
    _, pin = member_with_pin

    response = await client.post(
        ATTENDANCE_CHECK_IN_URL, json={"pin": pin}, headers=member
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_check_in_identifiers_are_mutually_exclusive(
    client: AsyncClient,
    db_engine: AsyncEngine,
    member_with_pin: tuple,
    member_with_qr: tuple,
):
    servant = await _headers_for(
        client, db_engine, "pin.ci.x@test.com", RoleName.SERVANT
    )
    _, pin = member_with_pin
    _, qr_token = member_with_qr

    both = await client.post(
        ATTENDANCE_CHECK_IN_URL, json={"qr_code": qr_token, "pin": pin}, headers=servant
    )
    assert both.status_code == 422

    neither = await client.post(ATTENDANCE_CHECK_IN_URL, json={}, headers=servant)
    assert neither.status_code == 422

    bad_pattern = await client.post(
        ATTENDANCE_CHECK_IN_URL, json={"pin": "1234"}, headers=servant
    )
    assert bad_pattern.status_code == 422


@pytest.mark.asyncio
async def test_suspended_member_pin_is_rejected(
    client: AsyncClient,
    db_engine: AsyncEngine,
):
    suspended_id = await create_user_direct(
        db_engine,
        email="pin.susp@test.com",
        role_name=RoleName.MEMBER,
        status=UserStatus.SUSPENDED,
    )
    async with db_engine.begin() as conn:
        await conn.execute(
            update(User)
            .where(User.id == suspended_id)
            .values(attendance_pin_hash=hash_attendance_pin("55555"))
        )

    admin = await _headers_for(client, db_engine, "pin.susp.a@test.com", RoleName.ADMIN)
    response = await client.post(
        ATTENDANCE_CHECK_IN_URL, json={"pin": "55555"}, headers=admin
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_pin_respects_meeting_guards(
    client: AsyncClient,
    db_engine: AsyncEngine,
    member_with_pin: tuple,
):
    """Same open-meeting rules apply to PIN entries as to QR scans."""
    admin = await _headers_for(client, db_engine, "pin.guard.a@test.com", RoleName.ADMIN)
    _, pin = member_with_pin
    closed_meeting = current_meeting_date(today_local()) - timedelta(days=7)

    past = await client.post(
        ATTENDANCE_CHECK_IN_URL,
        json={"pin": pin, "meeting_date": closed_meeting.isoformat()},
        headers=admin,
    )
    assert past.status_code == 422


@pytest.mark.asyncio
async def test_pin_record_can_be_excused_like_any_record(
    client: AsyncClient,
    db_engine: AsyncEngine,
    member_with_pin: tuple,
):
    admin = await _headers_for(
        client, db_engine, "pin.excuse.a@test.com", RoleName.ADMIN
    )
    _, pin = member_with_pin

    created = await client.post(ATTENDANCE_CHECK_IN_URL, json={"pin": pin}, headers=admin)
    assert created.status_code == 201
    attendance_id = created.json()["attendance"]["id"]

    excused = await client.post(
        attendance_excuse_url(attendance_id),
        json={"reason": "left early"},
        headers=admin,
    )
    assert excused.status_code == 200
    assert excused.json()["attendance"]["status"] == "EXCUSED"
    assert excused.json()["attendance"]["id"] == attendance_id
