# Phase 5 Implementation Plan — Part 1 of 2 (Specification & Frozen Contracts)

**Document type:** binding execution plan (implementer handoff)
**Covers:** `docs/Agile/phase-5/phase-5.md` — Bible verses, weekly publishing, engagement, quizzes, grading, points, analytics, publication email
**Design source of truth:** `docs/designs/` — `Bible-Verse-{en,ar}.png`, `Bible-post-{en,ar}.png`, `Bible-Management-{en,ar}.png`, `Create and Edit Bible-{en,ar}.png`, `Schedule-{en,ar}.png`, `Quiz-management-{en,ar}.png`, `Quiz-Builder-{en,ar}.png`, `QuestionManagement{-en,ar}.png`, `Quiz-Page-{en,ar}.png`, `Quiz-Result-{en,ar}.png`, `Quiz-Points-{en,ar}.png`, `Quiz-analysis-{en}.png` / `Quiz-Analysis-ar.png`, `Verse-Analysis-en.png` / `Verse-analysis-ar.png`, `Monthly-Analysis-{en,ar}.png`
**Visual identity source of truth:** `docs/Design-Guide.md` (overrides every colour in the mockups)
**Status of previous phases:** Phase 1 (auth) shipped · Phase 2 (weekly attendance) shipped · Phase 3 (blog/comments) **not started** · Phase 4 (notifications, email, anonymous messages) shipped
**Part 2 (tasks):** `docs/Agile/phase-5/phase-5-implementation-plan-part-2.md`
**Task ID series:** `P5-nnn` (the `TASK-nnn` series in `phase-5.md` is narrative; `P5-nnn` is executable)

---

# 0. Rules of Engagement

Read this section before touching any file.

1. **Read before you write.** Every task in Part 2 lists the files it touches. Open them first. §1 is the inventory of what already exists — the `bible` backend module, `bible_verses` table, `BibleVerseRepository`, the outbox, the bilingual email stack, `Page[T]` pagination, `require_role`, `AdminLayout`, `AppPagination`, the recharts wrapper. Do not re-create any of it.
2. **§1 and §2 are binding.** Anything under "already done" must not be rewritten, renamed or re-migrated. Every decision in §2 came from the product owner in response to an explicit question. Do not "improve" them.
3. **§4–§9 are frozen contracts.** Table names, column names, enum values, endpoint paths, error codes, DTO field names, settings names, i18n namespaces, React Query keys, route paths and design tokens are frozen. If a task forces a change to a frozen contract, stop and escalate instead of improvising.
4. **Backend commands must be prefixed.** The shell exports `DEBUG=release`, which crashes `pydantic-settings`:
   `cd backend && DEBUG=true APP_ENV=test .venv/bin/python -m pytest`
5. **Never migrate against `backend/.env`.** It points at remote Neon with live credentials. Always override:
   `DATABASE_URL=postgresql+asyncpg://marmarkos:marmarkos@localhost:55432/marmarkos_test alembic upgrade head`
6. **Tests bypass Alembic.** `tests/conftest.py` builds the schema with `create_all()` from `registry.Base.metadata`, so a missing or wrong migration still gives green tests. Every migration task has a separate `alembic upgrade head` + `alembic downgrade -1` acceptance step against the local scratch DB.
7. **Run the Acceptance block of a task before marking it done.** A task without a green acceptance run is not done.
8. **No git operations** (commit, branch, push, PR) unless explicitly requested. Branch when requested: `feature/bible-engagement`. Commit style: `feat: …`, `fix: …`, `test: …`.
9. **Design fidelity beats invention, identity beats design.** The mockups are the layout and content target. Their colours are **not** the palette — see §9.1. Where a mockup conflicts with the domain, the copy changes, never the domain.
10. **Arabic first.** `i18next` is initialised `lng: "ar"`, `fallbackLng: "ar"`, and the `t()` key types derive from `ar.ts`. Add keys to `frontend/src/i18n/resources/ar.ts` **before** `en.ts` or `t()` will not type-check. `i18n/__tests__/parity.test.ts` fails on any drift including array lengths.
11. **Logical CSS properties only.** `src/test/__tests__/logical-properties.test.ts` scans every `.tsx` for `ml-`, `pr-`, `left-`, `text-left`, `border-l`, `rounded-l`, `space-x-` and fails with `file:line`. Use `ms-`/`me-`, `ps-`/`pe-`, `start-`/`end-`, `text-start`/`text-end`, `border-s`/`border-e`, `gap-`.
12. **No new infrastructure.** `docs/Sprint-Guide.md` forbids Redis, Kafka, RabbitMQ and Kubernetes in V1. Phase 5 adds **no** broker, no queue server, no worker container and no websocket. Scheduling is an internal HTTP endpoint driven by an external cron (D-3).
13. **Never trust the client for correctness.** `is_correct`, `points_awarded`, `score` and elapsed time are computed server-side only, and correct answers are never serialised before an attempt is finished (§10).

---

# 1. Where the codebase stands today

## 1.1 Shipped and reusable — do not rebuild

**Backend** (`backend/app`, FastAPI + SQLAlchemy 2.0 async + Alembic, Python 3.12, modular DDD per feature)

| Capability | Location | Use it for |
| --- | --- | --- |
| App factory, CORS-safe error middleware | `main.py` | nothing to change except router registration |
| Nested versioned routers `/api/v1` | `api/router.py`, `api/v1/router.py` | register 4 new routers |
| `Settings` singleton, phase-banner convention | `config.py`, `.env.example` | add the Phase 5 block (§6) |
| `UUIDPrimaryKeyMixin`, `TimestampMixin`, `CreatedAtMixin`, single `Base` | `shared/infrastructure/persistence/base.py` | every new model |
| Metadata registry (Alembic + tests read it) | `shared/.../registry.py` | import the 9 new model modules |
| `UnitOfWork` + `record(event)` → outbox row on commit | `shared/.../unit_of_work.py` | add 9 repository properties |
| **Transactional outbox with `claim_pending()` (`FOR UPDATE SKIP LOCKED`), `mark_failed(retry_after_seconds)`** | `shared/.../outbox.py` | publication → email decoupling (D-3). Exists, **has no dispatcher yet** |
| `AuditLogRepository.record(...)` | `modules/admin/.../models.py` | every manager mutation |
| `require_role(RoleName.ADMIN, RoleName.SERVANT)`, `get_current_user` | `modules/auth/presentation/dependencies.py` | all authorization |
| `AppError` hierarchy + `{"detail": {"code", "message"}}` envelope | `core/exceptions/` | all new error codes |
| `PageParams` / `Page[T].build()` | `core/pagination/` | every list endpoint |
| Clock: `now_utc`, `now_local`, `today_local`, `platform_timezone` (Africa/Cairo) | `core/time/clock.py` | `date.today()`/`datetime.now()` are banned outside this module |
| Bilingual email: `BrandEmailContent`, `render_brand_email`, `messages.py` case builders, `EmailService.send`, Brevo/Gmail/console transports | `modules/notifications/infrastructure/email/` | add one case builder |
| Notifications: broadcast/per-user rows, `notification_reads`, `NotificationService`, feed API | `modules/notifications/` | creator in-app notification |
| Cloudinary signed upload | `shared/infrastructure/services/image_upload.py` | verse cover image |
| Analytics reference implementation: aggregate repository methods (one grouped query per dimension), `StatisticsService`, `MonthlyStatisticsResponse` | `modules/attendance/` | copy the shape for verse/quiz/monthly analytics |
| Test harness: `conftest.py` (scratch DB, `clean_db`, `captured_emails`, `client`), `tests/utils.py` (`register_and_login`, `create_user_direct`, `bearer`) | `backend/tests/` | all new tests |

**Frontend** (`frontend/src`, React 18 + Vite 6 + TS strict + TanStack Query 5 + Tailwind v4 + shadcn/ui + recharts + i18next)

| Capability | Location |
| --- | --- |
| Axios client, base-URL resolution, silent-refresh interceptor, `ApiError`, `getApiErrorMessage` | `lib/api.ts` |
| Session + roles (`localStorage`), `getUserRole`, `hasAnyRole` | `lib/auth.ts` |
| `RequireAuth`, `RequireRole` (renders visible 403, never a silent redirect) | `components/common/` |
| `AdminLayout` (sidebar shell), `AdminTopbar` (rendered per page), `AdminSidebar.NAV_ITEMS` | `layouts/`, `components/layout/` |
| `AppPagination`, `EmptyState`, `ErrorRetry`, `PageSkeleton` | `components/common/` |
| 45 shadcn primitives incl. `table`, `dialog`, `sheet`, `select`, `progress`, `skeleton`, `sonner`, **`chart`** (recharts wrapper, `ChartConfig` → `--color-<key>`) | `components/ui/` |
| Brand tokens `bg-navy`, `text-mint`, `text-ink`, `bg-soft`, `--chart-1..5`, fonts `font-heading`/`font-arabic`/`font-verse`/`font-sans`, `.card-elevated`, `.btn-primary`, `.btn-outline`, `.focus-ring` | `index.css` (Tailwind v4 CSS-first, **no JS config**) |
| i18n: inline TS resources, 12 namespaces, typed keys, `LanguageProvider` sets `lang`/`dir`, parity + RTL guard tests | `i18n/`, `test/` |
| Query-key factory convention, `keepPreviousData` lists, mutation → `invalidateQueries(<module>Keys.all)` | `modules/attendance/api/queryKeys.ts` (documented as the pattern to copy) |
| Admin CRUD patterns: URL-driven filters (`useSearchParams` + `patchParams`), 4-state list (pending/error/empty/rows) | `modules/anonymous-messages/pages/AdminAnonymousMessagesPage.tsx`, `modules/attendance/pages/AttendanceHistoryPage.tsx` |
| Bilingual RHF + zod forms, schema factories taking translated messages | `modules/notifications/components/{pushSchema.ts,PushNotificationForm.tsx}` |
| Stat cards + recharts usage + RTL axis handling | `modules/attendance/components/StatTile.tsx`, `pages/AttendanceDashboardPage.tsx` |

## 1.2 Phase 5 starting point — stubs and gaps

| Fact | Consequence |
| --- | --- |
| `backend/app/modules/bible/` has **models + repository only**: `BibleVerse` (`verse_reference`, `text`, `translation`, `image`, `published_at`, `week_start_date`, `is_published`, `created_by`) and `BibleVerseRepository` (`add`, `get_by_id`, `get_published_for_week`, `get_current_published`, `list_published`). `presentation/` is empty; the module is **not** in `api/v1/router.py`. | Extend, do not recreate (D-2). No verse endpoint exists today. |
| `bible_verses` carries `Index("uq_bible_verses_published_week", "week_start_date", unique=True, postgresql_where=text("is_published"))` — one published verse per week. | Dropped in Phase 5 (D-2). |
| Nothing in `app/` computes `week_start_date`; there is no producer. | Phase 5 introduces the ISO-week producer (D-5). |
| **No scheduler of any kind** — no APScheduler, Celery, cron, `BackgroundTasks`, `lifespan` or startup hook. The outbox `claim_pending()` is exercised only by `tests/integration/database/test_outbox.py`. | The dispatcher is greenfield (D-3, §4.7). |
| **No email retry.** `EmailService.send` returns `bool` and swallows exceptions. Retry exists only inline for Telegram and as `outbox.mark_failed(retry_after_seconds)`. | Notification status + retry lives on the schedule row + outbox backoff (BR-24). |
| `notification_mapper._ALLOWED_DATA_KEYS = {icon, cta_url, post_id, slug, meeting_date}` silently drops anything else. | Must be extended with `verse_id`, `quiz_id`, `attempt_id` or the CTA breaks (P5-018). |
| `NotificationType` has 4 values; `_ANNOUNCEMENT_TYPES`, `tab_counts()` and `NotificationTabCounts` are hard-coded against them. | Adding `BIBLE_VERSE` touches all four places (P5-018). |
| No `quiz`/`points` backend modules. `frontend/src/modules/bible/{api,components,hooks,pages,types}` exists but is **empty**; no `quiz`/`points` frontend modules. | All greenfield, folder shapes already decided. |
| Frontend has **no date library** (native `Intl` only), **no shared date util** (`src/utils/`, `src/constants/` are empty dirs), **no countdown hook**, **no rich-text editor**. | §8.4 adds `lib/datetime.ts`; D-8 removes the editor need. |
| Two different "week" meanings will coexist: attendance = Thursday meeting week (`MEETING_WEEKDAY = 3`, Thu→Wed); points/verses = Monday ISO week (D-5). | Copy must disambiguate; never import `meeting_schedule` into bible/quiz/points code. |
| Current Alembic head: **`e3b7d1c95f42`**. | Two new revisions chain from it (§4.9). |
| Backend JSON is **snake_case**; `phase-5.md` uses camelCase (`scheduledAt`, `durationSeconds`). | The codebase convention wins everywhere (§5). |
| Frontend CI: only `npm run build` (= `tsc -b && vite build`) is blocking; tests are `continue-on-error`. Backend CI blocks on `ruff check`, `ruff format --check`, `mypy app` (strict), `pytest`. | Treat frontend test failures as blocking anyway. |

---

# 2. Product decisions (answered by the product owner — binding)

| ID | Decision | Consequence |
| --- | --- | --- |
| **D-1** | **Content is authored once, Arabic-first.** No `_ar`/`_en` column pairs for verse or quiz content. | One `title`, `text`, `reflection`, `question`, `option_text` per record. Only UI chrome is localised. The notifications `_ar`/`_en` pattern applies **only** to the publication notification copy (which is generated code, not authored content). |
| **D-2** | **Extend `bible_verses`; drop the weekly-unique index.** Add `title`, `subtitle`, `book`, `chapter`, `verse_start`, `verse_end`, `reflection`, `status`; replace `is_published` with `status`; `week_start_date` becomes nullable + derived. Multiple published verses may exist; "This Week" is the newest published verse. | Migration `p5_a` (§4.9). No data loss; existing rows backfill deterministically. |
| **D-3** | **Publication runs from an internal endpoint driven by an external cron.** `POST /api/v1/internal/scheduler/tick`, authorised by `X-Cron-Secret` **or** an ADMIN bearer. It publishes due schedules, then drains the outbox. No worker container, no in-process loop. | Works on the uvicorn container and on Vercel. Idempotent, safe to run every minute, safe to run concurrently (`FOR UPDATE SKIP LOCKED`). |
| **D-4** | **One attempt per user per quiz**, enforced by `uq_quiz_attempts_quiz_user`. | Second start → `409 attempt_exists`. Result stays viewable forever. No retake button anywhere in the UI. |
| **D-5** | **Monday ISO week** for weekly points and for `week_start_date`. | New `core/time/periods.py`. Attendance keeps its Thursday week; the two never mix. |
| **D-6** | **Mark as Read is required before starting the quiz.** | `POST /quizzes/{id}/attempts` → `403 verse_not_read`. Start Quiz is disabled with a hint until read. Read-rate analytics is documented as gate-influenced (BR-14). |
| **D-7** | **Incremental answer save + submit.** `PUT /quiz-attempts/{id}/answers/{question_id}` on each selection, `POST /quiz-attempts/{id}/submit` grades what is stored. | Survives reload/tab-kill; timer expiry grades real answers. The mockup copy "Your answers are saved automatically" is accurate. |
| **D-8** | **Plain multiline text**, no rich-text editor. | No editor dependency, no HTML sanitiser, no stored-XSS surface. Textareas with character counters; newlines preserved on render (`whitespace-pre-line`). The toolbars in `Create and Edit Bible` and `QuestionManagement` are **not** built. |
| **D-9** | **Everything in the analytics mockups is in scope:** CSV exports, daily opens/reads time series, score-distribution histogram, completion-status donut, completion-rate distribution donut, monthly trend, Top-3, per-user sparklines, per-user question-by-question review drawer, engagement funnel. | Adds US-029/030/031 (+13 points → 68 total). Delivered in wave 5C (§12). |
| **D-10** | Mockup sidebar entries that are **not** Phase 5 features — Categories, Tags, Email Templates, General Settings, Users, Reports — ship as the existing `AdminSidebar` `kind: "disabled"` placeholders with the `comingSoon` tooltip. "Weekly Verses" links to `/admin/bible-verses?status=scheduled`. | No new features invented. Flag for escalation if functional screens were expected. |
| **D-11** | `DELETE /bible-verses/{id}` and `DELETE /quizzes/{id}` are **archive** (`status = ARCHIVED`), never row deletion. Restore = `PATCH … {status: "DRAFT"}`. | Matches the platform's status-lifecycle convention (no soft-delete column anywhere in the codebase). |
| **D-12** | **One quiz per verse**, enforced by `uq_quizzes_verse_id`. | `GET /bible-verses/{verse_id}/quiz` is singular; the "Add Quiz" affordance appears only when none exists. |
| **D-13** | Options are managed **inside the question payload** (server diffs the array). No standalone option endpoints. | Matches the single "Save Question" button in `QuestionManagement`. |
| **D-14** | The publication notification goes to the **creator only** (email + in-app row). No broadcast to members in Phase 5. | Per `phase-5.md` §45. Member-wide "new weekly verse" broadcast is listed in §11 out of scope. |
| **D-15** | CSV exports are **server-side** (`text/csv` + UTF-8 BOM), capped at `ANALYTICS_EXPORT_MAX_ROWS`. | The attendance client-side CSV walk does not scale to full analytics datasets. |
| **D-16** | Verse opens are **deduplicated per user per verse within `VERSE_OPEN_DEDUPE_SECONDS`** (default 300). | "Total Opens" cannot be inflated by refreshing. Documented in the metrics legend. |
| **D-17** | Score is reported on the quiz's own point scale (`score / total_points`); the "x / 10" in the mockups is a **normalised** presentation value `round(score / total_points * 10, 1)`. | Avoids forcing every quiz to total 10 points. Frozen field name `score_out_of_10`. |

---

# 3. Business rules

## 3.1 Roles

`RoleName` is `MEMBER | SERVANT | ADMIN` (**not** `USER` — `phase-5.md` says "User", the code says `MEMBER`).

| Capability | MEMBER | SERVANT | ADMIN |
| --- | --- | --- | --- |
| See published verses, open, mark read | ✅ | ✅ | ✅ |
| Take a quiz, see own result, see own points | ✅ | ✅ | ✅ |
| Create / edit / archive verses, schedule, publish now | ❌ | ✅ | ✅ |
| Create / edit / archive quizzes, questions, publish quiz | ❌ | ✅ | ✅ |
| Verse, quiz and monthly analytics + exports | ❌ | ✅ | ✅ |
| Trigger `internal/scheduler/tick` manually | ❌ | ❌ | ✅ |
| Archive/edit content created by another servant | ❌ | ✅ | ✅ |

Servants may manage each other's content (`phase-5.md` §1 "Both roles can manage Bible content unless a specific permission says otherwise"). `created_by` is displayed for accountability, not used for authorization.

## 3.2 Verse lifecycle

```text
DRAFT ──publish now──────────────► PUBLISHED ──archive──► ARCHIVED
  │                                    ▲                     │
  └──schedule──► SCHEDULED ──cron──────┘                     │
                    │  cancel                                │
                    └──────────► DRAFT ◄────restore──────────┘
```

- **BR-1** Required to save a verse: `title`, `verse_reference`, `book`, `chapter`, `verse_start`, `text`. Optional: `subtitle`, `verse_end`, `reflection`, `image`, `translation` (default `NIV`).
- **BR-2** Lengths: `title` ≤ 100 (mockup counter `24 / 100`), `subtitle` ≤ 200, `verse_reference` ≤ 120, `book` ≤ 60, `text` ≤ 2000 (`36 / 2,000`), `reflection` ≤ 5000 (`183 / 5,000`), `image` ≤ 500. `chapter` 1–150, `verse_start` 1–200, `verse_end` ≥ `verse_start` when present.
- **BR-3** MEMBER may read only `status = PUBLISHED`. Any other status returns **404**, never 403 (platform convention: never leak existence).
- **BR-4** `published_at` is set once, on the first transition into `PUBLISHED`, and never rewritten. `week_start_date = iso_week_start(published_at in platform tz)`, set at publish time.
- **BR-5** Publishing an `ARCHIVED` verse is rejected (`409 invalid_status_transition`). `DRAFT → PUBLISHED`, `SCHEDULED → PUBLISHED`, `PUBLISHED → ARCHIVED`, `ARCHIVED → DRAFT`, `SCHEDULED → DRAFT` (cancel) are the only allowed transitions.
- **BR-6** Archiving a verse cascades to its quiz: the quiz becomes `ARCHIVED` too, and no new attempts may start. Attempts already `IN_PROGRESS` may still be submitted and graded.
- **BR-7** Editing a `PUBLISHED` verse is allowed (typo fixes) and does not touch `published_at`, opens, reads or the quiz.

## 3.3 Scheduling

- **BR-8** `scheduled_at` must be strictly in the future at request time, ≤ 2 years out. Otherwise `422 invalid_schedule` with the mockup's "Invalid Schedule / You cannot schedule a post in the past" copy.
- **BR-9** At most one active (`SCHEDULED`) schedule row per verse — `uq_verse_publication_schedules_active` partial unique index. Re-scheduling updates that row; cancelling sets `CANCELLED` and returns the verse to `DRAFT`.
- **BR-10** The tick claims rows with `status = SCHEDULED AND scheduled_at <= now_utc()` using `FOR UPDATE SKIP LOCKED`, batch ≤ `SCHEDULER_TICK_MAX_BATCH`. Publication is **idempotent**: a claimed row is moved to `PUBLISHED` in the same transaction as the verse status change; a second tick finds nothing.
- **BR-11** A publication failure sets `status = FAILED`, `attempts += 1`, `last_error`, and is retried by the next tick while `attempts < 5`; at 5 it stays `FAILED` and is surfaced in the management list with a red badge. Verses whose status became `ARCHIVED` or whose schedule was `CANCELLED` are skipped, never published.
- **BR-12** The tick timezone is the platform timezone (Africa/Cairo, `PLATFORM_TIMEZONE`). The Schedule screen's timezone selector is **display-only and fixed** to the platform timezone (mockup: "(GMT+02:00) Cairo, Egypt (Platform Timezone)"); `scheduled_at` is stored as UTC `timestamptz`.

## 3.4 Engagement

- **BR-13** `POST /bible-verses/{id}/open` inserts a `verse_views` row unless the same user opened the same verse within `VERSE_OPEN_DEDUPE_SECONDS` (D-16). Returns 204 always. Managers' own opens are recorded and **excluded** from analytics via a role filter at query time (`role_id = MEMBER`), so staff previews do not distort metrics.
- **BR-14** `POST /bible-verses/{id}/read` is idempotent via `INSERT … ON CONFLICT DO NOTHING` on `uq_verse_reads_verse_user`. Response `{read_at, already_read}`. Reads are a prerequisite for the quiz (D-6), so the read-rate metric legend states "Read is also the quiz gate".
- **BR-15** Opens and reads on non-`PUBLISHED` verses are rejected with 404 (BR-3).
- **BR-16** Metrics: `total_opens` = row count; `unique_opens` = distinct `user_id`; `total_reads` = `unique_readers` = row count in `verse_reads` (one row per user by construction); `read_rate = round(unique_readers / unique_opens * 100, 1)`, `0.0` when `unique_opens = 0`.

## 3.5 Quiz content

- **BR-17** A quiz belongs to exactly one verse (D-12). `duration_seconds` ∈ [`QUIZ_MIN_DURATION_SECONDS`, `QUIZ_MAX_DURATION_SECONDS`] = [30, 7200]; the UI offers 1/2/5/10/15/30 minutes plus a custom value.
- **BR-18** `total_points` is **derived** — recomputed as `sum(question.points)` on every question insert/update/delete/reorder and stored on `quizzes`. It is read-only in the API (mockup: "Calculated from questions").
- **BR-19** Question: `question` text required ≤ 500, `points` 1–100, `position` ≥ 1. Max `QUIZ_MAX_QUESTIONS` (50) per quiz.
- **BR-20** Options: 2–`QUIZ_MAX_OPTIONS_PER_QUESTION` (6) per question, `option_text` ≤ 500, **exactly one** `is_correct`. "At most one" is enforced in the DB by the partial unique index `uq_quiz_options_correct`; "exactly one" by validation on save and on publish.
- **BR-21** Publish validation (all must pass, returned as a rule list for the readiness panel): ≥ 1 question · every question ≥ 2 options · every question exactly 1 correct option · every question `points` ≥ 1 · `total_points` ≥ 1 · duration in range · parent verse is `PUBLISHED` **or** `SCHEDULED`. Failure → `422 quiz_not_publishable` with `data.failed_rules[]`.
- **BR-22** Editing a `PUBLISHED` quiz is allowed but **never mutates existing attempts**: `quiz_attempts.total_points` and `quiz_answers.points_awarded` are snapshots taken at attempt time, so historical scores and analytics stay stable.
- **BR-23** A member's quiz is available iff verse `PUBLISHED` **and** quiz `PUBLISHED` **and** the member has a `verse_reads` row (D-6).

## 3.6 Attempt, timer, grading

- **BR-24** `POST /quizzes/{id}/attempts` creates one attempt: `started_at = now_utc()`, `expires_at = started_at + duration_seconds`, `total_points` and `duration_seconds` snapshotted, `status = IN_PROGRESS`. Second call → `409 attempt_exists` with `data.attempt_id`. Race → `IntegrityError` → same 409.
- **BR-25** The response carries `remaining_seconds` (authoritative) and `server_time`. The frontend timer is decorative (`phase-5.md` §23); the server decides expiry.
- **BR-26** `PUT /quiz-attempts/{id}/answers/{question_id}` upserts on `uq_quiz_answers_attempt_question`. Rejected with `409 attempt_expired` when `now > expires_at + QUIZ_ATTEMPT_GRACE_SECONDS`, or `409 attempt_finished` when the attempt is already finished. `selected_option_id` must belong to that question (else `422 invalid_option`). Grading fields are **not** written here.
- **BR-27** `POST /quiz-attempts/{id}/submit` grades stored answers only. `finished_at = now_utc()`; `status = COMPLETED` when `now <= expires_at + grace`, otherwise `AUTO_FINISHED`. Submit **never** fails because of expiry — an expired attempt is graded and auto-finished.
- **BR-28** Grading per question: `is_correct = selected_option_id == the option where is_correct`, `points_awarded = question.points if is_correct else 0`. Unanswered questions score 0 and count as incorrect. `score = sum(points_awarded)`, `correct_count`, `incorrect_count = question_count - correct_count`, `percentage = round(score / total_points * 100, 1)`, `score_out_of_10 = round(score / total_points * 10, 1)` (D-17).
- **BR-29** Submitting a finished attempt returns the **same** result payload with no new grading and no new points (`phase-5.md` §58). Idempotency boundary = the finished attempt.
- **BR-30** An attempt left `IN_PROGRESS` past `expires_at` is lazily auto-finished on the next touch (`GET /quiz-attempts/{id}`, `PUT answers`, `submit`) **and** by the scheduler tick, which auto-finishes expired attempts in batch so analytics never wait for the user to come back.

## 3.7 Points

- **BR-31** One `point_transactions` row per completed attempt, `points = score`. `uq_point_transactions_attempt` (unique `quiz_attempt_id`) makes double-awarding impossible at the DB level (`phase-5.md` §33).
- **BR-32** Ledger rows are **append-only and immutable**. No updates, no deletes, no recalculation. Editing a quiz after the fact never rewrites history (BR-22).
- **BR-33** Every row stores `period_week_start` (Monday ISO, D-5) and `period_month` (first day of month) in platform-local terms, so historical weekly/monthly reporting is a plain indexed `GROUP BY` and August stays August (`phase-5.md` §31).
- **BR-34** Aggregates: `lifetime = SUM(points)`; `this_week = SUM WHERE period_week_start = iso_week_start(today_local())`; `this_month = SUM WHERE period_month = month_start(today_local())`.
- **BR-35** Zero-point attempts still create a `points = 0` row, so "quizzes completed" counts and completion rates come from the same ledger.
- **BR-36** A member sees only their own points and history. Managers see anyone's via the analytics endpoints. No endpoint accepts client-supplied point values.

## 3.8 Analytics

- **BR-37** Every analytics number is computed by a grouped SQL query — never N+1, never in a Python loop over users (follow `weekly_attendance_repository.counts_*` shapes).
- **BR-38** Manager-role users are excluded from member-facing engagement metrics (BR-13) but **included** in quiz analytics if they actually completed a quiz (they show as participants with their role badge).
- **BR-39** Monthly analytics: `participants` = distinct users with a finished attempt in the month; `quizzes_completed` = finished attempts; `total_points` = ledger sum; `average_score` = `avg(score_out_of_10)`; `completion_rate(user) = finished_attempts / quizzes_published_in_month`, bucketed `100% / 75–99% / 50–74% / <50%`; `rank` = dense rank by month points desc, then `quizzes_completed` desc, then user name.
- **BR-40** Exports contain exactly the rows the filtered table would contain, in the same order, capped at `ANALYTICS_EXPORT_MAX_ROWS` (5000) with a `413 export_too_large` when exceeded.

---

# 4. Domain model and database

## 4.1 Aggregates and module boundaries

```text
BIBLE (app/modules/bible)          QUIZ (app/modules/quiz)         POINTS (app/modules/points)
├── BibleVerse            ────────►├── Quiz                        └── PointTransaction
├── VersePublicationSchedule       │   ├── QuizQuestion                 (append-only ledger)
├── VerseView                      │   └── QuizOption                        ▲
├── VerseRead                      └── QuizAttempt ──► QuizAnswer ───────────┘
└── verse analytics                    quiz analytics                 monthly analytics
```

Cross-module rule: `quiz` may read `bible_verses` through `uow.bible_verses`; `points` never imports `quiz` domain objects — the quiz submit use case calls `PointsService.award_for_attempt(...)` inside the same UoW transaction.

## 4.2 `bible_verses` — ALTER (migration `p5_a`)

| Column | Type | Notes |
| --- | --- | --- |
| `id`, `created_at`, `updated_at`, `created_by` | — | unchanged |
| `verse_reference` | `String(120)` | unchanged, required (display string, e.g. `Matthew 6:25-34`) |
| `text` | `Text` | unchanged, required (verse text) |
| `translation` | `String(80)` default `NIV` | unchanged |
| `image` | `String(500)` null | unchanged (cover image URL) |
| `published_at` | `timestamptz` null | unchanged, write-once |
| `week_start_date` | `Date` null | **altered to nullable**, derived at publish (Monday ISO) |
| ~~`is_published`~~ | — | **dropped** after backfill |
| `status` | `VARCHAR(20)` `SAEnum(VerseStatus, native_enum=False)` NOT NULL default `DRAFT` | **new** |
| `title` | `String(100)` NOT NULL | **new** — backfill from `verse_reference` |
| `subtitle` | `String(200)` null | **new** |
| `book` | `String(60)` NOT NULL | **new** — backfill `split(verse_reference)[0]` then `'Unknown'` |
| `chapter` | `SmallInteger` NOT NULL | **new** — backfill `1` |
| `verse_start` | `SmallInteger` NOT NULL | **new** — backfill `1` |
| `verse_end` | `SmallInteger` null | **new** |
| `reflection` | `Text` null | **new** |

Indexes: **drop** `uq_bible_verses_published_week` (D-2); keep `ix_bible_verses_week_start_date`; **add** `ix_bible_verses_status_published_at (status, published_at DESC)`, `ix_bible_verses_created_by`.
Checks: `ck_bible_verses_chapter` (1–150), `ck_bible_verses_verse_range` (`verse_end IS NULL OR verse_end >= verse_start`).
Enum: `VerseStatus = DRAFT | SCHEDULED | PUBLISHED | ARCHIVED`.

## 4.3 `verse_publication_schedules` — NEW

`id` · `verse_id` FK→`bible_verses` CASCADE · `scheduled_at timestamptz NOT NULL` · `status VARCHAR(20)` (`SCHEDULED|PUBLISHED|CANCELLED|FAILED`) default `SCHEDULED` · `published_at timestamptz null` · `attempts SmallInteger default 0` · `last_error Text null` · `notification_status VARCHAR(20)` (`PENDING|SENT|FAILED`) default `PENDING` · `notification_attempts SmallInteger default 0` · `notified_at timestamptz null` · `created_by` FK→`users` SET NULL · timestamps.
Indexes: `uq_verse_publication_schedules_active (verse_id) WHERE status = 'SCHEDULED'` (partial unique, BR-9) · `ix_verse_publication_schedules_due (status, scheduled_at)`.

## 4.4 `verse_views` / `verse_reads` — NEW

`verse_views`: `id` · `verse_id` FK CASCADE · `user_id` FK CASCADE · `opened_at timestamptz` (`CreatedAtMixin`-style, server default `now()`).
Indexes: `ix_verse_views_verse_opened (verse_id, opened_at)` · `ix_verse_views_verse_user (verse_id, user_id)` · `ix_verse_views_user_opened (user_id, opened_at)`.

`verse_reads`: `id` · `verse_id` FK CASCADE · `user_id` FK CASCADE · `read_at timestamptz`.
Indexes: `uq_verse_reads_verse_user (verse_id, user_id)` unique (BR-14) · `ix_verse_reads_verse_read_at (verse_id, read_at)`.

## 4.5 `quizzes` / `quiz_questions` / `quiz_options` — NEW

`quizzes`: `id` · `verse_id` FK CASCADE **unique** (`uq_quizzes_verse_id`, D-12) · `title String(100)` NOT NULL · `description Text null` (≤500) · `duration_seconds Integer` NOT NULL · `total_points Integer` NOT NULL default 0 (derived, BR-18) · `status VARCHAR(20)` (`DRAFT|PUBLISHED|ARCHIVED`) default `DRAFT` · `published_at timestamptz null` · `created_by` FK SET NULL · timestamps.
Checks: `ck_quizzes_duration` (30 ≤ `duration_seconds` ≤ 7200). Index: `ix_quizzes_status`.

`quiz_questions`: `id` · `quiz_id` FK CASCADE · `question Text` NOT NULL · `points SmallInteger` NOT NULL default 1 · `position SmallInteger` NOT NULL · timestamps.
Check `ck_quiz_questions_points` (1–100). Index `ix_quiz_questions_quiz_position (quiz_id, position)` — **non-unique on purpose**: drag-reorder rewrites all positions in one transaction and a unique index would deadlock on transient duplicates. Deterministic order is `ORDER BY position, created_at, id`.

`quiz_options`: `id` · `question_id` FK CASCADE · `option_text String(500)` NOT NULL · `is_correct Boolean` NOT NULL default `false` · `position SmallInteger` NOT NULL · `created_at`.
Indexes: `uq_quiz_options_correct (question_id) WHERE is_correct` partial unique (BR-20) · `ix_quiz_options_question_position (question_id, position)`.

## 4.6 `quiz_attempts` / `quiz_answers` / `point_transactions` — NEW

`quiz_attempts`: `id` · `quiz_id` FK CASCADE · `user_id` FK CASCADE · `started_at timestamptz` · `expires_at timestamptz` · `submitted_at timestamptz null` · `finished_at timestamptz null` · `status VARCHAR(20)` (`IN_PROGRESS|COMPLETED|AUTO_FINISHED`) default `IN_PROGRESS` · `duration_seconds Integer` (snapshot) · `total_points Integer` (snapshot, BR-22) · `question_count SmallInteger` (snapshot) · `score Integer` default 0 · `correct_count SmallInteger` default 0 · `incorrect_count SmallInteger` default 0 · timestamps.
Indexes: `uq_quiz_attempts_quiz_user (quiz_id, user_id)` unique (D-4) · `ix_quiz_attempts_quiz_status (quiz_id, status)` · `ix_quiz_attempts_user_finished (user_id, finished_at)` · `ix_quiz_attempts_expiry (status, expires_at)` (BR-30 batch auto-finish).

`quiz_answers`: `id` · `attempt_id` FK CASCADE · `question_id` FK CASCADE · `selected_option_id` FK→`quiz_options` SET NULL null · `is_correct Boolean null` · `points_awarded Integer` default 0 · `answered_at timestamptz` · `graded_at timestamptz null`.
Index: `uq_quiz_answers_attempt_question (attempt_id, question_id)` unique (BR-26 upsert).

`point_transactions`: `id` · `user_id` FK CASCADE · `quiz_attempt_id` FK→`quiz_attempts` CASCADE **unique** (`uq_point_transactions_attempt`, BR-31) · `source VARCHAR(20)` (`QUIZ`) default `QUIZ` · `points Integer` NOT NULL · `awarded_at timestamptz` · `period_week_start Date` NOT NULL · `period_month Date` NOT NULL · `created_at`.
Check `ck_point_transactions_points` (`points >= 0`). Indexes: `ix_point_transactions_user_awarded (user_id, awarded_at DESC)` · `ix_point_transactions_month_user (period_month, user_id)` · `ix_point_transactions_week_user (period_week_start, user_id)`.

## 4.7 Outbox dispatch (new, no new infrastructure)

```text
publish verse (one transaction)
  ├── bible_verses.status → PUBLISHED, published_at, week_start_date
  ├── verse_publication_schedules.status → PUBLISHED, published_at
  └── uow.record(BibleVersePublished(verse_id, schedule_id, creator_id, verse_reference, published_at))
                                        │  commit → outbox_events row (PENDING)
                                        ▼
POST /internal/scheduler/tick  step 2: outbox drain
  ├── outbox.claim_pending(limit)                  FOR UPDATE SKIP LOCKED
  ├── EVENT_HANDLERS["bible_verse.published"]      → creator email + in-app notification
  ├── success → mark_processed + schedule.notification_status = SENT, notified_at
  └── failure → mark_failed(retry_after_seconds=300) + notification_attempts += 1
                (5 attempts → notification_status = FAILED, logged, surfaced to admins)
```

New file: `app/shared/application/outbox_dispatcher.py` with an explicit `EVENT_HANDLERS: dict[str, Handler]` registry. The scheduler must never call `EmailService` directly (`phase-5.md` §47).

## 4.8 New shared time helpers — `app/core/time/periods.py`

```python
def iso_week_start(day: date) -> date          # Monday (D-5)
def iso_week_end(day: date) -> date            # Sunday
def month_start(day: date) -> date             # first of month
def month_bounds(year: int, month: int) -> tuple[date, date]
def week_window_utc(day: date) -> tuple[datetime, datetime]   # local Mon 00:00 → next Mon 00:00, as UTC
def month_window_utc(year: int, month: int) -> tuple[datetime, datetime]
def last_n_months(anchor: date, n: int) -> list[date]         # oldest → newest, first-of-month
```

`attendance/domain/meeting_schedule.py` is **not** touched and **not** imported by Phase 5 code.

## 4.9 Migration plan

Head today: `e3b7d1c95f42`. Two revisions, chained, both with working `downgrade()`.

**`p5_a` — "phase 5a: bible verse lifecycle, schedules, engagement"**
1. `ALTER TABLE bible_verses`: add `status` nullable → backfill `CASE WHEN is_published THEN 'PUBLISHED' ELSE 'DRAFT' END` → set NOT NULL, default `DRAFT`.
2. Add `title` nullable → backfill `verse_reference` (truncated to 100) → NOT NULL. Same backfill-then-NOT-NULL pattern for `book` (`split_part(verse_reference, ' ', 1)`, `'Unknown'` when empty), `chapter` (1), `verse_start` (1).
3. Add nullable `subtitle`, `verse_end`, `reflection`.
4. `DROP INDEX uq_bible_verses_published_week`; `ALTER COLUMN week_start_date DROP NOT NULL`; `DROP COLUMN is_published`.
5. Add the two check constraints and two new indexes.
6. `CREATE TABLE verse_publication_schedules`, `verse_views`, `verse_reads` with all indexes.
Downgrade reverses in order, recreating `is_published` from `status = 'PUBLISHED'` and the weekly partial unique index.

**`p5_b` — "phase 5b: quizzes, attempts, points ledger"**
`CREATE TABLE quizzes`, `quiz_questions`, `quiz_options`, `quiz_attempts`, `quiz_answers`, `point_transactions` with all constraints/indexes. Downgrade drops in reverse FK order.

Both revisions must be verified with `alembic upgrade head` **and** `alembic downgrade -1` against `postgresql+asyncpg://marmarkos:marmarkos@localhost:55432/marmarkos_test` (Rule 5/6).

## 4.10 Registry / UoW / User wiring

- `registry.py`: import `app.modules.bible.infrastructure.persistence.models`, `…quiz.infrastructure.persistence.models`, `…points.infrastructure.persistence.models`.
- `UnitOfWork` new properties: `verse_schedules`, `verse_views`, `verse_reads`, `quizzes`, `quiz_questions`, `quiz_options`, `quiz_attempts`, `quiz_answers`, `point_transactions` (`bible_verses` already exists).
- `User` model: add `verse_reads`, `verse_views`, `quiz_attempts`, `point_transactions` relationships + `TYPE_CHECKING` imports (all `lazy="raise"`-safe; never eager-load from `User`).

---

# 5. Frozen API contract

Base: `/api/v1`. JSON is **snake_case**. Errors are `{"detail": {"code": "...", "message": "..."}}` (+ `data` for structured cases). Lists use `Page[T]` = `{items, total, page, size, pages, has_next}`. Managers = `ADMIN|SERVANT`.

## 5.1 Verses — content (manager)

| Method & path | Auth | Notes |
| --- | --- | --- |
| `POST /bible-verses` | manager | 201 → `VerseDetail`. Body: `title, subtitle?, verse_reference, book, chapter, verse_start, verse_end?, text, reflection?, image?, translation?, status?(DRAFT\|PUBLISHED)` |
| `GET /bible-verses` | manager | `Page[VerseAdminItem]`; params `status`, `q`, `created_by`, `date_from`, `date_to`, `has_quiz`, `page`, `size`, `sort=published_at\|scheduled_at\|created_at\|title`, `order` |
| `GET /bible-verses/stats` | manager | `{total, drafts, scheduled, published, archived}` (KPI cards) |
| `GET /bible-verses/{id}` | any | manager → full `VerseDetail` (+`opens`, `reads`, `created_by_user`, `schedule`, `quiz_summary`); MEMBER → `VerseDetail` public projection, 404 unless `PUBLISHED` (BR-3) |
| `PATCH /bible-verses/{id}` | manager | partial; `status` accepted for `DRAFT↔PUBLISHED`/`ARCHIVED→DRAFT` transitions (BR-5) |
| `DELETE /bible-verses/{id}` | manager | 204, archive (D-11) |
| `POST /bible-verses/{id}/publish` | manager | 200 → `VerseDetail`; publishes now, cancels any active schedule |

## 5.2 Verses — scheduling (manager)

| Method & path | Notes |
| --- | --- |
| `POST /bible-verses/{id}/schedule` | 201 → `VerseScheduleResponse`. Body `{scheduled_at}` (ISO 8601 with offset). 422 `invalid_schedule` (BR-8), 409 `schedule_exists` |
| `PATCH /bible-verses/{id}/schedule` | 200, reschedule the active row |
| `DELETE /bible-verses/{id}/schedule` | 204, cancel → verse back to `DRAFT` |
| `GET /bible-verses/schedules` | `Page[VerseScheduleItem]`; params `status`, `date_from`, `date_to` — powers the "Weekly Verses"/Scheduled tab (D-10) |

## 5.3 Verses — member feed & engagement

| Method & path | Notes |
| --- | --- |
| `GET /bible-verses/current` | newest `PUBLISHED` verse as `VerseCard` or `204` when none |
| `GET /bible-verses/published` | `Page[VerseCard]`; params `q`, `read=all\|read\|unread`, `has_quiz`, `page`, `size`. `VerseCard` includes `is_read`, `has_quiz`, `quiz_state`, `published_at` |
| `POST /bible-verses/{id}/open` | 204, deduped (BR-13) |
| `POST /bible-verses/{id}/read` | 200 `{read_at, already_read}` (BR-14) |

## 5.4 Quiz content (manager)

| Method & path | Notes |
| --- | --- |
| `POST /bible-verses/{verse_id}/quiz` | 201 → `QuizDetail`; 409 `quiz_exists` (D-12) |
| `GET /bible-verses/{verse_id}/quiz` | `QuizDetail` (manager projection incl. `is_correct`), 404 when none |
| `GET /quizzes` | `Page[QuizAdminItem]`; params `status`, `q`, `verse_id`, `page`, `size` |
| `GET /quizzes/{id}` | `QuizDetail` |
| `PATCH /quizzes/{id}` | partial (`title`, `description`, `duration_seconds`, `status`) |
| `DELETE /quizzes/{id}` | 204 archive |
| `POST /quizzes/{id}/publish` | 200; 422 `quiz_not_publishable` + `data.failed_rules[]` (BR-21) |
| `GET /quizzes/{id}/validation` | `{is_publishable, rules: [{code, passed, detail}]}` — readiness panel |
| `POST /quizzes/{id}/questions` | 201 → `QuestionDetail`; body `{question, points, options: [{option_text, is_correct, position}]}` |
| `PATCH /quiz-questions/{id}` | full options array; server diffs (D-13) |
| `DELETE /quiz-questions/{id}` | 204 (hard delete; questions are not user-visible history) |
| `POST /quiz-questions/{id}/duplicate` | 201, appended at the end |
| `POST /quizzes/{id}/questions/reorder` | 200; body `{question_ids: [uuid, …]}` must be a permutation, else 422 `invalid_reorder` |

## 5.5 Quiz taking (member)

| Method & path | Notes |
| --- | --- |
| `GET /bible-verses/{verse_id}/quiz/summary` | `{quiz_id, title, description, question_count, total_points, duration_seconds, is_available, requires_read, has_read, attempt: AttemptState\|null}` — the "Test Your Understanding" card |
| `POST /quizzes/{id}/attempts` | 201 → `AttemptStartResponse` `{attempt_id, started_at, expires_at, remaining_seconds, server_time, duration_seconds, total_points, questions:[{id, question, points, position, options:[{id, option_text, position}]}]}` — **no `is_correct`**. 403 `verse_not_read` (D-6), 403 `quiz_not_available`, 409 `attempt_exists` + `data.attempt_id` |
| `GET /quiz-attempts/{id}` | resume: same shape + `answers: [{question_id, selected_option_id}]`, `status`, `remaining_seconds`. Own attempt only (else 404) |
| `PUT /quiz-attempts/{id}/answers/{question_id}` | 204; body `{selected_option_id}`. 409 `attempt_expired` / `attempt_finished`, 422 `invalid_option` (BR-26) |
| `POST /quiz-attempts/{id}/submit` | 200 → `AttemptResultResponse`, idempotent (BR-29) |
| `GET /quiz-attempts/{id}/result` | same payload for reloads |

`AttemptResultResponse` = `{attempt_id, quiz_id, verse_id, status, score, total_points, score_out_of_10, percentage, correct_count, incorrect_count, question_count, points_awarded, finished_at, time_taken_seconds, points: {week_before, week_after, month_before, month_after, lifetime_before, lifetime_after}, review: [{question_id, position, question, points, selected_option_id, correct_option_id, is_correct, points_awarded, options: [{id, option_text}]}]}`.
Correct answers appear **only** in this payload, only for a finished attempt, only for its owner (§10).

## 5.6 Points (member)

| Method & path | Notes |
| --- | --- |
| `GET /users/me/points` | `{lifetime, this_week, this_month, quizzes_completed, average_score_out_of_10}` |
| `GET /users/me/points/monthly` | `?months=6` (≤ `POINTS_HISTORY_MAX_MONTHS`) → `{items: [{period_month, points, quizzes_completed}]}` — chart + history list |
| `GET /users/me/points/history` | `Page[PointActivityItem]` `{id, points, awarded_at, quiz_id, quiz_title, verse_id, verse_reference, source}` |

## 5.7 Analytics (manager)

| Method & path | Notes |
| --- | --- |
| `GET /bible-verses/analytics/overview` | dashboard totals: `{total_posts, published, total_opens, total_reads, read_rate}` |
| `GET /bible-verses/{id}/analytics` | `{verse, total_opens, unique_opens, total_reads, unique_readers, read_rate, series: [{bucket, opens, reads}], quiz: {participants, average_score_out_of_10, quiz_id}\|null}`; params `granularity=daily\|weekly`, `date_from`, `date_to` |
| `GET /bible-verses/{id}/analytics/users` | `Page[VerseUserEngagementItem]` `{user_id, full_name, avatar, opened_count, has_read, last_opened_at}`; params `q`, `read`, `page`, `size`, `sort` |
| `GET /bible-verses/{id}/analytics/export` | `text/csv` (D-15) |
| `GET /quizzes/{id}/analytics` | `{participants, completed, auto_finished, average_score_out_of_10, highest_score, lowest_score, total_points_awarded, max_possible_points, score_distribution: [{score, users}], completion_status: [{status, users, percentage}]}` |
| `GET /quizzes/{id}/analytics/users` | `Page[QuizUserResultItem]` `{user_id, full_name, email, avatar, score, total_points, percentage, points_awarded, status, finished_at, time_taken_seconds}`; params `q`, `score_min`, `score_max`, `status`, `date_from`, `date_to`, `page`, `size`, `sort` |
| `GET /quiz-attempts/{id}/review` | manager view of one attempt = `AttemptResultResponse.review` + user block (drawer) |
| `GET /quizzes/{id}/analytics/export` | `text/csv` |
| `GET /quiz-analytics/monthly` | `?month=YYYY-MM` → `{month, participants, quizzes_completed, total_points, average_score_out_of_10, quizzes_published, trend: [{period_month, total_points, participants, average_score_out_of_10}], completion_distribution: [{bucket, users, percentage}], top: [{rank, user_id, full_name, avatar, points}]}` |
| `GET /quiz-analytics/monthly/users` | `Page[MonthlyUserItem]` `{rank, user_id, full_name, avatar, quizzes_completed, average_score_out_of_10, total_points, completion_rate, sparkline: [int × 6]}`; params `month`, `q`, `min_points`, `score_range`, `completion_rate`, `min_quizzes`, `page`, `size` |
| `GET /quiz-analytics/monthly/export` | `text/csv` |
| `GET /quiz-analytics/users/{user_id}` | `?month=` → user drawer: `{user, month, total_points, quizzes_completed, average_score_out_of_10, completion_rate, breakdown: [{quiz_id, quiz_title, score, total_points, score_out_of_10}], history: [{period_month, points}]}` |

## 5.8 Internal

`POST /api/v1/internal/scheduler/tick` — header `X-Cron-Secret: <CRON_SECRET>` **or** ADMIN bearer. Returns `{published, publish_failed, auto_finished_attempts, outbox_processed, outbox_failed}`. `503 scheduler_disabled` when `CRON_SECRET` is unset and no ADMIN bearer is present. Never returns 5xx for a single-item failure — failures are counted and logged (BR-11).

## 5.9 New error codes (added to `core/exceptions/errors.py`)

`invalid_status_transition` (409) · `invalid_schedule` (422) · `schedule_exists` (409) · `quiz_exists` (409) · `quiz_not_publishable` (422) · `quiz_not_available` (403) · `verse_not_read` (403) · `attempt_exists` (409) · `attempt_expired` (409) · `attempt_finished` (409) · `invalid_option` (422) · `invalid_reorder` (422) · `export_too_large` (413) · `scheduler_disabled` (503).

---

# 6. Frozen settings (`app/config.py` + `.env.example`)

```python
# -- Bible verses, quizzes & points (Phase 5) ---
CRON_SECRET: str | None = None            # shared secret for /internal/scheduler/tick
SCHEDULER_TICK_MAX_BATCH: int = 50
VERSE_OPEN_DEDUPE_SECONDS: int = 300      # D-16
BIBLE_VERSES_PAGE_SIZE: int = 12
BIBLE_VERSES_MAX_PAGE_SIZE: int = 50
QUIZ_MIN_DURATION_SECONDS: int = 30
QUIZ_MAX_DURATION_SECONDS: int = 7200
QUIZ_MAX_QUESTIONS: int = 50
QUIZ_MAX_OPTIONS_PER_QUESTION: int = 6
QUIZ_ATTEMPT_GRACE_SECONDS: int = 5       # network-latency tolerance, BR-26/27
QUIZ_ANALYTICS_PAGE_SIZE: int = 10
QUIZ_ANALYTICS_MAX_PAGE_SIZE: int = 100
POINTS_HISTORY_MAX_MONTHS: int = 24
ANALYTICS_EXPORT_MAX_ROWS: int = 5000
```

No new frontend env vars. `PLATFORM_TIMEZONE` (existing, `Africa/Cairo`) is the scheduling timezone (BR-12).

Cron wiring (documented in `README.md`, not code): one minute-ly caller, e.g.
`curl -fsS -X POST -H "X-Cron-Secret: $CRON_SECRET" https://<host>/api/v1/internal/scheduler/tick`.

---

# 7. Frozen i18n contract

Three new **top-level namespaces** in `frontend/src/i18n/resources/ar.ts` then `en.ts`: `bible`, `quiz`, `points`. Admin nav labels go under the existing `admin.nav.*`.

```text
bible.   list.{title,subtitle,thisWeek,previous,viewAll,search,filter,readBadge,quizBadge,quizAvailable,readMore,empty.{title,body}}
         detail.{back,weeklyVerse,publishedOn,reflection,readMore,markAsRead,markedAsRead,readFailed}
         quizCard.{title,body,questions,points,timeLimit,start,locked,lockedHint,completed,viewResult}
         admin.{title,subtitle,create,kpi.{total,drafts,scheduled,published},tabs.*,table.*,filters.*,actions.*,
                form.{title,edit,sections.*,fields.*,counters.*,preview.*,status.*,saveDraft,schedule,publish,cancel,validation.*},
                schedule.{title,subtitle,steps.*,timezoneNote,notificationNote,submit,already.*,invalid.*},
                analytics.{title,kpi.*,funnel.*,series.*,users.*,legend.*,export}}
quiz.    admin.{manage.*,builder.*,question.*,validation.rules.*,list.*,analytics.*}
         take.{header,timeRemaining,timesUp,question,of,previous,next,finish,autosaveNote,warning,expired,submitting,leaveConfirm.*}
         result.{completed,subtitle,correct,incorrect,pointsEarned,progress.{week,month,lifetime},summary,review.*,backToVerse,viewPoints}
points.  page.{title,subtitle,lifetime,thisMonth,thisWeek,overTime,range.*,history,viewAll,activity,empty.{title,body,cta}}
admin.nav.{bibleVerses,verses,weeklyVerses,quizzes,verseAnalytics,quizAnalytics,monthlyAnalytics}
```

Rules: Arabic first; every key in both files (parity test); no fragment concatenation — a full sentence per key with interpolation (`{{count}}`, `{{score}}`, `{{total}}`); Arabic numerals through `Intl.NumberFormat("ar-EG")`; verse text always `font-verse` (Amiri) per `Design-Guide.md` §7.1 and §22.

---

# 8. Frozen frontend contract

## 8.1 Modules

```text
src/modules/bible/{api/{index.ts,queryKeys.ts},components/,hooks/,pages/,types/index.ts}   (folder exists, empty)
src/modules/quiz/{…same…}                                                                   (new)
src/modules/points/{…same…}                                                                 (new)
```

Query-key roots: `bibleKeys = ["bible"]`, `quizKeys = ["quiz"]`, `pointsKeys = ["points"]`, each with tuple factories per the documented `attendance/api/queryKeys.ts` pattern.

## 8.2 Routes (`src/router.tsx`, all lazy + `<Suspense fallback={<PageSkeleton/>}>`; update `src/routes/README.md`)

| Path | Guard | Layout | Page |
| --- | --- | --- | --- |
| `/bible-verses` | `RequireAuth` | `Navbar` | `BibleVersesPage` |
| `/bible-verses/:verseId` | `RequireAuth` | `Navbar` | `VerseDetailPage` |
| `/bible-verses/:verseId/quiz` | `RequireAuth` | `Navbar` | `QuizAttemptPage` |
| `/quiz-attempts/:attemptId/result` | `RequireAuth` | `Navbar` | `QuizResultPage` |
| `/my-points` | `RequireAuth` | `Navbar` | `PointsPage` |
| `/admin/bible-verses` | `RequireRole(["ADMIN","SERVANT"])` | `AdminLayout` | `BibleManagementPage` (tabs via `?status=`) |
| `/admin/bible-verses/new` | ↑ | `AdminLayout` | `VerseFormPage` |
| `/admin/bible-verses/:verseId/edit` | ↑ | `AdminLayout` | `VerseFormPage` |
| `/admin/bible-verses/:verseId/schedule` | ↑ | `AdminLayout` | `VerseSchedulePage` |
| `/admin/bible-verses/:verseId/analytics` | ↑ | `AdminLayout` | `VerseAnalyticsPage` |
| `/admin/bible-verses/:verseId/quiz` | ↑ | `AdminLayout` | `QuizManagePage` |
| `/admin/quizzes` | ↑ | `AdminLayout` | `QuizListPage` |
| `/admin/quizzes/:quizId/builder` | ↑ | `AdminLayout` | `QuizBuilderPage` |
| `/admin/quizzes/:quizId/questions/new` | ↑ | `AdminLayout` | `QuestionFormPage` |
| `/admin/quiz-questions/:questionId/edit` | ↑ | `AdminLayout` | `QuestionFormPage` |
| `/admin/quizzes/:quizId/analytics` | ↑ | `AdminLayout` | `QuizAnalyticsPage` |
| `/admin/analytics/monthly` | ↑ | `AdminLayout` | `MonthlyAnalyticsPage` |

Member nav: add "Bible Verses" and "My Points" to `Navbar`. Admin sidebar (`NAV_ITEMS`): `bibleVerses` (`BookOpen`) with sub-items Verses / Weekly Verses (`?status=scheduled`) / Quizzes, and convert the disabled `reports` entry into `analytics` (`BarChart3`) with sub-items Verse / Quiz / Monthly. `AdminSidebar.test.tsx`'s "eight items in order" assertion must be updated in the same task.

## 8.3 Screen-by-screen source of truth

| Mockup | Route | Key elements to build |
| --- | --- | --- |
| `Bible-Verse-*` | `/bible-verses` | header + search + filter dropdown; "This Week" hero card (image, reference, title, excerpt, date, Read/Quiz chips, Read Verse CTA); "Previous Verses" 3-col grid → 1-col mobile; `EmptyState`; pagination via View All |
| `Bible-post-*` | `/bible-verses/:verseId` | back link; cover header; verse block in Amiri, centred, with reference; Reflection (`whitespace-pre-line`); mobile "Read More" expander; Mark as Read button ↔ "Marked as Read" state; "Test Your Understanding" card with 3 stat pills (questions/points/time) + Start Quiz (disabled + hint until read, D-6); tablet/mobile variants |
| `Bible-Management-*` | `/admin/bible-verses` | 4 KPI cards; status tabs; search + Status/Created-by/Date filters (URL-driven); table (Verse, Reference, Status, Schedule, Quiz, Opens, Reads, Created By, Actions: view/edit/schedule/quiz/analytics/archive); `AppPagination` + page-size; mobile card list + filter sheet; FAB → Create |
| `Create and Edit Bible-*` | `/admin/bible-verses/{new,:id/edit}` | 2-col: form (title, reference with validity tick, book/chapter/verse, text, reflection, cover image upload w/ preview, status radios) + live preview (mobile/desktop toggle); sticky Save Draft / Schedule / Publish in topbar and footer; **plain textareas with counters, no toolbar (D-8)** |
| `Schedule-*` | `/admin/bible-verses/:id/schedule` | numbered steps: selected verse card, date + time + fixed timezone (BR-12) with info note, notification note, Schedule Publication CTA; right column: summary card + "Already Scheduled" with Reschedule / Cancel (confirm dialog); inline invalid-schedule error |
| `Quiz-management-*` | `/admin/bible-verses/:verseId/quiz` | breadcrumb; Edit / Preview / Publish actions; related-verse card; overview (questions, total points, time limit, status); questions table with drag handle, order, options count, points, edit/duplicate/delete/reorder; Quiz Validation checklist; Quiz Analytics teaser |
| `Quiz-Builder-*` | `/admin/quizzes/:quizId/builder` | quiz info (title/description + counters), settings (time limit select, derived total points, fixed question type), related verse, status radios, question overview list, Quiz Readiness panel + Tips, Save Draft / Preview / Publish |
| `QuestionManagement-*` | `/admin/…/questions/{new,:id/edit}` | question textarea (`44 / 500`), points stepper, options list with radio for correct + drag + delete + Add Option, validation checklist, live member preview, manager-only "Correct Answer" callout, Save/Cancel |
| `Quiz-Page-*` | `/bible-verses/:verseId/quiz` | quiz header + live timer (normal/warning ≤30s/expired styles); progress dots + "Question n of m"; radio option cards; Previous/Next/Finish; autosave note; "Time's up!" panel → View Results; tablet/mobile variants |
| `Quiz-Result-*` | `/quiz-attempts/:attemptId/result` | success header; big `score/total` + percentage; correct/incorrect/points tiles; "Your Points Progress" three before→after bars; collapsible per-question review with correct answers; View My Points / Back to Bible Verse |
| `Quiz-Points-*` | `/my-points` | 3 KPI cards; Points Over Time line chart with range select; Points History by month list + View all; Recent Point Activity list; empty state with Explore CTA |
| `Verse-Analysis-*` | `/admin/bible-verses/:id/analytics` | verse card + 4 KPI cards; Engagement Overview funnel (CSS, no lib); Engagement Over Time dual-series area chart with granularity select; User Engagement table (paginated); Related Quiz Performance card; "About the Metrics" legend; date-range picker + Export Report |
| `Quiz-analysis-*` | `/admin/quizzes/:id/analytics` | 5 KPI cards; Score Distribution bar chart; Completion Status donut; filters (user search, score range, status, date range); user results table; per-user right drawer with question-by-question review; Export Results |
| `Monthly-Analysis-*` | `/admin/analytics/monthly` | month picker + recent-month chips; 4 KPI cards; Monthly Trend composed chart (points + participants bars, avg-score line); Completion Rate Distribution donut; filters; ranked user table with medals + sparkline trend; Top-3 card; user details drawer with quiz breakdown; Monthly Summary Comparison table; Export Report |

## 8.4 Shared frontend additions

- `src/lib/datetime.ts` — `localeFor(language)`, `formatDate`, `formatDateTime`, `formatTime`, `formatMonth`, `formatDuration(seconds)`, `formatClock(seconds)` (`mm:ss`). Replaces the inline `Intl` duplication; new screens must not re-inline it.
- `src/modules/quiz/hooks/useQuizTimer.ts` — takes `remaining_seconds` + `server_time` from the API (never `Date.now()` vs `expires_at`), ticks with `setInterval` cleared on unmount, re-syncs on `visibilitychange`, exposes `{secondsLeft, phase: "normal"|"warning"|"expired", label}` and fires `onExpire` exactly once.
- `src/components/common/StatCard.tsx` — generalisation of `attendance/components/StatTile.tsx` for the 4–5 KPI card rows used by six screens (keep `StatTile` untouched).
- `src/lib/download.ts` — authenticated CSV download (fetch with bearer → blob → object URL → revoke).

---

# 9. Design system mapping

## 9.1 Mockup colour → brand token (identity wins, `Design-Guide.md` §4, §30)

| Mockup | Usage | Use instead |
| --- | --- | --- |
| Indigo/violet `#4F46E5`-family (primary buttons, active nav, KPI icons, chart bars) | primary actions | **Navy `#253D63`** — `bg-navy`, `.btn-primary`; charts `var(--chart-5)` |
| Purple tints / lavender surfaces | card accents | `bg-soft`, `bg-secondary`, `border-border` |
| Green `#16A34A`-family (Read badge, Completed, success) | positive state | **Mint `#53CB9E`** — `text-mint`, `bg-mint/10`; charts `var(--chart-1)` |
| Amber/orange (Draft, warning timer, Auto Finished) | warning | **Brand orange `#F96702`** — `text-brand-orange`, `bg-brand-orange/10`; charts `var(--chart-3)` |
| Red (Incorrect, expired, destructive) | negative | **Brand red `#9E150B`** — `text-brand-red`; charts `var(--chart-4)` |
| Blue (Scheduled, secondary chart series) | info | **Brand blue `#2672B0`** — `text-brand-blue`; charts `var(--chart-2)` |
| Gold trophy illustration / confetti | celebration | keep one small trophy icon (`lucide` `Trophy`) + mint check; **no confetti animation** (`Design-Guide.md` §17) |

Status badges (frozen): `DRAFT` orange · `SCHEDULED` blue · `PUBLISHED` mint · `ARCHIVED` muted/grey · `FAILED` red · `COMPLETED` mint · `AUTO_FINISHED` orange · `IN_PROGRESS` blue.

Other identity rules that override the mockups: no glassmorphism/gradients/heavy shadows (`.card-elevated` only), radius `rounded-2xl` for sections and `rounded-lg`/`rounded-xl` inside, transitions 200–500 ms and only fade/slide/hover, Lucide icons only, 64px circular icon containers for feature tiles, logo untouched in its fixed container. The mockups' left "verse of the day" brand panel is already covered by the existing sidebar/`BrandPanel` treatment — do not add a second one.

## 9.2 Typography

Verse text and scripture quotations → `font-verse` (Amiri) always, both languages. Arabic headings/labels → `font-heading` (El Messiri). Arabic body → `font-arabic` (Markazi Text). English UI → `font-sans` (Poppins). Timer, scores and numeric KPIs are `dir="ltr"` with `tabular-nums`.

## 9.3 RTL

Every screen must render correctly at `dir="rtl"`: chart `XAxis reversed`, `YAxis orientation="right"`, progress bars `rtl:-scale-x-100`, chevrons swapped by component (not by CSS rotation) in Previous/Next quiz navigation, drawers open from the inline-start edge, drag handles on the inline-start side, funnel mirrored. Arabic mockups (`*-ar.png`) are the RTL reference.

---

# 10. Security requirements (hard gates)

1. **Correct answers never leak before the end.** `quiz_options.is_correct` is serialised only in (a) manager DTOs, (b) `AttemptResultResponse`/`/result`/`/review` for a **finished** attempt. A dedicated test asserts the string `is_correct` does not appear in the `POST /attempts` or `GET /quiz-attempts/{id}` response bodies of an in-progress attempt.
2. **Client-supplied grading is ignored.** `is_correct`, `points_awarded`, `score`, `percentage`, `total_points`, `finished_at`, `status` are absent from every request model (pydantic models must not silently accept them; extra fields are ignored by default — a test posts them and asserts stored values are unaffected).
3. **Timer is server-authoritative.** Expiry derives from `expires_at` stored at start. A test manipulates only client state and confirms an expired attempt yields `AUTO_FINISHED` with pre-expiry answers preserved.
4. **Ownership.** `GET /quiz-attempts/{id}`, `PUT answers`, `submit`, `/result` are restricted to the owning user (404 for other users, following the notifications "404 not 403" rule). Managers reach other users' attempts only through `/quiz-attempts/{id}/review`.
5. **Authorization matrix test** (extends `tests/unit/api/v1/test_authorization.py`): every manager endpoint returns 403 for MEMBER and 401 unauthenticated; every member endpoint returns 401 unauthenticated; `/internal/scheduler/tick` returns 401/403 without the secret and for SERVANT.
6. **Draft/scheduled content is invisible to members** — 404, verified per endpoint (BR-3).
7. **Idempotency** (BR-10, BR-14, BR-29, BR-31): mark-read twice, publish twice, tick twice, submit twice, award twice — each has an explicit test.
8. **Cron secret** compared with `secrets.compare_digest`; never logged. Absent `CRON_SECRET` → 503, never an open endpoint.
9. **Uploads** reuse the existing signed Cloudinary flow; only the returned URL is stored, max 500 chars, `https` scheme validated.
10. **Exports** enforce the row cap and never include emails of users the caller could not already see in the UI table.
11. **Audit** every manager mutation and every export: `bible_verse.create|update|archive|restore|publish|schedule|reschedule|cancel_schedule`, `quiz.create|update|publish|archive`, `quiz_question.create|update|delete|reorder|duplicate`, `points.award`, `analytics.export`, `scheduler.tick`.

---

# 11. Explicitly out of scope for Sprint 5

Broadcast notification to all members on publish (D-14) · public leaderboard visible to members (`phase-5.md` §44 keeps it hidden; the data model supports it) · quiz retakes (D-4) · question types other than single-correct multiple choice · per-question timers · verse categories/tags, email-template editor, general settings, users admin screen (D-10, placeholders only) · rich-text authoring (D-8) · verse comments/likes (Phase 3 domain) · push/web notifications · offline quiz taking · bilingual verse content (D-1) · Recharts-free print/PDF reports (CSV only, D-15).

---

# 12. Estimates, waves and sprint plan

`phase-5.md` scopes 55 points. D-9 adds the full analytics visual layer:

| ID | Story | Points |
| --- | --- | ---: |
| US-020 | Bible Verse CRUD | 5 |
| US-021 | Weekly verse publishing & scheduling (+ tick endpoint) | 8 |
| US-022 | Verse reading & engagement tracking | 5 |
| US-023 | Quiz management (quiz, questions, options, validation) | 8 |
| US-024 | Quiz taking & server-authoritative timer | 8 |
| US-025 | Automatic grading & points award | 5 |
| US-026 | User points & monthly history | 5 |
| US-027 | Verse & quiz analytics (numbers, tables, filters) | 8 |
| US-028 | Publication notification (email + in-app, retry) | 3 |
| **US-029** | Analytics visualisations (5 charts + funnel + sparklines) | **5** |
| **US-030** | CSV exports (verse, quiz, monthly) | **3** |
| **US-031** | Monthly leaderboard, Top-3 and user drawer | **5** |
| | **Total** | **68** |

68 points does not fit one 1–2 week sprint. Deliver as three waves on one architecture (the domain is one connected chain, `phase-5.md` §2):

| Wave | Scope | Points | Demo-able outcome |
| --- | --- | ---: | --- |
| **5A** | Foundation (both migrations, periods helper, error codes, settings, module scaffolding) + US-020 + US-021 + US-028 | 23 | A servant creates and schedules a verse; cron publishes it; the creator gets the email and the bell notification |
| **5B** | US-022 + US-023 + US-024 + US-025 + US-026 | 31 | A member reads the verse, is gated into the quiz, the timer is enforced, grading and points work end to end |
| **5C** | US-027 + US-029 + US-030 + US-031 | 21 | Full verse/quiz/monthly analytics with charts, drawers and exports |

Day plan (10 working days, mapped onto `phase-5.md` §59):

| Day | Focus |
| --- | --- |
| 1 | Migrations `p5_a`/`p5_b`, models, repositories, registry/UoW wiring, `periods.py`, settings, error codes, frontend module + i18n scaffolding |
| 2 | Verse CRUD service + API + authorization tests; admin list/form screens |
| 3 | Schedule entity/API, tick endpoint, outbox dispatcher, idempotency tests; Schedule screen |
| 4 | Publication email + in-app notification + retry/status; member feed + verse detail screens |
| 5 | Open/read tracking (+dedupe, idempotency), Mark-as-Read UI, quiz gate |
| 6 | Quiz + question + option CRUD, validation rules, Quiz Manage/Builder/Question screens |
| 7 | Attempt start/resume/answer-save/submit, timer enforcement, auto-finish batch; quiz taking screen + timer hook |
| 8 | Grading, points ledger, points API, result screen, My Points screen |
| 9 | Verse/quiz/monthly analytics endpoints + aggregate queries; analytics screens, charts, drawers |
| 10 | Exports, integration/concurrency/security passes, RTL + parity + a11y sweep, docs, demo rehearsal |

## 12.1 Definition of Ready additions

Beyond `phase-5.md` §60: the mockup for the story is opened and its brand-token mapping is agreed (§9.1); the frozen API shape for the story exists in §5; new i18n keys are listed; the idempotency and authorization tests for the story are named.

## 12.2 Definition of Done additions

`phase-5.md` §61 in full, plus: `ruff check` + `ruff format --check` + `mypy app` (strict) + `pytest` green; `npm run build` + `npm run test:run` green; `alembic upgrade head` **and** `downgrade -1` verified on the scratch DB; i18n parity and logical-properties guards green; every §10 gate has a passing test; audit rows exist for every manager mutation; the mockup and its RTL twin visually reviewed at 1440/768/375 px in light and dark mode.

## 12.3 Risk register

| Risk | Mitigation |
| --- | --- |
| Cron never wired in production → nothing publishes | Tick endpoint returns counters; management list shows a red "publication overdue" badge when `scheduled_at < now` and status is still `SCHEDULED`; ADMIN can trigger the tick from the UI (Publish now) |
| `bible_verses` ALTER on a live Neon DB | Backfill-then-NOT-NULL in one revision, tested with `upgrade`+`downgrade` on the scratch DB before any remote run; Rule 5 forbids running against `.env` |
| Analytics queries degrade as attempts grow | Every metric is a grouped query with a covering index (§4.6); page sizes capped; exports capped at 5000 rows |
| Timer abuse / clock skew | `remaining_seconds` + `server_time` from the server, grace window, server-side auto-finish batch (BR-30) |
| Scope creep from D-9 | Wave 5C is a separate deliverable; the API in §5.7 already returns chart-ready payloads so charts never force a contract change |
| Two "week" definitions confusing users | Copy says "هذا الأسبوع (الاثنين–الأحد)" / "This week (Mon–Sun)" on points surfaces; attendance copy unchanged |
