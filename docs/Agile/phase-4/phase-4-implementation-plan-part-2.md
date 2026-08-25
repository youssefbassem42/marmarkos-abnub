# Phase 4 Implementation Plan — Part 2 of 2

**Read `docs/Agile/phase-4/phase-4-implementation-plan.md` first.** Sections 0–3 there are binding:
§0 rules of engagement, §1 the specification (D-1…D-27, BR-1…BR-17, DR-1…DR-10), §2 the
do-not-redo inventory and the defect list (DEF-0…DEF-16), §3 the frozen contracts.

Task IDs use the `P4-nnn` series so they never collide with the `TASK-nnn` series that Phase 1 and
Phase 2 both reused.

---

# 4. Sprint Scope

| ID | Type | Title | Priority | Points |
| --- | --- | --- | --- | ---: |
| US-013 | Story | Member views a paginated, filterable notification feed | Must Have | 5 |
| US-014 | Story | Notification bell with live unread badge | Must Have | 3 |
| US-015 | Story | Mark one / mark all notifications as read | Must Have | 3 |
| US-016 | Story | Admin pushes a bilingual broadcast announcement | Must Have | 5 |
| US-017 | Story | Broadcast optionally goes out by email | Should Have | 3 |
| US-018 | Story | New blog post produces a notification + email (consumer only) | Should Have | 2 |
| US-019 | Story | Anyone submits an anonymous message | Must Have | 5 |
| US-020 | Story | Anonymous messages reach Telegram, with admin retry | Must Have | 5 |
| US-021 | Story | Admin reviews anonymous messages | Must Have | 3 |
| US-022 | Tech | `/admin/*` route tree and design-accurate sidebar | Must Have | 3 |
| US-023 | Tech | RTL/LTR correctness and branding compliance | Must Have | 5 |
| US-024 | Tech | Repair the red test baseline | Must Have | 2 |

**Total: 44 story points.**

> Phase 2 delivered 30 points in ten working days. If that is the team's velocity, cut at the end of
> Stage F and move Stages G–H (US-019, US-020, US-021 — the anonymous bot, 13 points) into Sprint 4b.
> Stages 0/A/B are still required in Sprint 4a because Stage B's migration is part of the same
> Alembic revision. Confirm the split with the product owner before starting; do not decide it
> mid-sprint.

## 4.1 Delivery stages

| Stage | Goal | Tasks | Blocks | Est. days |
| --- | --- | --- | --- | --- |
| **0** | Repair the test baseline so Phase 4 tests run against green | P4-001 → P4-003 | everything | 0.5 |
| **A** | Notifications backend: schema, per-user read state, service, endpoints, email | P4-101 → P4-110 | D, E, F | 2.5 |
| **B** | Anonymous messages backend: columns, Telegram, rate limit, endpoints | P4-201 → P4-208 | G, H | 2 |
| **C** | Frontend foundation: tokens, RTL, branding, `/admin` tree, sidebar, i18n, data layer | P4-301 → P4-311 | D, E, F, G, H | 2 |
| **D** | Notification bell + unread badge in both topbars | P4-401 → P4-403 | demo | 0.5 |
| **E** | Member notifications page (`/notifications`) | P4-501 → P4-507 | demo | 1.5 |
| **F** | Admin notifications page + push composer | P4-601 → P4-605 | demo | 1 |
| **G** | Public anonymous message page | P4-701 → P4-707 | demo | 1.5 |
| **H** | Admin anonymous messages section | P4-801 → P4-804 | demo | 1 |
| **I** | Tests, documentation, hardening, release | P4-901 → P4-908 | sprint close | 1.5 |

Stage A must be complete before Stage E starts: the feed page is written against real endpoints, not
mocks. Stage C must be complete before D–H, because every new page renders inside the layouts and
tokens it fixes.

---

# 5. Stage 0 — Baseline Repair

## P4-001 — Make the auth test fixtures produce verified users

**Story:** US-024 · **Fixes:** DEF-0

**Files**
- `backend/tests/utils.py`
- `backend/tests/conftest.py`

**Subtasks**
1. Run the suite first and capture the actual failure list. Do not fix anything before you have the
   baseline output — record it in the PR description.
2. In `tests/utils.py`, make `register_user()` leave the account verified: after registration, load
   the row and set `email_verified = True`, or complete the real token flow via
   `POST /api/v1/auth/verify-email`. Prefer the real flow where a test asserts verification
   behaviour; use the direct flag elsewhere so tests stay fast.
3. Make `create_user_direct(...)` accept `email_verified: bool = True`.
4. Do **not** weaken `AuthenticationService.login`. The production rule (unverified accounts cannot
   sign in) is correct and stays.

**Acceptance**
```bash
cd backend
DEBUG=true APP_ENV=test .venv/bin/python -m pytest tests/unit/api/v1 -q
```

## P4-002 — Stub the email sender in tests

**Story:** US-024 · **Fixes:** DEF-0

**Files**
- `backend/tests/conftest.py`

**Subtasks**
1. Add an autouse fixture that forces `MAIL_PROVIDER=console` for the test session so
   `get_email_sender()` resolves to `LoggingEmailSender` and no socket is ever opened.
2. Add an opt-in `captured_emails` fixture that monkeypatches `EmailService.send` to append
   `(to_email, content)` to a list and return `True`. Stages A and F assert against it.
3. Confirm no test reaches `smtp.gmail.com`: the run must not slow down when the network is
   unavailable.

**Acceptance**
```bash
cd backend
DEBUG=true APP_ENV=test .venv/bin/python -m pytest tests -q
grep -rn "smtp.gmail.com" tests   # must print nothing
```

## P4-003 — Green baseline gate

**Story:** US-024

**Subtasks**
1. Run the whole backend suite plus `ruff` and `mypy`; fix anything still red that P4-001/P4-002
   uncovered. If a failure is a genuine production bug outside Phase 4's scope, record it as a new
   `DEF-` entry in Part 1 §2.3 and escalate rather than silently patching the test.
2. Run the frontend suite and `tsc -b`.
3. Record the green baseline in the PR description. No Stage A work starts before this.

**Acceptance**
```bash
cd backend && DEBUG=true APP_ENV=test .venv/bin/python -m pytest -q \
  && ruff check . && ruff format --check . && DEBUG=true .venv/bin/python -m mypy app
cd ../frontend && npx tsc -b && npm run lint && npm run test:run
```

---

# 6. Stage A — Notifications Backend

## P4-101 — Migration: bilingual columns, read state, anonymous columns

**Story:** US-013, US-019 · **Rule:** BR-5, BR-2, BR-11 · **Decisions:** D-1, D-2, D-6

**Files**
- `backend/alembic/versions/e3b7d1c95f42_phase_4_notifications_and_anonymous.py` (new)
- `backend/app/modules/notifications/infrastructure/persistence/models.py`
- `backend/app/modules/anonymous_messages/infrastructure/persistence/models.py`

**Subtasks**
1. One revision, id `e3b7d1c95f42`, `down_revision = "f8a2c4e61b90"`. Implement exactly the target
   schema in Part 1 §3.2 — both modules in one revision, so Stage A and Stage B never fight over the
   head.
2. `notifications.title_en` / `message_en`: add nullable → `UPDATE notifications SET title_en = title,
   message_en = message` → `ALTER … SET NOT NULL`. Never add a `NOT NULL` column without a default to
   a table that may have rows.
3. Create `notification_reads` with the composite PK, both FKs `ON DELETE CASCADE`, `read_at NOT NULL
   server_default now()`, and `ix_notification_reads_user`.
4. Add `ix_notifications_created_at`.
5. `anonymous_messages`: add `sender_name VARCHAR(120) NULL`, `sender_phone VARCHAR(32) NULL`,
   `attempts INTEGER NOT NULL server_default '0'`, `last_attempt_at TIMESTAMPTZ NULL`.
6. Mirror all of it in the ORM models. Add the `NotificationRead` model to
   `notifications/infrastructure/persistence/models.py` and register nothing new in
   `shared/infrastructure/persistence/registry.py` (the module is already imported).
7. Update the `Notification` docstring: `title`/`message` are Arabic, `title_en`/`message_en` are
   English, and `read_at` is legacy and must not be used (D-2).
8. Update the `AnonymousMessage` docstring: anonymity is **no account linkage**; `sender_name` and
   `sender_phone` are self-declared and optional (D-1).
9. `downgrade()` drops `notification_reads`, the new index and the six columns. It drops no table.

**Acceptance**
```bash
cd backend
DATABASE_URL=postgresql+asyncpg://marmarkos:marmarkos@localhost:55432/marmarkos_test \
  DEBUG=true .venv/bin/alembic upgrade head
DATABASE_URL=postgresql+asyncpg://marmarkos:marmarkos@localhost:55432/marmarkos_test \
  DEBUG=true .venv/bin/alembic downgrade -1
DATABASE_URL=postgresql+asyncpg://marmarkos:marmarkos@localhost:55432/marmarkos_test \
  DEBUG=true .venv/bin/alembic upgrade head
DEBUG=true APP_ENV=test .venv/bin/python -m pytest tests/integration/database -q
```

## P4-102 — `NotificationReadRepository`

**Story:** US-015 · **Rule:** BR-2, BR-3

**Files**
- `backend/app/modules/notifications/infrastructure/persistence/notification_read_repository.py` (new)
- `backend/app/modules/notifications/domain/interfaces.py`
- `backend/app/shared/infrastructure/persistence/unit_of_work.py`

**Subtasks**
1. Methods: `mark_read(notification_id, user_id) -> int` (Postgres `INSERT … ON CONFLICT DO NOTHING`,
   returns rowcount so BR-3 idempotency is observable), `mark_all_read(user_id) -> int` (insert from a
   `SELECT` over the user's unread feed), `read_ids_for(user_id, notification_ids) -> set[UUID]`.
2. Every timestamp comes from `app.core.time.now_utc()` (DEF-2). Never `datetime.now()`.
3. Add the matching Protocol to `domain/interfaces.py` next to the existing notification protocol.
4. Expose `uow.notification_reads` as a property in `UnitOfWork`, placed next to `uow.notifications`.

**Acceptance**
```bash
cd backend
DEBUG=true APP_ENV=test .venv/bin/python -m pytest tests/integration/database/test_notifications.py -q
DEBUG=true .venv/bin/python -m mypy app/modules/notifications
```

## P4-103 — Rewrite `NotificationRepository` for per-user read state

**Story:** US-013, US-015 · **Fixes:** DEF-1, DEF-2 · **Rule:** BR-1, BR-2, BR-4

**Files**
- `backend/app/modules/notifications/infrastructure/persistence/notification_repository.py`
- `backend/app/modules/notifications/domain/enums/notification_tab.py` (new)
- `backend/app/modules/notifications/domain/interfaces.py`

**Subtasks**
1. Add `NotificationTab` with the five values in Part 1 §3.4.
2. Replace `list_for_user` with
   `list_for_user(user_id, *, params: PageParams, tab: NotificationTab, since: datetime | None) -> tuple[list[Notification], set[UUID], int]`
   returning the page, the set of read ids for those rows, and the total count for the filter set.
   Use one `LEFT OUTER JOIN notification_reads` for the unread filter — never N+1 per row.
3. Replace `count_unread` with a `notification_reads`-aware count, and add
   `tab_counts(user_id) -> dict[NotificationTab, int]` computed in a single grouped query.
4. **Delete `mark_read` from this repository.** Read state now belongs to
   `NotificationReadRepository` (P4-102). Grep for callers first; there are none in `app/`.
5. Add `create(..., title_en=…, message_en=…)` parameters; all four copy fields are required (BR-5).
6. Ordering is always `created_at DESC, id DESC` so pagination is stable when timestamps tie.

**Acceptance**
```bash
cd backend
grep -n "datetime.now()" app/modules/notifications   # must print nothing
DEBUG=true APP_ENV=test .venv/bin/python -m pytest tests/integration/database/test_notifications.py -q
DEBUG=true .venv/bin/python -m mypy app/modules/notifications
```

## P4-104 — Notification copy catalogue

**Story:** US-018, US-013 · **Rule:** BR-5, BR-9, BR-10

**Files**
- `backend/app/modules/notifications/application/copy.py` (new)

**Subtasks**
1. Add the frozen `NotificationCopy` dataclass from Part 1 §3.3.
2. Add `attendance_recorded_copy(meeting_date, status)` and `blog_post_published_copy(title_ar,
   title_en)`. Both return all four strings; Arabic first, matching the tone of the existing email
   copy in `email/messages.py`. Dates are formatted in the platform timezone via `app.core.time`.
3. Copy for these builders is code, not i18n — it is stored per notification at creation time (D-6).
   Keep the exact strings from §14.3 so the UI and the emails agree.

**Acceptance**
```bash
cd backend
DEBUG=true APP_ENV=test .venv/bin/python -m pytest tests/unit/notifications -q
```

## P4-105 — `NotificationService`

**Story:** US-013, US-016, US-017, US-018 · **Rule:** BR-5…BR-10

**Files**
- `backend/app/modules/notifications/application/services/notification_service.py` (new)
- `backend/app/modules/notifications/infrastructure/email/messages.py`

**Subtasks**
1. Implement the frozen signature in Part 1 §3.3.
2. `push_announcement`: assert `actor.role.name is RoleName.ADMIN` as defence in depth (the router
   already guards it), create the broadcast row, `uow.audit.record(action="notification.push",
   entity_type="notification", entity_id=str(id), actor_user_id=actor.id, metadata={"send_email":…})`,
   `await uow.commit()`, and **only then** fan out email if requested (BR-8).
3. `email_fan_out`: select `ACTIVE` + `email_verified` users, send with an
   `asyncio.Semaphore(settings.NOTIFICATION_EMAIL_CONCURRENCY)`, reuse the existing
   `EmailService.send_notification_email(title_ar=…, title_en=…, message_ar=…, message_en=…,
   cta_label=…, cta_url=…)`. `EmailService` already swallows per-message failures and returns `bool`
   — count them, never raise.
4. `notify_attendance_recorded`: create the per-user row inside the **caller's** UoW; never commit.
5. `notify_blog_post_published`: broadcast row + email fan-out, `data = {"post_id":…, "slug":…,
   "cta_url": f"{settings.FRONTEND_URL}/blog/{slug}"}`. Add a `TODO(phase-blog)` comment naming the
   publish command that must call it (D-13).
6. Add a thin `new_post_email(...)` builder to `email/messages.py` that delegates to the existing
   `notification_email(...)` with a bilingual CTA label. Do not touch `templates.py` or `sender.py`.

**Acceptance**
```bash
cd backend
DEBUG=true APP_ENV=test .venv/bin/python -m pytest tests/unit/notifications tests/integration/notifications -q
DEBUG=true .venv/bin/python -m mypy app/modules/notifications
```

## P4-106 — Notification DTOs and mapper

**Story:** US-013, US-016 · **Rule:** BR-5

**Files**
- `backend/app/modules/notifications/application/dto/notification_dto.py` (new)
- `backend/app/modules/notifications/application/dto/__init__.py`
- `backend/app/modules/notifications/application/mappers/notification_mapper.py` (new)

**Subtasks**
1. Implement every DTO in Part 1 §3.7, field names exactly as frozen. Re-export from
   `dto/__init__.py`, matching the `users` module convention.
2. `map_notification_to_response(notification, *, read_ids)` sets `is_read = id in read_ids` and
   `is_broadcast = user_id is None`. Use an explicit mapper, not `from_attributes`.
3. Sanitise `data` before it leaves the service: keep only `icon` (allowlist from Part 1 §3.5),
   `cta_url`, `post_id`, `slug`, `meeting_date`. Drop anything else so an arbitrary JSONB payload can
   never reach the DOM.

**Acceptance**
```bash
cd backend
DEBUG=true APP_ENV=test .venv/bin/python -m pytest tests/unit/notifications -q
DEBUG=true .venv/bin/python -m mypy app/modules/notifications
```

## P4-107 — Notifications router

**Story:** US-013, US-014, US-015, US-016 · **Rule:** BR-3, BR-4, BR-6, BR-7

**Files**
- `backend/app/modules/notifications/presentation/router.py` (new)
- `backend/app/modules/notifications/presentation/dependencies.py` (new)
- `backend/app/api/v1/router.py`

**Subtasks**
1. `router = APIRouter(prefix="/notifications", tags=["Notifications"])`. Mount it in
   `app/api/v1/router.py` after `users_router`.
2. Implement the five endpoints in Part 1 §3.6. `GET /notifications` validates `page`/`size` through
   `PageParams` bounded by `NOTIFICATIONS_MAX_PAGE_SIZE` and returns `Page[NotificationResponse]`
   built with `Page.build(...)`. This is the first consumer of `app/core/pagination` — do not
   hand-roll an envelope.
3. `tab` is `NotificationTab` with default `all`; an unknown value is a 422 through the enum, not a
   silent fallback. `since` is an optional ISO datetime (D-24).
4. `POST /{id}/read`: 200 `{"marked": 0}` when already read (BR-3); 404 when the notification does not
   exist **or** is a per-user row belonging to someone else (BR-7).
5. `POST /notifications/push`: `Annotated[User, Depends(require_role(RoleName.ADMIN))]`, documented
   `responses={403: …}` like the attendance router.
6. Every endpoint gets a docstring naming the rules it implements, matching the attendance router's
   style.

**Acceptance**
```bash
cd backend
DEBUG=true APP_ENV=test .venv/bin/python -m pytest tests/unit/api/v1/test_notifications.py -q
DEBUG=true .venv/bin/python -m pytest --collect-only -q | grep notifications
```

## P4-108 — Attendance consumer

**Story:** US-013 · **Rule:** BR-10 · **Decision:** D-21

**Files**
- `backend/app/modules/attendance/application/commands/check_in_command.py`

**Subtasks**
1. After the attendance row is recorded and the domain event is recorded, call
   `NotificationService(uow).notify_attendance_recorded(...)` **inside the same UoW**, before
   `uow.commit()`.
2. Wrap the call in `try/except Exception` with `logger.exception(...)`: a notification failure must
   never fail a check-in (BR-10). Add a comment stating that rule.
3. Do not change the check-in response DTO, the outbox event, or any existing assertion.

**Acceptance**
```bash
cd backend
DEBUG=true APP_ENV=test .venv/bin/python -m pytest tests/unit/attendance tests/integration/attendance tests/integration/api/attendance -q
```

## P4-109 — Rate-limit error and `Retry-After`

**Story:** US-019 · **Rule:** BR-15

**Files**
- `backend/app/core/exceptions/errors.py`
- `backend/app/core/exceptions/handlers.py`

**Subtasks**
1. Add `RateLimitedError` exactly as frozen in Part 1 §3.6, carrying `retry_after: int`.
2. In the handler, when the error exposes `retry_after`, add the `Retry-After` header. The
   `{"detail": {"code", "message"}}` envelope is unchanged.
3. Add a unit test asserting status 429, `code == "rate_limited"` and the header.

**Acceptance**
```bash
cd backend
DEBUG=true APP_ENV=test .venv/bin/python -m pytest tests/unit/api/test_main.py tests/unit/api/v1 -q
```

## P4-110 — Notification backend test suite

**Story:** US-013…US-018

**Files**
- `backend/tests/integration/database/test_notifications.py` (extend)
- `backend/tests/unit/notifications/test_copy.py`, `test_notification_service.py`,
  `test_notification_dto.py` (new)
- `backend/tests/unit/api/v1/test_notifications.py` (new)

**Subtasks**
1. Persistence: a broadcast marked read by user A stays unread for user B (locks DEF-1); `mark_read`
   twice returns `marked=1` then `marked=0`; `mark_all_read` covers per-user **and** broadcast rows;
   `tab_counts` matches a hand-built fixture.
2. Service: push creates one row and one audit row; `send_email=false` sends nothing;
   `send_email=true` reaches only ACTIVE + verified users (assert with `captured_emails`);
   `notify_blog_post_published` produces one broadcast + the right `cta_url`.
3. API: 401 unauthenticated; MEMBER can read own feed; MEMBER and SERVANT get 403 on `/push`; ADMIN
   gets 201; `tab=reminders` returns only `ATTENDANCE`; `size=1000` is 422; foreign per-user
   notification is 404 on `/read`.
4. Attendance regression: a check-in creates exactly one `ATTENDANCE` notification for the attendee
   and none for anyone else.

**Acceptance**
```bash
cd backend
DEBUG=true APP_ENV=test .venv/bin/python -m pytest tests -q
ruff check . && ruff format --check . && DEBUG=true .venv/bin/python -m mypy app
```

---

# 7. Stage B — Anonymous Messages Backend

## P4-201 — Sliding-window rate limiter

**Story:** US-019 · **Rule:** BR-12, BR-15 · **Decision:** D-22

**Files**
- `backend/app/core/rate_limit/__init__.py` (new)
- `backend/tests/unit/test_rate_limit.py` (new)

**Subtasks**
1. Implement `SlidingWindowRateLimiter` and `hash_key` exactly as frozen in Part 1 §3.3. Storage is a
   `dict[str, deque[float]]` pruned on each `hit`; monotonic time, not wall clock.
2. `hit` raises `RateLimitedError(retry_after=…)` computed from the oldest entry in the window.
3. `hash_key` is `sha256(settings.JWT_SECRET + value)`. The clear value must never be stored or
   logged (BR-12).
4. Add a memory guard: evict keys whose window is empty, and cap the dict size with a documented
   bound so a hostile client cannot grow it without limit.
5. Docstring must state the limitation: in-memory, per process, reset on restart (R-3).

**Acceptance**
```bash
cd backend
DEBUG=true APP_ENV=test .venv/bin/python -m pytest tests/unit/test_rate_limit.py -q
DEBUG=true .venv/bin/python -m mypy app/core/rate_limit
```

## P4-202 — Telegram client and message formatter

**Story:** US-020 · **Rule:** BR-11 · **Decision:** D-20

**Files**
- `backend/app/modules/anonymous_messages/infrastructure/telegram/client.py` (new)
- `backend/app/modules/anonymous_messages/infrastructure/telegram/formatter.py` (new)
- `backend/app/modules/anonymous_messages/infrastructure/telegram/__init__.py`

**Subtasks**
1. `TelegramClient` Protocol, `HttpTelegramClient`, `LoggingTelegramClient`, `get_telegram_client()`
   per Part 1 §3.3. Copy the httpx idiom already used in
   `notifications/infrastructure/email/sender.py:49-55`: module-level endpoint constant,
   `async with httpx.AsyncClient(timeout=settings.TELEGRAM_TIMEOUT_SECONDS)`, `raise_for_status()`.
2. `POST https://api.telegram.org/bot{token}/sendMessage` with `chat_id`, `text`,
   `parse_mode="HTML"`, `disable_web_page_preview=True`. Return `str(result["message_id"])`.
3. `get_telegram_client()` returns `LoggingTelegramClient` when `TELEGRAM_BOT_TOKEN` or
   `TELEGRAM_CHAT_ID` is missing, so local development and CI never need real credentials — mirroring
   `get_email_sender()`.
4. `formatter.format_message(message)` HTML-escapes every field and renders the layout in §14.4.
   Absent name/phone render as the localised "not provided" placeholder, never as an empty line.
5. Retry inside one request: up to `settings.TELEGRAM_SEND_ATTEMPTS` attempts on timeout or 5xx, with
   a short backoff. Do not retry 4xx — a bad token or chat id will never succeed.
6. Never log the message body, the name or the phone. Log the message id and the outcome only.

**Acceptance**
```bash
cd backend
DEBUG=true APP_ENV=test .venv/bin/python -m pytest tests/unit/anonymous_messages -q
DEBUG=true .venv/bin/python -m mypy app/modules/anonymous_messages
```

## P4-203 — Repository updates

**Story:** US-020 · **Fixes:** DEF-2 · **Rule:** BR-14

**Files**
- `backend/app/modules/anonymous_messages/infrastructure/persistence/anonymous_message_repository.py`

**Subtasks**
1. `mark_sent` / `mark_failed`: use `now_utc()`, increment `attempts`, set `last_attempt_at`.
2. Add `list_paginated(*, params: PageParams, status: MessageStatus | None) -> tuple[list[AnonymousMessage], int]`
   ordered `created_at DESC, id DESC`.
3. Leave `claim_pending` in place and add a comment: reserved for a future worker, unused in
   Phase 4 (D-3).

**Acceptance**
```bash
cd backend
grep -n "datetime.now()" app/modules/anonymous_messages   # must print nothing
DEBUG=true APP_ENV=test .venv/bin/python -m pytest tests/integration/database/test_anonymous_messages.py -q
```

## P4-204 — DTOs

**Story:** US-019, US-021 · **Rule:** BR-11, BR-16

**Files**
- `backend/app/modules/anonymous_messages/application/dto/anonymous_message_dto.py` (new)
- `backend/app/modules/anonymous_messages/application/dto/__init__.py`

**Subtasks**
1. Implement the three DTOs in Part 1 §3.7, field names and validators exactly as frozen. Length
   bounds read from settings where they exist.
2. Add a field validator that strips whitespace from `message` **before** the length check, and
   normalises empty strings for `sender_name`/`sender_phone` to `None` — an untouched optional field
   must not be stored as `""`.
3. Add a module docstring stating that no field of `AnonymousMessageAdminResponse` may ever be
   derived from an account, IP or session (BR-11).

**Acceptance**
```bash
cd backend
DEBUG=true APP_ENV=test .venv/bin/python -m pytest tests/unit/anonymous_messages -q
```

## P4-205 — `AnonymousMessageService`

**Story:** US-019, US-020, US-021 · **Rule:** BR-13, BR-14

**Files**
- `backend/app/modules/anonymous_messages/application/services/anonymous_message_service.py` (new)

**Subtasks**
1. `submit`: persist → `uow.commit()` → format → send → `mark_sent`/`mark_failed` → `uow.commit()`.
   Persist-before-send is the rule; a delivery exception must never lose the row (BR-13).
2. Return `AnonymousMessageCreateResponse(status=…, delivered=…)`; a failed send is still a 201.
3. `retry`: 404 when the id is unknown; 409 `conflict` when `telegram_status != FAILED`; otherwise
   re-attempt, update, and write `uow.audit.record(action="anonymous_message.retry", …)` with the
   actor id (BR-14). The audit metadata must not contain the message body.
4. `list_messages` delegates to `list_paginated` and wraps the result in `Page.build(...)`.

**Acceptance**
```bash
cd backend
DEBUG=true APP_ENV=test .venv/bin/python -m pytest tests/unit/anonymous_messages tests/integration/anonymous_messages -q
```

## P4-206 — Anonymous messages router

**Story:** US-019, US-021 · **Rule:** BR-12, BR-15 · **Decision:** D-9

**Files**
- `backend/app/modules/anonymous_messages/presentation/router.py` (new)
- `backend/app/modules/anonymous_messages/presentation/dependencies.py` (new)
- `backend/app/api/v1/router.py`

**Subtasks**
1. `router = APIRouter(prefix="/anonymous-messages", tags=["Anonymous Messages"])`, mounted in
   `app/api/v1/router.py`.
2. `POST /` takes **no auth dependency** (D-9). Resolve the caller softly: a helper
   `optional_current_user` returns `User | None` without raising when the bearer token is absent or
   invalid — an expired token must not block an anonymous submission.
3. Rate limiting: two module-level limiter singletons (per-IP hour, per-user day) built from settings.
   Key material is `hash_key(client_ip)` and `hash_key(str(user.id))`. Client IP comes from
   `request.client.host`, or the first `X-Forwarded-For` hop when `settings.TRUST_PROXY_HEADERS`.
   Check both limits before persisting anything (BR-15).
4. `GET /` and `POST /{id}/retry` are `Depends(require_role(RoleName.ADMIN))` with documented 403
   responses.
5. Response model on `POST /` is `AnonymousMessageCreateResponse` with `status_code=201`.

**Acceptance**
```bash
cd backend
DEBUG=true APP_ENV=test .venv/bin/python -m pytest tests/unit/api/v1/test_anonymous_messages.py -q
```

## P4-207 — `.env.example` and settings

**Story:** US-019, US-020

**Files**
- `backend/app/config.py`
- `backend/.env.example`

**Subtasks**
1. Add every setting in Part 1 §3.1 with its default and a one-line comment, in the existing style.
2. Add the two vars `.env.example` is missing today: `GOOGLE_CLIENT_SECRET`, `FRONTEND_URL`.
3. Do **not** edit `backend/.env`. Note in the PR description that `TELEGRAM_BOT_TOKEN` and
   `TELEGRAM_CHAT_ID` must be filled in the deployment environment, and that the credentials already
   present in the local `.env` should be rotated (they were shared in plain text).
4. `tests/unit/test_config.py`: assert every new setting has the documented default.

**Acceptance**
```bash
cd backend
DEBUG=true APP_ENV=test .venv/bin/python -m pytest tests/unit/test_config.py -q
grep -c "TELEGRAM_TIMEOUT_SECONDS\|ANONYMOUS_MESSAGE_MAX_LENGTH\|NOTIFICATIONS_PAGE_SIZE" .env.example
```

## P4-208 — Anonymous backend test suite

**Story:** US-019, US-020, US-021 · **Rule:** BR-11

**Files**
- `backend/tests/integration/database/test_anonymous_messages.py` (extend)
- `backend/tests/unit/anonymous_messages/{test_formatter,test_telegram_client,test_service}.py` (new)
- `backend/tests/unit/api/v1/test_anonymous_messages.py` (new)

**Subtasks**
1. Update `test_table_has_no_identity_columns` per D-1: assert `user_id`, `author_id`, `email`,
   `ip_address`, `user_agent`, `session_id` are absent **and** that `sender_name`/`sender_phone`
   exist and are nullable. Add a comment explaining the changed guarantee.
2. Telegram: stub the client with `monkeypatch.setattr` on the router/service seam (the technique
   `tests/unit/api/v1/test_auth_google.py:27-32` already uses). Cover success, timeout → FAILED,
   4xx → FAILED without retry, 5xx → retried then FAILED.
3. Formatter: HTML escaping of `<b>`-style input, absent name/phone placeholders, long-message
   handling.
4. API: 201 without a token; 201 with a token and **no** stored linkage (assert the row's columns);
   6th submission in an hour is 429 with `Retry-After`; `message` of 9 chars is 422; MEMBER gets 403
   on `GET /`; retry on a `SENT` row is 409; retry on a `FAILED` row flips it to SENT and writes an
   audit row.
5. Assert `delivered=false` still returns 201 (BR-13).

**Acceptance**
```bash
cd backend
DEBUG=true APP_ENV=test .venv/bin/python -m pytest tests -q
ruff check . && ruff format --check . && DEBUG=true .venv/bin/python -m mypy app
```

---

# 8. Stage C — Frontend Foundation

## P4-301 — Repair the shadcn config pointer

**Story:** US-023 · **Fixes:** DEF-15

**Files**
- `frontend/components.json`

**Subtasks**
1. Point `tailwind.css` at `src/index.css`.
2. Set `"rtl": true` if the schema supports it, so future generated primitives use logical
   properties. If it does not, add a comment in `index.css` recording that every generated primitive
   must be converted by hand per Part 1 §3.11.

**Acceptance**
```bash
cd frontend && npx tsc -b && npm run lint
```

## P4-302 — Logical properties in the rendered primitives

**Story:** US-023 · **Fixes:** DEF-6 · **Rule:** BR-17 · **Decision:** D-16

**Files** — exactly the "Rendered primitives" list in Part 1 §3.11.

**Subtasks**
1. Apply the conversion table in Part 1 §3.11 file by file. Do not touch the primitives listed as
   "deliberately untouched".
2. `sidebar.tsx`: convert only the unguarded values (`right-3`, `right-1`, `text-left`, `pr-8`,
   `border-l`). Leave every `group-data-[side=…]` selector alone — those are already correct.
3. `dialog.tsx`: `left-[50%]` centering stays; the `right-4` close button becomes `end-4`.
4. `sheet.tsx`/`drawer.tsx`: the `side` variants are intentional; only the close button and
   `sm:text-left` change.
5. `input-otp.tsx`: `border-r` → `border-e`, `first:rounded-l-md` → `first:rounded-s-md`,
   `last:rounded-r-md` → `last:rounded-e-md`. Verify against the attendance PIN screen in both
   directions.
6. Replace every `space-x-*` with `gap-*` (`space-x` does not flip).
7. Visually verify the attendance screens in `ar` and `en` before and after. This task changes
   shipped UI; a regression here is a Phase 2 regression.

**Acceptance**
```bash
cd frontend
npx tsc -b && npm run lint && npm run test:run
```

## P4-303 — Logical properties in app code

**Story:** US-023 · **Fixes:** DEF-5, DEF-7 · **Rule:** BR-17

**Files**
- `frontend/src/components/layout/Navbar.tsx` (lines 152, 237)
- `frontend/src/pages/landing/sections/BibleVerse.tsx`
- `frontend/src/pages/landing/sections/Pillars.tsx`
- `frontend/src/modules/attendance/components/ScannerFrame.tsx`

**Subtasks**
1. `Navbar`: `ml-1` → `ms-1` in both places, making the file internally consistent with line 160.
2. `BibleVerse.tsx:44`: drop `isArabic && "text-right"` entirely — `dir` already handles alignment.
3. `Pillars.tsx:46`: `lg:border-l` → `lg:border-s`.
4. `ScannerFrame.tsx`: make the corner brackets direction-agnostic — either all physical (a camera
   frame is a square, not a text flow) or all logical, but not the current mix of `border-s`/`border-e`
   with `rounded-tl/tr/bl/br`. State which you chose in a comment.

**Acceptance**
```bash
cd frontend
npm run test:run && npx tsc -b
```

## P4-304 — Shadow token and palette compliance

**Story:** US-023 · **Fixes:** DEF-8, DEF-9 · **Decision:** D-17

**Files**
- `frontend/src/index.css`
- the 15 files listed under "Branding fix scope" in Part 1 §3.11

**Subtasks**
1. Add `--shadow-card`, `--shadow-card-strong` and the `card-elevated` utility (Part 1 §3.11).
2. Replace all three hardcoded navy-rgba shadow variants with `card-elevated` (or
   `shadow-[var(--shadow-card-strong)]` where the stronger value was deliberate).
3. Replace `text-emerald-700` with `text-mint` or `text-ink` — whichever preserves contrast. Check
   the result against the light **and** dark themes.
4. Grep must come back clean afterwards.

**Acceptance**
```bash
cd frontend
grep -rn "rgba(37, *61, *99" src --include=*.tsx   # must print nothing
grep -rn "emerald" src --include=*.tsx             # must print nothing
npx tsc -b && npm run test:run
```

## P4-305 — De-duplicate the theme layer

**Story:** US-023 · **Fixes:** DEF-10

**Files**
- `frontend/src/index.css`

**Subtasks**
1. Collapse the two `:root` blocks into one, the two `.dark` blocks into one, and the three
   `@theme inline` blocks into one. Preserve the final computed values exactly — this is a
   refactor, not a re-theme.
2. Define `--chart-1..5` once.
3. Move every raw hex out of `btn-primary`/`btn-outline` (light and dark) into named vars
   (`--navy-hover`, `--surface-dark`, `--mint-hover`, …).
4. Fix the false comment claiming brand accents are identical in both modes — `--brand-blue` and
   `--brand-red` are in fact overridden in `.dark`. Either make them truly identical or correct the
   comment; state which and why. Note that `focus-ring` derives from `--brand-blue`.
5. Diff the rendered result: screenshot the landing page, profile page and attendance dashboard in
   light and dark, `ar` and `en`, before and after.

**Acceptance**
```bash
cd frontend
npm run build && npm run test:run
```

## P4-306 — Amiri on every scripture quotation

**Story:** US-023 · **Fixes:** DEF-11

**Files**
- `frontend/src/pages/landing/sections/BibleVerse.tsx`
- any component rendering `common.brand.verse` or `landing.bibleVerse`

**Subtasks**
1. Apply `font-verse` to every verse body and keep the reference small and mint, per
   `Design-Guide.md:829-851` and §9.
2. Confirm `index.html` loads the Amiri weights actually used, and drop any weight nothing uses.

**Acceptance**
```bash
cd frontend
grep -rn "font-verse" src --include=*.tsx   # must list every verse render site
npx tsc -b
```

## P4-307 — Unify the brand name

**Story:** US-023 · **Fixes:** DEF-12 · **Decision:** D-18

**Files**
- `frontend/index.html`
- `frontend/src/i18n/resources/{ar,en}.ts`
- `frontend/src/components/layout/{Footer,Navbar}.tsx`
- `frontend/src/pages/auth/components/{AuthFooter,BrandPanel}.tsx`

**Subtasks**
1. Canonical: Arabic `إجتماع الشباب بأبنوب`, English `Marmarkos Abnub` (D-18).
2. `common.brand.name` becomes the canonical Arabic string; add `common.brand.nameEn`.
3. Replace every hardcoded name and `alt` text with `common.brand.name` / `common.brand.logoAlt`.
4. `landing.footer` copyright uses the canonical name and a **computed** year, not a literal.
5. Grep for the two stale names afterwards.

**Acceptance**
```bash
cd frontend
grep -rn "خدمة الشباب" src index.html   # must print nothing
npm run test:run
```

## P4-308 — i18n for the placeholder page

**Story:** US-023 · **Fixes:** DEF-14

**Files**
- `frontend/src/pages/placeholder/PlaceholderPage.tsx`
- `frontend/src/i18n/resources/{ar,en}.ts`

**Subtasks**
1. Move the inline Arabic and English copy into `common.placeholder.*`.
2. Drop `"anonymous"` and `"notifications"` from the `titleKey` union — both get real pages in
   Stages E and G.

**Acceptance**
```bash
cd frontend
npx tsc -b   # the removed union members must fail if anything still references them
```

## P4-309 — Footer contact data and social links

**Story:** US-023 · **Fixes:** DEF-13 · **Decision:** D-19
**Blocked by:** the product owner supplying the social URLs (see DoR).

**Files**
- `frontend/src/components/layout/Footer.tsx`
- `frontend/src/i18n/resources/{ar,en}.ts`

**Subtasks**
1. Move phone, email and address into `landing.footer.contact.*` — placeholders stay, but they become
   editable without touching the component (D-19).
2. Wire the real Instagram / Facebook / YouTube URLs into a `SOCIAL_LINKS` constant with
   `rel="noopener noreferrer"` and accessible labels.
3. Quick links currently pointing at `#`: point each at its real route, or remove it. **Do not ship a
   dead anchor.** Anything with no destination yet is dropped from the footer, not stubbed.

**Acceptance**
```bash
cd frontend
grep -n 'href="#"' src/components/layout/Footer.tsx   # must print nothing
npm run test:run
```

## P4-310 — `/admin` route tree and legacy redirects

**Story:** US-022 · **Decision:** D-15

**Files**
- `frontend/src/router.tsx`
- `frontend/src/routes/README.md`
- `frontend/src/components/layout/{AdminTopbar,Navbar}.tsx`
- `frontend/src/layouts/__tests__/layouts.test.tsx`

**Subtasks**
1. Build the route table in Part 1 §3.8 exactly: one pathless `RequireRole(["ADMIN","SERVANT"])`
   branch with `errorElement: <ForbiddenPage/>`, `AttendanceLayout` for check-in and `AdminLayout`
   for the rest. Keep the existing lazy imports and `Suspense fallback={<PageSkeleton/>}`.
2. `/admin/anonymous-messages` needs a nested `RequireRole(["ADMIN"])` — SERVANT must get the visible
   403 page, not a blank screen.
3. Add the four legacy `Navigate … replace` redirects so existing bookmarks and any external link
   keep working.
4. Retarget `common.adminPanel` in both topbars to `/admin/dashboard`, and update every internal link
   to the moved paths (grep for `"/attendance/`).
5. Update `src/routes/README.md` in this task. The docs and the router must never disagree.
6. Extend the layout test: `/admin/attendance/check-in` renders `AttendanceLayout` with no
   `SidebarProvider`; `/admin/notifications` renders `AdminLayout` with one.

**Acceptance**
```bash
cd frontend
grep -rn '"/attendance/' src --include=*.tsx | grep -v router.tsx   # must print nothing
npm run test:run && npx tsc -b
```

## P4-311 — Design-accurate admin sidebar

**Story:** US-022 · **Decision:** D-8, DR-10

**Files**
- `frontend/src/components/layout/AdminSidebar.tsx`
- `frontend/src/i18n/resources/{ar,en}.ts` (new `admin` namespace)

**Subtasks**
1. Structure per DR-10: `SidebarHeader` = logo box + canonical name; a brand block (FAITH./FRIENDS./
   PURPOSE., supporting line, illustration, verse) rendered only when not collapsed —
   reuse `BrandPanel` content rather than redrawing it; `SidebarContent` = nav; `SidebarFooter` = the
   user card (name, role, chevron) opening the same dropdown as `AdminTopbar`.
2. Nav items, in the design's order, from the new `admin.nav.*` keys:
   `dashboard → /admin/dashboard` (LayoutDashboard) · `members` (Users, **disabled**) ·
   `attendance` (ScanLine) with sub-items `checkIn → /admin/attendance/check-in` and
   `history → /admin/attendance/history` via `SidebarMenuSub` · `events` (Calendar, **disabled**) ·
   `messages → /admin/anonymous-messages` (MessageSquare, **ADMIN only — hidden for SERVANT**) ·
   `notifications → /admin/notifications` (Bell) · `reports` (BarChart3, **disabled**) ·
   `settings` (Settings, **disabled**).
3. Disabled items: `aria-disabled`, no `NavLink`, `opacity-50 cursor-not-allowed`, tooltip
   `common.comingSoon` — the identical treatment Phase 2 gave the bell (D-8).
4. `side={isArabic ? "right" : "left"}` stays. Active item keeps the mint treatment from the design.
5. Icons are Lucide only (`Design-Guide.md:492-509`).

**Acceptance**
```bash
cd frontend
npm run test:run   # includes a new test: disabled items are not links and expose aria-disabled
npx tsc -b
```

---

# 9. Stage D — Notification Bell

## P4-401 — Notification data layer

**Story:** US-013, US-014, US-015 · **Decision:** D-4

**Files**
- `frontend/src/modules/notifications/types/index.ts` (new)
- `frontend/src/modules/notifications/api/index.ts` (new)
- `frontend/src/modules/notifications/api/queryKeys.ts` (new)
- `frontend/src/modules/notifications/hooks/{useNotifications,useNotificationSummary,useMarkRead,useMarkAllRead,usePushNotification,index}.ts` (new)

**Subtasks**
1. Types mirror the backend DTOs field for field (Part 1 §3.7). `NotificationType` is a union of the
   four literals.
2. `notificationsApi` is an object of methods over `apiClient`, returning `response.data` — copy
   `modules/attendance/api/index.ts` exactly.
3. Query keys exactly as frozen in Part 1 §3.9.
4. `useNotificationSummary`: `refetchInterval: 60_000`, `refetchOnWindowFocus: true`, and skipped
   entirely when `getAccessToken()` is null so anonymous visitors issue no requests (D-4).
5. `useNotifications`: `placeholderData: keepPreviousData` for smooth pagination, matching
   `useAttendanceHistory`.
6. Every mutation invalidates `notificationKeys.all`.

**Acceptance**
```bash
cd frontend
npx tsc -b && npm run lint
```

## P4-402 — `NotificationBell` component

**Story:** US-014 · **Fixes:** DEF-3, DEF-4, DEF-16

**Files**
- `frontend/src/modules/notifications/components/NotificationBell.tsx` (new)
- `frontend/src/components/layout/{AdminTopbar,Navbar}.tsx`

**Subtasks**
1. One component used by both topbars: a `Link to={to}` wrapping the `Bell` icon with an absolutely
   positioned mint badge. Props: `{ to: string; className?: string }`.
2. Badge rules: hidden at 0; shows the count up to 99; shows `99+` above that. Count formatted with
   `Intl.NumberFormat` so Arabic renders Arabic-Indic digits.
3. Position the badge with logical utilities (`-end-0.5 -top-0.5`) so it flips with direction. The
   container already has `relative`.
4. Accessibility: `aria-label` from `landing.nav.notifications`, and the count exposed via
   `aria-describedby` or an `sr-only` span using `notifications.badges.unread` with interpolation —
   never a bare number as the only signal (`Design-Guide.md:980-993`).
5. Replace the disabled placeholder in `AdminTopbar.tsx:109-118` (DEF-3) with
   `<NotificationBell to="/admin/notifications" />`, and the bare `Link` in `Navbar.tsx:142-148`
   (DEF-4) with `<NotificationBell to="/notifications" />`. Do the mobile menu row too.
6. DEF-16 mitigation, scoped: on sign-out, call `queryClient.removeQueries({ queryKey:
   notificationKeys.all })` so a second user on the same browser never sees the first user's count.
   Do **not** introduce an auth context in this phase.

**Acceptance**
```bash
cd frontend
npm run test:run   # new test: badge hidden at 0, "99+" above 99, aria-label present in ar
```

## P4-403 — Bell tests

**Story:** US-014

**Files**
- `frontend/src/modules/notifications/components/__tests__/NotificationBell.test.tsx` (new)

**Subtasks**
1. Use the `renderWithProviders` convention from `src/layouts/__tests__/layouts.test.tsx`, asserting
   Arabic strings (the harness sets `lng: "ar"`).
2. Mock `notificationsApi.summary` — do not hit axios.
3. Cover: 0 → no badge; 3 → "3"; 150 → "99+"; anonymous visitor → no query issued.

**Acceptance**
```bash
cd frontend && npm run test:run
```

---

# 10. Stage E — Member Notifications Page

## P4-501 — Shared feed components

**Story:** US-013 · **Rule:** BR-17 · **Decision:** D-7

**Files**
- `frontend/src/modules/notifications/components/{NotificationIcon,NotificationRow,NotificationList,NotificationTabs,NotificationFilterMenu,MarkAllReadButton,NotificationInfoCards}.tsx` (new)
- `frontend/src/components/common/{EmptyState,ErrorRetry,AppPagination}.tsx` (new)

**Subtasks**
1. `NotificationIcon`: type → icon + accent, strictly from the frozen map in Part 1 §3.5, honouring a
   `data.icon` override only from the allowlist. 40px circle, brand colour at 10% opacity.
2. `NotificationRow`: `card-elevated` card, `border-s-4` in the type accent, icon, title with the
   optional mint "New" pill (D-26), message, and a trailing block with the relative time plus an
   accent dot when unread. Clicking marks it read and follows `data.cta_url` when present.
3. `NotificationTabs`: use `ui/tabs` (its first consumer) with the five tabs from Part 1 §3.4,
   mint active underline, count badges on All and Unread from the summary query, Lucide icons on
   Announcements/Reminders/System per the design.
4. `NotificationFilterMenu`: `ui/dropdown-menu` with the four time ranges (D-24), mapping to `since`.
5. `MarkAllReadButton`: check icon + label, disabled at 0 unread, `sonner` toast on success.
6. `AppPagination`: wrap `ui/pagination` (its first consumer) with the design's `‹ 1 2 3 … 10 ›`
   ellipsis behaviour and `rtl:rotate-180` chevrons. Hand-rolling a second pager is not acceptable —
   and while you are here, retire the hand-rolled pager in `AttendanceHistoryPage` in favour of it.
7. `EmptyState` and `ErrorRetry`: extract the ad-hoc blocks from `AttendanceHistoryPage.tsx:183-216`
   and the local helper in `AttendanceDashboardPage.tsx` and reuse them in both places.
8. `NotificationInfoCards`: the four-card strip, with the reworded copy from Part 1 §1.5 (D-14).
9. Relative time: `Intl.RelativeTimeFormat` with `ar-EG` / `en-GB`; anything older than 7 days shows
   an absolute date via `Intl.DateTimeFormat`. Never concatenate translated fragments.
10. Logical properties only, and `font-arabic` applied conditionally in the established style.

**Acceptance**
```bash
cd frontend
npx tsc -b && npm run lint && npm run test:run
```

## P4-502 — `NotificationsPage` (member)

**Story:** US-013, US-015 · **Decision:** D-7

**Files**
- `frontend/src/modules/notifications/pages/NotificationsPage.tsx` (new)
- `frontend/src/router.tsx`

**Subtasks**
1. Public shell: `Navbar variant="landing"` + page content + `Footer` (DR-9), `dir`/`lang` on the
   page root as every other page does.
2. Header block with `notifications.title` / `notifications.subtitle`, then tabs, then the
   action row (mark-all-read at the start, filter at the end), the list, the pager, the info cards.
3. `Skeleton` while loading, `EmptyState` when empty, `ErrorRetry` on failure. Tabs and pagination
   state live in the URL query string so a reload and a shared link both survive.
4. Replace the `/notifications` placeholder route with this page, keeping `RequireAuth`.

**Acceptance**
```bash
cd frontend
npm run test:run && npx tsc -b
```

## P4-503 — Member page tests

**Story:** US-013, US-015

**Files**
- `frontend/src/modules/notifications/pages/__tests__/NotificationsPage.test.tsx` (new)

**Subtasks**
1. Mocked API. Cover: rows render with the right icon and accent; the Unread tab filters; mark-all-read
   fires the mutation and invalidates; the empty state appears; the error state offers retry; the
   pager appears only when `pages > 1`.
2. One test renders under `dir="ltr"` (`en`) and asserts the layout still exposes the same roles.

**Acceptance**
```bash
cd frontend && npm run test:run
```

---

# 11. Stage F — Admin Notifications and Push

## P4-601 — `AdminNotificationsPage`

**Story:** US-013 · **Decision:** D-7

**Files**
- `frontend/src/modules/notifications/pages/AdminNotificationsPage.tsx` (new)
- `frontend/src/router.tsx`

**Subtasks**
1. Same feed components inside `AdminLayout` + `AdminTopbar title={notifications.admin.title}
   subtitle={notifications.admin.subtitle}`. This page is the design screenshot.
2. ADMIN additionally sees the push composer (P4-602); SERVANT sees the feed only. Gate with
   `getUserRole() === "ADMIN"`, matching the existing inline checks in the topbars.

**Acceptance**
```bash
cd frontend && npm run test:run && npx tsc -b
```

## P4-602 — Push composer

**Story:** US-016, US-017 · **Rule:** BR-6, BR-8 · **Decision:** D-10

**Files**
- `frontend/src/modules/notifications/components/PushNotificationForm.tsx` (new)
- `frontend/src/modules/notifications/hooks/usePushNotification.ts`

**Subtasks**
1. `react-hook-form` + `zod`, matching the auth forms. Fields: Arabic title, English title, Arabic
   message, English message, optional CTA URL, "also send email" switch (D-10). All four copy fields
   are required (BR-5) — the resolver enforces the same bounds as the DTO.
2. Arabic fields render with `dir="rtl"` and `font-arabic`; English fields with `dir="ltr"`,
   regardless of the active UI language. This is the one place both directions coexist on screen.
3. When "also send email" is on, `ui/alert-dialog` confirms before sending, stating plainly that the
   email goes to every verified active member and that the request will take time to complete.
4. On success: `sonner` toast from `notifications.toast.pushed` with the interpolated
   `emails_sent` / `emails_failed` counts, form reset, `notificationKeys.all` invalidated.
5. On failure: `getApiErrorMessage(error, t("toast.pushFailed"))`.
6. Submit is disabled while pending and the button shows a busy label — bulk email is slow (R-1).

**Acceptance**
```bash
cd frontend && npm run test:run && npx tsc -b
```

## P4-603 — Admin notification tests

**Story:** US-016, US-017

**Files**
- `frontend/src/modules/notifications/components/__tests__/PushNotificationForm.test.tsx` (new)

**Subtasks**
1. Validation: empty Arabic title blocks submit; a 2-character message blocks submit; a malformed CTA
   URL blocks submit.
2. The email confirmation dialog appears only when the switch is on.
3. A successful submit calls the API once with all frozen field names.
4. A SERVANT does not see the composer.

**Acceptance**
```bash
cd frontend && npm run test:run
```

---

# 12. Stage G — Public Anonymous Message Page

## P4-701 — Anonymous data layer

**Story:** US-019, US-021

**Files**
- `frontend/src/modules/anonymous-messages/types/index.ts` (new)
- `frontend/src/modules/anonymous-messages/api/{index.ts,queryKeys.ts}` (new)
- `frontend/src/modules/anonymous-messages/hooks/{useSubmitAnonymousMessage,useAnonymousMessages,useRetryDelivery,index}.ts` (new)
- `frontend/src/lib/api.ts`

**Subtasks**
1. Types mirror the backend DTOs (Part 1 §3.7).
2. Add `/anonymous-messages` to `AUTH_FREE_PREFIXES` **only for the POST path** — the admin `GET`
   needs the bearer token. If the interceptor cannot distinguish by method, leave the prefix out
   entirely: an ignored bearer token is harmless for a public endpoint, a missing one on the admin
   listing is not. Document the choice in a comment.
3. `useSubmitAnonymousMessage` maps a 429 to `anonymousMessages.validation.rateLimited`.

**Acceptance**
```bash
cd frontend && npx tsc -b && npm run lint
```

## P4-702 — Anonymous message form

**Story:** US-019 · **Rule:** BR-16

**Files**
- `frontend/src/modules/anonymous-messages/components/{AnonymousMessageForm,AnonymityNotice,MessageTopicsCard}.tsx` (new)

**Subtasks**
1. Card per the design: mint circle with `Mail`, `card.title`, `card.subtitle` with `100%` in mint.
2. `AnonymityNotice`: mint-tinted banner, `ShieldCheck`, title + body.
3. Fields with Lucide prefix icons inside the input (`User`, `Phone`, `Pencil`), placed with logical
   padding so they flip: name (optional) + hint, phone (optional) + hint — labelled **"Phone Number
   (Optional)"**, correcting the design's typo (DR-7) — and the required message textarea with a live
   `0 / 1000` counter.
4. `zod` bounds identical to the DTO (BR-16). The counter turns `text-brand-red` past the limit and
   submit is disabled.
5. `MessageTopicsCard`: light blue tips box, `Lightbulb`, two-column bullet list from
   `topics.items`, collapsing to one column on mobile.
6. Submit: full-width navy button with `Send`, busy label while pending, then the footnote line with
   the lock icon.
7. Success: swap the card for a success state (`success.title`, `success.body`, "Send another"),
   shown for `delivered` **and** for `status: "FAILED"` — the message is stored either way (BR-13).
   Never surface a delivery failure to the sender.

**Acceptance**
```bash
cd frontend && npx tsc -b && npm run test:run
```

## P4-703 — `AnonymousMessagePage`

**Story:** US-019 · **Decision:** DR-9

**Files**
- `frontend/src/modules/anonymous-messages/pages/AnonymousMessagePage.tsx` (new)
- `frontend/src/modules/anonymous-messages/components/{ImportantInfoCard,BeforeYouSendCard}.tsx` (new)
- `frontend/src/components/layout/BrandFooterStrip.tsx` (new)
- `frontend/src/router.tsx`

**Subtasks**
1. Layout per the design: `BrandPanel variant="light"` on the start side (hidden below `md`), content
   on the other — the same split `AttendanceLayout` already uses. **Reuse `BrandPanel`; do not
   redraw the logo box, message, illustration or verse.**
2. `Navbar variant="auth"` at the top so the signed-in cluster or the login CTA appears exactly as it
   does elsewhere (DR-9). No fake avatar.
3. Below the form, the two cards side by side (stacking on mobile): "Important Information"
   (`ShieldCheck` blue / `Users` mint / `Clock` orange) with the **reworded** third item (§1.5), and
   "Before You Send" (`MessageSquare`, `Flame`, `Heart`, `Info`).
4. `BrandFooterStrip`: the navy strip with the four items already present in `common.footer` — reuse
   those keys, do not duplicate the copy — plus the copyright line with the canonical name and a
   computed year (DR-8).
5. Replace the `/anonymous-messages` placeholder route with this page. It stays public (D-9).

**Acceptance**
```bash
cd frontend && npm run test:run && npx tsc -b
```

## P4-704 — Anonymous page tests

**Story:** US-019

**Files**
- `frontend/src/modules/anonymous-messages/pages/__tests__/AnonymousMessagePage.test.tsx` (new)

**Subtasks**
1. A 9-character message blocks submit; 10 characters passes.
2. The counter updates and turns red past 1000.
3. An invalid phone shows the field error; an empty phone submits fine.
4. `status: "FAILED"` still renders the success state (BR-13).
5. A 429 renders the rate-limit message.
6. Renders for an anonymous visitor with no token and issues no authenticated request.

**Acceptance**
```bash
cd frontend && npm run test:run
```

---

# 13. Stage H — Admin Anonymous Messages Section

## P4-801 — Listing page

**Story:** US-021 · **Decision:** D-11

**Files**
- `frontend/src/modules/anonymous-messages/pages/AdminAnonymousMessagesPage.tsx` (new)
- `frontend/src/modules/anonymous-messages/components/{AnonymousMessagesTable,MessageStatusBadge}.tsx` (new)
- `frontend/src/router.tsx`

**Subtasks**
1. `AdminLayout` + `AdminTopbar` with the `anonymousMessages.admin.*` title and subtitle.
2. `ui/table` (already logical) with columns: created, message (clamped, expandable), name, phone,
   status, Telegram status, attempts, action. Long messages expand in place; do not truncate without
   a way to read the whole thing.
3. `MessageStatusBadge` follows the existing hand-rolled badge idiom from `AttendanceStatusBadge`
   (rounded-full, brand tokens): SENT → mint, PENDING → orange, FAILED → red.
4. Status filter (All / Pending / Sent / Failed) plus `AppPagination`, both mirrored into the URL.
5. `EmptyState` when empty, `ErrorRetry` on failure, `Skeleton` while loading.
6. Route is ADMIN-only (P4-310); SERVANT gets `ForbiddenPage`.

**Acceptance**
```bash
cd frontend && npm run test:run && npx tsc -b
```

## P4-802 — Retry action

**Story:** US-020, US-021 · **Rule:** BR-14

**Files**
- `frontend/src/modules/anonymous-messages/components/AnonymousMessagesTable.tsx`
- `frontend/src/modules/anonymous-messages/hooks/useRetryDelivery.ts`

**Subtasks**
1. A "Retry" button rendered only for `telegram_status === "FAILED"`, disabled while pending.
2. On success: toast, invalidate `anonymousMessageKeys.all`. On failure: `getApiErrorMessage`.
3. Surface `failure_reason` in a `ui/tooltip` or an expandable cell so an admin can see *why* it
   failed before retrying.

**Acceptance**
```bash
cd frontend && npm run test:run
```

## P4-803 — Admin section tests

**Story:** US-021

**Files**
- `frontend/src/modules/anonymous-messages/pages/__tests__/AdminAnonymousMessagesPage.test.tsx` (new)

**Subtasks**
1. Rows render with the right badge per status.
2. Retry appears only on FAILED rows and calls the API once.
3. The status filter refetches with the right params.
4. An empty result renders the empty state.

**Acceptance**
```bash
cd frontend && npm run test:run
```

## P4-804 — Sidebar wiring check

**Story:** US-021, US-022

**Subtasks**
1. Verify `admin.nav.messages` is hidden for SERVANT and visible for ADMIN, and that the active state
   lights up on `/admin/anonymous-messages`.
2. Verify all four disabled items still render disabled with the tooltip (D-8).

**Acceptance**
```bash
cd frontend && npm run test:run
```

---

# 14. Verbatim Copy (design-accurate)

Add to `frontend/src/i18n/resources/ar.ts` **first**, then `en.ts` (§0.10). Reworded items are
marked **(D-14)** and are the only deviations from the screenshots.

## 14.1 `notifications`

| Key | English | العربية |
| --- | --- | --- |
| `title` | Notifications | الإشعارات |
| `subtitle` | Stay updated with what's happening. | ابق على اطلاع دائم بكل ما يحدث. |
| `tabs.all` | All | الكل |
| `tabs.unread` | Unread | غير المقروءة |
| `tabs.announcements` | Announcements | الإعلانات |
| `tabs.reminders` | Reminders | التذكيرات |
| `tabs.system` | System | النظام |
| `actions.markAllRead` | Mark all as read | تحديد الكل كمقروء |
| `actions.filter` | Filter | تصفية |
| `filter.allTime` | All time | كل الأوقات |
| `filter.today` | Today | اليوم |
| `filter.last7` | Last 7 days | آخر ٧ أيام |
| `filter.last30` | Last 30 days | آخر ٣٠ يومًا |
| `badges.new` | New | جديد |
| `badges.unread` | `{{count}} unread` | `{{count}} غير مقروءة` |
| `empty.title` | No notifications yet | لا توجد إشعارات بعد |
| `empty.body` | Announcements, reminders and updates will appear here. | ستظهر هنا الإعلانات والتذكيرات والتحديثات. |
| `error.title` | Could not load notifications | تعذّر تحميل الإشعارات |
| `error.body` | Check your connection and try again. | تحقق من اتصالك وحاول مرة أخرى. |
| `infoCards.0.title` | Stay Updated | ابق على اطلاع |
| `infoCards.0.description` | Get real-time updates about events, meetings, and announcements. | احصل على تحديثات فورية عن الفعاليات والاجتماعات والإعلانات. |
| `infoCards.1.title` | Never Miss Out | لا تفوّت أي شيء |
| `infoCards.1.description` **(D-14)** | Announcements, reminders and events all land here in one place. | الإعلانات والتذكيرات والفعاليات كلها تصلك في مكان واحد. |
| `infoCards.2.title` **(D-14)** | Filter your view | رتّب إشعاراتك |
| `infoCards.2.description` **(D-14)** | Use the tabs to see announcements, reminders or system notices only. | استخدم التصنيفات لعرض الإعلانات أو التذكيرات أو إشعارات النظام وحدها. |
| `infoCards.3.title` | Connected | متصل دائمًا |
| `infoCards.3.description` | Stay connected with your community and grow together in faith. | ابق على تواصل مع مجتمعك وانمُ معًا في الإيمان. |
| `toast.markedAllRead` | All notifications marked as read | تم تحديد كل الإشعارات كمقروءة |
| `admin.title` | Notifications | الإشعارات |
| `admin.subtitle` | Review and send announcements. | راجع الإعلانات وأرسل إشعارًا جديدًا. |
| `admin.composer.title` | Send an announcement | إرسال إعلان |
| `admin.composer.titleAr` | Title (Arabic) | العنوان (بالعربية) |
| `admin.composer.titleEn` | Title (English) | العنوان (بالإنجليزية) |
| `admin.composer.messageAr` | Message (Arabic) | الرسالة (بالعربية) |
| `admin.composer.messageEn` | Message (English) | الرسالة (بالإنجليزية) |
| `admin.composer.ctaUrl` | Link (optional) | رابط (اختياري) |
| `admin.composer.sendEmail` | Also send by email | إرسالها بالبريد الإلكتروني أيضًا |
| `admin.composer.submit` | Send to everyone | إرسال إلى الجميع |
| `admin.composer.submitting` | Sending… | جارٍ الإرسال… |
| `admin.confirm.title` | Send this by email too? | إرسالها بالبريد الإلكتروني أيضًا؟ |
| `admin.confirm.body` | Every active member with a verified email will receive it. This may take a while. | سيستلمها كل عضو نشِط ببريد إلكتروني مُوثّق. قد يستغرق ذلك بعض الوقت. |
| `admin.confirm.cancel` | Cancel | إلغاء |
| `admin.confirm.confirm` | Send | إرسال |
| `toast.pushed` | `Announcement sent · {{sent}} emails delivered, {{failed}} failed` | `تم إرسال الإعلان · {{sent}} رسالة بريد ناجحة و{{failed}} فاشلة` |
| `toast.pushFailed` | Could not send the announcement | تعذّر إرسال الإعلان |

## 14.2 `anonymousMessages`

| Key | English | العربية |
| --- | --- | --- |
| `title` | Anonymous Message | رسالة مجهولة |
| `subtitle` | Share your message with confidence and peace of mind | شاركنا رسالتك بكل أمان وسرية |
| `card.title` | Send Your Message | أرسل رسالتك المجهولة |
| `card.subtitle` | `We're here to listen and connect with you. Your message is <0>100% secure</0>.` | `نحن هنا لنستمع إليك ونتصل بك من أجلك. رسالتك <0>آمنة وسرية 100%</0>.` |
| `anonymityNotice.title` | Your message will remain completely anonymous | رسالتك ستكون مجهولة تمامًا |
| `anonymityNotice.body` | We will not display your name or any identifying information with your message. | لن يتم عرض اسمك أو أي معلومات تعريفية مع رسالتك. |
| `form.name` | Your Name (Optional) | الاسم (اختياري) |
| `form.namePlaceholder` | Enter your name if you'd like | اكتب اسمك إن أردت |
| `form.nameHint` | Leave blank if you prefer to remain anonymous. | اتركه فارغًا إذا كنت تريد أن تبقى مجهولاً. |
| `form.phone` **(DR-7)** | Phone Number (Optional) | رقم الهاتف (اختياري) |
| `form.phonePlaceholder` | Enter your phone number if you'd like | اكتب رقم هاتفك إن أردت |
| `form.phoneHint` | Leave blank if you do not want to share your phone number. | اتركه فارغًا إذا كنت لا تريد ترك رقمك. |
| `form.message` | Your Message | رسالتك |
| `form.messagePlaceholder` | Write your message here… | اكتب رسالتك هنا… |
| `form.counter` | `{{count}} / {{max}}` | `{{count}} / {{max}}` |
| `form.submit` | Send Message | إرسال الرسالة |
| `form.submitting` | Sending… | جارٍ الإرسال… |
| `form.footnote` | All messages are handled with care, confidentiality, and respect. | جميع الرسائل تُعامل بسرية تامة وتُستخدم فقط لغرض الخدمة والصلاة. |
| `validation.messageRequired` | Please write your message. | من فضلك اكتب رسالتك. |
| `validation.messageMin` | `Your message must be at least {{min}} characters.` | `يجب أن تكون رسالتك {{min}} حرفًا على الأقل.` |
| `validation.messageMax` | `Your message must not exceed {{max}} characters.` | `يجب ألا تزيد رسالتك عن {{max}} حرفًا.` |
| `validation.nameMax` | The name is too long. | الاسم طويل جدًا. |
| `validation.phoneInvalid` | Please enter a valid phone number. | من فضلك اكتب رقم هاتف صحيحًا. |
| `validation.rateLimited` | You have sent several messages already. Please try again later. | لقد أرسلت عدة رسائل بالفعل. حاول مرة أخرى بعد قليل. |
| `topics.title` | You can send messages about: | يمكنك إرسال رسائل عن: |
| `topics.items.0` | Prayer request | طلب صلاة |
| `topics.items.1` | Praise report | شكر لله على نعمة |
| `topics.items.2` | Need advice or encouragement | طلب نصيحة روحية |
| `topics.items.3` | Participate or provide feedback | مشاركة هموم أو ضغوط |
| `importantInfo.title` | Important Information | معلومات مهمة |
| `importantInfo.items.0.title` | Fully Confidential | سرية تامة |
| `importantInfo.items.0.description` | We do not share your message with anyone outside our team. | لن نشارك رسالتك مع أي شخص خارج فريق الخدمة. |
| `importantInfo.items.1.title` | 100% Anonymous | مجهولية كاملة |
| `importantInfo.items.1.description` | Your name and information will never be displayed with your message. | اسمك ومعلوماتك لن تُظهر أبدًا مع رسالتك. |
| `importantInfo.items.2.title` **(D-14)** | Every message is read | كل رسالة تُقرأ |
| `importantInfo.items.2.description` **(D-14)** | Our servants read every message and pray over it. | يقرأ الخدام كل رسالة ويصلّون من أجلها. |
| `beforeYouSend.title` | Before You Send | قبل إرسال رسالتك |
| `beforeYouSend.items.0` | Make sure your message is clear and within the guidelines. | تأكد من أن رسالتك واضحة ومحددة قدر الإمكان. |
| `beforeYouSend.items.1` | We are here to support you spiritually and emotionally. | نحن هنا لدعمك روحيًا والصلاة من أجلك. |
| `beforeYouSend.items.2` | Trust that God hears you and we stand with you. | ثق أن الله يسمع صلاتك ويهتم بك دائمًا. |
| `beforeYouSend.items.3` | For urgent matters, please contact us directly via phone or visit the church. | للتواصل المباشر، يمكنك زيارة الكنيسة أو التواصل مع أحد الخدام. |
| `success.title` | Your message has been received | تم استلام رسالتك |
| `success.body` | Thank you for trusting us. We will read it and pray for you. | شكرًا لثقتك بنا. سنقرأ رسالتك ونصلّي من أجلك. |
| `success.sendAnother` | Send another message | إرسال رسالة أخرى |
| `admin.title` | Anonymous Messages | الرسائل المجهولة |
| `admin.subtitle` | Review the messages received by the service. | راجع الرسائل التي وصلت إلى الخدمة. |
| `admin.filters.all` | All | الكل |
| `admin.table.createdAt` | Received | وقت الاستلام |
| `admin.table.message` | Message | الرسالة |
| `admin.table.name` | Name | الاسم |
| `admin.table.phone` | Phone | الهاتف |
| `admin.table.status` | Status | الحالة |
| `admin.table.telegram` | Telegram | تليجرام |
| `admin.table.attempts` | Attempts | المحاولات |
| `admin.table.notProvided` | Not provided | غير مذكور |
| `admin.status.PENDING` | Pending | قيد الانتظار |
| `admin.status.SENT` | Sent | تم الإرسال |
| `admin.status.FAILED` | Failed | فشل |
| `admin.retry.action` | Retry | إعادة المحاولة |
| `admin.retry.success` | Message delivered | تم توصيل الرسالة |
| `admin.empty.title` | No messages yet | لا توجد رسائل بعد |
| `admin.empty.body` | Messages sent from the anonymous page will appear here. | ستظهر هنا الرسائل المُرسلة من صفحة الرسائل المجهولة. |

## 14.3 `admin.nav` and backend notification copy

| Key | English | العربية |
| --- | --- | --- |
| `admin.nav.section` | Admin | الإدارة |
| `admin.nav.dashboard` | Dashboard | لوحة التحكم |
| `admin.nav.members` | Members | الأعضاء |
| `admin.nav.attendance` | Attendance | الحضور |
| `admin.nav.checkIn` | Check-in | تسجيل الحضور |
| `admin.nav.history` | History | السجل |
| `admin.nav.events` | Events | الفعاليات |
| `admin.nav.messages` | Messages | الرسائل |
| `admin.nav.notifications` | Notifications | الإشعارات |
| `admin.nav.reports` | Reports | التقارير |
| `admin.nav.settings` | Settings | الإعدادات |

Backend copy builders (`app/modules/notifications/application/copy.py`, stored per notification):

| Builder | `title_en` / `title_ar` | `message_en` / `message_ar` |
| --- | --- | --- |
| `attendance_recorded_copy` (PRESENT) | Attendance Recorded · تم تسجيل الحضور | `Your attendance for the meeting on {date} has been recorded.` · `تم تسجيل حضورك في اجتماع {date}.` |
| `attendance_recorded_copy` (LATE) | Attendance Recorded · تم تسجيل الحضور | `Your attendance for the meeting on {date} has been recorded as late.` · `تم تسجيل حضورك في اجتماع {date} كمتأخر.` |
| `blog_post_published_copy` | `New post: {title_en}` · `منشور جديد: {title_ar}` | `A new post has been published. Read it now.` · `تم نشر موضوع جديد. اقرأه الآن.` |

## 14.4 Telegram message format (`telegram/formatter.py`)

```text
🕊️ <b>رسالة مجهولة جديدة</b> — New anonymous message

{message}

—
الاسم / Name: {sender_name or "غير مذكور / not provided"}
الهاتف / Phone: {sender_phone or "غير مذكور / not provided"}
المعرّف / Ref: {id_first_8}
الوقت / Time: {created_at in PLATFORM_TIMEZONE}
```

Every interpolated value is HTML-escaped. No IP, user id, user agent or token ever appears (BR-11).

---

# 15. Stage I — Tests, Documentation, Hardening

## P4-901 — i18n parity test

**Files:** `frontend/src/i18n/__tests__/parity.test.ts` (new)

Recursively compare the key sets of `ar` and `en`, including array lengths. Report the full list of
missing keys per side, not just the first. This is a permanent guard, not a Phase 4 one-off.

```bash
cd frontend && npm run test:run
```

## P4-902 — RTL regression guard

**Files:** `frontend/src/test/__tests__/logical-properties.test.ts` (new) · **Rule:** BR-17

Scan `src/**/*.tsx` for banned physical classes (`ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`,
`text-left`, `text-right`, `border-l`, `border-r`, `rounded-l`, `rounded-r`, `space-x-`) inside
`className` strings. Fail with `file:line` per hit. Allowlist, with a one-line justification each:
the "deliberately untouched" primitives from Part 1 §3.11, the landing decorative offsets, the
`left-[50%]` dialog centering, and `ScannerFrame`. Every allowlist entry needs a comment — an
unexplained entry is how this test dies.

```bash
cd frontend && npm run test:run
```

## P4-903 — Backend hardening pass

**Subtasks**
1. `grep -rn "datetime.now()" app | grep -v core/time/clock.py` must print nothing (DEF-2).
2. `mypy app` must pass with no new ignores. Do not add `# type: ignore` to make it green.
3. Make `mypy` blocking in `.github/workflows/backend-ci.yml` (it is `continue-on-error: true` today,
   already flagged as a risk by Phase 2). If that turns CI red, fix the types.
4. Confirm no endpoint logs a message body, a phone number or a name.

```bash
cd backend && ruff check . && ruff format --check . && DEBUG=true .venv/bin/python -m mypy app
```

## P4-904 — Frontend accessibility pass

**Subtasks**
1. Keyboard: tabs, filter menu, mark-all-read, pagination and the retry button are all reachable and
   operable, with visible `focus-ring` states.
2. The unread indicator is never colour-only (`Design-Guide.md:992`) — it always has text or an
   `sr-only` label.
3. Heading hierarchy on both new pages is `h1 → h2 → h3` with no skips.
4. Every icon is either `aria-hidden` or labelled. Every image has meaningful `alt` or `alt=""`.
5. Contrast check for mint-on-white text and every badge, in light and dark.

```bash
cd frontend && npm run build && npm run test:run
```

## P4-905 — Responsive pass

Verify at 1440px, 768px and 375px, in `ar` and `en`: the brand panel hides below `md`; the sidebar
becomes a sheet; tabs scroll horizontally instead of wrapping; the notification row's time block
moves below the text on mobile; the two info cards stack; the topics list collapses to one column;
the table scrolls horizontally without breaking the page (`Design-Guide.md:942-977`).

## P4-906 — Documentation

**Files**
- `docs/database/DATABASE_DESIGN.md`, `docs/database/IMPLEMENTATION_REPORT.md`
- `docs/Agile/phase-4/phase-4.md`
- `frontend/src/routes/README.md`
- `backend/.env.example`

**Subtasks**
1. Add `notification_reads` to the table list, the Mermaid ERD and the constraint table.
2. Update the `notifications` entry: bilingual columns, `read_at` marked legacy.
3. Update the `anonymous_messages` entry and **restate the anonymity guarantee as "no account
   linkage"** (D-1), replacing the current "no identity columns" wording in both docs.
4. Append a short "Delivered in Phase 4" section to `docs/Agile/phase-4/phase-4.md` mapping each
   backlog line to its task id, and explicitly noting that "New post email" shipped as a
   consumer only (D-13).
5. Confirm `routes/README.md` matches `router.tsx` exactly.

## P4-907 — Full suite and CI

```bash
cd backend && DEBUG=true APP_ENV=test .venv/bin/python -m pytest -q \
  && ruff check . && ruff format --check . && DEBUG=true .venv/bin/python -m mypy app
cd ../frontend && npx tsc -b && npm run lint && npm run test:run && npm run build
```

## P4-908 — Manual verification script

Walk the demo scenario in §19 end to end, in Arabic **and** English, in light **and** dark mode, with
a real `TELEGRAM_BOT_TOKEN` in a scratch chat. Record the result per step. A step that was not run is
not verified.

---

# 16. Test Matrix

| Requirement | Level | Where |
| --- | --- | --- |
| BR-1 feed = own + broadcast | integration (db) | `tests/integration/database/test_notifications.py` |
| BR-2 per-user read state, broadcast isolation | integration (db) | same |
| BR-3 `mark_read` idempotent | integration + api | same + `tests/unit/api/v1/test_notifications.py` |
| BR-4 `mark_all_read` ignores the active tab | integration | same |
| BR-5 both languages required | unit (dto) | `tests/unit/notifications/test_notification_dto.py` |
| BR-6 push is ADMIN-only + audited | api | `tests/unit/api/v1/test_notifications.py` |
| BR-7 foreign notification → 404 | api | same |
| BR-8 email fan-out targets active+verified only | integration | `tests/integration/notifications/` |
| BR-9 blog consumer | unit | `tests/unit/notifications/test_notification_service.py` |
| BR-10 check-in notification never breaks check-in | integration | `tests/integration/attendance/` |
| BR-11 no identity columns / no identity in responses | integration (db) + api | `test_anonymous_messages.py` |
| BR-12 hashed rate-limit keys | unit | `tests/unit/test_rate_limit.py` |
| BR-13 delivery failure still returns 201 | api | `tests/unit/api/v1/test_anonymous_messages.py` |
| BR-14 retry only from FAILED, audited | api | same |
| BR-15 429 + `Retry-After` | api | same |
| BR-16 message/name/phone bounds | unit + component | dto tests + `AnonymousMessagePage.test.tsx` |
| BR-17 logical properties everywhere | static | `logical-properties.test.ts` |
| D-4 bell polling + badge formatting | component | `NotificationBell.test.tsx` |
| D-8 disabled sidebar items | component | `AdminSidebar` test |
| D-15 `/admin` tree + legacy redirects | component | `layouts.test.tsx` |
| i18n `ar`/`en` parity | static | `parity.test.ts` |
| Migration up/down/up | manual + CI | P4-101 acceptance |

---

# 17. Execution Timeline (10 working days)

| Day | Backend | Frontend |
| --- | --- | --- |
| 1 | P4-001 → P4-003 (baseline), P4-101 (migration) | P4-301 → P4-303 (config + RTL) |
| 2 | P4-102, P4-103, P4-104 | P4-304 → P4-306 (tokens, theme, Amiri) |
| 3 | P4-105, P4-106 | P4-307 → P4-309 (brand, i18n, footer) |
| 4 | P4-107, P4-108, P4-109 | P4-310, P4-311 (`/admin` tree + sidebar) |
| 5 | P4-110 (notification tests) | P4-401 → P4-403 (bell) |
| 6 | P4-201, P4-202 (rate limit, Telegram) | P4-501 (shared feed components) |
| 7 | P4-203 → P4-205 | P4-502, P4-503 (member page) |
| 8 | P4-206, P4-207 | P4-601 → P4-603 (admin page + composer) |
| 9 | P4-208 (anonymous tests) | P4-701 → P4-704 (anonymous page) |
| 10 | P4-903, P4-906, P4-907 | P4-801 → P4-804, P4-901, P4-902, P4-904, P4-905, P4-908 |

Day 10 is heavy on purpose: everything on it is verification, not new surface. If Stage G or H slips,
cut it to Sprint 4b (§4) rather than shipping Stage I partially — an unverified feature is worse than
a deferred one.

---

# 18. Definition of Ready / Done

## 18.1 Definition of Ready (must be true before Day 1)

**Product owner**
- [ ] The 44-point scope is accepted, or the Sprint 4a/4b split in §4 is agreed.
- [ ] Real Instagram / Facebook / YouTube URLs are supplied (D-19, blocks P4-309).
- [ ] The three reworded copy items in Part 1 §1.5 are approved (D-14).
- [ ] The canonical brand name (D-18) is confirmed for print/social use too.

**Environment**
- [ ] A Telegram bot exists, `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are available for a scratch
      chat, and the bot has been added to it.
- [ ] `MAIL_PROVIDER` is decided per environment. Brevo is recommended for any environment that will
      run a real broadcast; Gmail SMTP will throttle a bulk fan-out (R-1).
- [ ] The credentials currently in `backend/.env` are rotated (they were shared in plain text).
- [ ] Local Postgres is reachable on port 55432.

**Engineering**
- [ ] Part 1 §0–§3 has been read by whoever implements this.
- [ ] The green baseline from P4-003 is recorded.

## 18.2 Definition of Done (per task)

- [ ] The task's Acceptance block ran green, and the output is in the PR.
- [ ] No frozen contract from Part 1 §3 changed without an escalation.
- [ ] `ruff`, `ruff format`, `mypy` clean for touched backend paths; `tsc -b` and `eslint` clean for
      touched frontend paths.
- [ ] New behaviour has a test at the level named in §16.
- [ ] Arabic keys were added before English ones, and both files are in parity.
- [ ] The change was checked visually in `ar` **and** `en`, light **and** dark.

## 18.3 Definition of Done (sprint)

- [ ] Every checklist item in `docs/Sprint-Guide.md:32-51` is satisfied.
- [ ] `Design-Guide.md` §32 Final Quality Check passes for both new pages.
- [ ] Migration `e3b7d1c95f42` applies and rolls back cleanly on a copy of production data.
- [ ] No `TODO` remains except the single documented `TODO(phase-blog)` from P4-105.
- [ ] `docs/database/*` and `frontend/src/routes/README.md` match the shipped code.
- [ ] The full test matrix in §16 is green.

---

# 19. Sprint Review — Demo Scenario

```text
1.  Sign in as ADMIN. The navbar bell shows no badge.
2.  Go to /admin/notifications. The sidebar matches the design: Dashboard, Members (disabled),
    Attendance (Check-in, History), Events (disabled), Messages, Notifications (active),
    Reports (disabled), Settings (disabled).
3.  Compose an announcement: Arabic and English title and message, "also send email" ON.
    Confirm the dialog. A toast reports the delivered/failed email counts.
4.  The feed shows the new announcement with a mint accent and a "New" pill. The bell shows 1.
5.  Switch the language to English. The same notification renders in English, layout flips to LTR,
    nothing shifts or overlaps. Switch to dark mode: brand colours hold.
6.  Sign in as a MEMBER in another browser. The bell shows 1 (the broadcast).
    Open /notifications: the member page shows the same announcement in the public shell.
7.  Click the notification. It is marked read; the member's badge clears.
8.  Back in the ADMIN browser, the badge still shows 1 — read state is per user (BR-2, DEF-1 fixed).
9.  ADMIN marks all as read. Badge clears.
10. As SERVANT, check the member in at /admin/attendance/check-in. The member's bell increments and
    the Reminders tab shows "Attendance Recorded" (BR-10).
11. Sign out entirely. Open /anonymous-messages as a visitor. Send a message with no name and no
    phone. The success state appears.
12. The Telegram group receives the message with "not provided" for name and phone.
13. Send a second message with a name and a phone. Telegram shows both.
14. Send four more within the hour. The sixth is refused with the rate-limit message (BR-15).
15. As ADMIN, open /admin/anonymous-messages. Both messages are listed as SENT with attempts = 1.
    The names and phones are visible; nothing links a message to an account.
16. Break the Telegram token in the environment, send another message: the sender still sees success,
    the admin list shows FAILED with a reason. Restore the token and click Retry: it flips to SENT.
17. As SERVANT, visit /admin/anonymous-messages: the visible 403 page appears.
18. Open /admin/attendance/dashboard via the old /attendance/dashboard URL: it redirects.
```

---

# 20. Risks

| # | Risk | Impact | Mitigation |
| --- | --- | --- | --- |
| **R-1** | Inline email fan-out (D-3, BR-8) blocks the admin's request for the whole broadcast, and Gmail SMTP will throttle or block bulk sending. | A broadcast to a few hundred members times out at the proxy; the notification is created but emails are partially sent. | `NOTIFICATION_EMAIL_CONCURRENCY`; the confirmation dialog warns; the response reports sent/failed counts; **recommend Brevo for any environment that broadcasts**. If member count passes ~500, revisit D-3 and add a worker. |
| **R-2** | A Telegram outage leaves messages FAILED until an admin notices (no automatic retry, D-3). | Pastoral-care messages are delayed. | Messages are never lost (BR-13); the admin list defaults to showing FAILED first when any exist; §19 step 16 proves the recovery path. A future worker can reuse the untouched `claim_pending`. |
| **R-3** | In-memory rate limits (D-22) reset on restart and are per instance. | On a multi-instance or frequently redeployed host the effective limit is higher than configured. | Documented in the limiter docstring and here. Escalate to the persistent option only if abuse is observed. |
| **R-4** | Moving the attendance routes under `/admin/*` (D-15) breaks existing bookmarks and any external link. | Users hit 404s. | Four legacy redirects (P4-310) plus a grep gate in the acceptance block. |
| **R-5** | Editing 13 vendored shadcn primitives for RTL (D-16) will be overwritten by a future `shadcn add`. | Silent RTL regression. | `components.json` fixed (P4-301) and the static test in P4-902 fails the build if a physical property reappears. |
| **R-6** | The `index.css` de-duplication (P4-305) is a pure refactor of a file that three `@theme` blocks currently override in sequence. | Subtle colour drift across the whole app. | Before/after screenshots in six combinations are part of the task; the task is reverted rather than "fixed forward" if anything shifts. |
| **R-7** | `sender_name` / `sender_phone` (D-1) weaken the anonymity story: a submitter may type a name without realising an admin will see it. | Trust damage. | The form states it twice (`anonymityNotice`, `nameHint`), the fields are clearly optional, and `importantInfo` repeats it. No account linkage is ever stored (BR-11). |
| **R-8** | Notification copy is stored, not translated, so fixing a typo in a sent announcement is impossible. | Permanent typos in the feed. | Accepted consequence of D-6. The composer previews both languages before sending. |
| **R-9** | 44 points against a 30-point Phase 2 baseline. | Stage I gets squeezed and quality slips. | The §4 split is agreed at DoR time, not on Day 9. |

---

# 21. Out of Scope

Explicitly **not** in Phase 4. Do not build these, and do not leave hooks for them beyond what is
named here.

- Any background worker, queue, cron, Celery, Redis or broker (D-3, `Sprint-Guide.md:157-184`).
- Websockets, SSE, service workers, browser push or FCM (D-4).
- Per-user notification preferences, an unsubscribe flow or a Settings page (D-12; the design's
  "preferences in settings" copy is reworded instead, D-14).
- A `users.locale` column or any backend i18n/`Accept-Language` handling (D-6).
- New `NotificationType` values (D-5).
- Blog publishing, blog endpoints or the blog UI. Only the dormant consumer ships (D-13).
- Consumers for `attendance.excused`, `user.registered`, `user.banned`, `comment.created` (D-21).
- A second Telegram destination, Telegram operational alerting, or an inbound Telegram webhook (D-20).
- Replying to an anonymous message from the admin panel, a handled/archived flag or internal notes
  (D-11).
- Role-targeted or single-user push, scheduled push, or push templates (D-10).
- Notification retention, archiving or purging (D-27).
- An auth context/provider to replace the per-render `localStorage` reads (DEF-16 is mitigated for
  the bell only; the wider refactor is its own task).
- Members, Events, Reports and Settings admin sections — rendered disabled only (D-8).
- Converting the vendored primitives nothing renders (`context-menu`, `menubar`,
  `navigation-menu`, `carousel`, `resizable`) to logical properties (D-16).
- Real footer phone/email/address. Only the social URLs become real (D-19).
