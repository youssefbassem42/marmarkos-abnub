# Phase 2 — Attendance · Implementation Plan

**Document type:** Execution plan (handoff to implementers)
**Covers:** `docs/Agile/phase-2/phase-2.md` (EPIC-002, Sprint 2, US-006 → US-009) to completion
**Design source of truth:** `docs/designs/ckeck-in-en.png`, `docs/designs/check-in-ar.png`
**Design system:** `docs/Design-Guide.md` + `frontend/src/index.css` tokens
**Domain source of truth:** `docs/WEEKLY_ATTENDANCE_IMPLEMENTATION_PLAN.md` §1 (Thursday meeting model)
**Status of Phase 1:** Delivered — identity, roles, JWT auth, refresh rotation, profile, per-user QR identity
**Reference date used in all examples:** Saturday 2026-08-22 → open meeting = Thursday 2026-08-20

---

# 0. Rules of Engagement

Read this section before touching any file.

1. **Read before you write.** Every task lists the exact files it touches. Open and read each file first; the codebase already contains a large, working Phase 2 backend. Do not re-create what exists.
2. **Section 2 is binding.** Anything listed under "Already done — do not redo" must not be rewritten, renamed, or re-migrated.
3. **Section 3 freezes the contracts.** Function names, DTO field names, endpoint paths, error codes, i18n keys and design tokens in Section 3 are frozen. If a task forces a change to a frozen contract, stop and escalate instead of improvising.
4. **Meeting vocabulary is mandatory.** The words `daily`, `today`, `weekly` (in the rolling-7-day sense), `count_today`, `daily_trend`, `DailyStatistics` must not appear in new code, DTOs, endpoints, tests, or i18n keys. The unit of attendance is a **meeting** (a Thursday). See §1.
5. **Backend commands must be prefixed.** The shell exports `DEBUG=release`, which crashes `pydantic-settings`. Always run:
   `cd backend && DEBUG=true APP_ENV=test .venv/bin/python -m pytest`
6. **Never migrate against `backend/.env`.** It points at remote Neon. Always override `DATABASE_URL` to the local scratch DB (`postgresql+asyncpg://marmarkos:marmarkos@localhost:55432/marmarkos_test`).
7. **Run the Acceptance block of a task before marking it done.** A task without a green Acceptance run is not done.
8. **No git operations** (no commit, branch, push, PR) unless explicitly requested. Branch name when requested: `feature/attendance-phase-2`. Commit style: `feat: …`, `fix: …`, `test: …` (see `docs/Sprint-Guide.md`).
9. **Design fidelity beats invention.** The two check-in screenshots are the visual target. Where the design conflicts with the domain (see §1.4), the **copy** changes, never the domain.
10. **Arabic first.** `i18next` is initialised with `lng: "ar"`, `fallbackLng: "ar"`, and TypeScript key types are derived from `ar.ts`. Add keys to `frontend/src/i18n/resources/ar.ts` **before** `en.ts` or `t()` calls will not type-check.

---

# 1. Authoritative Business Specification

## 1.1 The meeting model (unchanged, already implemented)

```text
A meeting week starts Thursday and ends the following Wednesday.
Every calendar date inside that week resolves to the same meeting_date
(the Thursday of that week).

A month contains 4 meetings (5 when the month has five Thursdays).
```

Constants live in `backend/app/modules/attendance/domain/meeting_schedule.py`:
`MEETING_WEEKDAY = 3`, `MEETING_DAY_NAME = "Thursday"`, `MEETING_INTERVAL_DAYS = 7`.

## 1.2 Check-in rules (unchanged, already implemented)

| Situation | Result | HTTP |
| --- | --- | --- |
| Scan on any weekday, no explicit date | Recorded against the **open meeting** = most recent Thursday ≤ today | 201 |
| Explicit `meeting_date` = open meeting | Accepted | 201 |
| Explicit `meeting_date` in the future | Rejected | 422 |
| Explicit `meeting_date` in the past | Rejected — no back-dating | 422 |
| Explicit `meeting_date` not a Thursday | Rejected | 422 |
| User already has a record for that meeting | Rejected | 409 |
| Unknown / inactive QR token | Rejected | 422 |
| Non-ACTIVE user | Rejected | 422 |
| Caller is not ADMIN or SERVANT | Rejected | 403 |

## 1.3 New rules introduced by this plan

These close the gaps between `phase-2.md`, the design screens, and the shipped code.

| # | Rule | Rationale |
| --- | --- | --- |
| BR-1 | The platform has a single configured timezone, default **`Africa/Cairo`**. Every "which meeting is open", "what date is it" and `check_in_at` value is computed in that timezone and stored as an aware UTC timestamp. | `phase-2.md` §2 "Timezone" is unimplemented; `date.today()` and naive `datetime.now()` are currently used, so `check_in_at` is silently shifted and the Wednesday→Thursday rollover follows the server clock. |
| BR-2 | The meeting has a configured **start time** (default `19:00` local) and a **late grace period** (default `15` minutes). A check-in whose local timestamp is later than `meeting_date @ start + grace` is recorded with status **`LATE`**, otherwise `PRESENT`. | The design screens show a first-class **Late / متأخر** counter. There is currently no `LATE` status anywhere. |
| BR-3 | `PRESENT` and `LATE` both count as **attended**. `attendance_rate = attended / expected × 100`. Late members are never counted as absent. | Prevents the Late counter from double-counting or deflating rates. |
| BR-4 | Expected population = users with `status = ACTIVE` **whose account existed on or before the end of that meeting week**. | Today a member who registered yesterday is reported absent for every earlier meeting of the month, inflating absence and deflating every rate. |
| BR-5 | The absent list and absence counts for the **open** meeting are **provisional** until the configured **absence cutoff** (`21:00` local on the meeting day). Responses carry `is_final: boolean`. Before the cutoff the UI labels the number "pending", not "absent". | `phase-2.md` §2 requires a cutoff; without it every member is "absent" on Thursday morning. |
| BR-6 | Attendance records are **append-only in Sprint 2**. There is no edit, no delete, no back-dating. Marking a member `EXCUSED` is the only correction, is ADMIN-only, applies to the open meeting only, and is recorded in `audit_logs`. | Answers the open questions in `phase-2.md` TASK-011 with the smallest safe rule set. |
| BR-7 | Every attendance read endpoint requires role **ADMIN or SERVANT**. Members may read **their own** attendance only. | Today all six GET routes accept any authenticated user, so a MEMBER can read the absent list including every active member's name, e-mail and role. This violates US-007 AC-005. |
| BR-8 | Every recorded check-in stores the scan method (`QR_SCAN` \| `MANUAL`) and the recording admin, emits the `attendance.recorded` outbox event, and writes an `audit_logs` row, inside one transaction. | AC-006 requires audit information; the event type already exists but is never emitted, and the check-in path currently bypasses `UnitOfWork`. |

## 1.4 Design ↔ domain reconciliation

The screenshots were drawn against day-based wording. The domain is meeting-based. Resolution:

| Design element | Design label | Shipped label (frozen) | Reason |
| --- | --- | --- | --- |
| Stats card heading | "Today's Check-ins" / "إحصائيات اليوم" | **"Current Meeting" / "الاجتماع الحالي"** + the resolved date, e.g. `Thu 20 Aug` / `الخميس ٢٠ أغسطس` | `today` is banned vocabulary; a scan on Saturday belongs to Thursday's meeting, so "today" would be wrong on screen. |
| Stat tile 1 | "Checked in" / "تم تسجيل الحضور" | unchanged | Maps to `total_present`. |
| Stat tile 2 | "Late" / "متأخر" | unchanged | New `LATE` status, BR-2. |
| Stat tile 3 | "Absent" / "غائب" | unchanged, but reads **"Pending" / "قيد الانتظار"** before the absence cutoff | BR-5. |
| Stat tile 4 | "Total" / "الإجمالي" | unchanged | Maps to `total_expected`. |
| Recent check-in secondary line | "Youth Group • 10:24 AM" | **role • time**, e.g. "Member • 10:24 AM" / "عضو • ١٠:٢٤ ص" | There is no group/class entity until Phase 3. Do not invent one. |
| Notification bell + badge "3" | live counter | Rendered **disabled with no badge**, `aria-disabled`, tooltip "Coming soon" | The notifications module is Phase 4. Do not fake a count. |
| Left brand panel | white top, navy wave bottom, verse | reuse `BrandPanel` with a new `variant="light"` | Design-Guide §29 requires reuse; the auth pages already ship this panel in navy. |
| Footer benefit strip | 4 items on navy | reuse `AuthFooter` verbatim | `common.footer[]` in `en.ts`/`ar.ts` already contains exactly these four items with the same copy. |
| Flashlight toggle | always visible | rendered **only when the camera reports torch capability** | `html5-qrcode` torch support is device/browser dependent; a dead toggle is worse than none. |

## 1.5 Decisions taken (assumed unless the Product Owner overrides)

| ID | Decision | Default | Where configured |
| --- | --- | --- | --- |
| D-1 | Platform timezone | `Africa/Cairo` | `PLATFORM_TIMEZONE` |
| D-2 | Meeting start time | `19:00` | `MEETING_START_TIME` |
| D-3 | Late grace period | `15` minutes | `MEETING_LATE_GRACE_MINUTES` |
| D-4 | Absence cutoff | `21:00` on the meeting day | `MEETING_ABSENCE_CUTOFF_TIME` |
| D-5 | Expected population | all ACTIVE users registered on or before the meeting week end | code (BR-4) |
| D-6 | Corrections | `EXCUSED` only, ADMIN only, open meeting only, audited | code (BR-6) |
| D-7 | Attendance reads | ADMIN + SERVANT; members see only themselves | code (BR-7) |
| D-8 | Legacy `service_sessions` / `attendance_records` tables | **frozen, not extended, not dropped in Sprint 2**; a Phase 3 decision | — |

Note the Design-Guide landing copy says "FRIDAY YOUTH NIGHT" while the attendance domain is Thursday-based. Attendance UI must never name a weekday from hard-coded copy; it renders the date returned by the API. Aligning the landing page copy is a Phase 3 content task, out of scope here.

---

# 2. Already Done — Do Not Redo

Verified present in the working tree.

## 2.1 Backend — implemented and working

| Area | Files | Notes |
| --- | --- | --- |
| Meeting schedule | `app/modules/attendance/domain/meeting_schedule.py` (132 L) | 9 pure functions + 3 constants. 13 unit tests green. |
| Domain entity | `domain/entities/attendance.py` | `Attendance` dataclass, `is_present/is_absent/is_excused/is_on_meeting_day/meeting_index_in_month`. |
| Status enum | `domain/enums/attendance_status.py` | `PRESENT`, `ABSENT`, `EXCUSED`. |
| Method enum | `domain/enums/attendance.py` | `AttendanceMethod.QR_SCAN/MANUAL` (exists, unused). |
| Persistence | `infrastructure/persistence/weekly_models.py` (61 L) | `weekly_attendance_records`, unique `(user_id, meeting_date)`, 3 secondary indexes, `recorded_by` FK RESTRICT. |
| Repository | `infrastructure/persistence/weekly_attendance_repository.py` (229 L) | 13 methods incl. grouped aggregates. |
| QR validation | `infrastructure/services/qr_validation_service.py` | SHA-256 lookup, never trusts a client-supplied user id, ACTIVE check. |
| Check-in use case | `application/commands/check_in_command.py` (196 L) | Open-meeting resolution, duplicate pre-check, `IntegrityError` → 409, ADMIN/SERVANT check. |
| Queries | `application/queries/meeting_attendance_query.py`, `attendance_history_query.py` | Meeting roster ordered by `check_in_at`; history with 4-meeting default. |
| Services | `application/services/absence_service.py`, `statistics_service.py` | Absence list/count; meeting + monthly statistics with 4/5-meeting breakdown, division-by-zero safe. |
| API | `presentation/router.py` (269 L) | 7 routes under `/api/v1/attendance`. |
| Migrations | `alembic/versions/e6c8dd49ee41_*.py`, `b7d41c0f92aa_*.py` | Table created, then renamed/snapped to the Thursday model. Chain head is `a4f7c2d91e83`. |
| Error envelope | `app/core/exceptions/errors.py`, `handlers.py` | `{"detail": {"code", "message"}}`; `AppError` subclasses for 401/403/404/409/422. |
| Tests | `tests/unit/attendance/` (19 tests), `tests/integration/attendance/` (22 tests) | Domain + service-level coverage. |

## 2.2 Frontend — implemented

| Area | Files | Notes |
| --- | --- | --- |
| Types | `src/modules/attendance/types/index.ts` (105 L) | Meeting-shaped, matches backend DTOs. |
| API client | `src/modules/attendance/api/index.ts` (115 L) | 7 methods + `getApiErrorMessage`. |
| Scanner | `src/modules/attendance/components/QRScanner.tsx` (201 L) | Working `html5-qrcode` integration. **Needs rework** (§5 Stage D). |
| Check-in page | `src/modules/attendance/pages/CheckInPage.tsx` (174 L) | Working happy path. **Needs rebuild against the design** (§5 Stage D). |
| Design tokens | `src/index.css` (310 L) | Brand palette, fonts, `focus-ring`, `btn-primary`, `btn-outline`, `reveal`, dark mode. |
| i18n | `src/i18n/*` | i18next, Arabic default, namespaces `common/landing/profile/login/register/forgotPassword/resetPassword`. |
| Split-layout pattern | `src/pages/auth/login/*`, `src/pages/auth/components/BrandPanel.tsx`, `AuthFooter.tsx` | Exactly the composition the check-in design uses. |
| shadcn/ui | `src/components/ui/*` (52 files) | `Table`, `Badge`, `Chart`, `Sidebar`, `Pagination`, `Sonner` all present but unused. |

## 2.3 Known defects in shipped Phase 2 code (fixed by this plan)

| # | Defect | Location | Fixed by |
| --- | --- | --- | --- |
| DEF-1 | Attendance API calls send **no `Authorization` header** → every request 401s. The page has never worked against a real backend. | `src/modules/attendance/api/index.ts` (bare `apiClient`, no interceptor) | TASK-201 |
| DEF-2 | `CheckInPage` is **not registered in the router** and is unreachable. | `src/router.tsx` | TASK-204 |
| DEF-3 | All six attendance GET routes accept any authenticated MEMBER; `/absent` leaks every active member's name, e-mail and role. | `presentation/router.py` L98–269 | TASK-104 |
| DEF-4 | `check_in_at` is built with naive `datetime.now()` and written to a `timestamptz` column → value shifted whenever the server clock is not UTC. | `check_in_command.py` L101 | TASK-101 |
| DEF-5 | `current_meeting_date()` and `router.py` L143 fall back to server-local `date.today()`. | `meeting_schedule.py` L69, `router.py` L143 | TASK-101 |
| DEF-6 | `count_by_meeting` counts **all** statuses as present. | `statistics_service.py` L44–73 | TASK-102 |
| DEF-7 | `status` is a free-form `varchar(20)` with no CHECK/enum constraint. | `weekly_models.py` L48 | TASK-102 |
| DEF-8 | `recorded_by` is stored but exposed nowhere; no `audit_logs` row; `AttendanceRecorded` never emitted; check-in bypasses `UnitOfWork`. | `check_in_command.py`, `unit_of_work.py` | TASK-105 |
| DEF-9 | History has no pagination and no sort; `status` and the user+range combination are filtered **in Python** after loading rows. | `attendance_history_query.py` L58–87 | TASK-106 |
| DEF-10 | `calculate_expected_count()` loads every `User` row and calls `len()`. | `absence_service.py` L90 | TASK-103 |
| DEF-11 | `--ink` is declared only inside `.dark`, so `text-ink` is invalid in light mode and works only by inheritance accident. | `src/index.css` L280 | TASK-205 |
| DEF-12 | `TableHead` hard-codes `text-left`; `Sidebar` hard-codes `side="left"` with physical borders — both break RTL. | `components/ui/table.tsx` L76, `components/ui/sidebar.tsx` L174 | TASK-205, TASK-203 |
| DEF-13 | `domain/interfaces.py` Protocols are implemented by nothing and already drift from the concrete repository. | `domain/interfaces.py` | TASK-107 |
| DEF-14 | `phase-2.md` still contains day-based wording (`GET /attendance/today`, `UNIQUE(userId, attendanceDate)`, "one check-in per day"). | `docs/Agile/phase-2/phase-2.md` | TASK-703 |

---

# 3. Frozen Contracts

## 3.1 Configuration (new fields in `backend/app/config.py`)

```python
PLATFORM_TIMEZONE: str = "Africa/Cairo"          # IANA name
MEETING_START_TIME: str = "19:00"                # HH:MM, platform-local
MEETING_LATE_GRACE_MINUTES: int = 15
MEETING_ABSENCE_CUTOFF_TIME: str = "21:00"       # HH:MM, platform-local
ATTENDANCE_HISTORY_PAGE_SIZE: int = 20
ATTENDANCE_HISTORY_MAX_PAGE_SIZE: int = 100
```

## 3.2 Clock helper (new module `backend/app/core/time/clock.py`)

```python
def platform_timezone() -> ZoneInfo: ...
def now_utc() -> datetime: ...          # timezone-aware, UTC
def now_local() -> datetime: ...        # timezone-aware, PLATFORM_TIMEZONE
def today_local() -> date: ...          # local calendar date
def to_local(value: datetime) -> datetime: ...
def local_datetime(day: date, hhmm: str) -> datetime: ...   # aware, platform tz
```

`meeting_schedule.current_meeting_date` loses its `None` default and becomes `current_meeting_date(reference: date)`. All call sites pass `today_local()`. This makes the server clock impossible to use by accident.

## 3.3 Domain

```python
class AttendanceStatus(StrEnum):
    PRESENT = "PRESENT"
    LATE    = "LATE"        # new
    ABSENT  = "ABSENT"
    EXCUSED = "EXCUSED"

ATTENDED_STATUSES: frozenset[AttendanceStatus] = frozenset(
    {AttendanceStatus.PRESENT, AttendanceStatus.LATE}
)
```

`Attendance` entity gains `method: AttendanceMethod` and the properties `is_late`, `is_attended`.

## 3.4 Database — target schema for `weekly_attendance_records`

```text
weekly_attendance_records
─────────────────────────────────────────────────────────────
id            uuid        PK
user_id       uuid        NOT NULL  FK users(id) ON DELETE CASCADE
meeting_date  date        NOT NULL
check_in_at   timestamptz NOT NULL
status        varchar(20) NOT NULL  DEFAULT 'PRESENT'
                          CHECK (status IN ('PRESENT','LATE','ABSENT','EXCUSED'))
method        varchar(20) NOT NULL  DEFAULT 'QR_SCAN'
                          CHECK (method IN ('QR_SCAN','MANUAL'))          -- new
recorded_by   uuid        NOT NULL  FK users(id) ON DELETE RESTRICT
created_at    timestamptz NOT NULL  DEFAULT now()
updated_at    timestamptz NOT NULL  DEFAULT now()

uq_weekly_attendance_user_meeting   UNIQUE (user_id, meeting_date)   -- exists
ix_weekly_attendance_user_id                                          -- exists
ix_weekly_attendance_meeting_date                                     -- exists
ix_weekly_attendance_status                                           -- exists
ix_weekly_attendance_meeting_check_in  (meeting_date, check_in_at)    -- new
```

One new migration, `down_revision = a4f7c2d91e83`, slug `attendance_late_status_and_method`.

## 3.5 API — complete Phase 2 surface

All paths are prefixed `/api/v1`. `[A]` = ADMIN, `[S]` = SERVANT, `[M]` = MEMBER.

| # | Method + path | Roles | Change | Success |
| --- | --- | --- | --- | --- |
| 1 | `POST /attendance/check-in` | A, S | body gains `method` | 201 |
| 2 | `GET /attendance/meeting?meeting_date=` | A, S | role guard added; summary gains late/pending fields | 200 |
| 3 | `GET /attendance/meetings?year=&month=` | A, S | role guard added | 200 |
| 4 | `GET /attendance/absent?meeting_date=` | A, S | role guard; typed items; `is_final` | 200 |
| 5 | `GET /attendance/statistics/meeting?meeting_date=` | A, S | role guard; `total_late`, `is_final` | 200 |
| 6 | `GET /attendance/statistics/monthly?year=&month=` | A, S | role guard; `late_count` per meeting | 200 |
| 7 | `GET /attendance?start_date=&end_date=&user_id=&status=&page=&size=&sort=` | A, S | role guard; **pagination + SQL filters + sort** | 200 |
| 8 | `GET /attendance/me?year=&month=` | A, S, M | **new** — caller's own attendance | 200 |
| 9 | `POST /attendance/{attendance_id}/excuse` | A | **new** — BR-6 correction | 200 |

Error codes (envelope `{"detail": {"code", "message"}}`): `unauthorized` 401, `forbidden` 403, `not_found` 404, `conflict` 409, `validation_error` 422, `internal_error` 500.

## 3.6 DTO field additions (frozen names)

```text
CheckInRequest        + method: "QR_SCAN" | "MANUAL" = "QR_SCAN"
AttendanceDTO         + method: str
                      + recorded_by: UUID
                      + recorded_by_name: str
AttendanceSummary     + total_late: int
                      + total_attended: int          # present + late
                      + is_final: bool               # absence cutoff reached
MeetingStat           + late_count: int
MeetingAttendance…    (unchanged besides summary)
AbsentUsersResponse   absent_users: list[AbsentUserDTO]   # was list[dict[str, str]]
                      + is_final: bool
AbsentUserDTO         user_id: UUID, name: str, email: str, role: str
AttendanceHistory…    + page: int, size: int, pages: int, has_next: bool
ExcuseResponse        success: bool, message: str, attendance: AttendanceDTO
MyAttendanceResponse  year, month, meetings_held, attended_count, records[]
```

## 3.7 Shared pagination (new `backend/app/core/pagination/__init__.py`)

```python
class PageParams(BaseModel):
    page: int = Field(1, ge=1)
    size: int = Field(20, ge=1, le=100)
    @property
    def offset(self) -> int: ...

class Page(BaseModel, Generic[T]):
    items: list[T]; total: int; page: int; size: int; pages: int; has_next: bool
```

## 3.8 Frontend design tokens (use these — never raw hex)

| Purpose | Token / utility | Value |
| --- | --- | --- |
| Primary text, headings, nav, footer bg | `text-ink`, `bg-navy`, `text-navy` | `#253d63` |
| Secondary accent, links, focus ring | `text-brand-blue`, `focus-ring` | `#2672b0` |
| Success, "Checked in" badge, accent CTA | `text-mint`, `bg-mint`, `bg-mint/15` | `#53cb9e` |
| Late / warning | `text-brand-orange` | `#f96702` |
| Absent / error | `text-brand-red` | `#9e150b` |
| Section background | `bg-soft` | `oklch(0.975 0.006 240)` |
| Card | `rounded-2xl border border-border bg-card shadow-[0_2px_24px_rgba(37,61,99,0.08)]` | — |
| Radius | `rounded-lg` = `0.75rem`, `rounded-xl`, `rounded-2xl`, `rounded-full` | `--radius: 0.75rem` |
| EN body font | `font-sans` | Poppins |
| Headings | `font-heading` | El Messiri |
| Arabic body | `font-arabic` | Markazi Text |
| Verse | `font-verse` | Amiri |
| Chart series | `--chart-1..5` | re-mapped to mint/blue/orange/red/navy by TASK-205 |

Icons: **Lucide only**. Circular icon containers 64×64 `rounded-full`. Animations: fade/slide/hover only, 200–500 ms. No glassmorphism, no gradients, no parallax.

## 3.9 i18n — new `attendance` namespace

Added to `ar.ts` first, then `en.ts`, structurally identical. Frozen key tree:

```text
attendance
├── nav.{checkIn, dashboard, history, section}
├── checkIn
│   ├── title, subtitle
│   ├── scanner.{readyTitle, readySubtitle, scanningTitle, scanningSubtitle,
│   │            processingTitle, processingSubtitle, start, stop, retry,
│   │            flashlight, permissionTitle, permissionBody, permissionRetry,
│   │            unsupportedTitle, unsupportedBody}
│   ├── manual.{title, subtitle, label, placeholder, submit, cancel}
│   ├── tips.{title, items[3]}
│   ├── result.{successTitle, duplicateTitle, invalidTitle, forbiddenTitle,
│   │           networkTitle, name, meeting, time, status, scanNext}
│   ├── stats.{title, viewAll, checkedIn, late, absent, pending, total}
│   └── recent.{title, viewAll, empty, badge, role}
├── dashboard
│   ├── title, subtitle
│   ├── cards.{present, late, absent, expected, rate}
│   ├── meeting.{selectorLabel, previous, next, open, closed, notHeld}
│   ├── table.{title, colName, colTime, colStatus, colMethod, empty}
│   ├── absent.{title, empty, provisional}
│   └── trend.{title, subtitle, empty, meetingLabel}
├── history
│   ├── title, subtitle
│   ├── filters.{from, to, member, status, all, apply, reset}
│   ├── table.{colDate, colName, colTime, colStatus, colRecordedBy, empty}
│   ├── pagination.{showing, of, previous, next}
│   └── export.{csv, filename}
├── status.{PRESENT, LATE, ABSENT, EXCUSED}
├── method.{QR_SCAN, MANUAL}
└── errors.{unauthorized, forbidden, conflict, validation, network, unknown}
```

Verbatim EN/AR copy for every key is specified in §6.

## 3.10 Frontend routes (frozen)

| Path | Guard | Layout | Component |
| --- | --- | --- | --- |
| `/attendance/check-in` | `RequireRole(["ADMIN","SERVANT"])` | `AttendanceLayout` (split, brand panel) | `CheckInPage` |
| `/attendance/dashboard` | `RequireRole(["ADMIN","SERVANT"])` | `AdminLayout` (sidebar) | `AttendanceDashboardPage` |
| `/attendance/history` | `RequireRole(["ADMIN","SERVANT"])` | `AdminLayout` | `AttendanceHistoryPage` |
| `/profile` | `RequireAuth` | existing | `ProfilePage` (adds "My attendance" card) |

## 3.11 React Query conventions (frozen)

`src/modules/attendance/api/queryKeys.ts`:

```ts
export const attendanceKeys = {
  all: ["attendance"] as const,
  meeting: (d?: string) => [...attendanceKeys.all, "meeting", d ?? "open"] as const,
  schedule: (y: number, m: number) => [...attendanceKeys.all, "schedule", y, m] as const,
  absent: (d?: string) => [...attendanceKeys.all, "absent", d ?? "open"] as const,
  meetingStats: (d?: string) => [...attendanceKeys.all, "stats", "meeting", d ?? "open"] as const,
  monthlyStats: (y: number, m: number) => [...attendanceKeys.all, "stats", "monthly", y, m] as const,
  history: (f: HistoryFilters) => [...attendanceKeys.all, "history", f] as const,
  mine: (y: number, m: number) => [...attendanceKeys.all, "mine", y, m] as const,
};
```

`useCheckIn` invalidates `attendanceKeys.all` on success.

---

# 4. Continued in Part 2

Delivery stages, every task and subtask, the check-in screen UI specification (including verbatim EN/AR copy), the test matrix, the 10-day timeline and the Definition of Done are in:

**`docs/Agile/phase-2/phase-2-implementation-plan-part-2.md`**

| Part 2 section | Contents |
| --- | --- |
| §4 | Delivery stages A–G, revised story scope (30 points) |
| §5 | Stage A — backend correctness, security, data model (TASK-101 → 108) |
| §6 | Stage B — frontend foundation (TASK-201 → 208) |
| §7 | Stage C — check-in screen, design spec + copy tables (TASK-301 → 310) |
| §8 | Stage D — attendance dashboard (TASK-401 → 407) |
| §9 | Stage E — attendance history + export (TASK-501 → 505) |
| §10 | Stage F — member self-service (TASK-601 → 602) |
| §11 | Stage G — tests, docs, hardening, release (TASK-701 → 708) |
| §12–17 | Test matrix, timeline, DoR/DoD, demo scenario, risks, out of scope |
