"""HTTP security matrix: every route x every role (TASK-702)."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine

from app.modules.users.domain.enums.role_name import RoleName
from tests.integration.api.attendance.conftest import _headers_for
from tests.utils import (
    ATTENDANCE_ABSENT_URL,
    ATTENDANCE_CHECK_IN_URL,
    ATTENDANCE_EXCUSE_URL,
    ATTENDANCE_HISTORY_URL,
    ATTENDANCE_MEETINGS_URL,
    ATTENDANCE_MEETING_URL,
    ATTENDANCE_ME_URL,
    ATTENDANCE_STATS_MEETING_URL,
    ATTENDANCE_STATS_MONTHLY_URL,
)

READ_ROUTES = [
    ("GET", ATTENDANCE_MEETING_URL),
    ("GET", ATTENDANCE_MEETINGS_URL),
    ("GET", ATTENDANCE_ABSENT_URL),
    ("GET", ATTENDANCE_STATS_MEETING_URL),
    ("GET", ATTENDANCE_STATS_MONTHLY_URL),
    ("GET", ATTENDANCE_HISTORY_URL),
]


@pytest.mark.asyncio
@pytest.mark.parametrize("method,url", READ_ROUTES)
async def test_read_routes_reject_anonymous(
    client: AsyncClient, method: str, url: str
):
    response = await getattr(client, method.lower())(url)
    assert response.status_code == 401


@pytest.mark.asyncio
@pytest.mark.parametrize("method,url", READ_ROUTES)
async def test_read_routes_forbid_member(
    client: AsyncClient,
    db_engine: AsyncEngine,
    method: str,
    url: str,
):
    headers = await _headers_for(client, db_engine, "m.matrix@test.com", RoleName.MEMBER)
    response = await getattr(client, method.lower())(url, headers=headers)
    assert response.status_code == 403


@pytest.mark.asyncio
@pytest.mark.parametrize("method,url", READ_ROUTES)
async def test_read_routes_allow_servant_and_admin(
    client: AsyncClient,
    db_engine: AsyncEngine,
    method: str,
    url: str,
):
    servant = await _headers_for(
        client, db_engine, "s.matrix@test.com", RoleName.SERVANT
    )
    admin = await _headers_for(client, db_engine, "a.matrix@test.com", RoleName.ADMIN)
    for headers in (servant, admin):
        response = await getattr(client, method.lower())(url, headers=headers)
        assert response.status_code == 200, response.text


@pytest.mark.asyncio
async def test_me_route_is_open_to_every_authenticated_role(
    client: AsyncClient, db_engine: AsyncEngine
):
    member = await _headers_for(client, db_engine, "me.m@test.com", RoleName.MEMBER)
    servant = await _headers_for(client, db_engine, "me.s@test.com", RoleName.SERVANT)
    admin = await _headers_for(client, db_engine, "me.a@test.com", RoleName.ADMIN)

    anonymous = await client.get(ATTENDANCE_ME_URL)
    assert anonymous.status_code == 401

    for headers in (member, servant, admin):
        response = await client.get(ATTENDANCE_ME_URL, headers=headers)
        assert response.status_code == 200, response.text


@pytest.mark.asyncio
async def test_excuse_is_admin_only(
    client: AsyncClient,
    db_engine: AsyncEngine,
    member_with_qr: tuple,
):
    from tests.utils import (
        ATTENDANCE_CHECK_IN_URL,
        attendance_excuse_url,
    )

    _, token = member_with_qr
    admin = await _headers_for(client, db_engine, "ex.a@test.com", RoleName.ADMIN)
    servant = await _headers_for(client, db_engine, "ex.s@test.com", RoleName.SERVANT)
    member = await _headers_for(client, db_engine, "ex.m@test.com", RoleName.MEMBER)

    created = await client.post(
        ATTENDANCE_CHECK_IN_URL, json={"qr_code": token}, headers=admin
    )
    assert created.status_code == 201, created.text
    attendance_id = created.json()["attendance"]["id"]

    anonymous = await client.post(
        ATTENDANCE_EXCUSE_URL.format(attendance_id=attendance_id), json={}
    )
    assert anonymous.status_code == 401

    for headers in (member, servant):
        response = await client.post(
            attendance_excuse_url(attendance_id), json={}, headers=headers
        )
        assert response.status_code == 403

    allowed = await client.post(
        attendance_excuse_url(attendance_id), json={"reason": "matrix"}, headers=admin
    )
    assert allowed.status_code == 200
