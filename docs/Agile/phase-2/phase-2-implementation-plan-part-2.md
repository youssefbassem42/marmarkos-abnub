# Phase 2 — Attendance · Implementation Plan (Part 2 of 2)

**Part 1:** `docs/Agile/phase-2/phase-2-implementation-plan.md` — rules of engagement, business specification, "already done" inventory, frozen contracts.
**This part:** delivery stages, every task and subtask, the check-in screen UI specification, test matrix, timeline, Definition of Done.

Task IDs continue from Part 1 and never collide with the `TASK-001…TASK-017` numbering already used inside `docs/Agile/phase-2/phase-2.md`.

---

# 4. Delivery Stages

| Stage | Goal | Tasks | Blocks | Est. days |
| --- | --- | --- | --- | --- |
| **A** | Backend correctness, security and data-model completion | TASK-101 → TASK-108 | everything | 3 |
| **B** | Frontend foundation: auth transport, guards, layouts, tokens, i18n, data layer | TASK-201 → TASK-208 | C, D, E, F | 2 |
| **C** | Check-in screen rebuilt to the design (EN + AR) | TASK-301 → TASK-310 | demo | 2 |
| **D** | Attendance dashboard | TASK-401 → TASK-407 | demo | 1.5 |
| **E** | Attendance history + export | TASK-501 → TASK-505 | — | 1 |
| **F** | Member self-service attendance | TASK-601 → TASK-602 | — | 0.5 |
| **G** | Tests, documentation, hardening, release | TASK-701 → TASK-708 | sprint close | 2 |

Stage A must be complete before Stage C starts: the check-in screen renders the `LATE` status and the provisional-absence flag introduced in Stage A. Stage B may run in parallel with Stage A.

Story-point mapping back to `phase-2.md` §1: US-006 = 8 (Stages A, C), US-007 = 5 (Stages A, D), US-008 = 5 (Stages A, D), US-009 = 5 (Stages A, D, E). Two stories are added by this plan:

| ID | Type | Title | Priority | Points |
| --- | --- | --- | --- | ---: |
| US-010 | Story | Late arrival tracking | Must Have | 3 |
| US-011 | Story | Attendance correction (excuse) | Should Have | 2 |
| US-012 | Story | Member views own attendance | Should Have | 2 |

**Revised sprint total: 30 story points.**

---

# 5. Stage A — Backend Correctness, Security and Data Model

## TASK-101 — Platform timezone and a single clock

**Story:** US-006 · **Fixes:** DEF-4, DEF-5 · **Rule:** BR-1

**Files**
- `backend/app/config.py` (add settings)
- `backend/app/core/time/__init__.py`, `backend/app/core/time/clock.py` (new)
- `backend/app/modules/attendance/domain/meeting_schedule.py` (signature change)
- `backend/app/modules/attendance/application/commands/check_in_command.py`
- `backend/app/modules/attendance/application/queries/meeting_attendance_query.py`
- `backend/app/modules/attendance/application/queries/attendance_history_query.py`
- `backend/app/modules/attendance/application/services/absence_service.py`
- `backend/app/modules/attendance/application/services/statistics_service.py`
- `backend/app/modules/attendance/presentation/router.py`
- `backend/.env.example`

**Subtasks**
1. Add the six settings from Part 1 §3.1 to `Settings`. Keep `case_sensitive=True` and document each in `.env.example` with the default value.
2. Create `app/core/time/clock.py` exposing exactly the seven helpers in Part 1 §3.2. Implement with `zoneinfo.ZoneInfo(settings.PLATFORM_TIMEZONE)`; cache the `ZoneInfo` in a module-level `functools.lru_cache`. `local_datetime(day, "19:00")` parses `HH:MM` and returns an aware datetime in the platform zone; raise `ValueError` on a malformed value at import-free call time.
3. Re-export the helpers from `app/core/time/__init__.py`.
4. Change `current_meeting_date(reference: date | None = None)` to `current_meeting_date(reference: date)`. Do **not** keep a default. Update its docstring to state that the caller owns the clock.
5. Update every call site to pass `today_local()`. There are six: `check_in_command._resolve_open_meeting`, `meeting_attendance_query.resolve_meeting`, `attendance_history_query.execute` (two calls), `absence_service`, `statistics_service`, `router.py` L143 (`/meetings`).
6. In `check_in_command`, replace `datetime.now()` with `now_utc()`. The value written to `check_in_at` must be timezone-aware.
7. Add a `clock` seam for tests: `CheckInCommand.__init__(self, session, *, now: Callable[[], datetime] = now_utc)` and `today: Callable[[], date] = today_local`. Same seam on `AbsenceCalculationService` and `StatisticsService`. Default arguments keep production wiring unchanged.
8. Grep the module for `date.today()` and `datetime.now()` — the only permitted remaining occurrences are inside `app/core/time/clock.py`.

**Acceptance**
```bash
cd backend
grep -rn "date.today()\|datetime.now()" app/modules/attendance app/core/time | grep -v "core/time/clock.py"   # must print nothing
DEBUG=true APP_ENV=test .venv/bin/python -m pytest tests/unit/attendance -q
DEBUG=true .venv/bin/python -m mypy app/core/time app/modules/attendance
```

---

## TASK-102 — `LATE` status, `method` column, status constraint, migration

**Story:** US-010 · **Fixes:** DEF-6, DEF-7 · **Rules:** BR-2, BR-3

**Files**
- `backend/app/modules/attendance/domain/enums/attendance_status.py`
- `backend/app/modules/attendance/domain/enums/__init__.py`
- `backend/app/modules/attendance/domain/entities/attendance.py`
- `backend/app/modules/attendance/infrastructure/persistence/weekly_models.py`
- `backend/app/modules/attendance/infrastructure/persistence/weekly_attendance_repository.py`
- `backend/app/modules/attendance/application/commands/check_in_command.py`
- `backend/app/modules/attendance/application/services/statistics_service.py`
- `backend/alembic/versions/<new>_attendance_late_status_and_method.py` (new)

**Subtasks**
1. Add `LATE = "LATE"` to `AttendanceStatus`. Order the members `PRESENT, LATE, ABSENT, EXCUSED`. Add the module-level `ATTENDED_STATUSES` frozenset.
2. Export `AttendanceStatus`, `ATTENDED_STATUSES`, `AttendanceMethod` from `domain/enums/__init__.py` (currently only `AttendanceStatus` is exported).
3. Entity: add `method: AttendanceMethod` (default `QR_SCAN`) and the properties `is_late` and `is_attended` (`status in ATTENDED_STATUSES`).
4. Model: change `status` to `mapped_column(SAEnum(AttendanceStatus, name="attendance_status", native_enum=False, length=20), nullable=False, default=AttendanceStatus.PRESENT)` to match the project convention (`native_enum=False` everywhere). Add `method` with the same treatment against `AttendanceMethod`, default `QR_SCAN`. Add `Index("ix_weekly_attendance_meeting_check_in", "meeting_date", "check_in_at")` to `__table_args__`.
5. Repository: map `method` in `add()` and `_to_domain()`. Add `count_attended_by_meeting(meeting_date)` and `counts_attended_by_meeting(dates)` that filter `status.in_(ATTENDED_STATUSES)`. Add `counts_by_meeting_and_status(dates)` returning `dict[date, dict[str, int]]` so one query feeds present/late/excused per meeting.
6. `CheckInCommand`: derive the status instead of hard-coding `PRESENT`.
   ```text
   threshold = local_datetime(meeting_date, MEETING_START_TIME) + MEETING_LATE_GRACE_MINUTES
   status    = LATE if to_local(check_in_at) > threshold else PRESENT
   ```
   Store `method` from the request. Document the rule in the docstring: a scan on a later weekday of the same meeting week is always `LATE`, because it is by definition after the meeting ended.
7. `StatisticsService`: replace `count_by_meeting` with `count_attended_by_meeting`; compute `total_present`, `total_late`, `total_attended`; `absent = max(expected - attended, 0)`; `attendance_rate = _rate(attended, expected)`. Populate `MeetingStat.late_count` from the grouped query.
8. Migration (`down_revision = "a4f7c2d91e83"`):
   - `ALTER TABLE weekly_attendance_records ADD COLUMN method varchar(20) NOT NULL DEFAULT 'QR_SCAN'`
   - `CREATE CHECK` constraints `ck_weekly_attendance_status` and `ck_weekly_attendance_method` with the value lists from Part 1 §3.4
   - `CREATE INDEX ix_weekly_attendance_meeting_check_in ON weekly_attendance_records (meeting_date, check_in_at)`
   - `downgrade()` drops the index, both constraints, and the column. It must not attempt to reclassify `LATE` rows; note in a comment that `LATE` rows downgrade to an unconstrained value.
9. No back-fill: existing rows keep `PRESENT` and `QR_SCAN`.

**Acceptance**
```bash
cd backend
export DATABASE_URL=postgresql+asyncpg://marmarkos:marmarkos@localhost:55432/marmarkos_test
DEBUG=true .venv/bin/alembic upgrade head && DEBUG=true .venv/bin/alembic check
DEBUG=true .venv/bin/alembic downgrade -1 && DEBUG=true .venv/bin/alembic upgrade head
psql "postgresql://marmarkos:marmarkos@localhost:55432/marmarkos_test" -c "\d weekly_attendance_records"
# expect: method column, 2 CHECK constraints, 5 indexes
```

---

## TASK-103 — Expected population and absence finality

**Story:** US-008 · **Fixes:** DEF-10 · **Rules:** BR-4, BR-5

**Files**
- `backend/app/modules/attendance/application/services/absence_service.py`
- `backend/app/modules/attendance/application/dto/query_dto.py`
- `backend/app/modules/attendance/application/services/statistics_service.py`

**Subtasks**
1. Introduce `AbsentUserDTO(user_id: UUID, name: str, email: str, role: str)` and change `AbsentUsersResponse.absent_users` to `list[AbsentUserDTO]`. Add `is_final: bool`. This replaces the untyped `list[dict[str, str]]`, which produced a useless OpenAPI schema.
2. `get_expected_users(meeting_date)`: add the BR-4 predicate — `User.status == ACTIVE` **and** `User.created_at <= end_of(meeting_week_end)` where the boundary is `local_datetime(meeting_week_end, "23:59") .astimezone(UTC)`. Add `selectinload(User.role)` so `user.role.name` never triggers a lazy load.
3. `calculate_expected_count(meeting_date)`: replace the `len(list)` implementation with `select(func.count()).select_from(User).where(<same predicate>)`.
4. Add `is_absence_final(meeting_date) -> bool`: `True` when `meeting_date < current_meeting_date(today_local())`, or when it is the open meeting and `now_local() >= local_datetime(meeting_date, MEETING_ABSENCE_CUTOFF_TIME)`. Return it in both the absence and statistics responses.
5. Absent list = expected users minus users with an **attended** record (`PRESENT`/`LATE`). Users holding an `EXCUSED` record are excluded from the absent list and reported in a new `excused_count` field on `AttendanceSummary`.
6. Both services take the expected count from one shared helper — do not compute it twice in the monthly path.

**Acceptance**
```bash
cd backend
DEBUG=true APP_ENV=test .venv/bin/python -m pytest tests/integration/attendance -q
DEBUG=true .venv/bin/python -m mypy app/modules/attendance
```

---

## TASK-104 — Authorization on every attendance route

**Story:** US-007 AC-005 · **Fixes:** DEF-3 · **Rule:** BR-7

**Files**
- `backend/app/modules/attendance/presentation/router.py`

**Subtasks**
1. Add the shared alias next to the existing `CurrentUser`:
   ```python
   AttendanceManager = Annotated[User, Depends(require_role(RoleName.ADMIN, RoleName.SERVANT))]
   ```
2. Change routes 1–7 to depend on `AttendanceManager` instead of `CurrentUser`. Keep the in-command role check in `CheckInCommand._validate_admin_permission` (defence in depth) — do not delete it.
3. Add `403` to the documented `responses` of every changed route so `/docs` reflects reality.
4. Route 3 (`GET /attendance/meetings`) currently takes no DB session; it still needs the role dependency.
5. Do not touch route 8 (`/attendance/me`, TASK-108), which must remain reachable by MEMBER.

**Acceptance**
```bash
cd backend
grep -n "AttendanceManager" app/modules/attendance/presentation/router.py | wc -l   # >= 8
DEBUG=true APP_ENV=test .venv/bin/python -m pytest tests/integration/api/attendance -q
```

---

## TASK-105 — Transactional integrity, outbox event and audit trail

**Story:** US-006 AC-006 · **Fixes:** DEF-8 · **Rule:** BR-8

**Files**
- `backend/app/shared/infrastructure/persistence/unit_of_work.py`
- `backend/app/modules/attendance/domain/events/attendance_recorded.py`
- `backend/app/modules/attendance/application/commands/check_in_command.py`
- `backend/app/modules/attendance/application/dto/check_in_dto.py`
- `backend/app/modules/attendance/presentation/router.py`
- `backend/tests/integration/database/test_outbox.py`

**Subtasks**
1. Expose the repository on the UoW:
   ```python
   @property
   def weekly_attendance(self) -> WeeklyAttendanceRepository: ...
   ```
   Follow the existing lazy-property pattern used by `attendance` and `users`.
2. Fix `AttendanceRecorded` so it describes the weekly record instead of the legacy service session. Fields: `aggregate_id` (attendance id), `user_id`, `meeting_date`, `status`, `method`, `recorded_by`. Remove `session_id`. Keep `event_type = "attendance.recorded"` and `aggregate_type = "attendance_record"`.
3. Rewrite the persistence tail of `CheckInCommand.execute` to run inside `UnitOfWork`:
   - resolve the user and the open meeting as today
   - `uow.weekly_attendance.add(attendance)`
   - `uow.record(AttendanceRecorded(...))`
   - `uow.audit.add(...)` with `action="attendance.check_in"`, `actor_id=admin_user.id`, `metadata={"user_id", "meeting_date", "status", "method"}`
   - let `UnitOfWork.create()` commit; keep the `IntegrityError` → `ConflictError` translation, and roll back through the UoW, not the request session
4. Route 1 must construct the command with a UoW dependency (`Depends(get_unit_of_work)`) instead of the raw session, mirroring how other modules obtain a UoW. The `qr_validation_service` keeps using `uow.session`.
5. `AttendanceDTO` gains `method`, `recorded_by`, `recorded_by_name`. Populate `recorded_by_name` from the already-loaded admin user in the check-in path, and via the batched user lookup in query paths.
6. Update `tests/integration/database/test_outbox.py` L116–122 to the new event shape.

**Acceptance**
```bash
cd backend
DEBUG=true APP_ENV=test .venv/bin/python -m pytest tests/integration -q
psql "postgresql://marmarkos:marmarkos@localhost:55432/marmarkos_test" \
  -c "select event_type, count(*) from outbox_events group by 1"
```

---

## TASK-106 — History pagination, SQL filtering and sorting

**Story:** US-007 / US-009 · **Fixes:** DEF-9

**Files**
- `backend/app/core/pagination/__init__.py` (currently empty)
- `backend/app/modules/attendance/infrastructure/persistence/weekly_attendance_repository.py`
- `backend/app/modules/attendance/application/queries/attendance_history_query.py`
- `backend/app/modules/attendance/application/dto/query_dto.py`
- `backend/app/modules/attendance/presentation/router.py`

**Subtasks**
1. Implement `PageParams` and `Page[T]` exactly as frozen in Part 1 §3.7. `pages = ceil(total / size)`, `has_next = page < pages`. This is shared infrastructure — no attendance-specific naming.
2. Add one repository method that does all the work in SQL:
   ```python
   async def search(
       self, *, start: date | None, end: date | None, user_id: UUID | None,
       status: AttendanceStatus | None, limit: int, offset: int,
       sort: Literal["meeting_date", "check_in_at"], descending: bool,
   ) -> list[Attendance]: ...
   async def count_search(self, *, start, end, user_id, status) -> int: ...
   ```
   Build one `select()` with conditional `where` clauses; `selectinload(user)` and `selectinload(recorder)`; order by the requested column then `id` for a stable page boundary.
3. Rewrite `AttendanceHistoryQuery.execute` to delegate to `search`/`count_search`. Delete the in-Python date filtering (L58–84) and the in-Python status filter (L86–87). Keep the "no filters → last 4 meetings" default by computing `start = meeting_dates_between(...)[−4]`.
4. Add `page`, `size`, `pages`, `has_next` to `AttendanceHistoryResponse`. `total_count` stays and now comes from `count_search` — the frontend already reads it.
5. Route 7 gains `page: int = Query(1, ge=1)`, `size: int = Query(settings.ATTENDANCE_HISTORY_PAGE_SIZE, ge=1, le=settings.ATTENDANCE_HISTORY_MAX_PAGE_SIZE)`, `sort: Literal["meeting_date","check_in_at"] = "meeting_date"`, `order: Literal["asc","desc"] = "desc"`.
6. Verify the query plan uses `ix_weekly_attendance_meeting_check_in` for the default ordering.

**Acceptance**
```bash
cd backend
DEBUG=true APP_ENV=test .venv/bin/python -m pytest tests/integration/attendance/test_queries.py -q
psql "postgresql://marmarkos:marmarkos@localhost:55432/marmarkos_test" -c \
  "explain select * from weekly_attendance_records order by meeting_date desc, check_in_at desc limit 20"
```

---

## TASK-107 — Correction endpoint, protocols, dead code

**Story:** US-011 · **Fixes:** DEF-13 · **Rule:** BR-6

**Files**
- `backend/app/modules/attendance/application/commands/excuse_attendance_command.py` (new)
- `backend/app/modules/attendance/application/dto/check_in_dto.py`
- `backend/app/modules/attendance/domain/interfaces.py`
- `backend/app/modules/attendance/presentation/router.py`

**Subtasks**
1. `ExcuseAttendanceCommand.execute(attendance_id, admin_user, reason: str | None)`:
   - ADMIN only → otherwise `ForbiddenError`
   - record must exist → otherwise `NotFoundError`
   - record's `meeting_date` must equal the open meeting → otherwise `ValidationError` ("past meetings are closed")
   - sets `status = EXCUSED`, writes an `audit_logs` row with the reason, records `attendance.excused` on the outbox
2. Add route 9 `POST /attendance/{attendance_id}/excuse` with `require_role(RoleName.ADMIN)`, body `{ "reason": str | None }`, response `ExcuseResponse`. Document 403/404/422.
3. Make the Protocols real: add `find_users_by_meeting`, `search`, `count_search`, `count_attended_by_meeting` to the `WeeklyAttendanceRepository` Protocol, and annotate the concrete class as implementing it (`_: WeeklyAttendanceRepositoryProtocol = WeeklyAttendanceRepository(...)` assertion in a `if TYPE_CHECKING` block, or explicit inheritance). Either way `mypy` must fail if they drift again.
4. Delete nothing from the legacy `attendance_repository.py` / `models.py` — D-8 freezes them. Add a module docstring to both stating they are legacy and unused by Phase 2 endpoints.

**Acceptance**
```bash
cd backend
DEBUG=true .venv/bin/python -m mypy app/modules/attendance   # zero errors, strict
DEBUG=true APP_ENV=test .venv/bin/python -m pytest tests/integration/attendance -q
```

---

## TASK-108 — Member self-service endpoint

**Story:** US-012

**Files**
- `backend/app/modules/attendance/application/queries/my_attendance_query.py` (new)
- `backend/app/modules/attendance/application/dto/query_dto.py`
- `backend/app/modules/attendance/presentation/router.py`

**Subtasks**
1. `MyAttendanceQuery.execute(user_id, year, month)` → `MyAttendanceResponse(year, month, total_meetings, meetings_held, attended_count, attendance_rate, records: list[AttendanceDTO])`. Uses `meetings_in_month` + `find_by_user` filtered to the month range in SQL.
2. Route 8 `GET /attendance/me?year=&month=` with plain `CurrentUser` (any authenticated, ACTIVE user). Defaults: current local year/month.
3. The response must never include other members' data and must not include `recorded_by_name` (an admin's identity is not member-visible). Use a reduced DTO (`MyAttendanceRecord`) with `meeting_date`, `meeting_index_in_month`, `check_in_at`, `status`.

**Acceptance**
```bash
cd backend
DEBUG=true APP_ENV=test .venv/bin/python -m pytest tests/integration/api/attendance/test_my_attendance.py -q
```

---

# 6. Stage B — Frontend Foundation

## TASK-201 — Auth transport for all API calls

**Fixes:** DEF-1 — highest-severity frontend defect: the attendance UI has never successfully called the backend.

**Files**
- `frontend/src/lib/api.ts`
- `frontend/src/lib/auth.ts`
- `frontend/src/modules/attendance/api/index.ts`

**Subtasks**
1. Add a request interceptor to `apiClient` that attaches `Authorization: Bearer ${getAccessToken()}` when a token exists. Skip the header for `/auth/login`, `/auth/register`, `/auth/google/*`.
2. Add a response interceptor that converts any axios error into `ApiError(status, message)` using the same precedence already implemented in `getApiErrorMessage` (`detail` string → `detail[].msg` → `detail.message` → `error.message`). Then delete the eight duplicated `catch` blocks in `lib/api.ts` and keep the per-call logic to one line.
3. Move `getApiErrorMessage` out of the attendance module into `src/lib/api.ts` and re-export it from the attendance API for compatibility. One error-mapping implementation only.
4. Replace the hardcoded Arabic fallback string with an i18n key (`attendance.errors.unknown` for attendance calls, `common.errors.unknown` for the rest) resolved at the call site, not inside the transport layer. The transport returns `code` + raw `message`; components translate.
5. `lib/auth.ts`: add `getUserRole(): "ADMIN" | "SERVANT" | "MEMBER" | null` and `hasAnyRole(...roles)`; add `isAttendanceManager()` = `hasAnyRole("ADMIN","SERVANT")`.
6. Convert the attendance API module to the `@/` alias and double quotes so it matches prettier defaults.

**Acceptance**
```bash
cd frontend && npm run lint && npm run build
# manual: log in as SERVANT, open /attendance/check-in, confirm 200 (not 401) in the network tab
```

---

## TASK-202 — Route guards

**Files**
- `frontend/src/components/common/RequireAuth.tsx` (new)
- `frontend/src/components/common/RequireRole.tsx` (new)
- `frontend/src/pages/ForbiddenPage.tsx` (new)

**Subtasks**
1. `RequireAuth`: renders `<Outlet />` when `getAccessToken()` exists, otherwise `<Navigate to="/login" replace state={{ from: location }} />`.
2. `RequireRole({ roles })`: composes `RequireAuth`, then checks `hasAnyRole(...roles)`; on failure renders `<ForbiddenPage />` (not a redirect — the user is authenticated, they are simply not allowed). 403 must be visible, not silently bounced.
3. `ForbiddenPage`: brand-consistent, `ShieldAlert` in a `bg-brand-red/10` medallion, `common.forbidden.*` i18n keys, `btn-outline` link home. `dir`/`lang` set from `useLanguage()`.
4. These are the first guards in the codebase — the existing `ProfilePage` in-component redirect stays, but note it in a comment as superseded.

**Acceptance** `npm run build` and manual: MEMBER hitting `/attendance/dashboard` sees the 403 page; anonymous user is redirected to `/login`.

---

## TASK-203 — `AdminLayout` and `AttendanceLayout`

**Files**
- `frontend/src/layouts/AdminLayout.tsx` (new — the directory is currently empty)
- `frontend/src/layouts/AttendanceLayout.tsx` (new)
- `frontend/src/components/layout/AdminSidebar.tsx` (new)
- `frontend/src/components/layout/AdminTopbar.tsx` (new)
- `frontend/src/components/ui/sidebar.tsx` (RTL fix)

**Subtasks**
1. `AdminSidebar` built on the existing shadcn `Sidebar`. Pass `side={language === "ar" ? "right" : "left"}`. Items (Lucide icons): `ScanLine` Check-in, `LayoutDashboard` Dashboard, `History` History — labels from `attendance.nav.*`, group label `attendance.nav.section`. Active state via `NavLink` `isActive`.
2. `sidebar.tsx` RTL fix: the mobile `Sheet` hard-codes `side="right"` (L600) — make it follow the same language expression. Leave the rest of the component untouched.
3. `AdminTopbar` reproduces the design header row: `SidebarTrigger` (hamburger) → page title (`font-heading text-2xl font-bold text-ink`) + subtitle (`text-sm text-muted-foreground`) → spacer → notification bell (`Bell`, disabled, `aria-disabled="true"`, `title` from `common.comingSoon`, **no badge** per §1.4) → avatar + name + role + `ChevronDown` dropdown reusing the `DropdownMenu` pattern from `Navbar.tsx` L52–57 (Profile, Sign out) → `LanguageToggle` → `ThemeToggle`.
4. `AdminLayout`: `<SidebarProvider>` → `<AdminSidebar/>` + `<SidebarInset>` → `<AdminTopbar/>` → `<main className="mx-auto w-full max-w-7xl px-5 py-8 lg:px-8">` → `<Outlet/>`. Root element carries `dir` and `lang`.
5. `AttendanceLayout` for the check-in screen — the design's two-column split, mirroring `LoginPage` composition:
   ```tsx
   <div dir={dir} lang={language} className="min-h-screen bg-background">
     <main className="flex min-h-screen flex-col lg:flex-row">
       <BrandPanel lang={language} variant="light" className="lg:w-[26%]" />
       <section className="flex w-full flex-col bg-soft lg:w-[74%]">
         <AdminTopbar title={…} subtitle={…} />
         <div className="mx-auto w-full max-w-5xl px-5 py-6 lg:px-8"><Outlet /></div>
       </section>
     </main>
     <AuthFooter lang={language} />
   </div>
   ```
6. Extend `BrandPanel` with `variant?: "navy" | "light"` (default `"navy"`, so auth pages are untouched) and an optional `className`. `light` renders: white/`bg-soft` background, navy heading text, the mint `YOUTH SERVICE` eyebrow label, `FAITH. FRIENDS. PURPOSE.` with the last word in mint, supporting copy, the silhouette illustration, a navy wave block at the bottom (reuse `brush-mask`), and the verse `figure` on the navy area. All copy from the existing `common.brand.*` keys — no new strings.

**Acceptance** `npm run build`; visual check of both layouts in EN/AR, light/dark, at 1440 / 768 / 375 px.

---

## TASK-204 — Route registration

**Fixes:** DEF-2

**Files** `frontend/src/router.tsx`, `frontend/src/routes/README.md`

**Subtasks**
1. Convert the flat array to include nested guard + layout routes:
   ```tsx
   {
     element: <RequireRole roles={["ADMIN", "SERVANT"]} />,
     children: [
       { element: <AttendanceLayout />, children: [
           { path: "/attendance/check-in", element: <CheckInPage /> } ] },
       { element: <AdminLayout />, children: [
           { path: "/attendance/dashboard", element: <AttendanceDashboardPage /> },
           { path: "/attendance/history",   element: <AttendanceHistoryPage /> } ] },
     ],
   }
   ```
2. Add `{ path: "/attendance", element: <Navigate to="/attendance/check-in" replace /> }`.
3. Convert the three attendance pages to `React.lazy` + a `<Suspense fallback={<PageSkeleton/>}>` boundary. They pull in `html5-qrcode` and `recharts`; they must not enter the landing-page bundle.
4. Add a "Attendance" entry to `Navbar` visible only when `isAttendanceManager()`.
5. Update `src/routes/README.md` with the three real paths and their guards.

**Acceptance**
```bash
cd frontend && npm run build
# confirm separate chunks for the attendance pages in the vite output
```

---

## TASK-205 — Design-token and shared-component corrections

**Fixes:** DEF-11, DEF-12

**Files** `frontend/src/index.css`, `frontend/src/components/ui/table.tsx`, `frontend/src/providers/AppProviders.tsx`, `frontend/src/components/ui/sonner.tsx`

**Subtasks**
1. Declare `--ink: #253d63` in the brand `:root` block so `text-ink` is a real light-mode token instead of relying on inheritance.
2. Re-map the chart palette inside the brand blocks so charts are on-brand: `--chart-1: var(--brand-mint)`, `--chart-2: var(--brand-blue)`, `--chart-3: var(--brand-orange)`, `--chart-4: var(--brand-red)`, `--chart-5: var(--brand-navy)`; add dark-mode variants in the `.dark` brand block.
3. Add two semantic status tokens used by attendance UI: `--status-late: var(--brand-orange)`, `--status-absent: var(--brand-red)` plus `@theme inline` mappings `--color-status-late`, `--color-status-absent`.
4. `table.tsx`: `TableHead` `text-left` → `text-start`; `TableCell`/`TableCaption` alignment reviewed for logical properties.
5. Mount `<Toaster />` in `AppProviders`, inside `LanguageProvider`, with `position="top-center"` and `dir` derived from language. Toasts carry **secondary** feedback only (scanner recovery, export finished); primary check-in feedback stays the inline result card from the design.
6. Do not add gradients, shadow tokens, or new animations. Design-Guide §17 caps animation at fade/slide/hover, 200–500 ms.

**Acceptance** `npm run build`; verify `text-ink` renders navy in light mode with dev-tools showing a resolved value (not `invalid at computed-value time`).

---

## TASK-206 — `attendance` i18n namespace

**Files** `frontend/src/i18n/resources/ar.ts`, `frontend/src/i18n/resources/en.ts`

**Subtasks**
1. Add the full key tree from Part 1 §3.9 to **`ar.ts` first** (types derive from it), then mirror it in `en.ts`. Both files must stay structurally identical.
2. Use the verbatim copy tables in §7.6 of this document.
3. Add `common.comingSoon`, `common.forbidden.{title, body, cta}`, `common.errors.unknown`, `common.retry`, `common.loading`.
4. Repeated blocks are arrays of objects, consistent with `common.footer[]` and `landing.pillars.items[]`: `attendance.checkIn.tips.items` is `string[3]`.
5. Never concatenate translated fragments. Counts use i18next interpolation, e.g. `showing: "Showing {{from}}–{{to}} of {{total}}"` / `"عرض {{from}}–{{to}} من {{total}}"`.

**Acceptance**
```bash
cd frontend && npx tsc -b   # key-type check
node -e "const a=require('./src/i18n/resources/ar.ts');" # or a small script comparing key sets of ar/en
```

---

## TASK-207 — React Query data layer for attendance

**Files** `frontend/src/modules/attendance/api/queryKeys.ts` (new), `frontend/src/modules/attendance/hooks/*` (new — the directory is empty)

**Subtasks**
1. Create `queryKeys.ts` exactly as frozen in Part 1 §3.11.
2. Hooks, one file each: `useMeetingAttendance`, `useMeetingSchedule`, `useMeetingStatistics`, `useMonthlyStatistics`, `useAbsentUsers`, `useAttendanceHistory`, `useMyAttendance`, `useCheckIn`, `useExcuseAttendance`.
3. Query defaults: rely on the global `staleTime: 60_000, retry: 1`. Override `staleTime: 0` for `useMeetingAttendance` and `useMeetingStatistics` on the check-in screen — they must reflect a scan immediately.
4. `useCheckIn` is a mutation: on success `queryClient.invalidateQueries({ queryKey: attendanceKeys.all })`; on error surface `ApiError.status` so the caller can pick the right result state (409 duplicate vs 422 invalid vs 403 forbidden).
5. This is the first react-query usage in the codebase. Add a short "conventions" comment block at the top of `queryKeys.ts` so later modules copy the pattern rather than inventing one.
6. Extend the API client with the two new endpoints (`getMyAttendance`, `excuseAttendance`) and the new history parameters (`page`, `size`, `sort`, `order`).

**Acceptance** `npm run lint && npm run build`; React Query devtools not required.

---

## TASK-208 — Frontend test harness

**Files** `frontend/vitest.config.ts` (new), `frontend/src/test/setup.ts` (new), `frontend/package.json`

**Subtasks**
1. Install exact versions: `jsdom@25.0.1`, `@testing-library/react@16.1.0`, `@testing-library/user-event@14.5.2`, `@testing-library/jest-dom@6.6.3`, `@vitest/coverage-v8@2.1.8` (matching the installed `vitest@2.1.8`).
2. `vitest.config.ts`: `environment: "jsdom"`, `setupFiles: ["src/test/setup.ts"]`, `globals: true`, alias `@` → `src` (reuse the vite alias), `css: false`.
3. `setup.ts`: `@testing-library/jest-dom/vitest`, a `matchMedia` stub (needed by `useIsMobile`), and an i18next test init that loads the real `ar`/`en` resources so missing keys fail tests.
4. Add `"test:run": "vitest run"` and `"test:coverage": "vitest run --coverage"` scripts. `npm test -- --run` in `.github/workflows/frontend-ci.yml` then stops being a no-op; remove its `continue-on-error: true`.

**Acceptance**
```bash
cd frontend && npm run test:run
```

---

# 7. Stage C — Check-in Screen (design implementation)

The screenshots are the visual target: `docs/designs/ckeck-in-en.png` (LTR) and `docs/designs/check-in-ar.png` (RTL).

## 7.1 Component architecture (frozen names)

```text
src/modules/attendance/
├── pages/CheckInPage.tsx                 orchestrates state + data, no markup detail
├── components/
│   ├── ScannerCard.tsx                   medallion + heading + viewport + OR + manual + tips
│   ├── QRScanner.tsx                     html5-qrcode wrapper (rewritten)
│   ├── ScannerFrame.tsx                  mint corner brackets + scan line overlay
│   ├── FlashlightToggle.tsx              capability-gated torch pill
│   ├── ManualCodeEntry.tsx               collapsible row → validated input
│   ├── ScanTips.tsx                      mint tinted tips panel + phone illustration
│   ├── ScanResultCard.tsx                success / duplicate / invalid / forbidden states
│   ├── MeetingStatsCard.tsx              4 × StatTile + "View all"
│   ├── StatTile.tsx                      icon medallion + value + label
│   ├── RecentCheckInsCard.tsx            last 5 rows + "View all"
│   └── AttendanceStatusBadge.tsx          shared PRESENT/LATE/ABSENT/EXCUSED badge
└── hooks/                                 from TASK-207
```

## 7.2 Layout

```text
┌──────────────┬──────────────────────────────────────────────────────┐
│              │  ☰   Check-in Scanner              🔔   [avatar ▾]   │
│  BrandPanel  │      Scan a user QR code to check them in            │
│  variant=    ├──────────────────────────────────────────────────────┤
│  "light"     │  ┌────────────── ScannerCard ─────────────────────┐  │
│              │  │            ◯ QrCode (mint medallion)           │  │
│  YOUTH       │  │              Ready to scan                     │  │
│  SERVICE     │  │      Position the QR code within the frame     │  │
│              │  │   ┌─── camera viewport, mint brackets ─────┐   │  │
│  FAITH.      │  │   │            [ 🔦 Flashlight ○ ]         │   │  │
│  FRIENDS.    │  │   └────────────────────────────────────────┘   │  │
│  PURPOSE.    │  │   ───────────────── OR ─────────────────────    │  │
│              │  │   [⌨]  Enter code manually              →     │  │
│  illustration│  │   ┌─ mint tips panel ───────────┬─ phone ──┐   │  │
│  navy wave   │  │   │ ⓘ Tips for a successful scan│    📱✓   │   │  │
│  verse       │  │   └─────────────────────────────┴──────────┘   │  │
│              │  └───────────────────────────────────────────────┘  │
│              │  ┌── Current Meeting ─────┐ ┌── Recent Check-ins ─┐ │
│              │  │ 142  12   5   159      │ │ ● Mark   10:24 ✓    │ │
│              │  │ in  late abs total     │ │ ● Mariam 10:22 ✓    │ │
│              │  └────────────────────────┘ └─────────────────────┘ │
└──────────────┴──────────────────────────────────────────────────────┘
                     AuthFooter (navy, 4 benefits, copyright)
```

Breakpoints: `lg` ≥ 1024 px two columns as drawn · `md` 768–1023 px brand panel collapses to a slim navy header bar, scanner full width, the two bottom cards stay side by side · `< 768 px` single column, order: topbar → scanner → result → stats → recent → footer. Brand panel is hidden below `md` (`hidden md:flex`), because the camera viewport must own the viewport on a phone.

## 7.3 State machine

`CheckInPage` holds one discriminated union — no boolean soup:

```ts
type ScanState =
  | { kind: "idle" }
  | { kind: "requesting-permission" }
  | { kind: "permission-denied" }
  | { kind: "unsupported" }
  | { kind: "scanning" }
  | { kind: "processing"; code: string }
  | { kind: "success";  record: AttendanceRecord }
  | { kind: "duplicate"; message: string }
  | { kind: "invalid";   message: string }
  | { kind: "forbidden"; message: string }
  | { kind: "network";   message: string };
```

| State | Heading key | Sub-key | Visual |
| --- | --- | --- | --- |
| `idle` | `scanner.readyTitle` | `scanner.readySubtitle` | mint medallion, dark viewport placeholder, `btn-primary` Start |
| `requesting-permission` | `scanner.readyTitle` | `scanner.readySubtitle` | spinner in medallion |
| `permission-denied` | `scanner.permissionTitle` | `scanner.permissionBody` | `CameraOff` in `bg-brand-red/10`, retry `btn-outline`, manual entry auto-expanded |
| `unsupported` | `scanner.unsupportedTitle` | `scanner.unsupportedBody` | manual entry only |
| `scanning` | `scanner.scanningTitle` | `scanner.scanningSubtitle` | live video, mint brackets, animated scan line |
| `processing` | `scanner.processingTitle` | `scanner.processingSubtitle` | viewport dimmed, spinner, scanner paused |
| `success` | `result.successTitle` | — | `ScanResultCard` mint, `CheckCircle2`, name / meeting date / time / status badge |
| `duplicate` | `result.duplicateTitle` | — | `ScanResultCard` orange, `AlertCircle` |
| `invalid` | `result.invalidTitle` | — | `ScanResultCard` red, `XCircle` |
| `forbidden` | `result.forbiddenTitle` | — | red card, no retry (role problem) |
| `network` | `result.networkTitle` | — | red card + retry |

Rules: the scanner pauses during `processing` and resumes automatically after the result timeout — success 3 s, error 5 s, both cancelled on unmount and on a new scan. Duplicate scans of the same code within 2 s are ignored (`lastCodeRef` + timestamp) so one physical badge cannot fire five requests. Every result state also announces itself through `role="status"` / `role="alert"`.

## 7.4 Task list

### TASK-301 — Rewrite `QRScanner`
**Files** `components/QRScanner.tsx`, `components/ScannerFrame.tsx`, `components/FlashlightToggle.tsx`
1. Replace all hardcoded hex (`text-[#253D63]`, `bg-[#2672B0]`, `border-[#9E150B]`) and raw palette classes (`text-gray-600`, `bg-red-50`, `bg-blue-50`) with brand tokens.
2. Replace `mr-2 rtl:mr-0 rtl:ml-2` with the logical `me-2`; remove every `rtl:` variant from this module. Replace `flex-shrink-0` with `shrink-0`. Replace relative imports with `@/`.
3. Remove all hardcoded English strings; consume `useTranslation("attendance")`.
4. Replace `catch (err: any)` with a typed narrow (`err instanceof Error`), and classify the failure: `NotAllowedError` → `permission-denied`, `NotFoundError`/`OverconstrainedError` → `unsupported`, anything else → `network`.
5. Make the DOM id unique per instance (`useId()`), not the global `"qr-reader"`.
6. Cleanup: stop and clear the scanner in an effect cleanup that cannot race — guard with a `isStartingRef`; await `stop()` before `clear()`; swallow only the documented "scanner is not running" error.
7. `ScannerFrame`: absolutely-positioned overlay, four mint corner brackets (`border-mint`, 3 px, 28 px arms), and a scan line — a 2 px `bg-brand-red/80` bar with a 2 s `ease-in-out` `translateY` loop, disabled under `prefers-reduced-motion`.
8. `FlashlightToggle`: after `start()`, read `scanner.getRunningTrackCapabilities()`; render only when `torch` is present. Uses `applyVideoConstraints({ advanced: [{ torch }] })`. Pill styling per design: `rounded-full bg-navy/80 px-4 py-2 text-white` + `Flashlight` icon + shadcn `Switch`.

**Acceptance** `npm run test:run -- QRScanner` (state-classification unit tests) and a manual pass on Android Chrome + iOS Safari.

### TASK-302 — `ManualCodeEntry`
1. Collapsed row exactly as designed: `Keyboard` icon in a `bg-mint/15` rounded square, title `manual.title`, subtitle `manual.subtitle`, `ChevronRight` at the inline end (the icon must be `ChevronLeft` in RTL — mirror with a `rtl` check in the component, not CSS `transform`).
2. Expanded: `Input` (`h-12 rounded-xl ps-4 focus-ring`), `manual.label`, `manual.placeholder`, submit `btn-primary`, cancel `btn-outline`.
3. Validation with `react-hook-form` + a zod factory taking translated messages, mirroring `loginSchema.ts`: trim, `min(8)`, strip whitespace, reject an empty string. `mode: "onChange"`, submit disabled while `!isValid || isPending`.
4. Submits through `useCheckIn` with `method: "MANUAL"`. Field errors render as `text-sm font-medium text-brand-red` with `role="alert"` and `aria-invalid`.
5. Auto-expanded and focused when the state is `permission-denied` or `unsupported`.

### TASK-303 — `ScanTips`
1. Panel `rounded-xl border border-mint/30 bg-mint/10 p-4`, `Info` icon in mint, title `tips.title`, three bullets from `tips.items`.
2. Right side: the phone-with-check illustration. Compose it from Lucide (`Smartphone` + `QrCode` + a mint `CheckCircle2` badge) rather than adding an image asset.
3. Hidden below `sm` to keep the phone viewport free.

### TASK-304 — `ScanResultCard`
1. One component, `variant: "success" | "warning" | "error"`; tint via `bg-mint/10 border-mint/40`, `bg-brand-orange/10 border-brand-orange/30`, `bg-brand-red/5 border-brand-red/30`.
2. Success rows per design: member name (`font-heading text-xl text-ink`), meeting date, check-in time, `AttendanceStatusBadge`.
3. Dates and times must be locale-formatted: `new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-GB", …)`. The current code calls `toLocaleDateString()` with no locale — fix it. Arabic shows Arabic-Indic digits and `ص`/`م`, as in the design.
4. `scanNext` button returns to `scanning`.

### TASK-305 — `MeetingStatsCard` + `StatTile`
1. Card header: `stats.title` ("Current Meeting"), the resolved meeting date as a muted subtitle, and a `stats.viewAll` link to `/attendance/dashboard` in `text-brand-blue`.
2. Four tiles in a `grid grid-cols-2 gap-3 sm:grid-cols-4`, each `rounded-xl border border-border bg-card p-4 text-center`:

   | Tile | Icon | Icon colour | Value | Label key |
   | --- | --- | --- | --- | --- |
   | 1 | `Users` | `text-mint` | `total_present` | `stats.checkedIn` |
   | 2 | `Clock` | `text-brand-orange` | `total_late` | `stats.late` |
   | 3 | `UserRoundX` | `text-brand-red` | `total_absent` | `stats.absent` / `stats.pending` |
   | 4 | `CalendarDays` | `text-brand-blue` | `total_expected` | `stats.total` |

3. Value typography `font-heading text-3xl font-bold text-ink`, label `text-xs font-medium text-muted-foreground`. Numbers are locale-formatted with `Intl.NumberFormat` so Arabic renders Arabic-Indic digits, matching the design.
4. When `is_final === false`, tile 3 uses the `stats.pending` label and an `text-muted-foreground` icon, with a `title`/`aria-description` explaining the cutoff (BR-5).
5. Data from `useMeetingStatistics()`; skeletons via `Skeleton` while loading; on error show a compact retry row, never an empty zero state (zeros would be a lie).

### TASK-306 — `RecentCheckInsCard`
1. Header `recent.title` + `recent.viewAll` → `/attendance/history`.
2. Rows: `Avatar` (image or initials fallback on `bg-navy text-white`), name (`text-sm font-semibold text-ink`), secondary line `role • time` per §1.4 — **not** "Youth Group", `text-xs text-muted-foreground`, then a mint badge `recent.badge` with a `CheckCircle2`, or an orange `LATE` badge.
3. Source: `useMeetingAttendance()` → `attendance_records` sorted by `check_in_at` desc, `slice(0, 5)`.
4. Empty state: mint `QrCode` medallion + `recent.empty`.
5. New rows animate in with a 250 ms fade/slide (`reveal`-style, `prefers-reduced-motion` respected).

### TASK-307 — `AttendanceStatusBadge`
Shared by check-in, dashboard and history. `PRESENT` → `bg-mint/15 text-emerald-700 border-mint/40`; `LATE` → `bg-brand-orange/10 text-brand-orange border-brand-orange/30`; `ABSENT` → `bg-brand-red/5 text-brand-red border-brand-red/30`; `EXCUSED` → `bg-muted text-muted-foreground border-border`. Label from `attendance.status.*`. Never colour-only: every badge carries its text label and an icon (`CheckCircle2` / `Clock` / `XCircle` / `MinusCircle`).

### TASK-308 — `CheckInPage` orchestration
1. Owns `ScanState`, the debounce ref, and the result timers; renders `ScannerCard`, `ScanResultCard`, `MeetingStatsCard`, `RecentCheckInsCard`.
2. Maps `ApiError.status` → state: 409 `duplicate`, 422 `invalid`, 403 `forbidden`, 0/5xx `network`. Message text comes from `attendance.errors.*` keyed by the backend `code`, with the backend `message` as the fallback.
3. Clears every timer in an effect cleanup (the current implementation leaks two `setTimeout`s).
4. Keyboard: `Enter` restarts scanning from a result state; `M` focuses manual entry; both documented in `aria-keyshortcuts`.
5. No page-level `dir`/`lang` — that lives on `AttendanceLayout`.

### TASK-309 — Arabic / RTL pass
1. Verify in `dir="rtl"`: brand panel side, sidebar side, chevron direction, icon-to-text spacing (`me-*`/`ms-*` only), tips bullets, badge alignment, camera overlay symmetry, footer order.
2. Arabic typography: `font-arabic` plus the one-step size bump used elsewhere (`text-lg` where EN uses `text-base`); headings use `font-heading`; the verse keeps `font-verse`.
3. No hardcoded `left`/`right`, `ml-`/`mr-`, `pl-`/`pr-`, `text-left`/`text-right` in any new attendance file.
4. Numbers and times formatted through `Intl` with `ar-EG`.

**Acceptance for TASK-301…309**
```bash
cd frontend
grep -rn "\[#\|text-left\|text-right\|\bml-\|\bmr-\|\bpl-\|\bpr-\|rtl:" src/modules/attendance   # must print nothing
npm run lint && npm run build && npm run test:run
```

### TASK-310 — Copy tables into i18n
Enter the verbatim strings from §7.6 into `ar.ts` then `en.ts`. No string may remain inline in a component.

## 7.5 Accessibility requirements (all of Stage C)

- Semantic landmarks: `<main>`, `<aside>`, `<footer>`; one `<h1>` per page (the topbar title).
- The camera region is `role="region"` with `aria-label` from `scanner.scanningTitle`; state changes announce through a single `aria-live="polite"` region, errors through `role="alert"`.
- Every interactive element reachable by keyboard with a visible `focus-ring`; the flashlight `Switch` has an accessible label.
- Colour is never the only signal — status always carries icon + text.
- Contrast: mint on white is only used for large text, icons and fills; body text on white is `--ink`. Verify AA for the badge combinations.
- `prefers-reduced-motion` disables the scan line, the row fade-in and the `reveal` utility.

## 7.6 Verbatim copy (design-accurate)

`attendance.checkIn` — EN / AR:

| Key | English | العربية |
| --- | --- | --- |
| `title` | Check-in Scanner | ماسح تسجيل الحضور |
| `subtitle` | Scan a user QR code to check them in | امسح رمز QR لتسجيل حضور المستخدمين |
| `scanner.readyTitle` | Ready to scan | جاهز للمسح |
| `scanner.readySubtitle` | Position the QR code within the frame | ضع رمز QR داخل الإطار |
| `scanner.scanningTitle` | Scanning… | جارٍ المسح… |
| `scanner.scanningSubtitle` | Hold the code steady inside the frame | ثبّت الرمز داخل الإطار |
| `scanner.processingTitle` | Recording attendance… | جارٍ تسجيل الحضور… |
| `scanner.processingSubtitle` | This takes a moment | لن يستغرق هذا سوى لحظات |
| `scanner.start` | Start scanner | ابدأ المسح |
| `scanner.stop` | Stop scanner | إيقاف المسح |
| `scanner.retry` | Try again | حاول مرة أخرى |
| `scanner.flashlight` | Flashlight | الفلاش |
| `scanner.permissionTitle` | Camera access needed | نحتاج الوصول إلى الكاميرا |
| `scanner.permissionBody` | Allow camera access in your browser, or enter the code manually. | اسمح بالوصول إلى الكاميرا من المتصفح، أو أدخل الكود يدويًا. |
| `scanner.unsupportedTitle` | Camera not available | الكاميرا غير متاحة |
| `scanner.unsupportedBody` | This device has no usable camera. Use manual entry instead. | لا توجد كاميرا متاحة على هذا الجهاز. استخدم الإدخال اليدوي. |
| `manual.title` | Enter code manually | إدخال الكود يدويًا |
| `manual.subtitle` | Type the check-in code | اكتب كود تسجيل الحضور |
| `manual.label` | Check-in code | كود تسجيل الحضور |
| `manual.placeholder` | MA_QR:… | MA_QR:… |
| `manual.submit` | Record attendance | تسجيل الحضور |
| `manual.cancel` | Cancel | إلغاء |
| `tips.title` | Tips for a successful scan | نصائح لعملية مسح ناجحة |
| `tips.items[0]` | Ensure good lighting | تأكد من وجود إضاءة جيدة |
| `tips.items[1]` | Hold the device steady | ثبّت الجهاز بشكل مستقر |
| `tips.items[2]` | Avoid glare on the screen | تجنب انعكاس الضوء على الشاشة |
| `result.successTitle` | Attendance recorded | تم تسجيل الحضور |
| `result.duplicateTitle` | Already checked in for this meeting | تم تسجيل الحضور لهذا الاجتماع بالفعل |
| `result.invalidTitle` | Invalid QR code | رمز QR غير صالح |
| `result.forbiddenTitle` | You are not allowed to record attendance | لا تملك صلاحية تسجيل الحضور |
| `result.networkTitle` | Connection problem | مشكلة في الاتصال |
| `result.name` | Name | الاسم |
| `result.meeting` | Meeting | الاجتماع |
| `result.time` | Check-in time | وقت التسجيل |
| `result.status` | Status | الحالة |
| `result.scanNext` | Scan next | مسح التالي |
| `stats.title` | Current Meeting | الاجتماع الحالي |
| `stats.viewAll` | View all | عرض الكل |
| `stats.checkedIn` | Checked in | تم تسجيل الحضور |
| `stats.late` | Late | متأخر |
| `stats.absent` | Absent | غائب |
| `stats.pending` | Pending | قيد الانتظار |
| `stats.total` | Total | الإجمالي |
| `recent.title` | Recent Check-ins | آخر عمليات التسجيل |
| `recent.viewAll` | View all | عرض الكل |
| `recent.empty` | No check-ins yet for this meeting | لا يوجد تسجيل حضور لهذا الاجتماع بعد |
| `recent.badge` | Checked in | تم التسجيل |

`attendance.status` — `PRESENT` Present / حاضر · `LATE` Late / متأخر · `ABSENT` Absent / غائب · `EXCUSED` Excused / بعذر.
`attendance.method` — `QR_SCAN` QR scan / مسح رمز · `MANUAL` Manual / يدوي.
`attendance.errors` — `conflict` "Already checked in for this meeting" / "تم تسجيل الحضور لهذا الاجتماع بالفعل" · `validation` "The code is not valid" / "الكود غير صالح" · `forbidden` "You do not have permission" / "لا تملك الصلاحية" · `unauthorized` "Please sign in again" / "يرجى تسجيل الدخول مرة أخرى" · `network` "Check your connection and try again" / "تحقق من الاتصال وحاول مرة أخرى" · `unknown` "Something went wrong. Please try again." / "حدث خطأ غير متوقع. حاول مرة أخرى".

Note the Arabic design screenshot contains a typo (`اكتب كود لسجيل الحضور`). The corrected form `اكتب كود تسجيل الحضور` ships.

---

# 8. Stage D — Attendance Dashboard

Layout per `phase-2.md` §20: summary cards → current-meeting table → absent users → monthly trend.

### TASK-401 — Page shell and meeting selector
**Files** `pages/AttendanceDashboardPage.tsx`, `components/MeetingSelector.tsx`
1. `AdminLayout` route; topbar title `dashboard.title`, subtitle `dashboard.subtitle`.
2. `MeetingSelector`: previous / next meeting buttons (`ChevronLeft`/`ChevronRight`, mirrored in RTL) + a month `Select` fed by `useMeetingSchedule(year, month)`. Next is disabled beyond the open meeting. The selected `meeting_date` lives in the URL query (`?meeting_date=YYYY-MM-DD`) so a view is shareable and survives refresh.
3. Badge next to the date: `meeting.open` / `meeting.closed` / `meeting.notHeld`.

### TASK-402 — Summary cards
Five cards from `useMeetingStatistics`: Present, Late, Absent (or Pending), Expected, Rate. Reuse `StatTile` with a `size="lg"` variant. The rate card shows the percentage plus a thin `Progress` bar in mint (`bg-mint`), and renders `—` when `total_expected === 0`.

### TASK-403 — Current-meeting table
`Table` from shadcn, columns Name / Check-in time / Status / Method, sorted by `check_in_at`. `AttendanceStatusBadge` in the status column. Sticky header, horizontal scroll below `sm`. Loading = 5 skeleton rows; empty = mint medallion + `table.empty`. ADMIN-only row action "Excuse" (`useExcuseAttendance`) shown only when the meeting is open, with a confirm `AlertDialog` and an optional reason field.

### TASK-404 — Absent users section
From `useAbsentUsers`. Rows: avatar initials, name, e-mail, role badge. When `is_final === false` render an `Info` note using `absent.provisional` explaining the cutoff. Empty state (`absent.empty`) is a positive mint state — full attendance is good news.

### TASK-405 — Monthly trend chart
1. First chart in the codebase. Use `ChartContainer` + recharts `BarChart` with `MeetingStat[]` from `useMonthlyStatistics`.
2. X axis: `M1…M5` (`trend.meetingLabel` with the meeting index) and the meeting date in the tooltip. Y axis: attendance rate 0–100.
3. Series colours from the brand chart tokens re-mapped in TASK-205: attended = `--chart-1` (mint), late portion = `--chart-3` (orange) as a stacked segment.
4. `is_held === false` meetings render as a hollow `bg-muted` bar with the `trend.notHeld` tooltip — never as 0 %.
5. Below the chart: month totals (`total_attendance`, `average_attendance`, `attendance_rate`, `distinct_attendees`, `full_attendance_count`, `no_attendance_count`) as a definition list.
6. `ResponsiveContainer` height 260 px; on RTL set `reversed` on the X axis so the month reads right-to-left.

### TASK-406 — Loading / empty / error states
Every section owns its own state; one failing query must not blank the page. Errors render a compact inline `Alert` with a retry button wired to `refetch()`.

### TASK-407 — Dashboard i18n and RTL pass
Same rules as TASK-309, including chart axis direction and the `Progress` fill direction.

---

# 9. Stage E — Attendance History

### TASK-501 — Page and filter bar
`pages/AttendanceHistoryPage.tsx`, `components/HistoryFilters.tsx`. Filters: meeting range (two meeting pickers, snapped to Thursdays), member (a `Command`-based combobox over `GET /users`, ADMIN only), status (`Select` over the four statuses + "All"). Filter state lives in the URL query string; `filters.reset` clears it.

### TASK-502 — Paginated table
Columns Meeting date / Name / Check-in time / Status / Recorded by. `useAttendanceHistory` with `page`/`size`/`sort`/`order`. shadcn `Pagination` plus `pagination.showing` interpolated with `{{from}} {{to}} {{total}}`. Sort toggles on the two date columns. Page size `Select` (20 / 50 / 100).

### TASK-503 — CSV export
Client-side export of the **current filter set** (not just the current page — refetch with `size` capped at the backend max and iterate pages). Emit UTF-8 with a BOM so Arabic opens correctly in Excel; headers localised; filename from `export.filename` (e.g. `attendance-2026-08.csv`). Show a `sonner` toast on completion. No new dependency — hand-roll the CSV with proper quote escaping.

### TASK-504 — Empty and error states
Distinguish "no records for these filters" (offer `filters.reset`) from "no records at all".

### TASK-505 — History i18n and RTL pass
As TASK-309.

---

# 10. Stage F — Member Self-Service

### TASK-601 — "My attendance" card in the profile page
Add a section to `src/pages/profile/ProfilePage.tsx`, matching the existing section shell (`rounded-2xl border border-border bg-card p-6 shadow-…`). Shows the current month: meetings held, attended count, rate, and a compact list of the member's records with `AttendanceStatusBadge`. Data from `useMyAttendance`. Placed directly under the existing QR card, because the two belong together conceptually.

### TASK-602 — Wire and verify
Confirm `GET /attendance/me` is reachable by MEMBER and that no admin-only field leaks into the response.

---

# 11. Stage G — Tests, Documentation, Hardening

### TASK-701 — Backend unit tests
**Files** `tests/unit/attendance/test_late_status.py`, `test_statistics_math.py`, `test_absence_rules.py`, `test_clock.py` (new)
1. Late derivation: on-time, exactly at the grace boundary, one minute past, scan on a later weekday of the same meeting week → `LATE`.
2. `_rate`: zero expected, partial, full, over-100 impossible.
3. Absence: user registered after the meeting week is excluded; `EXCUSED` is neither absent nor attended; `is_absence_final` before/after cutoff and for a past meeting.
4. Clock: `today_local` across the Wednesday 23:30 / Thursday 00:30 boundary in `Africa/Cairo`; `to_local` on an aware UTC value.
5. Use the injected clock seam from TASK-101 — no monkeypatching of `datetime`.

### TASK-702 — Backend integration and security tests at the HTTP boundary
**Files** `tests/integration/api/attendance/` (new package with `__init__.py`)
1. All nine routes: happy path status codes and response envelopes.
2. Security matrix — for each route × role:

   | Route | anonymous | MEMBER | SERVANT | ADMIN |
   | --- | --- | --- | --- | --- |
   | `POST /check-in` | 401 | 403 | 201 | 201 |
   | `GET /meeting`, `/meetings`, `/absent`, `/statistics/*`, `GET /attendance` | 401 | 403 | 200 | 200 |
   | `GET /attendance/me` | 401 | 200 | 200 | 200 |
   | `POST /{id}/excuse` | 401 | 403 | 403 | 200 |

3. Error cases: duplicate → 409 `conflict`; unknown QR → 422 `validation_error`; suspended user → 422; future/past/non-Thursday `meeting_date` → 422; malformed UUID → 422.
4. Concurrency: two simultaneous check-ins for the same user via `asyncio.gather` on two independent sessions → exactly one 201 and one 409, and exactly one row in the table.
5. Pagination: totals and `has_next` across three pages; `size` above the max → 422.
6. Manipulated payload: a QR string whose hash does not exist; a payload containing a valid user's UUID (must be rejected — the id is never trusted).
7. Add `ATTENDANCE_*` URL constants to `tests/utils.py` (currently there are none).

### TASK-703 — Reconcile `phase-2.md` with the shipped model
**Fixes:** DEF-14. Edit `docs/Agile/phase-2/phase-2.md` only where it contradicts the domain:
1. §2 "One Check-in Per Day" → "One Check-in Per Meeting"; `attendanceDate` → `meeting_date`; add the `LATE` status and the cutoff rule.
2. US-007 title and AC: "Today's Attendance" → "Current Meeting Attendance"; remove `GET /attendance/today` (TASK-008) and point at `GET /attendance/meeting`.
3. TASK-002 / TASK-006 uniqueness → `UNIQUE(user_id, meeting_date)`.
4. TASK-017 "Weekly aggregation" → "Monthly meeting aggregation".
5. Field names to snake_case in every JSON block; endpoint paths prefixed `/api/v1`.
6. AC-005 "attendance-management permission" → "ADMIN or SERVANT role" (there is no permission table).
7. Add the two new stories US-010/US-011/US-012 and the revised 30-point total.

### TASK-704 — Update the other docs
1. `docs/database/DATABASE_DESIGN.md`: `weekly_attendance_records` gains `method` and the two CHECK constraints; add the new index; correct the "18 tables" count to 19; add `attendance.excused` to the domain-events table.
2. `docs/database/IMPLEMENTATION_REPORT.md`: refresh the assumptions on timezone (now configured, no longer server-local) and on the expected population (BR-4).
3. `docs/PHASE_2_IMPLEMENTATION_SUMMARY.md`: mark tasks 20–24 done, list the new endpoints, remove the "tests require a database that is unavailable" note once TASK-702 is green.
4. `README.md`: complete the truncated file (it ends mid-command) and add the attendance routes.

### TASK-705 — API documentation
Ensure every route carries a summary, description, documented `responses` for 401/403/409/422, and a realistic example. `AbsentUsersResponse` must serialise a typed model, not `dict[str, str]`. Export the OpenAPI JSON to `docs/api/openapi-phase-2.json` as the sprint artefact.

### TASK-706 — Frontend tests
1. `QRScanner`: error classification, cleanup on unmount, torch gating.
2. `ManualCodeEntry`: validation messages in EN and AR, submit disabled states.
3. `CheckInPage`: status-to-state mapping for 201/409/422/403 with a mocked `useCheckIn`; timer cleanup; the 2 s duplicate-scan debounce.
4. `StatTile` / `AttendanceStatusBadge`: label and colour per status, Arabic numeral formatting.
5. Guards: `RequireRole` renders `ForbiddenPage` for MEMBER and `Navigate` for anonymous.
6. `lib/api` interceptor: attaches the header when a token exists, omits it on auth routes, maps errors to `ApiError`.
7. i18n parity test: the key sets of `ar.ts` and `en.ts` are identical (recursive comparison) — this test must fail if a translator forgets a key.

### TASK-707 — Performance and hardening
1. `EXPLAIN` the meeting roster, history and monthly aggregate queries; confirm index usage; no N+1 (`selectinload` on user and recorder everywhere).
2. Seed 2 000 users × 8 meetings in the scratch DB; assert the dashboard endpoints respond under 400 ms and the history page under 200 ms.
3. Rate-limit consideration: note that `POST /check-in` is a scan endpoint hit rapidly; confirm the debounce is client-side only and record the decision that server-side rate limiting is deferred (no Redis in V1 per `Sprint-Guide.md`).
4. Verify the bundle: attendance chunks are lazy and the landing bundle does not include `html5-qrcode` or `recharts`.
5. Run the full gate set (below) with zero failures and re-enable `mypy` as a blocking CI step (`continue-on-error: false`) once it is clean.

### TASK-708 — Release checklist
1. `.env.example` documents all six new settings.
2. Confirm the deployment timezone value with the Product Owner before release (D-1).
3. Migration rehearsal on a copy of production data: `upgrade head` → smoke test → `downgrade -1` → `upgrade head`.
4. Verify CORS and cookie settings still allow the check-in screen from the deployed frontend origin.

---

# 12. Test Matrix

| Requirement | Level | Where |
| --- | --- | --- |
| Meeting date resolution, month boundaries | unit | `tests/unit/attendance/test_meeting_schedule.py` (exists) |
| Entity/status behaviour incl. `LATE` | unit | `test_domain.py`, `test_late_status.py` |
| Rate math, zero expected | unit | `test_statistics_math.py` |
| Absence rules, cutoff, late joiners | unit + integration | `test_absence_rules.py`, `test_queries.py` |
| Timezone boundary | unit | `test_clock.py` |
| Check-in happy path, duplicate, invalid QR, inactive user, role | integration | `tests/integration/attendance/test_check_in.py` (exists) |
| HTTP status codes, error envelope, role matrix | integration (API) | `tests/integration/api/attendance/` (new) |
| Concurrent scans → one record | integration (API) | `test_concurrency.py` |
| Pagination, SQL filters, sorting | integration | `test_queries.py` |
| Outbox event + audit row written | integration | `test_check_in.py`, `test_outbox.py` |
| Scanner states, manual entry, guards, i18n parity | frontend unit | `src/**/*.test.tsx` |
| Design fidelity EN/AR, light/dark, 1440/768/375 | manual QA | §14 checklist |
| Demo flow end to end | manual QA | §15 |

Playwright end-to-end coverage is deliberately deferred to Phase 3; the harness does not exist yet and standing it up would consume the hardening day.

---

# 13. Execution Timeline (10 working days)

| Day | Backend | Frontend |
| --- | --- | --- |
| 1 | TASK-101 timezone/clock, TASK-102 `LATE` + migration | TASK-201 auth transport, TASK-202 guards |
| 2 | TASK-103 expected population, TASK-104 role guards | TASK-203 layouts, TASK-205 tokens |
| 3 | TASK-105 UoW/outbox/audit, TASK-106 pagination | TASK-204 routes, TASK-206 i18n, TASK-207 data layer, TASK-208 harness |
| 4 | TASK-107 excuse + protocols, TASK-108 `/attendance/me` | TASK-301 scanner rewrite, TASK-302 manual entry |
| 5 | TASK-701 unit tests | TASK-303–305 tips, result, stats |
| 6 | TASK-702 API + security + concurrency tests | TASK-306–310 recent, badge, orchestration, RTL, copy |
| 7 | support / fixes | TASK-401–403 dashboard shell, cards, table |
| 8 | TASK-705 API docs | TASK-404–407 absent, chart, states, RTL |
| 9 | TASK-707 performance | TASK-501–505 history, TASK-601–602 member view |
| 10 | TASK-703/704 docs, TASK-708 release checklist | TASK-706 frontend tests, QA, bug fixing, review, demo, retro |

---

# 14. Definition of Ready / Done

## Definition of Ready (per story)

- [ ] Business rule resolved in §1 with no open contradiction
- [ ] Acceptance criteria testable at the API or UI boundary
- [ ] Contract present in Part 1 §3 (endpoint, DTO, i18n keys, tokens)
- [ ] Identity/QR dependency confirmed available
- [ ] Design reference identified (screenshot region or Design-Guide section)
- [ ] Estimated, and dependencies on other stages identified

## Definition of Done (sprint)

**Domain and data**
- [ ] Platform timezone configured; no `date.today()`/`datetime.now()` outside `app/core/time`
- [ ] `LATE` status implemented end to end; `PRESENT`+`LATE` count as attended
- [ ] `method` column, both CHECK constraints, and the composite index migrated; `alembic check` clean; downgrade rehearsed
- [ ] Expected population excludes late joiners; absence finality exposed as `is_final`

**API**
- [ ] Nine routes documented in `/docs` with 401/403/409/422 examples
- [ ] Every read route restricted to ADMIN/SERVANT; `/attendance/me` open to the owner only
- [ ] History paginated, filtered and sorted in SQL
- [ ] Check-in writes record + outbox event + audit row in one transaction
- [ ] Concurrent duplicate scans produce exactly one record

**Frontend**
- [ ] Attendance requests carry the bearer token; one error-mapping implementation
- [ ] `/attendance/check-in`, `/attendance/dashboard`, `/attendance/history` reachable, guarded, lazily loaded
- [ ] Check-in screen matches both screenshots in EN and AR
- [ ] All 11 scanner/result states implemented, including camera-denied and unsupported
- [ ] Manual code entry validated and functional
- [ ] Dashboard: summary cards, meeting table, absent list, monthly trend chart
- [ ] History: filters, pagination, CSV export with Arabic-safe encoding
- [ ] Zero hardcoded hex, zero physical-direction classes, zero inline strings in attendance files
- [ ] Dark mode and RTL verified at 1440 / 768 / 375 px
- [ ] Loading, empty and error states for every data section

**Quality**
- [ ] `ruff check .` and `ruff format --check .` clean
- [ ] `mypy app` clean and blocking in CI
- [ ] `pytest` green including the new API, security and concurrency tests
- [ ] `npm run lint`, `npm run build`, `npm run test:run` green
- [ ] i18n parity test green
- [ ] Accessibility pass: keyboard, focus, contrast, `aria-live`, reduced motion
- [ ] Docs updated: `phase-2.md`, `DATABASE_DESIGN.md`, `IMPLEMENTATION_REPORT.md`, `PHASE_2_IMPLEMENTATION_SUMMARY.md`, `README.md`, OpenAPI artefact
- [ ] No critical or high-priority defect open

---

# 15. Sprint Review — Demo Scenario

```text
1.  Sign in as SERVANT                     → redirected home, "Attendance" appears in the nav
2.  Open /attendance/check-in              → design screen renders, Arabic by default
3.  Toggle language to English             → full LTR mirror, no layout break
4.  Start scanner, grant camera            → live viewport, mint brackets, scan line
5.  Scan member A's QR                     → 201, mint result card: name, meeting date, 07:12 PM, Present
6.  Stats card updates                     → Checked in 1, Late 0, Pending 4, Total 5
7.  Recent check-ins                       → member A appears with a mint "Checked in" badge
8.  Scan member A again                     → 409, orange card "Already checked in for this meeting"
9.  Scan an unknown code                    → 422, red card "Invalid QR code"
10. Enter member B's code manually          → 201, method MANUAL
11. Set the clock past start+grace, scan C  → status LATE, orange badge, Late counter = 1
12. Open /attendance/dashboard              → 5 summary cards, meeting table, absent list (provisional note before 21:00)
13. Monthly trend                           → 4 bars; the future meeting is hollow, not 0 %
14. Excuse member D as ADMIN                → status EXCUSED, removed from the absent list, audit row written
15. Open /attendance/history                → filter by member and status, page 2, export CSV, open in Excel with Arabic intact
16. Sign in as MEMBER                       → /attendance/dashboard shows the 403 page; /profile shows "My attendance"
```

**Expected result:** the complete business flow of `phase-2.md` §30 works — Admin → Scan QR → Validate User → Validate Attendance → Record Check-in → Dashboard → Statistics → Absence — with late tracking, a configured timezone, enforced authorization, and a bilingual UI matching the design.

---

# 16. Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Torch/`html5-qrcode` support varies by device | Flashlight toggle unusable on some phones | Capability-gated rendering (TASK-301); manual entry always available |
| QR tokens are bearer secrets with no expiry, and `GET /users/me/qr` rotates on every view | A photographed code works indefinitely; viewing your QR twice invalidates a printed one | Documented as a Phase 3 item (rolling/short-lived codes). Do not change the QR contract inside this sprint |
| Timezone change on an existing deployment shifts `check_in_at` interpretation for old rows | Historic timestamps read differently | Existing values are already ambiguous; record the deployment timezone in `IMPLEMENTATION_REPORT.md` and do not back-fill |
| Two attendance models coexist (`attendance_records` vs `weekly_attendance_records`) | Confusion, drift, duplicated analytics | D-8 freezes the legacy tables; add legacy docstrings (TASK-107) and decide in Phase 3 |
| Camera use on a shared admin device | Privacy/consent | Scanner is admin-only, never records video, and the stream stops on unmount |
| The design implies groups ("Youth Group") | Scope creep into Phase 3 | §1.4 substitutes the role label; do not add a group entity |
| `mypy` is currently `continue-on-error` in CI | Type drift lands silently | Make it blocking in TASK-707 |

---

# 17. Out of Scope (do not build in Sprint 2)

- Service/class/group assignment, enrollment, attendance-by-class (Phase 3)
- Configurable meeting weekday (the Thursday constant stays)
- Bulk check-in, offline queueing, PWA install
- Notifications, e-mail or Telegram on check-in (the outbox event is emitted; no consumer)
- Editing or deleting attendance records (only `EXCUSED`, BR-6)
- Rolling/expiring QR codes, proof-of-presence
- Payroll, servant management, advanced analytics
- Playwright end-to-end suite
- Dropping or migrating the legacy `service_sessions` / `attendance_records` tables
- Landing-page copy alignment (Friday vs Thursday)
- Git operations
