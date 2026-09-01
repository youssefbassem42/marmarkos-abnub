# Phase 5 Implementation Plan — Part 2 of 2 (Executable Tasks)

**Part 1 (spec, decisions, frozen contracts):** `docs/Agile/phase-5/phase-5-implementation-plan.md`
Read Part 1 §0–§10 before starting. Every `D-n` / `BR-n` reference below points there.

## How to read a task

```text
P5-nnn — <title>                     [wave] [story] [estimate]
Goal        one sentence, testable
Depends on  task ids
Files       exact paths (read them before writing)
Subtasks    ordered, each independently reviewable
Acceptance  the commands and assertions that must pass before the task is done
```

Backend commands are always prefixed: `cd backend && DEBUG=true APP_ENV=test .venv/bin/python -m …`
Migrations always override the DB: `DATABASE_URL=postgresql+asyncpg://marmarkos:marmarkos@localhost:55432/marmarkos_test`

---

# Workstream A — Foundation (wave 5A)

## P5-001 — ISO period helpers `core/time/periods.py` [5A] [US-026] [S]

**Goal** One place computes Monday-ISO weeks and month periods (D-5); attendance's Thursday week is untouched.
**Depends on** —
**Files** `backend/app/core/time/periods.py` (new) · `backend/app/core/time/__init__.py` · `backend/tests/unit/core/test_periods.py` (new)
**Subtasks**
1. Implement `iso_week_start`, `iso_week_end`, `month_start`, `month_bounds`, `week_window_utc`, `month_window_utc`, `last_n_months` exactly as Part 1 §4.8.
2. `week_window_utc` / `month_window_utc` build local midnight boundaries with `platform_timezone()` and return aware UTC datetimes (mirror `absence_service.py`'s `local_datetime(...).astimezone(UTC)` idiom).
3. Re-export from `core/time/__init__.py`.
4. Unit-test: Monday/Sunday edges, month rollover, leap February, DST-free Cairo offsets, `last_n_months` ordering and length.
**Acceptance** `pytest tests/unit/core/test_periods.py` green · `mypy app` green · no `date.today()`/`datetime.now()` added outside `core/time`.

## P5-002 — New error codes [5A] [all] [XS]

**Goal** Every Phase 5 failure has a stable code (Part 1 §5.9).
**Files** `backend/app/core/exceptions/errors.py` · `backend/app/core/exceptions/__init__.py`
**Subtasks** Add the 14 `AppError` subclasses with their status codes; support an optional `data: dict` payload on `quiz_not_publishable` and `attempt_exists` (extend the handler in `handlers.py` to merge `exc.data` into `detail` when present, keeping the existing envelope shape).
**Acceptance** `pytest tests/unit/core` green · a handler test asserts `{"detail": {"code", "message", "data"}}` for a data-carrying error and the unchanged 2-key shape otherwise.

## P5-003 — Phase 5 settings [5A] [all] [XS]

**Files** `backend/app/config.py` · `backend/.env.example` · `backend/README.md` (cron section)
**Subtasks** Add the `# -- Bible verses, quizzes & points (Phase 5) ---` block verbatim from Part 1 §6; mirror into `.env.example`; document the one-minute cron invocation.
**Acceptance** App boots with none of the new vars set (all have defaults; `CRON_SECRET` may be `None`) · `mypy app` green.

## P5-004 — Migration `p5_a`: verse lifecycle, schedules, engagement [5A] [US-020/021/022] [M]

**Goal** `bible_verses` matches Part 1 §4.2 and the three new tables exist, with a working downgrade.
**Depends on** P5-005 (models must exist for autogenerate; write models first, then hand-tidy the revision)
**Files** `backend/alembic/versions/<rev>_phase_5a_….py` (new, `down_revision = "e3b7d1c95f42"`)
**Subtasks**
1. `bible_verses`: add `status` nullable → backfill from `is_published` → NOT NULL + default; same backfill-then-NOT-NULL for `title`, `book`, `chapter`, `verse_start`; add nullable `subtitle`, `verse_end`, `reflection`.
2. Drop `uq_bible_verses_published_week`; make `week_start_date` nullable; drop `is_published`.
3. Add `ck_bible_verses_chapter`, `ck_bible_verses_verse_range`, `ix_bible_verses_status_published_at`, `ix_bible_verses_created_by`.
4. Create `verse_publication_schedules`, `verse_views`, `verse_reads` with every index in Part 1 §4.3/§4.4 (including the two partial unique indexes).
5. Implement `downgrade()` fully: recreate `is_published` from `status`, restore the weekly partial unique index, drop the new tables/columns in reverse order.
**Acceptance** `DATABASE_URL=…scratch alembic upgrade head` then `alembic downgrade -1` then `upgrade head` again, all clean · `alembic check` reports no pending autogenerate diff after P5-005 · comments in the file cite BR/D ids.

## P5-005 — Bible models, enums, repositories [5A] [US-020/021/022] [M]

**Files**
`backend/app/modules/bible/domain/enums/{verse_status.py,schedule_status.py,notification_status.py,__init__.py}` ·
`backend/app/modules/bible/domain/{entities/,events/bible_verse_published.py,interfaces.py}` ·
`backend/app/modules/bible/infrastructure/persistence/{models.py,verse_repository.py,schedule_repository.py,engagement_repository.py}` ·
`backend/app/shared/infrastructure/persistence/{registry.py,unit_of_work.py}` ·
`backend/app/modules/users/infrastructure/persistence/models.py`
**Subtasks**
1. `VerseStatus`, `ScheduleStatus`, `NotificationDeliveryStatus` as `StrEnum`; columns use `SAEnum(..., native_enum=False, length=20)`.
2. Extend `BibleVerse` per §4.2 (keep `verse_reference`, `text`, `translation`, `image`, `published_at`, `week_start_date`, `created_by`); remove `is_published`; add `__table_args__` checks/indexes; add `schedule`, `quiz`, `views`, `reads` relationships with `lazy="raise"` defaults.
3. New models `VersePublicationSchedule`, `VerseView`, `VerseRead`.
4. `BibleVerseRepository`: keep existing methods, add `list_for_manager(filters, page)`, `count_for_manager`, `status_counts()`, `list_published(filters, page, user_id)`, `get_current_published()`, `get_for_member(id, user_id)`, `set_status(...)`.
5. `VerseScheduleRepository`: `add`, `get_active_for_verse`, `claim_due(limit, now)` (`FOR UPDATE SKIP LOCKED`), `mark_published`, `mark_failed`, `mark_cancelled`, `set_notification_status`, `list_for_manager`.
6. `VerseEngagementRepository`: `record_open(verse_id, user_id, dedupe_seconds)` (returns bool inserted), `mark_read(...)` via `on_conflict_do_nothing` returning `rowcount`, `has_read`, `read_map_for_verses(verse_ids, user_id)`, plus the aggregate methods used by analytics (`open_counts_for_verses`, `read_counts_for_verses`, `verse_metrics(verse_id)`, `engagement_series(verse_id, granularity, window)`, `user_engagement_page(...)`).
7. Register the 4 UoW properties; import models in `registry.py`; add the two `User` relationships.
8. `BibleVersePublished` domain event (frozen dataclass, `event_type = "bible_verse.published"`, payload: `verse_id`, `schedule_id`, `creator_id`, `verse_reference`, `title`, `published_at`).
**Acceptance** `pytest tests/integration/database/test_bible.py` (extended) green: status default, partial unique index on active schedules rejects a second `SCHEDULED` row, `verse_reads` unique pair rejects duplicates, FK cascades delete children · `mypy app` green.

## P5-006 — Quiz models and repositories [5A] [US-023/024/025] [M]

**Files** `backend/app/modules/quiz/**` (new module, full 4-layer skeleton) · `registry.py` · `unit_of_work.py` · `users/.../models.py`
**Subtasks**
1. Enums `QuizStatus`, `AttemptStatus`.
2. Models `Quiz`, `QuizQuestion`, `QuizOption`, `QuizAttempt`, `QuizAnswer` per Part 1 §4.5/§4.6 with every constraint/index.
3. `QuizRepository` (`add`, `get_by_id`, `get_by_verse`, `get_with_questions`, `list_for_manager`, `recompute_total_points`, `set_status`).
4. `QuizQuestionRepository` (`add`, `get_by_id`, `list_for_quiz`, `delete`, `reorder(quiz_id, ordered_ids)`, `next_position`).
5. `QuizOptionRepository` (`replace_for_question(question_id, options)` — single-transaction diff per D-13, `get_correct_option_ids(question_ids)`).
6. `QuizAttemptRepository` (`add`, `get_by_id`, `get_for_user_and_quiz`, `claim_expired(limit, now)`, `finalise(...)`, aggregate methods for analytics: `quiz_kpis`, `score_distribution`, `completion_status_counts`, `user_results_page`, `monthly_kpis`, `monthly_user_page`, `counts_by_month`).
7. `QuizAnswerRepository` (`upsert(attempt_id, question_id, option_id)`, `list_for_attempt`, `grade_bulk(...)`).
8. Register 5 UoW properties, registry import, `User.quiz_attempts` relationship.
**Acceptance** New `tests/integration/database/test_quiz.py`: `uq_quizzes_verse_id` blocks a second quiz per verse; `uq_quiz_options_correct` blocks two correct options on one question; `uq_quiz_attempts_quiz_user` blocks a second attempt; `uq_quiz_answers_attempt_question` upsert path works; duration check constraint rejects 10 s and 8000 s · `mypy app` green.

## P5-007 — Points models, repository, migration `p5_b` [5A] [US-025/026] [M]

**Files** `backend/app/modules/points/**` (new) · `backend/alembic/versions/<rev>_phase_5b_….py` · `registry.py` · `unit_of_work.py` · `users/.../models.py`
**Subtasks**
1. `PointSource` enum (`QUIZ`), `PointTransaction` model per §4.6 (unique `quiz_attempt_id`, `period_week_start`, `period_month`, check `points >= 0`).
2. `PointTransactionRepository`: `award(...)` using `on_conflict_do_nothing(index_elements=["quiz_attempt_id"])` returning the existing row when present, `totals_for_user`, `monthly_series_for_user`, `history_page`, `month_totals_for_users`, `sparkline_for_users(user_ids, months)`, `month_leaderboard`.
3. Migration `p5_b` creating `quizzes`, `quiz_questions`, `quiz_options`, `quiz_attempts`, `quiz_answers`, `point_transactions` with all indexes, `down_revision = <p5_a>`, full `downgrade()`.
4. Register UoW property, registry import, `User.point_transactions`.
**Acceptance** `upgrade head` → `downgrade -1` → `upgrade head` clean · `tests/integration/database/test_points.py`: double `award` for the same attempt yields exactly one row and identical points; `period_month`/`period_week_start` persisted as expected for a Cairo-local timestamp near midnight.

## P5-008 — Router registration and module scaffolding [5A] [all] [XS]

**Files** `backend/app/api/v1/router.py` · `backend/app/modules/{bible,quiz,points}/presentation/{router.py,dependencies.py}` · `backend/app/modules/internal/presentation/router.py` (new tiny module for the tick)
**Subtasks** Create the four routers with frozen prefixes/tags (`/bible-verses` "Bible Verses", `/quizzes` + `/quiz-questions` + `/quiz-attempts` "Quizzes", `/users/me/points` "Points", `/quiz-analytics` "Quiz Analytics", `/internal` "Internal"); define shared dependency aliases `CurrentUser`, `BibleManager = Annotated[User, Depends(require_role(RoleName.ADMIN, RoleName.SERVANT))]`, `DbSession`, `Uow`; include all in `api/v1/router.py`.
**Acceptance** `GET /docs` lists the new tags with no routes missing a `response_model`/return annotation · `pytest tests/unit/api` green.

---

# Workstream B — Verse content backend (wave 5A, US-020)

## P5-009 — Verse DTOs [5A] [US-020] [S]

**Files** `backend/app/modules/bible/application/dto/{verse_dto.py,query_dto.py}`
**Subtasks** `VerseCreateRequest`, `VerseUpdateRequest` (all optional), `VerseDetailResponse`, `VerseAdminItem`, `VerseCard`, `VerseStatsResponse`, `VerseListParams`. Enforce BR-2 lengths/ranges with `Field(...)` and add `description=` to every field (drives OpenAPI). No `status`-mutating fields beyond the transitions in BR-5. Never include `is_correct`-adjacent quiz data — only a `quiz_summary` (`{quiz_id, status, question_count, total_points, duration_seconds}`).
**Acceptance** `mypy app` green · a DTO unit test asserts `title` > 100 chars and `chapter = 0` are rejected.

## P5-010 — Verse service (commands + queries) [5A] [US-020] [M]

**Files** `backend/app/modules/bible/application/commands/{create_verse.py,update_verse.py,archive_verse.py,publish_verse.py}` · `…/queries/{verse_list_query.py,verse_detail_query.py,verse_stats_query.py,published_feed_query.py}` · `…/mappers/verse_mapper.py`
**Subtasks**
1. Create/update with BR-1/BR-2 validation, `created_by = actor.id`, audit row in the same transaction, role re-check inside the service (defence in depth, house convention).
2. `publish_verse`: BR-4/BR-5 transitions, sets `published_at` once and `week_start_date = iso_week_start(...)`, cancels any active schedule, records the `BibleVersePublished` event **only** for scheduled/automatic publication (manual publish notifies too — same event, `data.trigger = "manual"|"scheduled"`).
3. `archive_verse`: BR-6 cascade to the quiz.
4. Queries: manager list with filters/sort/pagination in SQL, member feed with `is_read`/`has_quiz`/`quiz_state` via one grouped join (no N+1), `verse_stats_query` returning the 5 KPI counts in one grouped query.
5. Member detail returns 404 for any non-`PUBLISHED` verse (BR-3).
**Acceptance** New `tests/unit/bible/test_verse_service.py` + `tests/integration/api/bible/test_verses.py`: transitions matrix, 404 for member on draft, stats counts, feed flags correct for read/unread, audit row written.

## P5-011 — Verse API [5A] [US-020] [S]

**Files** `backend/app/modules/bible/presentation/router.py`
**Subtasks** Implement §5.1 and the two feed endpoints of §5.3 (`current`, `published`). Google-style docstrings citing BR ids; explicit `response_model` and `status_code`; documented `responses={403,404,409,422}`; `DbSession` for reads, `Uow` for writes; page params bounded by `BIBLE_VERSES_MAX_PAGE_SIZE`.
**Acceptance** `tests/integration/api/bible/test_verses.py` covers all 7 verse endpoints × {member, servant, admin, anonymous} · `test_authorization.py` extended.

## P5-012 — Cover image upload wiring [5A] [US-020] [XS]

**Files** `backend/app/shared/infrastructure/services/image_upload.py` (read only) · verse DTO validation
**Subtasks** Reuse the existing signed Cloudinary upload used by avatars; validate the stored URL is `https`, ≤ 500 chars, and on the configured Cloudinary host; never accept a raw file on the verse endpoints.
**Acceptance** Unit test rejects `http://` and a non-Cloudinary host.

---

# Workstream C — Scheduling, publication, notification (wave 5A, US-021 + US-028)

## P5-013 — Schedule DTOs and service [5A] [US-021] [S]

**Files** `backend/app/modules/bible/application/dto/schedule_dto.py` · `…/commands/{schedule_verse.py,reschedule_verse.py,cancel_schedule.py}` · `…/queries/schedule_list_query.py`
**Subtasks** BR-8 validation (future, ≤ 2 years, platform timezone interpretation), BR-9 single active row (`ConflictError("schedule_exists")` on race via `IntegrityError`), verse → `SCHEDULED` on schedule and → `DRAFT` on cancel, audit rows for schedule/reschedule/cancel.
**Acceptance** `tests/unit/bible/test_schedule_rules.py` (pure validation, injected clock) + integration: past date → 422 `invalid_schedule`; second schedule → 409; cancel restores `DRAFT`.

## P5-014 — Publication service (idempotent, transactional) [5A] [US-021] [M]

**Files** `backend/app/modules/bible/application/services/publication_service.py`
**Subtasks**
1. `publish_due(now, limit)`: `claim_due` → for each row, in its own transaction: skip if verse `ARCHIVED` or schedule no longer `SCHEDULED`; else publish verse (reusing `publish_verse` logic), mark schedule `PUBLISHED`, `uow.record(BibleVersePublished(...))`.
2. Per-item failure isolation: `except Exception` → `mark_failed(last_error, attempts+1, retry_after)`, `logger.exception`, continue (BR-11).
3. Return counters `{published, failed, skipped}`.
4. Injected clock (`now: Callable[[], datetime] = now_utc`) for tests.
**Acceptance** `tests/integration/bible/test_publication.py`: due verse publishes exactly once across two sequential ticks; two concurrent ticks publish once total (asyncio.gather); archived verse skipped; forced failure sets `FAILED` + `attempts = 1` and the next tick retries; 6th failure stops retrying.

## P5-015 — Outbox dispatcher [5A] [US-028] [S]

**Files** `backend/app/shared/application/outbox_dispatcher.py` (new) · `backend/app/shared/infrastructure/persistence/outbox.py` (read only)
**Subtasks** `EVENT_HANDLERS: dict[str, Callable[[UnitOfWork, OutboxEvent], Awaitable[None]]]`; `dispatch_pending(session_factory, limit)` claiming with `claim_pending`, calling the handler, `mark_processed` on success, `mark_failed(..., retry_after_seconds=300)` on failure; unknown `event_type` → `mark_failed` with a clear message (never silently processed); returns `{processed, failed}`.
**Acceptance** `tests/integration/database/test_outbox.py` extended: unknown event type is retried not dropped; handler exception increments `attempts` and sets `available_at` in the future; success sets `PROCESSED`.

## P5-016 — Publication email case builder [5A] [US-028] [S]

**Files** `backend/app/modules/notifications/infrastructure/email/messages.py` · `…/service.py`
**Subtasks** Add `verse_published_email(*, verse_reference, title, published_at, verse_url) -> BrandEmailContent` following the existing bilingual two-`EmailSection` pattern (Arabic first, `rtl=True`), subject "تم نشر آية الكتاب المقدس المجدولة / Your scheduled Bible Verse has been published" and the body of `phase-5.md` §46; add `EmailService.send_verse_published_email(...)` wrapper. No markup duplication — reuse `render_brand_email`.
**Acceptance** `tests/unit/notifications/test_email_messages.py`: subject and both sections render, verse reference and date appear, no `None` leaks; `captured_emails` fixture sees exactly one email.

## P5-017 — `bible_verse.published` handler [5A] [US-028] [S]

**Files** `backend/app/modules/bible/application/handlers/bible_verse_published_handler.py` (new) · registered in `outbox_dispatcher.EVENT_HANDLERS`
**Subtasks**
1. Load the creator; if the creator is missing/inactive/unverified, mark the schedule notification `SENT` with a logged skip reason (nothing to deliver, do not retry forever).
2. Create the in-app notification for the creator via `NotificationService.create_for_user(type=BIBLE_VERSE, copy=verse_published_copy(...), data={"verse_id": …, "cta_url": "/bible-verses/<id>", "icon": "BookOpen"})`.
3. Send the email; on success `set_notification_status(SENT, notified_at)`, on failure raise so the outbox retries and `notification_attempts` increments; at 5 attempts set `FAILED` (BR-11/BR-24).
4. Duplicate protection: skip entirely when `notification_status = SENT` (idempotent handler).
**Acceptance** `tests/integration/bible/test_publication_notification.py`: one email + one notification row per publication; re-running the dispatcher sends nothing more; email failure path leaves `PENDING` with `attempts = 1`; 5 failures → `FAILED`.

## P5-018 — Notification type + data key extension [5A] [US-028] [XS]

**Files** `backend/app/modules/notifications/domain/enums/notification_type.py` · `…/infrastructure/persistence/notification_repository.py` (`_ANNOUNCEMENT_TYPES`, `tab_counts`) · `…/application/dto/*` (`NotificationTabCounts`) · `…/application/mappers/notification_mapper.py` (`_ALLOWED_DATA_KEYS`, icon allowlist) · `…/application/copy.py` · `frontend/src/modules/notifications/types/index.ts`
**Subtasks** Add `BIBLE_VERSE` to `NotificationType` and to the tab mapping; add `verse_id`, `quiz_id`, `attempt_id` to `_ALLOWED_DATA_KEYS`; allow the `BookOpen` icon; add `verse_published_copy(...)` (bilingual, code not i18n); mirror the union type on the frontend.
**Acceptance** `tests/unit/api/v1/test_notifications.py` extended: a `BIBLE_VERSE` notification appears in `all` and in the correct tab, `verse_id` survives sanitisation, tab counts stay correct.

## P5-019 — `POST /internal/scheduler/tick` [5A] [US-021] [S]

**Files** `backend/app/modules/internal/presentation/router.py` · `…/dependencies.py`
**Subtasks**
1. Dependency `require_cron_or_admin`: `secrets.compare_digest` on `X-Cron-Secret` when `CRON_SECRET` is set; else accept an ADMIN bearer; else `503 scheduler_disabled` / `401`. Never log the secret.
2. Sequence: `publish_due` → `auto_finish_expired_attempts` (P5-031) → `dispatch_pending`. Aggregate counters into the frozen response (§5.8). Single-item failures never 5xx.
3. Audit row `scheduler.tick` with the counters (actor = admin id or `None` for cron).
**Acceptance** `tests/integration/api/internal/test_scheduler_tick.py`: wrong secret → 401; SERVANT bearer → 403; MEMBER → 403; correct secret publishes and returns counters; two ticks in a row are idempotent; unset `CRON_SECRET` + no bearer → 503.

---

# Workstream D — Engagement tracking (wave 5B, US-022)

## P5-020 — Open tracking [5B] [US-022] [S]

**Files** `backend/app/modules/bible/application/commands/record_verse_open.py` · router
**Subtasks** 404 for non-published (BR-15); dedupe window `VERSE_OPEN_DEDUPE_SECONDS` (D-16) implemented as a single `INSERT … WHERE NOT EXISTS (SELECT 1 … opened_at > now - interval)` so it is race-safe without a lock; return 204 regardless; no audit row (high volume).
**Acceptance** `tests/integration/api/bible/test_engagement.py`: two opens within the window → 1 row; two opens with a patched clock beyond the window → 2 rows; draft verse → 404; anonymous → 401.

## P5-021 — Mark as read [5B] [US-022] [S]

**Files** `backend/app/modules/bible/application/commands/mark_verse_read.py` · router
**Subtasks** `on_conflict_do_nothing` upsert; response `{read_at, already_read}`; 404 for non-published; no double row possible under concurrency.
**Acceptance** Same test file: 1st call `already_read = false`, 2nd `true`, single row; 10 concurrent calls → 1 row.

## P5-022 — Read-state projection on feed and detail [5B] [US-022] [XS]

**Files** `bible/application/queries/{published_feed_query.py,verse_detail_query.py}`
**Subtasks** One grouped `LEFT JOIN verse_reads` per page (never per row) to populate `is_read`; support `read=read|unread|all` filter; detail adds `read_at`.
**Acceptance** Feed filter test: creating one read row moves the verse between the `read`/`unread` filters; query count assertion (single statement) via a SQLAlchemy event counter.

---

# Workstream E — Quiz content backend (wave 5B, US-023)

## P5-023 — Quiz DTOs [5B] [US-023] [S]

**Files** `backend/app/modules/quiz/application/dto/{quiz_dto.py,question_dto.py,validation_dto.py,query_dto.py}`
**Subtasks** Manager DTOs include `is_correct`; **member DTOs are separate classes** that structurally cannot carry it (§10.1). `total_points` is response-only (BR-18). Duration bounded by settings. Options array 2–6 with exactly one `is_correct` validated by a model validator.
**Acceptance** DTO unit tests: 1 option rejected, 7 options rejected, 0 correct rejected, 2 correct rejected, `total_points` in a request payload is ignored.

## P5-024 — Quiz service [5B] [US-023] [M]

**Files** `backend/app/modules/quiz/application/commands/{create_quiz.py,update_quiz.py,archive_quiz.py,publish_quiz.py}` · `…/queries/{quiz_detail_query.py,quiz_list_query.py}` · `…/services/quiz_validation_service.py`
**Subtasks**
1. `create_quiz`: 409 `quiz_exists` (D-12), verse must exist and not be `ARCHIVED`.
2. `quiz_validation_service.evaluate(quiz) -> list[RuleResult]` implementing BR-21's seven rules with stable codes (`has_questions`, `options_per_question`, `single_correct_answer`, `question_points`, `total_points`, `duration_in_range`, `verse_publishable`).
3. `publish_quiz`: run validation → `422 quiz_not_publishable` + `data.failed_rules`; on success set `PUBLISHED`, `published_at`, audit.
4. `archive_quiz`; `update_quiz` recomputes nothing but re-runs validation for the readiness panel.
5. Pure-function validation kept DB-free so it unit-tests without a database.
**Acceptance** `tests/unit/quiz/test_quiz_validation.py` (all 7 rules, both directions) + integration publish happy/sad paths.

## P5-025 — Question and option service [5B] [US-023] [M]

**Files** `backend/app/modules/quiz/application/commands/{create_question.py,update_question.py,delete_question.py,duplicate_question.py,reorder_questions.py}`
**Subtasks**
1. Create/update accept the full options array and diff it in one transaction (D-13): delete removed, update kept (by id), insert new, renumber `position` from 1.
2. Enforce exactly one correct option before writing, so the partial unique index is never the first line of defence.
3. `duplicate_question` copies text/points/options (correct flag included) and appends at `next_position`.
4. `reorder_questions` validates the id list is a permutation of the quiz's questions (`422 invalid_reorder`) and rewrites positions in a single `UPDATE … CASE` statement.
5. Every mutation recomputes `quizzes.total_points` (BR-18) and writes an audit row.
**Acceptance** `tests/integration/api/quiz/test_questions.py`: option diff keeps ids stable for untouched options; reorder with a foreign id → 422; delete recomputes `total_points`; duplicate lands last; 51st question → 422.

## P5-026 — Quiz content API [5B] [US-023] [S]

**Files** `backend/app/modules/quiz/presentation/router.py`
**Subtasks** Implement §5.4 exactly, manager-guarded, with docstrings, `response_model`s and documented failure responses.
**Acceptance** `tests/integration/api/quiz/test_quiz_admin.py` × {member 403, anonymous 401, servant 200, admin 200} for all 11 endpoints.

## P5-027 — Member quiz summary endpoint [5B] [US-024] [XS]

**Files** `quiz/application/queries/quiz_summary_query.py` · router
**Subtasks** `GET /bible-verses/{verse_id}/quiz/summary` returning the frozen shape incl. `requires_read`, `has_read`, `is_available` and the member's `attempt` state; never leaks `is_correct` or question text.
**Acceptance** Test: unread member sees `is_available = false, requires_read = true`; after read `true`; draft quiz → `404`; finished attempt exposes `attempt.status` + `attempt_id`.

---

# Workstream F — Attempts, timer, grading, points (wave 5B, US-024/025/026)

## P5-028 — Start attempt [5B] [US-024] [M]

**Files** `backend/app/modules/quiz/application/commands/start_attempt.py` · `…/dto/attempt_dto.py` · router
**Subtasks** BR-23 availability + D-6 read gate (`403 verse_not_read`); BR-24 snapshots (`duration_seconds`, `total_points`, `question_count`) and `expires_at`; `IntegrityError` → `409 attempt_exists` + `data.attempt_id`; response uses the **member** question DTO (no `is_correct`), options ordered by `position`; include `remaining_seconds` + `server_time` (BR-25).
**Acceptance** `tests/integration/api/quiz/test_attempt_start.py`: unread → 403 `verse_not_read`; unpublished quiz → 403 `quiz_not_available`; second start → 409 with the original attempt id; concurrent starts → exactly one row; response body asserted to **not** contain `is_correct` (§10.1).

## P5-029 — Resume attempt [5B] [US-024] [S]

**Files** `quiz/application/queries/attempt_state_query.py` · router
**Subtasks** Owner-only (404 otherwise, §10.4); returns saved answers, `remaining_seconds`, `status`; lazily auto-finishes an expired `IN_PROGRESS` attempt before responding (BR-30) and then returns the result-shaped state.
**Acceptance** Test: reload mid-attempt restores selections; another user → 404; expired attempt returns `AUTO_FINISHED` and a graded result.

## P5-030 — Save answer [5B] [US-024] [S]

**Files** `quiz/application/commands/save_answer.py` · router
**Subtasks** BR-26: upsert, ownership, expiry + grace check (`409 attempt_expired`), finished check (`409 attempt_finished`), option-belongs-to-question check (`422 invalid_option`); never writes `is_correct`/`points_awarded`; 204 response.
**Acceptance** `tests/integration/api/quiz/test_answer_save.py`: overwrite same question keeps one row; option from another question → 422; after expiry+grace → 409 and the stored answer is unchanged; posting `is_correct: true` in the body does not change stored grading fields (§10.2).

## P5-031 — Grading, submit and auto-finish [5B] [US-025] [L]

**Files** `quiz/application/services/grading_service.py` · `…/commands/submit_attempt.py` · `…/services/attempt_expiry_service.py` · router
**Subtasks**
1. Pure `grade(questions, correct_option_ids, answers) -> GradingResult` (score, per-question rows, correct/incorrect counts, percentage, `score_out_of_10`) — DB-free, unit-testable (BR-28, D-17).
2. `submit_attempt`: load questions + correct ids in **two** queries, grade, persist `quiz_answers` grading fields in one bulk update, finalise the attempt (`status` per BR-27, `submitted_at`, `finished_at`, `score`, counts), call `PointsService.award_for_attempt` in the same transaction, audit `points.award`.
3. Idempotency: already-finished attempt returns the stored result with no re-grading and no new ledger row (BR-29).
4. `attempt_expiry_service.auto_finish_expired(limit, now)` for the tick (BR-30) reusing the same submit path with `status = AUTO_FINISHED`.
5. Result payload assembles the points before/after snapshot by reading totals before and after the award inside the transaction.
**Acceptance** `tests/unit/quiz/test_grading_math.py` (all-correct, all-wrong, partial, unanswered, single-question, uneven points) + `tests/integration/api/quiz/test_submit.py`: double submit → identical body, one ledger row, unchanged points; expired submit → `AUTO_FINISHED` with pre-expiry answers graded; two concurrent submits → one ledger row.

## P5-032 — Points service and API [5B] [US-026] [M]

**Files** `backend/app/modules/points/application/services/points_service.py` · `…/queries/{my_points_query.py,monthly_series_query.py,history_query.py}` · `…/dto/points_dto.py` · `…/presentation/router.py`
**Subtasks**
1. `award_for_attempt(uow, attempt)`: computes `period_week_start`/`period_month` from `finished_at` in platform-local terms (D-5, BR-33), `on_conflict_do_nothing` insert, returns the effective row (BR-31, BR-35).
2. Queries for §5.6 — three aggregate statements, no Python loops.
3. `months` param clamped to `POINTS_HISTORY_MAX_MONTHS`; `last_n_months` fills empty months with `0` so the chart has no gaps.
**Acceptance** `tests/unit/points/test_points_math.py` (period boundaries incl. Sunday 23:59 and Monday 00:01 Cairo) + `tests/integration/api/points/test_my_points.py`: week/month/lifetime totals; a new month resets `this_month` while history keeps the old month unchanged (BR-33, `phase-5.md` §31); member cannot read another user's points.

---

# Workstream G — Analytics backend and exports (wave 5C, US-027/029/030/031)

## P5-033 — Verse analytics queries and API [5C] [US-027/029] [M]

**Files** `bible/application/queries/{verse_analytics_query.py,verse_analytics_users_query.py,analytics_overview_query.py}` · `…/dto/analytics_dto.py` · router
**Subtasks** BR-16 metrics; `series` bucketed by day or ISO week in SQL (`date_trunc`) over the requested window, gap-filled in Python from `last_n_*`; per-user engagement page (opened count, has_read, last_opened_at) as one grouped query; manager-role exclusion (BR-13/BR-38); overview totals for the dashboard; related-quiz mini-card data.
**Acceptance** `tests/integration/api/bible/test_verse_analytics.py`: read rate maths incl. zero-open division, dedupe respected, series has one entry per bucket with zeros, servant/admin only, single-statement assertions for the aggregates.

## P5-034 — Quiz analytics queries and API [5C] [US-027/029] [M]

**Files** `quiz/application/queries/{quiz_analytics_query.py,quiz_users_query.py,attempt_review_query.py}` · `…/dto/analytics_dto.py` · router
**Subtasks** KPIs, `score_distribution` (grouped by `score`, densified from `total_points` down to 0), `completion_status` counts + percentages, filtered/sorted user results page, manager attempt review (reuses the grading result shape, adds the user block).
**Acceptance** `tests/integration/api/quiz/test_quiz_analytics.py`: KPIs against a seeded fixture of 5 attempts incl. one `AUTO_FINISHED`; distribution buckets sum to participants; score filters and date filters; member → 403.

## P5-035 — Monthly analytics and leaderboard [5C] [US-031] [M]

**Files** `points/application/queries/{monthly_analytics_query.py,monthly_users_query.py,user_month_detail_query.py}` · `…/dto/monthly_dto.py` · `…/presentation/analytics_router.py`
**Subtasks** BR-39 definitions; trend over the last 3 months (mockup) driven by `last_n_months`; completion-rate distribution buckets; Top-3 with dense rank; user page with 6-month sparkline for the **page's** users in one grouped query; user drawer with per-quiz breakdown and full month history.
**Acceptance** `tests/integration/api/points/test_monthly_analytics.py`: ranks and ties, completion buckets, sparkline length always 6, `month` param validation (`YYYY-MM`), historical month immutable after a new month starts.

## P5-036 — CSV exports [5C] [US-030] [S]

**Files** `backend/app/modules/bible/presentation/router.py` · `quiz/presentation/router.py` · `points/presentation/analytics_router.py` · `backend/app/core/csv/__init__.py` (new small helper)
**Subtasks** `stream_csv(rows, header, filename)` returning `StreamingResponse` with `text/csv; charset=utf-8`, UTF-8 BOM (Excel/Arabic), `Content-Disposition`; reuse the exact filtered query of the corresponding table (BR-40); `413 export_too_large` beyond `ANALYTICS_EXPORT_MAX_ROWS`; audit `analytics.export`.
**Acceptance** `tests/integration/api/test_exports.py`: BOM present, Arabic names intact, row order equals the table's first page order, cap enforced, member → 403.

---

# Workstream H — Frontend foundation (wave 5A)

## P5-037 — i18n namespaces [5A] [all] [M]

**Files** `frontend/src/i18n/resources/ar.ts` **then** `en.ts`
**Subtasks** Add the three top-level namespaces and the `admin.nav.*` keys from Part 1 §7. Arabic first, full sentences, interpolation instead of concatenation (`{{count}}`, `{{score}}`, `{{total}}`, `{{minutes}}`), disambiguating week copy ("هذا الأسبوع (الاثنين–الأحد)").
**Acceptance** `npm run test:run -- parity` green · `npm run build` green (typed keys resolve) · no key contains a sentence fragment.

## P5-038 — Types and API clients [5A] [all] [M]

**Files** `frontend/src/modules/{bible,quiz,points}/types/index.ts` · `…/api/index.ts` · `…/api/queryKeys.ts`
**Subtasks** Hand-write types mirroring Part 1 §5 **exactly** (snake_case, no `any`, discriminated unions for `VerseStatus`/`QuizStatus`/`AttemptStatus`); reuse the shared `Paginated<T>` from `modules/notifications/types`; one method per endpoint returning `response.data`; hierarchical query-key factories rooted `["bible"]`, `["quiz"]`, `["points"]` with the documented doc-comment.
**Acceptance** `npm run build` green · no endpoint path string duplicated outside `api/index.ts`.

## P5-039 — Hooks [5A/5B/5C] [all] [M]

**Files** `frontend/src/modules/{bible,quiz,points}/hooks/*.ts` + `hooks/index.ts`
**Subtasks** One hook per file. Queries: `useCurrentVerse`, `useVerseFeed`, `useVerse`, `useAdminVerses`, `useVerseStats`, `useVerseSchedules`, `useVerseAnalytics`, `useVerseAnalyticsUsers`, `useQuizByVerse`, `useQuizSummary`, `useAdminQuizzes`, `useQuiz`, `useQuizValidation`, `useAttempt`, `useAttemptResult`, `useQuizAnalytics`, `useQuizAnalyticsUsers`, `useAttemptReview`, `useMyPoints`, `useMonthlyPoints`, `usePointsHistory`, `useMonthlyAnalytics`, `useMonthlyAnalyticsUsers`, `useUserMonthDetail`. Mutations: `useCreateVerse`, `useUpdateVerse`, `useArchiveVerse`, `usePublishVerse`, `useScheduleVerse`, `useRescheduleVerse`, `useCancelSchedule`, `useRecordOpen`, `useMarkAsRead`, `useCreateQuiz`, `useUpdateQuiz`, `usePublishQuiz`, `useArchiveQuiz`, `useSaveQuestion`, `useDeleteQuestion`, `useDuplicateQuestion`, `useReorderQuestions`, `useStartAttempt`, `useSaveAnswer`, `useSubmitAttempt`.
Rules: paginated lists use `placeholderData: keepPreviousData`; mutations invalidate the module root key; attempt hooks use `staleTime: 0` and `retry: false`; `useSaveAnswer` is fire-and-forget with a silent retry-once and a visible "not saved" indicator on failure.
**Acceptance** `npm run build` green · each mutation's `onSuccess` invalidation asserted in the page tests that use it.

## P5-040 — Shared frontend utilities [5A] [all] [S]

**Files** `frontend/src/lib/datetime.ts` (new) · `frontend/src/lib/download.ts` (new) · `frontend/src/components/common/StatCard.tsx` (new)
**Subtasks** Implement Part 1 §8.4. `StatCard` props `{Icon, iconClassName, label, value, hint?, tone?}` with locale-aware number formatting and `dir="ltr" tabular-nums` numerals; no physical direction classes.
**Acceptance** `npm run test:run` green incl. the logical-properties guard · a unit test for `formatClock(102) === "01:42"` (matches the mockup timer).

## P5-041 — Routes and navigation [5A] [all] [S]

**Files** `frontend/src/router.tsx` · `frontend/src/routes/README.md` · `frontend/src/components/layout/{AdminSidebar.tsx,Navbar.tsx}` · `frontend/src/components/layout/__tests__/AdminSidebar.test.tsx`
**Subtasks** Register all 17 routes from Part 1 §8.2 lazily with `PageSkeleton` fallbacks; add the `bibleVerses` and `analytics` `NAV_ITEMS` entries with sub-items (converting the disabled `reports` placeholder, keeping Categories/Tags/Email Templates/Settings disabled per D-10); add member `Navbar` links; update the route table doc and the sidebar test's ordered-items assertion.
**Acceptance** `npm run test:run` green (updated sidebar test) · manual: MEMBER hitting `/admin/bible-verses` sees the visible 403, anonymous is redirected to `/login` with `state.from`.

---

# Workstream I — Member screens (wave 5B)

## P5-042 — `BibleVersesPage` (`Bible-Verse-*`) [5B] [US-022] [M]

**Files** `frontend/src/modules/bible/pages/BibleVersesPage.tsx` · `components/{VerseHeroCard,VerseCard,VerseFilters}.tsx`
**Subtasks** Header + search (debounced, URL-driven `?q=`) + filter dropdown (`read`, `has_quiz`); hero "This Week" card from `useCurrentVerse` (cover image, reference in navy, title in orange, excerpt in Amiri, date, Read/Quiz chips, Read Verse CTA); "Previous Verses" 3→2→1 column grid from `useVerseFeed` with `AppPagination`; four states (skeleton/error+retry/empty `EmptyState`/rows); RTL and dark mode verified.
**Acceptance** `pages/__tests__/BibleVersesPage.test.tsx`: renders hero + grid, filter change refetches with the right params, empty state, error retry `role="alert"`, pager only when `pages > 1`, one English/LTR pass.

## P5-043 — `VerseDetailPage` (`Bible-post-*`) [5B] [US-022] [M]

**Files** `frontend/src/modules/bible/pages/VerseDetailPage.tsx` · `components/{VerseHeader,VerseBody,MarkAsReadButton,QuizTeaserCard}.tsx`
**Subtasks** Back link; cover header with "Weekly Bible Verse" badge and publish date; verse text `font-verse` centred with reference; `Reflection` with `whitespace-pre-line` and a mobile "Read More" expander; `useRecordOpen` fired once on mount (guard with a ref so React 18 double-invoke does not double-post); Mark as Read → "Marked as Read" success state with optimistic update; `QuizTeaserCard` with the three stat pills and Start Quiz **disabled + hint until read** (D-6), or "View Result" when an attempt is finished.
**Acceptance** `__tests__/VerseDetailPage.test.tsx`: open recorded exactly once; read mutation flips the UI and enables Start Quiz; finished attempt shows View Result; a11y — button has an accessible name, focus ring visible.

## P5-044 — `QuizAttemptPage` + timer (`Quiz-Page-*`) [5B] [US-024] [L]

**Files** `frontend/src/modules/quiz/pages/QuizAttemptPage.tsx` · `hooks/useQuizTimer.ts` · `components/{QuizTimer,QuestionCard,QuizProgressDots,TimesUpPanel,AutosaveIndicator}.tsx`
**Subtasks**
1. `useQuizTimer` per Part 1 §8.4 — server `remaining_seconds` + `server_time` only, re-sync on `visibilitychange`, single `onExpire`.
2. Timer chip states: normal (mint), warning ≤ 30 s (orange), expired (red) with `aria-live="polite"` announcements at 60/30/10 s.
3. One question at a time, radio option cards, progress dots + "Question n of m", Previous/Next, Finish on the last question; direction-aware chevrons (component swap, not rotation).
4. Each selection calls `useSaveAnswer`; `AutosaveIndicator` shows saved/saving/failed.
5. On expiry: stop input, auto-submit once, show the "Time's up!" panel with View Results.
6. Guard against navigating away mid-attempt (`beforeunload` + in-app confirm dialog).
7. Resume path: entering with an existing `IN_PROGRESS` attempt restores answers and remaining time; entering with a finished attempt redirects to the result route.
**Acceptance** `__tests__/QuizAttemptPage.test.tsx` with `vi.useFakeTimers()`: countdown ticks, warning class at 30 s, auto-submit fires exactly once at 0, answers posted per selection, reload restores state, expired attempt redirects; timer never reads `Date.now()` against `expires_at` (assert on the hook's inputs).

## P5-045 — `QuizResultPage` (`Quiz-Result-*`) [5B] [US-025] [M]

**Files** `frontend/src/modules/quiz/pages/QuizResultPage.tsx` · `components/{ResultHeader,ScoreSummary,PointsProgressBars,QuestionReviewList}.tsx`
**Subtasks** Success header with the trophy icon (no confetti animation — `Design-Guide.md` §17; the mockup's confetti becomes a static decorative element); big `score / total_points` + percentage; three tiles (correct, incorrect, points earned); "Your Points Progress" three before→after bars using mint/navy/orange with `rtl:-scale-x-100`; collapsible per-question review showing the member's answer and the correct answer; View My Points / Back to Bible Verse.
**Acceptance** `__tests__/QuizResultPage.test.tsx`: renders from `useAttemptResult`, review rows mark correct/incorrect, progress bars use before/after values, deep-link reload works, `AUTO_FINISHED` shows the timed-out badge.

## P5-046 — `PointsPage` (`Quiz-Points-*`) [5B] [US-026] [M]

**Files** `frontend/src/modules/points/pages/PointsPage.tsx` · `components/{PointsKpiRow,PointsOverTimeChart,MonthlyHistoryList,RecentActivityList}.tsx`
**Subtasks** Three KPI cards (lifetime/month/week); `PointsOverTimeChart` line chart via `ChartContainer` with a range select (3/6/12 months), `XAxis reversed={isArabic}`, `YAxis orientation` flip; monthly history list + "View all history"; recent activity list from `usePointsHistory` with `AppPagination`; empty state with "Explore Bible Verses" CTA.
**Acceptance** `__tests__/PointsPage.test.tsx`: KPIs, chart renders with 6 points, range change refetches, empty state with zero ledger rows, RTL axis props asserted.

---

# Workstream J — Manager content screens (wave 5A/5B)

## P5-047 — `BibleManagementPage` (`Bible-Management-*`) [5A] [US-020] [L]

**Files** `frontend/src/modules/bible/pages/BibleManagementPage.tsx` · `components/{VerseKpiRow,VerseStatusTabs,VerseFilterBar,VerseTable,VerseRowActions,VerseMobileList,VerseFilterSheet}.tsx`
**Subtasks** `AdminTopbar` + Create Verse CTA; 4 KPI cards from `useVerseStats`; status tabs and every filter driven by `useSearchParams` + the `patchParams` helper (copy from `AdminAnonymousMessagesPage`); table columns per the mockup incl. Opens/Reads and a Quiz cell that becomes "+ Add Quiz" when absent; row actions view/edit/schedule/quiz/analytics/archive with an `AlertDialog` confirm for archive; `AppPagination` + page-size select; mobile card list + filter `Sheet` + FAB; overdue-schedule red badge (risk register).
**Acceptance** `__tests__/BibleManagementPage.test.tsx`: tab and filter changes hit the API with the right params, archive confirm → mutation + invalidation + toast, empty vs filtered-empty distinguished, pager, mobile sheet opens.

## P5-048 — `VerseFormPage` (`Create and Edit Bible-*`) [5A] [US-020] [L]

**Files** `frontend/src/modules/bible/pages/VerseFormPage.tsx` · `components/{verseSchema.ts,VerseForm.tsx,VersePreview.tsx,CoverImageField.tsx}`
**Subtasks** RHF + zod schema factory taking translated messages (copy the `pushSchema` pattern); fields per BR-1/BR-2 with live counters (`24 / 100`, `36 / 2,000`, `183 / 5,000`); reference validity tick; Book select (66-book list constant) + Chapter + Verse; **plain textareas, no toolbar** (D-8); `CoverImageField` reusing the existing signed-upload flow with drag & drop, preview and remove; status radios; live preview panel with mobile/desktop toggle rendering exactly what the member sees (Amiri verse, reflection `whitespace-pre-line`); Save Draft / Schedule / Publish in both topbar and sticky footer; unsaved-changes guard; edit mode prefills and PATCHes.
**Acceptance** `__tests__/VerseFormPage.test.tsx`: validation messages in Arabic, counters update, publish calls create-then-publish (or `status: PUBLISHED`) once, Schedule navigates to the schedule route with the created id, preview mirrors input, edit mode prefills.

## P5-049 — `VerseSchedulePage` (`Schedule-*`) [5A] [US-021] [M]

**Files** `frontend/src/modules/bible/pages/VerseSchedulePage.tsx` · `components/{ScheduleForm.tsx,scheduleSchema.ts,ScheduleSummaryCard.tsx,AlreadyScheduledCard.tsx}`
**Subtasks** Numbered step layout; selected-verse card; date input + time select + **disabled** timezone select fixed to the platform timezone with the info note (BR-12); notification note; live summary card (weekday, date, time, timezone) using `lib/datetime`; "Already Scheduled" block with Reschedule and Cancel (`AlertDialog`); inline `invalid_schedule` error surface matching the mockup's red panel; client-side past-date guard plus server error mapping.
**Acceptance** `__tests__/VerseSchedulePage.test.tsx`: past date blocked client-side, server 422 renders the red panel, reschedule PATCHes, cancel confirms then DELETEs and shows the toast, summary updates as inputs change.

## P5-050 — `QuizManagePage` (`Quiz-management-*`) [5B] [US-023] [M]

**Files** `frontend/src/modules/quiz/pages/QuizManagePage.tsx` · `components/{QuizOverviewCard,RelatedVerseCard,QuestionTable,QuizValidationPanel,QuizAnalyticsTeaser}.tsx`
**Subtasks** Breadcrumb (Bible Verses → verse → Manage Quiz); Edit/Preview/Publish actions with the readiness gate (Publish disabled until `is_publishable`, tooltip lists failures); overview stats; questions table with drag handle (`@dnd-kit` is **not** available — implement keyboard-accessible up/down buttons plus HTML5 drag on the handle, with an `aria-live` announcement) calling `useReorderQuestions`; edit/duplicate/delete row actions; validation checklist from `useQuizValidation`; analytics teaser card linking to quiz analytics; "no quiz yet" state offering Create Quiz.
**Acceptance** `__tests__/QuizManagePage.test.tsx`: publish blocked with failing rules and the 422 `failed_rules` rendered, reorder posts the new id order, delete confirm → invalidation, empty-quiz state creates a quiz.

## P5-051 — `QuizBuilderPage` (`Quiz-Builder-*`) [5B] [US-023] [M]

**Files** `frontend/src/modules/quiz/pages/QuizBuilderPage.tsx` · `components/{quizSchema.ts,QuizInfoForm.tsx,QuizSettingsForm.tsx,QuizReadinessPanel.tsx,QuestionOverviewList.tsx}`
**Subtasks** Quiz info (title/description with counters); settings — time-limit select (1/2/5/10/15/30 min + custom) writing `duration_seconds`, **read-only derived** total points ("Calculated from questions"), fixed question-type label; related-verse card; status radios with helper copy; question overview list with add/edit/duplicate/delete; readiness panel + Tips card; Save Draft / Preview / Publish.
**Acceptance** `__tests__/QuizBuilderPage.test.tsx`: duration mapping, total points read-only, status change PATCHes, publish success toast and navigation, validation panel reflects the API.

## P5-052 — `QuestionFormPage` (`QuestionManagement-*`) [5B] [US-023] [M]

**Files** `frontend/src/modules/quiz/pages/QuestionFormPage.tsx` · `components/{questionSchema.ts,QuestionForm.tsx,OptionRow.tsx,QuestionPreview.tsx,QuestionValidationPanel.tsx}`
**Subtasks** Question textarea with `44 / 500` counter; points stepper (1–100); options list — radio group for the single correct answer, A/B/C/D letters, add option (≤ 6), delete (≥ 2 remain), reorder via accessible up/down; validation checklist mirroring BR-20/BR-21; member-preview panel; manager-only "Correct Answer: Option C" callout; Save/Cancel; create and edit modes on the same component.
**Acceptance** `__tests__/QuestionFormPage.test.tsx`: cannot save with 0 or 2 correct answers, cannot delete below 2 options, cannot add a 7th, preview shows no correct-answer hint, save posts the full options array once.

## P5-053 — `QuizListPage` (`Quizzes` nav) [5B] [US-023] [S]

**Files** `frontend/src/modules/quiz/pages/QuizListPage.tsx` · `components/QuizTable.tsx`
**Subtasks** Manager list of quizzes with status/verse/search filters (URL-driven), columns (quiz, verse, questions, points, duration, status, participants, actions), pagination, empty state.
**Acceptance** `__tests__/QuizListPage.test.tsx`: filters, navigation to builder/analytics, empty state.

---

# Workstream K — Analytics screens (wave 5C)

## P5-054 — `VerseAnalyticsPage` (`Verse-Analysis-*`) [5C] [US-027/029] [L]

**Files** `frontend/src/modules/bible/pages/VerseAnalyticsPage.tsx` · `components/{VerseAnalyticsKpis,EngagementFunnel,EngagementOverTimeChart,VerseUserEngagementTable,RelatedQuizCard,MetricsLegend}.tsx`
**Subtasks** Breadcrumb + date-range picker + Export Report (`lib/download`); verse card; 4 KPI cards; `EngagementFunnel` as pure CSS trapezoids (no library) mirrored under RTL; dual-series area chart (`--chart-5` opens, `--chart-1` reads) with granularity select and RTL axis handling; paginated user engagement table (opened count, read yes/no, last opened); related-quiz card; "About the Metrics" legend including the dedupe rule (D-16) and the read-as-quiz-gate note (BR-14).
**Acceptance** `__tests__/VerseAnalyticsPage.test.tsx`: KPIs render, granularity switch refetches, export triggers the authenticated download, table pagination, RTL pass.

## P5-055 — `QuizAnalyticsPage` (`Quiz-analysis-*`) [5C] [US-027/029] [L]

**Files** `frontend/src/modules/quiz/pages/QuizAnalyticsPage.tsx` · `components/{QuizAnalyticsKpis,ScoreDistributionChart,CompletionStatusDonut,QuizResultsTable,QuizResultFilters,UserPerformanceDrawer}.tsx`
**Subtasks** 5 KPI cards; score-distribution bar chart; completion-status donut with a centred participant count and a legend showing counts + percentages; filter bar (user search, score range, status, date range) URL-driven; results table with status badges; right-side `Sheet` drawer per user showing score/percentage/points, completed-at, time taken and the question-by-question review from `useAttemptReview`; Export Results.
**Acceptance** `__tests__/QuizAnalyticsPage.test.tsx`: filters map to query params, drawer opens with review rows and closes, donut/bar receive normalised data, export call, member sees 403 route guard.

## P5-056 — `MonthlyAnalyticsPage` (`Monthly-Analysis-*`) [5C] [US-031] [L]

**Files** `frontend/src/modules/points/pages/MonthlyAnalyticsPage.tsx` · `components/{MonthPicker,MonthlyKpis,MonthlyTrendChart,CompletionDistributionDonut,LeaderboardTable,TopThreeCard,UserMonthDrawer,MonthlyComparisonTable}.tsx`
**Subtasks** Month picker + recent-month chips (reuse the `MeetingSelector` interaction model); 4 KPI cards; composed trend chart (points + participants bars, average-score line on a right axis, flipped under RTL); completion-rate donut; filter bar; ranked table with medal badges for 1–3, per-row sparkline (`LineChart` with hidden axes), row → user drawer (quiz breakdown with progress bars, full history link); Top-3 card; monthly summary comparison table highlighting the selected month; Export Report.
**Acceptance** `__tests__/MonthlyAnalyticsPage.test.tsx`: month change refetches all panels, ranks render with medals, sparkline receives 6 values, drawer shows breakdown, comparison highlights the selected row.

## P5-057 — Admin dashboard tiles (`phase-5.md` §43) [5C] [US-027] [S]

**Files** `frontend/src/modules/attendance/pages/AttendanceDashboardPage.tsx` (extend) or a new `BibleEngagementSummary` section component
**Subtasks** Add a "Bible Engagement" card row (total posts, published, total opens, total reads, read rate) from `GET /bible-verses/analytics/overview` and a "Quiz Analytics" row (participants, completed, auto-finished, average score, points awarded) from a lightweight aggregate; link to the full analytics pages. Do not restructure the existing attendance dashboard.
**Acceptance** Existing dashboard tests stay green; new tiles have their own test with mocked hooks.

---

# Workstream L — QA, hardening, docs (wave 5C)

## P5-058 — Security gate tests [5C] [all] [M]

**Files** `backend/tests/integration/api/quiz/test_security.py` (new) · `backend/tests/unit/api/v1/test_authorization.py` (extend)
**Subtasks** Implement all 11 gates of Part 1 §10 as explicit tests, including the "`is_correct` never appears in an in-progress payload" string assertion, the client-supplied-grading rejection, cross-user attempt access → 404, cron secret handling, and draft invisibility per endpoint.
**Acceptance** All green; each test names the gate it covers in its docstring.

## P5-059 — Idempotency and concurrency suite [5C] [all] [M]

**Files** `backend/tests/integration/api/test_idempotency.py` (new)
**Subtasks** One test per BR-10/BR-14/BR-29/BR-31 plus concurrent (`asyncio.gather`) variants for: mark read ×10, tick ×2 in parallel, submit ×2 in parallel, start attempt ×2 in parallel, award ×2. Assert exact row counts and unchanged totals.
**Acceptance** No flakiness across 3 consecutive runs.

## P5-060 — Performance sanity pass [5C] [US-027] [S]

**Files** `backend/tests/integration/api/test_query_counts.py` (new)
**Subtasks** SQLAlchemy `before_cursor_execute` counter fixture; assert an upper bound on statements per request for: manager verse list (≤ 4), member feed (≤ 3), verse analytics (≤ 6), quiz analytics (≤ 6), monthly users page (≤ 5), attempt submit (≤ 8). Seed ~200 users / 50 verses / 500 attempts in a factory helper.
**Acceptance** Bounds hold; any N+1 introduced later fails this test.

## P5-061 — RTL, a11y and dark-mode sweep [5C] [all] [M]

**Files** all new `.tsx`
**Subtasks** Run `npm run test:run` (logical-properties + parity guards); manual pass of all 13 screens at 1440/768/375 px in `ar`+`en` and light+dark; keyboard-only pass of the quiz attempt flow, the question form and every drawer/dialog; verify focus rings, `aria-live` for the timer and autosave, accessible names on icon-only buttons, table `scope` attributes, and 4.5:1 contrast for every badge colour combination.
**Acceptance** Written checklist in the PR description; zero physical-direction-class violations; no icon-only button without an `aria-label`.

## P5-062 — Docs and demo prep [5C] [all] [S]

**Files** `README.md` (cron setup) · `backend/README.md` · `frontend/src/routes/README.md` · `docs/database/DATABASE_DESIGN.md` (append the 9 new tables) · `docs/Agile/phase-5/phase-5.md` (mark DoD items)
**Subtasks** Document the cron invocation and the `CRON_SECRET` rotation procedure; add the new tables/relationships to the database design doc; update the route table; write the demo script below into the sprint review notes.
**Acceptance** A new developer can publish a scheduled verse end to end from the docs alone, without reading code.

---

# Test matrix (minimum)

| Area | Unit | Integration | Frontend |
| --- | --- | --- | --- |
| Periods / week boundaries | `test_periods.py` | — | `datetime.test.ts` |
| Verse CRUD + transitions | `test_verse_service.py` | `test_verses.py` | `BibleManagementPage`, `VerseFormPage` |
| Scheduling | `test_schedule_rules.py` | `test_schedules.py`, `test_publication.py` | `VerseSchedulePage` |
| Tick / outbox / email | — | `test_scheduler_tick.py`, `test_outbox.py`, `test_publication_notification.py` | — |
| Engagement | — | `test_engagement.py` | `VerseDetailPage`, `BibleVersesPage` |
| Quiz content + validation | `test_quiz_validation.py` | `test_quiz_admin.py`, `test_questions.py` | `QuizManagePage`, `QuizBuilderPage`, `QuestionFormPage` |
| Attempt + timer | — | `test_attempt_start.py`, `test_answer_save.py` | `QuizAttemptPage` (fake timers) |
| Grading + points | `test_grading_math.py`, `test_points_math.py` | `test_submit.py`, `test_my_points.py` | `QuizResultPage`, `PointsPage` |
| Analytics + exports | — | `test_verse_analytics.py`, `test_quiz_analytics.py`, `test_monthly_analytics.py`, `test_exports.py`, `test_query_counts.py` | 3 analytics pages |
| Security / idempotency | — | `test_security.py`, `test_idempotency.py`, `test_authorization.py` | route-guard tests |
| i18n / RTL | — | — | `parity.test.ts`, `logical-properties.test.ts` |

---

# Sprint review demo script (`phase-5.md` §62)

1. **Servant** logs in → Bible Verses (admin) → Create Verse → fills Psalm 23:1 with reflection and cover → Save Draft → Create Quiz → adds 5 questions × 2 points → sets 2-minute timer → Publish Quiz (readiness panel all green).
2. Schedule the verse for two minutes from now → summary card confirms Cairo time → verse shows `SCHEDULED` in the list.
3. **System**: `POST /internal/scheduler/tick` (cron or the admin button) → verse becomes `PUBLISHED`, schedule `PUBLISHED`, creator receives the email (console transport in the demo) **and** the bell notification with a working CTA.
4. **Member** logs in → Bible Verses → "This Week" hero → opens the verse (open counter +1) → Start Quiz is disabled with the hint → Mark as Read (read counter +1) → Start Quiz.
5. Timer runs; answers save per selection; reload the page mid-quiz to prove resume; finish → 8/10, 80%, 8 points, points progress bars animate week/month/lifetime.
6. Submit again via the API to prove no double points; My Points shows lifetime/month/week, the 6-month chart and the activity list.
7. **Servant** → Verse Analytics (opens 142 / unique 97 / reads 74 / read rate 76.3%, funnel, time series) → Quiz Analytics (participants, distribution, donut, user table, review drawer) → Monthly Analytics (KPIs, trend, Top-3, ranked table, user drawer) → Export Report downloads a UTF-8 CSV that opens correctly in Excel with Arabic names.

---

# Handoff checklist before starting

- [ ] Part 1 §0–§10 read end to end
- [ ] Local scratch Postgres running on `55432`; `alembic upgrade head` clean **before** any Phase 5 change (baseline `e3b7d1c95f42`)
- [ ] `cd backend && DEBUG=true APP_ENV=test .venv/bin/python -m pytest` green on `main`
- [ ] `cd frontend && npm run build && npm run test:run` green on `main`
- [ ] `docs/designs/*-ar.png` opened alongside the `-en` twins for every screen being built
- [ ] `CRON_SECRET` generated for local use and the tick verified manually with `curl`
- [ ] Wave 5A/5B/5C boundaries agreed with the product owner (68 points total, Part 1 §12)
