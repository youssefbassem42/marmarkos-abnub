# Weekly Meeting Attendance — Implementation Plan (handoff)

**Change:** attendance is no longer daily. The service holds **one meeting per week, on
Thursday**, so a month has **4 meetings** (5 when the month contains five Thursdays).
Attendance, absence, statistics and analysis must all be keyed to a **meeting**, never to a
calendar day.

**Status:** backend domain/application/infrastructure/presentation layers, the Alembic
migration, and part of the test suite are **already migrated** (see §2). What remains is
listed in §4 as tasks **T1 … T8**, in the order they must be done.

**Audience:** implementing agents. Follow this document literally. Do not redesign, do not
rename anything that §3 declares as a contract, do not add features that are not listed.

---

## 0. Rules of engagement

1. **Read a file before editing it.** Never guess its current content.
2. Code blocks marked `FULL FILE CONTENT` must be written **verbatim** to the given path.
3. Code blocks marked `EDIT` describe a targeted replacement; keep every other line intact.
4. Never edit files listed in §5 (out of scope / already done).
5. After each task, run its **Acceptance** command. Do not start the next task while the
   previous one fails.
6. `python`/`pytest`/`ruff`/`mypy`/`alembic` must be invoked through the venv:
   `/home/youssef/marmarkos-abnub/marmarkos-abnub/backend/.venv/bin/...`
7. **Environment quirk:** the shell exports `DEBUG=release`, which crashes
   `pydantic-settings`. Every backend command must be prefixed with `DEBUG=true`.
   Test commands additionally need `APP_ENV=test`.
8. **Database safety:** `backend/.env` points `DATABASE_URL` at a remote (Neon) database.
   *Never* run `alembic upgrade`, `alembic downgrade`, or any write command without
   explicitly overriding `DATABASE_URL` to the local test database. See §6.
9. Do not commit, push, or open a PR. Leave changes in the working tree.

Paths in this document are relative to
`/home/youssef/marmarkos-abnub/marmarkos-abnub/`.

---

## 1. Business specification (authoritative)

### 1.1 Meeting week

A **meeting week** starts on the meeting day (Thursday) and ends the following Wednesday:

```
Thu (meeting) | Fri | Sat | Sun | Mon | Tue | Wed
^------------------ one meeting week ----------^
```

Every date inside that window resolves to the same `meeting_date` (the Thursday).

### 1.2 Check-in rules (decided by the product owner)

| Rule | Behaviour |
| --- | --- |
| Scanning day | An admin may scan on **any weekday**. The record is attributed to the meeting of the current meeting week. Do **not** block scanning because "today is not Thursday". |
| Open meeting | Exactly one meeting is open for recording: `current_meeting_date(today)` = most recent Thursday ≤ today. |
| Future meeting | **Rejected** (422). A meeting that has not been held yet can never receive attendance. |
| Past meeting | **Rejected** (422). Once a new Thursday starts, the previous meeting is closed. No back-dating. |
| Non-Thursday explicit date | **Rejected** (422) — "not a meeting date". |
| Duplicate | **Rejected** (409). One record per `(user_id, meeting_date)`, enforced in the use case *and* by a unique index, so a race cannot create a second row. |

### 1.3 Analysis levels

* **Per meeting:** present / absent / expected / rate for one Thursday.
* **Per month:** the 4 (or 5) meetings of a calendar month, with a per-meeting breakdown,
  month totals, and per-member aggregates. Future meetings of the month are reported with
  `is_held = false` and `present_count = 0`.

Anything named `daily`, `weekly` (in the "7 rolling days" sense), `today`, `count_today`,
`daily_trend`, `DailyStatistics`, `WeeklyStatistics(7-day)` is **removed vocabulary** and
must not reappear anywhere in code, DTOs, endpoints, tests or docs.

---

## 2. Already done — DO NOT REDO

### 2.1 New files

| File | Purpose |
| --- | --- |
| `backend/app/modules/attendance/domain/meeting_schedule.py` | Pure meeting-schedule helpers (the single source of truth for the Thursday rule). |
| `backend/app/modules/attendance/infrastructure/persistence/weekly_models.py` | `WeeklyAttendanceRecord` ORM model, table `weekly_attendance_records`. |
| `backend/app/modules/attendance/infrastructure/persistence/weekly_attendance_repository.py` | `WeeklyAttendanceRepository`. |
| `backend/app/modules/attendance/application/queries/meeting_attendance_query.py` | `MeetingAttendanceQuery`. |
| `backend/alembic/versions/b7d41c0f92aa_weekly_meeting_attendance.py` | Rename + column rename + data snap + dedupe migration. |
| `backend/tests/unit/attendance/test_meeting_schedule.py` | 15 unit tests for the schedule helpers. |
| `backend/tests/integration/attendance/conftest.py` | `db_session` fixture + `create_user()` helper (the attendance integration tests previously had **no** `db_session` fixture at all and could never run). |

### 2.2 Deleted files (do not recreate)

* `backend/app/modules/attendance/infrastructure/persistence/daily_models.py`
* `backend/app/modules/attendance/infrastructure/persistence/daily_attendance_repository.py`
* `backend/app/modules/attendance/application/queries/today_attendance_query.py`

### 2.3 Rewritten / edited files

| File | What changed |
| --- | --- |
| `.../domain/entities/attendance.py` | `attendance_date` → `meeting_date`; added `is_on_meeting_day`, `meeting_index_in_month`. |
| `.../domain/interfaces.py` | Meeting-based `AttendanceRepository` protocol + new `WeeklyAttendanceRepository` protocol. |
| `.../domain/events/attendance_recorded.py` | `attendance_date` → `meeting_date`. |
| `.../infrastructure/persistence/models.py` | Docstrings now describe the weekly meeting; `ServiceSession.service_type` default `SUNDAY_SERVICE` → `YOUTH_MEETING` (Python-side default only, **no migration needed**). |
| `.../infrastructure/persistence/attendance_repository.py` | Legacy analytics rewritten: `count_today`/`count_this_week`/`count_this_month`/`daily_trend` **removed**, replaced by `count_for_meeting`, `count_current_meeting`, `count_for_meetings`, `count_month_meetings`, `meeting_trend`. |
| `.../application/commands/check_in_command.py` | Enforces §1.2 in `_resolve_open_meeting()`; `IntegrityError` → `ConflictError`. |
| `.../application/dto/check_in_dto.py` | `meeting_date`, `meeting_index_in_month`; `CheckInRequest.meeting_date` optional. |
| `.../application/dto/query_dto.py` | New DTO set (see §3.4). |
| `.../application/queries/attendance_history_query.py` | Meeting-based; date filters snapped to meetings; default = last 4 meetings; N+1 user lookups replaced by one batched query. |
| `.../application/services/absence_service.py` | Meeting-based; `_get_expected_users` → public `get_expected_users`. |
| `.../application/services/statistics_service.py` | `calculate_meeting_statistics` + `calculate_monthly_statistics`. |
| `.../presentation/router.py` | New endpoint set (§3.5); relies on the global `AppError` handler instead of manual `HTTPException` mapping. |
| `backend/app/core/exceptions/errors.py` / `__init__.py` | **Added `ValidationError` (422)**. It was imported by the attendance module but never existed — the whole app failed to boot (`ImportError`). |
| `backend/app/modules/users/infrastructure/persistence/models.py` | Relationship `daily_attendance_records` → `weekly_attendance_records`; TYPE_CHECKING import updated. |
| `backend/app/shared/infrastructure/persistence/registry.py` | **Added** `import app.modules.attendance.infrastructure.persistence.weekly_models`. The daily model was never registered, so SQLAlchemy mapper configuration failed for every test touching `User`. |
| `backend/tests/unit/attendance/test_domain.py` | Rewritten for `meeting_date`. |
| `backend/tests/integration/attendance/test_check_in.py` | Rewritten: open meeting, duplicate (409 + single row), future rejection, past rejection, non-Thursday rejection, invalid QR, permission, suspended user. |
| `backend/tests/integration/database/test_outbox.py` | `AttendanceRecorded(..., meeting_date=...)`. |

### 2.4 Verified working right now

```
DEBUG=true APP_ENV=test .venv/bin/python -c "from app.main import create_app; create_app().openapi()"
```
boots and exposes exactly:

```
POST /api/v1/attendance/check-in
GET  /api/v1/attendance
GET  /api/v1/attendance/absent
GET  /api/v1/attendance/meeting
GET  /api/v1/attendance/meetings
GET  /api/v1/attendance/statistics/meeting
GET  /api/v1/attendance/statistics/monthly
```

---

## 3. Contracts you must code against (do not change these names)

### 3.1 `app.modules.attendance.domain.meeting_schedule`

```python
MEETING_WEEKDAY: int = 3            # Monday=0 → Thursday
MEETING_DAY_NAME: str = "Thursday"
MEETING_INTERVAL_DAYS: int = 7

is_meeting_date(value: date) -> bool
current_meeting_date(reference: date | None = None) -> date   # most recent Thursday <= reference
meeting_week_end(meeting_date: date) -> date                  # the Wednesday
next_meeting_date(reference: date | None = None) -> date
previous_meeting_date(reference: date | None = None) -> date
meeting_dates_between(start: date, end: date) -> list[date]
month_bounds(year: int, month: int) -> tuple[date, date]
meetings_in_month(year: int, month: int) -> list[date]         # 4 or 5 Thursdays
meeting_index_in_month(meeting_date: date) -> int              # 1..5
```

### 3.2 `WeeklyAttendanceRepository` (infrastructure)

```python
add(attendance) -> Attendance
get_by_id(attendance_id) -> Attendance | None
find_by_user_and_meeting(user_id, meeting_date) -> Attendance | None
find_by_meeting(meeting_date) -> list[Attendance]
find_by_meeting_range(start_date, end_date) -> list[Attendance]
find_by_user(user_id) -> list[Attendance]
find_users_by_meeting(meeting_date) -> list[tuple[Attendance, User]]   # eager-loaded user
count_by_meeting(meeting_date) -> int
count_by_meeting_and_status(meeting_date, status) -> int
counts_by_meeting(start_date, end_date) -> dict[date, int]             # one grouped query
count_by_user_between(user_id, start_date, end_date) -> int
count_distinct_attendees_between(start_date, end_date) -> int
counts_by_user_between(start_date, end_date) -> dict[UUID, int]
```

### 3.3 Application layer

```python
CheckInCommand(session).execute(qr_code, admin_user, meeting_date=None) -> CheckInResponse
MeetingAttendanceQuery(session).execute(meeting_date=None) -> list[AttendanceDTO]
MeetingAttendanceQuery.resolve_meeting(meeting_date=None) -> date          # staticmethod
AttendanceHistoryQuery(session).execute(start_date=None, end_date=None, user_id=None, status=None)
AbsenceCalculationService(session).calculate_absent_users(meeting_date=None) -> tuple[int, list[dict]]
AbsenceCalculationService(session).get_expected_users() -> list[User]
AbsenceCalculationService(session).calculate_expected_count() -> int
StatisticsService(session).calculate_meeting_statistics(meeting_date=None) -> MeetingStatisticsResponse
StatisticsService(session).calculate_monthly_statistics(year=None, month=None) -> MonthlyStatisticsResponse
```

Legacy service-session analytics (`AttendanceRepository`, exposed as `uow.attendance`):

```python
count_between(start, end) -> int
count_for_meeting(meeting_date) -> int
count_current_meeting(today=None) -> int
count_for_meetings(meetings: list[date]) -> int
count_month_meetings(today=None) -> int      # meetings of that month held so far
count_total() -> int
attendance_percentage_between(start, end) -> float | None
absent_users_since(cutoff) -> list[UUID]
meeting_trend(start, end) -> list[tuple[date, int]]   # every meeting in range, 0-filled
list_between(start, end) -> list[AttendanceRecord]
```

### 3.4 Response payloads (backend → frontend)

```
AttendanceDTO:              id, user_id, user_name, meeting_date, meeting_index_in_month,
                            check_in_at, status
CheckInResponse:            success, message, attendance
MeetingAttendanceResponse:  meeting_date, meeting_index_in_month, is_open, total_present,
                            attendance_records[]
AttendanceSummary:          total_present, total_absent, total_expected, attendance_rate
MeetingStatisticsResponse:  meeting_date, meeting_index_in_month, summary
MeetingStat:                meeting_date, meeting_index_in_month, present_count,
                            absent_count, attendance_rate, is_held
MonthlyStatisticsResponse:  year, month, total_meetings, meetings_held,
                            expected_per_meeting, meetings[], total_attendance,
                            average_attendance, attendance_rate, distinct_attendees,
                            full_attendance_count, no_attendance_count
MeetingScheduleResponse:    year, month, meeting_day, total_meetings, meetings[],
                            open_meeting_date
AbsentUsersResponse:        meeting_date, absent_count, absent_users[]
AttendanceHistoryResponse:  total_count, attendance_records[]
```

### 3.5 HTTP endpoints

| Method | Path | Query / body | Notes |
| --- | --- | --- | --- |
| POST | `/api/v1/attendance/check-in` | body `{qr_code, meeting_date?}` | 201 / 403 / 409 / 422 |
| GET | `/api/v1/attendance/meeting` | `meeting_date?` | Any date is snapped to its meeting |
| GET | `/api/v1/attendance/meetings` | `year?`, `month?` | Meeting calendar of a month |
| GET | `/api/v1/attendance/absent` | `meeting_date?` | |
| GET | `/api/v1/attendance/statistics/meeting` | `meeting_date?` | |
| GET | `/api/v1/attendance/statistics/monthly` | `year?`, `month?` | The 4-meeting analysis |
| GET | `/api/v1/attendance` | `start_date?`, `end_date?`, `user_id?`, `status?` | History; default = last 4 meetings |

**Error body shape changed.** The router no longer wraps errors in `HTTPException`, so the
global `AppError` handler responds with:

```json
{ "detail": { "code": "conflict", "message": "John Doe is already recorded for the Thursday meeting on 2026-08-20" } }
```

`detail` is now an **object**, not a string. The frontend must handle this (T5) or React
will throw when rendering an object as a child.

---

## 4. Remaining tasks

### T1 — Make the attendance test packages importable

`backend/tests/integration/attendance/test_check_in.py` imports
`from tests.integration.attendance.conftest import create_user`, and the sibling test
directories are regular packages (`tests/integration/__init__.py`,
`tests/integration/database/__init__.py` exist). The two attendance test directories are
missing their `__init__.py`.

Create **two empty files**:

* `backend/tests/unit/attendance/__init__.py`
* `backend/tests/integration/attendance/__init__.py`

**Acceptance**

```bash
cd backend && DEBUG=true APP_ENV=test .venv/bin/python -m pytest -q --collect-only tests/unit/attendance tests/integration/attendance
```
Collection must succeed with no `ImportError` / `ModuleNotFoundError`.

---

### T2 — Rewrite `backend/tests/integration/attendance/test_queries.py`

The current file is the **only remaining hard breakage**: it imports
`today_attendance_query`, `daily_models`, and calls `calculate_daily_statistics` /
`calculate_weekly_statistics`, all of which no longer exist.

Two details that were bugs in the old file and must not be reproduced:
* `recorded_by` is a FK to `users.id` with `ON DELETE RESTRICT` — it must be a **real user
  id**, never `uuid.uuid4()`.
* Expectations must be **derived from the schedule helpers**, not hardcoded, because the
  previous meeting may fall in the previous calendar month depending on the run date.

`FULL FILE CONTENT` → `backend/tests/integration/attendance/test_queries.py`

```python
"""Integration tests for meeting attendance queries, absence and statistics."""

import uuid
from datetime import datetime, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.attendance.application.queries.attendance_history_query import (
    AttendanceHistoryQuery,
)
from app.modules.attendance.application.queries.meeting_attendance_query import (
    MeetingAttendanceQuery,
)
from app.modules.attendance.application.services.absence_service import (
    AbsenceCalculationService,
)
from app.modules.attendance.application.services.statistics_service import (
    StatisticsService,
)
from app.modules.attendance.domain.meeting_schedule import (
    current_meeting_date,
    meetings_in_month,
    previous_meeting_date,
)
from app.modules.attendance.infrastructure.persistence.weekly_models import (
    WeeklyAttendanceRecord,
)
from app.modules.users.domain.enums.role_name import RoleName
from app.modules.users.infrastructure.persistence.models import User
from tests.integration.attendance.conftest import create_user

OPEN_MEETING = current_meeting_date()
PREVIOUS_MEETING = previous_meeting_date(OPEN_MEETING)


@pytest.fixture
async def test_users(db_session: AsyncSession) -> list[User]:
    """Five ACTIVE members (the expected population)."""
    users = []
    for index in range(5):
        users.append(
            await create_user(
                db_session,
                email=f"user{index}@test.com",
                role_name=RoleName.MEMBER,
                first_name=f"User{index}",
            )
        )
    return users


@pytest.fixture
async def attendance_records(db_session: AsyncSession, test_users: list[User]) -> None:
    """Users 0-2 attend the open meeting; users 0-1 also attended the previous one."""
    recorder_id = test_users[0].id

    for user in test_users[:3]:
        db_session.add(
            WeeklyAttendanceRecord(
                id=uuid.uuid4(),
                user_id=user.id,
                meeting_date=OPEN_MEETING,
                check_in_at=datetime.now(),
                status="PRESENT",
                recorded_by=recorder_id,
            )
        )

    for user in test_users[:2]:
        db_session.add(
            WeeklyAttendanceRecord(
                id=uuid.uuid4(),
                user_id=user.id,
                meeting_date=PREVIOUS_MEETING,
                check_in_at=datetime.now() - timedelta(days=7),
                status="PRESENT",
                recorded_by=recorder_id,
            )
        )

    await db_session.commit()


@pytest.mark.asyncio
async def test_meeting_query_defaults_to_the_open_meeting(
    db_session: AsyncSession, test_users: list[User], attendance_records: None
):
    query = MeetingAttendanceQuery(db_session)
    results = await query.execute()

    assert len(results) == 3
    assert all(record.meeting_date == OPEN_MEETING for record in results)
    assert all(record.status == "PRESENT" for record in results)


@pytest.mark.asyncio
async def test_meeting_query_snaps_any_weekday_to_its_meeting(
    db_session: AsyncSession, test_users: list[User], attendance_records: None
):
    """A Saturday inside the meeting week resolves to that Thursday."""
    query = MeetingAttendanceQuery(db_session)
    results = await query.execute(OPEN_MEETING + timedelta(days=2))

    assert len(results) == 3
    assert all(record.meeting_date == OPEN_MEETING for record in results)


@pytest.mark.asyncio
async def test_meeting_query_for_the_previous_meeting(
    db_session: AsyncSession, test_users: list[User], attendance_records: None
):
    query = MeetingAttendanceQuery(db_session)
    results = await query.execute(PREVIOUS_MEETING)

    assert len(results) == 2
    assert all(record.meeting_date == PREVIOUS_MEETING for record in results)


@pytest.mark.asyncio
async def test_absence_calculation_for_the_open_meeting(
    db_session: AsyncSession, test_users: list[User], attendance_records: None
):
    service = AbsenceCalculationService(db_session)
    absent_count, absent_users = await service.calculate_absent_users(OPEN_MEETING)

    assert absent_count == 2
    absent_ids = {uuid.UUID(user["user_id"]) for user in absent_users}
    assert absent_ids == {test_users[3].id, test_users[4].id}


@pytest.mark.asyncio
async def test_absence_calculation_defaults_to_the_open_meeting(
    db_session: AsyncSession, test_users: list[User], attendance_records: None
):
    service = AbsenceCalculationService(db_session)
    absent_count, _ = await service.calculate_absent_users()

    assert absent_count == 2


@pytest.mark.asyncio
async def test_meeting_statistics(
    db_session: AsyncSession, test_users: list[User], attendance_records: None
):
    service = StatisticsService(db_session)
    stats = await service.calculate_meeting_statistics()

    assert stats.meeting_date == OPEN_MEETING
    assert stats.meeting_index_in_month >= 1
    assert stats.summary.total_present == 3
    assert stats.summary.total_absent == 2
    assert stats.summary.total_expected == 5
    assert stats.summary.attendance_rate == 60.0  # 3/5 * 100


@pytest.mark.asyncio
async def test_monthly_statistics(
    db_session: AsyncSession, test_users: list[User], attendance_records: None
):
    service = StatisticsService(db_session)
    stats = await service.calculate_monthly_statistics(
        OPEN_MEETING.year, OPEN_MEETING.month
    )

    month_meetings = meetings_in_month(OPEN_MEETING.year, OPEN_MEETING.month)
    held = [meeting for meeting in month_meetings if meeting <= OPEN_MEETING]

    assert stats.total_meetings == len(month_meetings)
    assert stats.total_meetings in (4, 5)
    assert stats.meetings_held == len(held)
    assert stats.expected_per_meeting == 5

    by_date = {stat.meeting_date: stat for stat in stats.meetings}
    assert by_date[OPEN_MEETING].present_count == 3
    assert by_date[OPEN_MEETING].absent_count == 2
    assert by_date[OPEN_MEETING].attendance_rate == 60.0
    assert by_date[OPEN_MEETING].is_held is True

    # Future meetings of the month are listed but empty.
    for stat in stats.meetings:
        assert stat.is_held is (stat.meeting_date <= OPEN_MEETING)
        if not stat.is_held:
            assert stat.present_count == 0
            assert stat.absent_count == 0

    # The previous meeting only counts when it falls in the same month.
    attended_per_user = {user.id: 0 for user in test_users}
    for user in test_users[:3]:
        attended_per_user[user.id] += 1
    if PREVIOUS_MEETING in by_date:
        assert by_date[PREVIOUS_MEETING].present_count == 2
        for user in test_users[:2]:
            attended_per_user[user.id] += 1

    expected_total = sum(attended_per_user.values())
    assert stats.total_attendance == expected_total
    assert stats.average_attendance == round(expected_total / len(held), 2)
    assert stats.attendance_rate == round(expected_total * 100 / (5 * len(held)), 2)

    assert stats.distinct_attendees == 3
    assert stats.no_attendance_count == 2
    assert stats.full_attendance_count == sum(
        1 for count in attended_per_user.values() if count >= len(held)
    )


@pytest.mark.asyncio
async def test_history_defaults_to_the_last_four_meetings(
    db_session: AsyncSession, test_users: list[User], attendance_records: None
):
    query = AttendanceHistoryQuery(db_session)
    results = await query.execute()

    assert len(results) == 5  # 3 at the open meeting + 2 at the previous one


@pytest.mark.asyncio
async def test_history_filtered_by_user(
    db_session: AsyncSession, test_users: list[User], attendance_records: None
):
    query = AttendanceHistoryQuery(db_session)
    results = await query.execute(user_id=test_users[0].id)

    assert len(results) == 2
    assert {record.meeting_date for record in results} == {OPEN_MEETING, PREVIOUS_MEETING}


@pytest.mark.asyncio
async def test_history_filtered_by_meeting_range(
    db_session: AsyncSession, test_users: list[User], attendance_records: None
):
    query = AttendanceHistoryQuery(db_session)
    results = await query.execute(
        start_date=PREVIOUS_MEETING, end_date=PREVIOUS_MEETING
    )

    assert len(results) == 2


@pytest.mark.asyncio
async def test_history_snaps_calendar_dates_to_meetings(
    db_session: AsyncSession, test_users: list[User], attendance_records: None
):
    """Passing a Friday must not silently drop that week's records."""
    friday = OPEN_MEETING + timedelta(days=1)
    query = AttendanceHistoryQuery(db_session)
    results = await query.execute(start_date=friday, end_date=friday)

    assert len(results) == 3


@pytest.mark.asyncio
async def test_expected_count(db_session: AsyncSession, test_users: list[User]):
    service = AbsenceCalculationService(db_session)

    assert await service.calculate_expected_count() == 5
```

**Acceptance**

```bash
cd backend && DEBUG=true APP_ENV=test .venv/bin/python -m pytest -q tests/integration/attendance
```
All tests in `test_check_in.py` and `test_queries.py` pass.

---

### T3 — Update `backend/tests/integration/database/test_attendance.py`

This file exercises the **legacy service-session analytics** (`uow.attendance`) and still
calls the removed `count_today` / `count_this_week` / `count_this_month` / `daily_trend`.

Apply exactly these changes (read the file first, it is 172 lines):

1. Imports — add the schedule helper:

```python
from app.modules.attendance.domain.meeting_schedule import current_meeting_date
```

2. `make_session` helper — the default session is now the weekly meeting:

```python
async def make_session(
    uow: UnitOfWork,
    *,
    name: str = "Weekly Youth Meeting",
    date_: date | None = None,
) -> ServiceSession:
    session = ServiceSession(
        name=name,
        date=date_ or current_meeting_date(),
        service_type=ServiceType.YOUTH_MEETING,
        is_active=True,
    )
    await uow.service_sessions.add(session)
    return session
```

3. `test_multiple_sessions_same_day_allowed` → rename to
   `test_multiple_sessions_same_meeting_date_allowed`, replace the docstring with
   *"Different sessions on the same meeting date are distinct attendance events."*, replace
   `today = date.today()` with `meeting = current_meeting_date()`, use `date_=meeting` and
   `attendance_date=meeting` in both records, and assert:

```python
    assert await uow.attendance.count_current_meeting() == 2
```

4. `test_attendance_counts_and_percentage` — replace `today = date.today()` with
   `meeting = current_meeting_date()`, propagate `meeting` to `make_session(date_=meeting)`
   and `attendance_date=meeting`, then replace the assertion block with:

```python
    assert await uow.attendance.count_total() == 1
    assert await uow.attendance.count_current_meeting() == 1
    assert await uow.attendance.count_for_meeting(meeting) == 1
    assert await uow.attendance.count_for_meetings([meeting]) == 1
    assert await uow.attendance.count_month_meetings(meeting) >= 1
    assert await uow.attendance.count_between(meeting, meeting) == 1

    percentage = await uow.attendance.attendance_percentage_between(meeting, meeting)
    assert percentage is not None
    assert percentage == 50.0  # 1 of 2 active users attended

    trend = await uow.attendance.meeting_trend(meeting, meeting)
    assert trend == [(meeting, 1)]
```

5. `test_absent_users_detection` — replace `today = date.today()` with
   `meeting = current_meeting_date()`, use it for `make_session(date_=meeting)` and
   `attendance_date=meeting`, and `cutoff = meeting - timedelta(weeks=1)`.

6. Remove the now-unused `date.today()` usages. Keep `from datetime import date, timedelta`
   (still needed for the `date | None` annotation and `timedelta`).

**Acceptance**

```bash
cd backend && DEBUG=true APP_ENV=test .venv/bin/python -m pytest -q tests/integration/database/test_attendance.py
```
6 passed. (Before T3 they fail on `AttributeError: count_today`.)

---

### T4 — Full backend verification

Run, in order:

```bash
cd backend
docker start marmarkos-test-db                        # local test Postgres, port 55432
DEBUG=true APP_ENV=test .venv/bin/python -m pytest -q # whole suite
.venv/bin/ruff check app tests
.venv/bin/mypy app/modules/attendance
```

Requirements:
* **pytest: zero failures, zero errors.** If a *pre-existing* failure is unrelated to
  attendance (e.g. auth), report it in your summary instead of silently "fixing" it by
  changing assertions.
* **ruff: clean** for every file touched by this migration. Config: line length 100,
  rules `E,F,I,B,UP`. Import order matters (`I`).
* **mypy** runs in `strict` mode for the whole project; only fix errors located in
  attendance-module files. Do not "fix" strict-mode errors elsewhere.

Migration check on a scratch database (**never** the URL from `.env`):

```bash
cd backend
docker exec marmarkos-test-db psql -U marmarkos -d postgres \
  -c 'DROP DATABASE IF EXISTS marmarkos_migration;' \
  -c 'CREATE DATABASE marmarkos_migration;'

export SCRATCH='postgresql+asyncpg://marmarkos:marmarkos@localhost:55432/marmarkos_migration'
DEBUG=true DATABASE_URL="$SCRATCH" .venv/bin/alembic upgrade head
DEBUG=true DATABASE_URL="$SCRATCH" .venv/bin/alembic current      # must show b7d41c0f92aa
DEBUG=true DATABASE_URL="$SCRATCH" .venv/bin/alembic downgrade -1
DEBUG=true DATABASE_URL="$SCRATCH" .venv/bin/alembic upgrade head
docker exec marmarkos-test-db psql -U marmarkos -d marmarkos_migration -c '\d weekly_attendance_records'
```

The final `\d` must show column `meeting_date` and indexes
`uq_weekly_attendance_user_meeting` (unique), `ix_weekly_attendance_user_id`,
`ix_weekly_attendance_meeting_date`, `ix_weekly_attendance_status`.

Then drop the scratch DB.

---

### T5 — Frontend

Three files. There is no attendance dashboard yet, so the surface is small.

#### T5.1 `FULL FILE CONTENT` → `frontend/src/modules/attendance/types/index.ts`

```ts
/**
 * Attendance module types
 *
 * Attendance is recorded per weekly meeting (Thursday), never per day.
 * A month therefore holds 4 meetings (5 when it has five Thursdays).
 */

export interface AttendanceRecord {
  id: string;
  user_id: string;
  user_name: string;
  /** ISO date of the Thursday meeting the record belongs to */
  meeting_date: string;
  /** 1-based position of the meeting within its month (1..5) */
  meeting_index_in_month: number;
  check_in_at: string;
  status: 'PRESENT' | 'ABSENT' | 'EXCUSED';
}

export interface CheckInRequest {
  qr_code: string;
  /** Optional; must be the currently open meeting when provided */
  meeting_date?: string;
}

export interface CheckInResponse {
  success: boolean;
  message: string;
  attendance: AttendanceRecord;
}

export interface MeetingAttendanceResponse {
  meeting_date: string;
  meeting_index_in_month: number;
  /** True when this meeting is the one currently open for check-in */
  is_open: boolean;
  total_present: number;
  attendance_records: AttendanceRecord[];
}

export interface AbsentUser {
  user_id: string;
  name: string;
  email: string;
  role: string;
}

export interface AbsentUsersResponse {
  meeting_date: string;
  absent_count: number;
  absent_users: AbsentUser[];
}

export interface AttendanceSummary {
  total_present: number;
  total_absent: number;
  total_expected: number;
  attendance_rate: number;
}

export interface MeetingStatisticsResponse {
  meeting_date: string;
  meeting_index_in_month: number;
  summary: AttendanceSummary;
}

export interface MeetingStat {
  meeting_date: string;
  meeting_index_in_month: number;
  present_count: number;
  absent_count: number;
  attendance_rate: number;
  /** False for meetings still in the future */
  is_held: boolean;
}

export interface MonthlyStatisticsResponse {
  year: number;
  month: number;
  /** Meetings scheduled in the month (4 or 5) */
  total_meetings: number;
  meetings_held: number;
  expected_per_meeting: number;
  meetings: MeetingStat[];
  total_attendance: number;
  average_attendance: number;
  attendance_rate: number;
  distinct_attendees: number;
  full_attendance_count: number;
  no_attendance_count: number;
}

export interface MeetingScheduleResponse {
  year: number;
  month: number;
  meeting_day: string;
  total_meetings: number;
  meetings: string[];
  open_meeting_date: string;
}

export interface AttendanceHistoryResponse {
  total_count: number;
  attendance_records: AttendanceRecord[];
}
```

#### T5.2 `FULL FILE CONTENT` → `frontend/src/modules/attendance/api/index.ts`

```ts
/**
 * Attendance API client (weekly Thursday meetings)
 */

import { apiClient } from '../../../lib/api';
import type {
  AbsentUsersResponse,
  AttendanceHistoryResponse,
  CheckInRequest,
  CheckInResponse,
  MeetingAttendanceResponse,
  MeetingScheduleResponse,
  MeetingStatisticsResponse,
  MonthlyStatisticsResponse,
} from '../types';

/**
 * Extract a displayable message from an API error.
 *
 * The backend returns `{ detail: { code, message } }` for handled errors and
 * `{ detail: [{ msg }] }` for FastAPI validation errors, so `detail` must
 * never be rendered directly.
 */
export function getApiErrorMessage(error: unknown, fallback = 'Request failed'): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;

  if (typeof detail === 'string') {
    return detail;
  }

  if (Array.isArray(detail)) {
    const first = detail[0] as { msg?: unknown } | undefined;
    if (first && typeof first.msg === 'string') {
      return first.msg;
    }
  }

  if (detail && typeof detail === 'object') {
    const message = (detail as { message?: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
  }

  const message = (error as { message?: unknown })?.message;
  return typeof message === 'string' && message ? message : fallback;
}

export const attendanceApi = {
  /**
   * Record attendance for the current meeting via QR code
   */
  checkIn: async (data: CheckInRequest): Promise<CheckInResponse> => {
    const response = await apiClient.post('/attendance/check-in', data);
    return response.data;
  },

  /**
   * Get the attendance of one meeting (any date is snapped to its meeting)
   */
  getMeetingAttendance: async (meetingDate?: string): Promise<MeetingAttendanceResponse> => {
    const params = meetingDate ? { meeting_date: meetingDate } : {};
    const response = await apiClient.get('/attendance/meeting', { params });
    return response.data;
  },

  /**
   * Get the meeting calendar of a month (4 meetings, 5 in long months)
   */
  getMeetingSchedule: async (year?: number, month?: number): Promise<MeetingScheduleResponse> => {
    const params = { ...(year ? { year } : {}), ...(month ? { month } : {}) };
    const response = await apiClient.get('/attendance/meetings', { params });
    return response.data;
  },

  /**
   * Get users who missed a meeting
   */
  getAbsentUsers: async (meetingDate?: string): Promise<AbsentUsersResponse> => {
    const params = meetingDate ? { meeting_date: meetingDate } : {};
    const response = await apiClient.get('/attendance/absent', { params });
    return response.data;
  },

  /**
   * Get statistics for one meeting
   */
  getMeetingStatistics: async (meetingDate?: string): Promise<MeetingStatisticsResponse> => {
    const params = meetingDate ? { meeting_date: meetingDate } : {};
    const response = await apiClient.get('/attendance/statistics/meeting', { params });
    return response.data;
  },

  /**
   * Get the monthly analysis across the month's meetings
   */
  getMonthlyStatistics: async (year?: number, month?: number): Promise<MonthlyStatisticsResponse> => {
    const params = { ...(year ? { year } : {}), ...(month ? { month } : {}) };
    const response = await apiClient.get('/attendance/statistics/monthly', { params });
    return response.data;
  },

  /**
   * Get meeting attendance history with filters
   */
  getAttendanceHistory: async (params?: {
    start_date?: string;
    end_date?: string;
    user_id?: string;
    status?: string;
  }): Promise<AttendanceHistoryResponse> => {
    const response = await apiClient.get('/attendance', { params });
    return response.data;
  },
};
```

#### T5.3 `EDIT` → `frontend/src/modules/attendance/pages/CheckInPage.tsx`

Four targeted changes; keep all brand colours, layout and Lucide icons as they are.

1. Import the helper:

```tsx
import { attendanceApi, getApiErrorMessage } from '../api';
```

2. Replace the `catch` block so the object-shaped `detail` is handled:

```tsx
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, 'Failed to check in user');
```

(keep the rest of the block: `setLastScan({ success: false, message })` and the 5s timeout).

3. Header subtitle (line ~71) becomes:

```tsx
            Scan user QR codes to record attendance for this week's Thursday meeting
```

4. In the success details block, replace the `attendance_date` line with the meeting date
   **and** its position in the month:

```tsx
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#2672B0]" />
                      <span className="text-gray-600">
                        {new Date(lastScan.attendance.meeting_date).toLocaleDateString()}
                        {' · '}
                        Meeting {lastScan.attendance.meeting_index_in_month} of the month
                      </span>
                    </div>
```

5. In the "How to Use" list, replace item 3 with a statement of the rule:

```tsx
              <span>
                Attendance is recorded for this week's Thursday meeting, and a member can
                only be recorded once per meeting
              </span>
```

**Acceptance**

```bash
cd frontend && npm run build      # runs `tsc -b && vite build`
```
No TypeScript errors. `grep -rn "attendance_date\|getTodayAttendance\|getDailyStatistics\|getWeeklyStatistics" frontend/src` must return nothing.

---

### T6 — Repository-wide vocabulary sweep

Prove the old vocabulary is gone from code:

```bash
cd /home/youssef/marmarkos-abnub/marmarkos-abnub
grep -rn --include=*.py --include=*.ts --include=*.tsx \
  -e 'attendance_date' -e 'DailyAttendance' -e 'daily_attendance' \
  -e 'count_today' -e 'count_this_week' -e 'count_this_month' -e 'daily_trend' \
  -e 'TodayAttendance' -e 'DailyStatistics' -e 'WeeklyStatistics' \
  backend/app backend/tests frontend/src
```

Expected remaining matches — **these are correct, do not "fix" them**:

* `backend/app/modules/attendance/infrastructure/persistence/models.py` and
  `attendance_repository.py`: the legacy `attendance_records.attendance_date` **column**
  keeps its name (it is a denormalized copy of `service_sessions.date`; renaming it would
  need another migration and is out of scope).
* `backend/tests/integration/database/test_attendance.py`: uses that column.
* `backend/alembic/versions/*`: migration history is immutable.

Any other match is a leftover and must be fixed.

---

### T7 — Documentation

Update these files to describe weekly meetings. Keep the existing structure and tone; do
not create new documents.

1. **`docs/PHASE_2_IMPLEMENTATION_SUMMARY.md`** (the human-facing summary; currently all
   "daily"):
   * File list: `daily_models.py` → `weekly_models.py`,
     `daily_attendance_repository.py` → `weekly_attendance_repository.py`,
     `today_attendance_query.py` → `meeting_attendance_query.py`.
   * Migration reference: add `b7d41c0f92aa_weekly_meeting_attendance.py`.
   * SQL block → table `weekly_attendance_records`, column `meeting_date`, unique
     `(user_id, meeting_date)`, index names `ix_weekly_attendance_*` /
     `uq_weekly_attendance_user_meeting`.
   * Endpoint list → the table in §3.5 of this plan.
   * Example JSON → `meeting_date` + `meeting_index_in_month`; replace "Daily Statistics"
     with the meeting/monthly examples.
   * Business-logic bullets → the rules in §1.2 (scan any day, one open meeting, no
     future/past, no duplicates).
   * TS interface list → the names in §3.4.
   * Known issues: replace "No attendance correction" wording with the explicit rule that
     past meetings are closed and cannot be back-dated.
   * Add a short note that `ValidationError` (422) was added to `app/core/exceptions` and
     that `weekly_models` is now registered in the persistence registry.

2. **`docs/database/DATABASE_DESIGN.md`**
   * Line ~41 (`attendance_records` row): reword "powers daily/weekly/monthly analytics" →
     "powers per-meeting and monthly analytics (weekly Thursday meeting)".
   * Add a row for `weekly_attendance_records`: `user_id`, `meeting_date` (Thursday),
     `check_in_at`, `status`, `recorded_by`, unique `(user_id, meeting_date)`.
   * Mermaid block (~line 160): keep `attendance_date` for `attendance_records` (real
     column) and add the `weekly_attendance_records` entity with `meeting_date`.

3. **`docs/database/IMPLEMENTATION_REPORT.md`**
   * Line ~81 analytics list → `count_current_meeting`, `count_for_meeting`,
     `count_for_meetings`, `count_month_meetings`, `count_between`,
     `attendance_percentage_between`, `meeting_trend`, `absent_users_since`.
   * Line ~212 → "per-meeting/monthly attendance" instead of "daily/weekly/monthly".
   * Line ~243 → keep the denormalization note, add that dates are meeting dates.

4. **`docs/Agile/phase-2/phase-2.md`**
   * `TASK-012 — Daily Statistics` → `TASK-012 — Meeting Statistics`.
   * `TASK-013 — Weekly Statistics` → `TASK-013 — Monthly Statistics (4 meetings)`.
   * Endpoint list (~line 827) → §3.5.
   * Acceptance checklist items about daily/weekly statistics → meeting/monthly.
   * Dashboard mock-up caption "Weekly Attendance Trend" → "Monthly Meeting Attendance
     Trend (4 meetings)".

**Acceptance:** `grep -rn -i "daily" docs/PHASE_2_IMPLEMENTATION_SUMMARY.md` returns only
historical references that are explicitly labelled as superseded, if any.

---

### T8 — Final report

Produce a short summary containing:

1. Files created / modified / deleted in T1–T7.
2. The exact test, ruff, mypy and `npm run build` output lines proving success.
3. Migration evidence (the `\d weekly_attendance_records` output).
4. **Explicit data-loss warning to relay to the owner:** migration `b7d41c0f92aa` snaps
   every existing `attendance_date` back to the Thursday of its meeting week and then
   **deletes** the later duplicates when two old daily rows collapse into one meeting
   (earliest `check_in_at` wins). On a database with real daily data this is destructive
   and irreversible; `downgrade()` restores the table/column names but not the original
   per-day dates. It must be run on a backup first.
5. Anything you could not verify, and why.

---

## 5. Out of scope — do not touch

* `ServiceSession` / `attendance_records` table names and the `attendance_date` column of
  the legacy analytics table (only vocabulary in docstrings/method names changed).
* Auth, users, QR generation, blog, comments, media, notifications, bible modules.
* The attendance **dashboard** and **history pages** (Phase 2 tasks 20-21) — they do not
  exist yet and are not part of this change.
* `frontend/src/modules/attendance/components/QRScanner.tsx` — no meeting logic inside it.
* Adding a configurable meeting weekday. It is intentionally the constant
  `MEETING_WEEKDAY = 3` in one module; if the day ever changes, that constant is the single
  edit point.
* Timezone handling. `check_in_at` uses `datetime.now()` as before; changing it is a
  separate concern.
* git operations (no commit, no push, no PR).

---

## 6. Environment reference

| Item | Value |
| --- | --- |
| Backend root | `backend/` (venv at `backend/.venv`) |
| Test database | Docker container `marmarkos-test-db`, Postgres 16, `localhost:55432`, user/password/db `marmarkos` / `marmarkos` / `marmarkos_test` |
| Start it | `docker start marmarkos-test-db` |
| Test env vars | `DEBUG=true APP_ENV=test` (the shell's `DEBUG=release` breaks settings parsing) |
| Test DB URL | conftest defaults to `postgresql+asyncpg://marmarkos:marmarkos@localhost:55432/marmarkos_test` |
| `backend/.env` | Contains a **remote** `DATABASE_URL` and live secrets. Never run migrations without overriding `DATABASE_URL`, never print secret values. |
| Frontend | `frontend/`, `npm run build` = `tsc -b && vite build` |
| Today (reference date used in tests/examples) | Fri 2026-08-21 → open meeting Thu **2026-08-20**, August meetings: 6, 13, 20, 27 |

---

## 7. Definition of done

- [ ] T1 `__init__.py` added to both attendance test packages
- [ ] T2 `test_queries.py` rewritten and passing
- [ ] T3 `test_attendance.py` updated and passing
- [ ] T4 full pytest suite green; ruff clean; mypy clean for the attendance module;
      migration upgrade/downgrade/upgrade verified on a scratch database
- [ ] T5 frontend types/api/page updated; `npm run build` green; no `attendance_date` left
      in `frontend/src`
- [ ] T6 vocabulary sweep clean except the documented legacy-column matches
- [ ] T7 four documents updated
- [ ] T8 final report delivered, including the migration data-loss warning
