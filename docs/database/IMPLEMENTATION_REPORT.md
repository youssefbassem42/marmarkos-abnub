# MARMARKOS ABNUB — DATABASE IMPLEMENTATION REPORT

**Date:** 2026-08-20
**Scope:** Complete database + ORM foundation for the Marmarkos ABNUB church platform.
**Stack:** PostgreSQL 16 (Neon production, Docker local), SQLAlchemy 2.0 async + asyncpg, Alembic, FastAPI, Pydantic v2, Python 3.12.

---

## 1. Executive Summary

The platform now has a production-ready persistence layer: 18 tables across 10 modules, a transactional outbox for domain events, a Unit-of-Work façade, per-module repositories behind Protocol interfaces, async Alembic migrations, and 89 automated tests (37 API + 52 database integration). All quality gates pass: `ruff check`, `ruff format --check`, `mypy app` (strict), `pytest`, `alembic check`, `alembic upgrade head`.

## 2. Architecture

Modular monolith with Clean Architecture layering per module:

```
app/
  core/                 # engine, session factory, UoW dependency, exceptions
  shared/
    domain/events.py    # DomainEvent base
    infrastructure/
      persistence/      # Base, mixins, OutboxEvent, UnitOfWork, registry
  modules/
    <module>/
      domain/           # enums, events, interfaces (Protocol repositories)
      application/      # DTOs, services, mappers
      infrastructure/
        persistence/    # SQLAlchemy models + repository implementations
        security/       # JWT, password, hashing
        services/       # QR generation, token utilities
      presentation/     # FastAPI routers, dependencies, cookies
```

**Decision:** ORM models ARE the domain objects for the MVP. The domain layer owns enums, events, and repository interfaces; infrastructure owns concrete models/repositories. This avoids duplicated entity classes while keeping dependency inversion (application depends on `domain/interfaces.py`, not on SQLAlchemy).

## 3. Data Model Summary (18 tables)

| # | Table | Module | Purpose |
|---|---|---|---|
| 1 | `roles` | users | MEMBER / SERVANT / ADMIN |
| 2 | `users` | users | Members, staff, admins |
| 3 | `user_qr_codes` | users | QR attendance tokens (hashed) |
| 4 | `user_ban_records` | users | Append-only ban history |
| 5 | `refresh_tokens` | auth | Refresh sessions (hashed) |
| 6 | `service_sessions` | attendance | Scheduled services |
| 7 | `attendance_records` | attendance | Check-ins (unique per session) |
| 8 | `blog_posts` | blog | Articles |
| 9 | `blog_categories` | blog | Taxonomy |
| 10 | `blog_post_categories` | blog | M2M join |
| 11 | `blog_post_likes` | blog | Likes (unique per post/user) |
| 12 | `comments` | comments | Threaded, soft-moderated |
| 13 | `notifications` | notifications | Per-user + broadcast |
| 14 | `anonymous_messages` | anonymous_messages | Prayers/feedback, no identity |
| 15 | `bible_verses` | bible | Weekly verse (one published/week) |
| 16 | `media_assets` | media | URL-only media registry |
| 17 | `audit_logs` | admin | Append-only admin actions |
| 18 | `outbox_events` | shared | Transactional outbox |

## 4. Conventions

- **PKs:** `UUID` generated in Python (`uuid.uuid4`), avoiding DB round-trips and exposing no enumeration.
- **Timestamps:** `timestamptz`, always UTC, `server_default=func.now()`. Mixins: `TimestampMixin` (created/updated), `CreatedAtMixin` (created only).
- **Enums:** `StrEnum` in `domain/enums/`; persisted via `native_enum=False` (VARCHAR) for portability between Neon and local PostgreSQL. Example: `RoleName.MEMBER = "MEMBER"`.
- **JSON:** `JSONB` for `notifications.data`, `audit_logs.metadata`, `outbox_events.payload`.

## 5. Module Details

### 5.1 users
- `roles`: INT PK seeded in migration `60db6157691a` (MEMBER/SERVANT/ADMIN).
- `users`: unique `email`, unique nullable `phone`, `public_id` (opaque external ID), `first_name`/`last_name`/`avatar`, `status` lifecycle (ACTIVE/SUSPENDED/BANNED/INACTIVE), `last_login_at`.
- `user_qr_codes`: stores only the **SHA-256 hash** of the QR token; partial unique index `uq_user_qr_codes_active_user (user_id) WHERE is_active` enforces at most one live token per user. Rotation = insert new + deactivate old (verified by `test_qr_association_and_rotation`). No personal data inside the QR payload (`test_qr_token_is_stored_hashed_only`).
- `user_ban_records`: `banned_at`, `banned_until`, `reason`, `banned_by`, `lifted_at`, `lifted_by`.

### 5.2 auth
- `refresh_tokens`: only `token_hash` (SHA-256) stored, unique; `expires_at`, `revoked_at`, plus device metadata `user_agent` and `ip_address` for security monitoring. `delete_expired` and `revoke_all_for_user` for logout-all.

### 5.3 attendance
- `service_sessions`: name, `date` (indexed), start/end time, `service_type` (SUNDAY_SERVICE/LITURGY/BIBLE_STUDY/YOUTH/PRAYER_MEETING), `is_active`.
- `attendance_records`: `user_id` + `session_id` with **unique constraint `uq_attendance_user_session`** (no double counting), denormalized indexed `attendance_date` powering analytics, `scanned_at`, `scanned_by`, `method` (QR_SCAN/MANUAL), `notes`.
- `weekly_attendance_records`: QR check-ins for the weekly Thursday meeting — `user_id`, `meeting_date` (unique together), `check_in_at`, `status`, `recorded_by`; unique index `uq_weekly_attendance_user_meeting` (one record per member per meeting).
- Analytics: `count_current_meeting`, `count_for_meeting`, `count_for_meetings`, `count_month_meetings`, `count_between`, `attendance_percentage_between`, `meeting_trend`, `absent_users_since` (ACTIVE users with no attendance since a cutoff).

### 5.4 blog
- `blog_posts`: title, unique `slug`, excerpt, content, cover_image, `status` (DRAFT/PUBLISHED/ARCHIVED), `published_at`; index `(status, published_at)` for feed queries.
- `blog_categories` + `blog_post_categories` (M2M). Posts filterable/searchable by `search` and `category_slug`.
- `blog_post_likes`: unique `(post_id, user_id)`; toggle is race-safe via `INSERT ... ON CONFLICT DO NOTHING` then physical delete on unlike.

### 5.5 comments
- Self-referencing `parent_comment_id` for threaded replies. `status` VISIBLE/HIDDEN/DELETED — **never physically deleted** (soft moderation; verified by `test_comment_never_physically_deleted`). HIDDEN/DELETED excluded from public listings unless requested.

### 5.6 notifications
- Per-user rows; `user_id IS NULL` = broadcast to all (e.g., announcements). `data` JSONB payload, `read_at` for unread counting (`count_unread`).

### 5.7 anonymous_messages
- Message + delivery lifecycle only: `status` (PENDING/SENT/FAILED), `telegram_status`, `telegram_message_id`, `failure_reason`. **No identity columns by design**; enforced structurally and by test `test_table_has_no_identity_columns`.

### 5.8 bible
- `bible_verses`: `verse_reference`, `text`, `translation`, `week_start_date`, `is_published`. Partial unique index `uq_bible_verses_published_week (week_start_date) WHERE is_published` → at most one published verse per week; drafts for the same week allowed.

### 5.9 media
- `media_assets`: metadata + URL only (no binary storage): `name`, `type` (IMAGE/VIDEO/DOCUMENT), `url`, `alt_text`, `section`, `sort_order`, `is_active`. Index `(section, is_active)` for hero/gallery queries.

### 5.10 admin
- `audit_logs`: append-only `action`, `entity_type`, `entity_id`, `actor_user_id`, `details` mapped to the JSONB `metadata` column (SQLAlchemy reserves `metadata`; attribute is `details`). Indexes on `(entity_type, entity_id)` and `created_at`.

### 5.11 shared
- `outbox_events`: `event_type`, `aggregate_type`, `aggregate_id`, `payload` JSONB, `status` (PENDING/PROCESSED/FAILED), `attempts`, `available_at` (backoff), `last_error`, `processed_at`. Dispatch index `(status, available_at)`.

## 6. Domain Events

| Event | event_type | Emitted |
|---|---|---|
| `UserRegistered` | `user.registered` | auth register |
| `UserBanned` | `user.banned` | admin ban |
| `AttendanceRecorded` | `attendance.recorded` | check-in |
| `BlogPostPublished` | `blog.post_published` | publish |
| `CommentCreated` | `comment.created` | comment |

Events are frozen dataclasses with ClassVar `event_type`/`aggregate_type`. Payloads are serialized JSON-safely (`_json_safe` handles UUID/datetime/date/timedelta/Enum).

## 7. Transactional Outbox

- Writes to `outbox_events` happen in the **same transaction** as the aggregate change (`UnitOfWork.record()` + `commit()`), guaranteeing at-least-once delivery semantics.
- Worker claims rows with `FOR UPDATE SKIP LOCKED` (safe concurrent workers), processes, then `mark_processed`; failures recorded with `attempts` + exponential `available_at` backoff.
- Atomicity verified by `test_outbox_event_is_atomic_with_aggregate_change` (rollback removes both).

## 8. Unit of Work

`UnitOfWork` holds all repositories and the session; `commit()` flushes the session **and** the pending outbox events in one transaction. It is provided per-request via the `get_unit_of_work` FastAPI dependency and created in workers via `UnitOfWork.create(async_session_factory)`.

## 9. Repositories

Each module exposes a `Protocol` in `domain/interfaces.py` and a concrete implementation in `infrastructure/persistence/`. Repositories: user, role, qr_code, refresh_token, service_session, attendance, blog_post, category, like, comment, notification, anonymous_message, bible_verse, media, audit_log, outbox.

## 10. Migration Strategy

- `alembic/env.py` imports `app.shared.infrastructure.persistence.registry` so autogenerate sees every model.
- Initial migration `60db6157691a_initial_full_schema.py` (autogenerated) + role seed. `alembic check` reports no drift; `upgrade head` applies cleanly on the local dev DB.
- Production/Neon is NEVER touched during development/tests.

## 11. Indexes & Constraints

| Guarantee | Mechanism |
|---|---|
| No duplicate attendance | `uq_attendance_user_session (user_id, session_id)` |
| One active QR token per user | partial unique `uq_user_qr_codes_active_user WHERE is_active` |
| One published verse per week | partial unique `uq_bible_verses_published_week WHERE is_published` |
| One like per post per user | `uq_blog_post_likes_post_user (post_id, user_id)` |
| Unique content slugs | `blog_posts.slug`, `blog_categories.slug` |
| Referential integrity | FKs enforced; verified by `test_foreign_keys.py` |

## 12. Security Design

- Passwords: bcrypt via passlib.
- Access/refresh JWT: python-jose (HS256), separate secrets, configurable TTLs.
- **QR and refresh tokens are stored only as SHA-256 hashes**; a DB leak exposes no usable credentials.
- QR payload format `MA_QR:<token_urlsafe(32)>`; rotation invalidates old tokens.

## 13. Testing

### API tests (`tests/unit/api/v1/`, 37 tests)
Register, login, refresh rotation, logout revocation, authorization (role-based), profile/QR endpoint, health. Uses ASGI transport with a session-scoped test DB; tables truncated + roles reseeded between tests.

### Database integration tests (`tests/integration/database/`, 52 tests)
One file per module plus FK/cascade tests:
- `test_users.py` — creation, unique email, QR rotation + hashing, ban record/status.
- `test_auth.py` — token hashing, metadata, revocation, revoke-all.
- `test_attendance.py` — creation, duplicate prevention, multi-session same day, analytics (counts, percentage, trend, absent users).
- `test_blog.py` — post creation, unique slug, search/category filter, like toggle + uniqueness.
- `test_comments.py` — replies, moderation, soft-delete, nested depth.
- `test_notifications.py` — per-user + broadcast, unread counts, mark-read.
- `test_anonymous_messages.py` — no-identity columns, Telegram lifecycle, exclusive claim.
- `test_bible.py` — weekly publish uniqueness, drafts, current-verse lookup.
- `test_media.py` — metadata/URL only, section filtering, deactivation.
- `test_outbox.py` — atomicity, claim/process, failure/backoff, event serialization, idempotent replay.
- `test_audit.py` — append-only records with JSONB details.
- `test_foreign_keys.py` — FK violations rejected, user-delete cascades.

## 14. Quality Gates (all passing)

```
ruff check .             ✅ All checks passed
ruff format --check .    ✅ 280 files already formatted
mypy app                 ✅ no issues in 249 source files (strict)
pytest -q                ✅ 89 passed
alembic check            ✅ No new upgrade operations detected
alembic upgrade head     ✅ clean
```

## 15. Local Development Setup

```bash
# Disposable Postgres (test + dev DBs) on port 55432
docker run -d --name marmarkos-test-db -p 55432:5432 \
  -e POSTGRES_USER=marmarkos -e POSTGRES_PASSWORD=marmarkos \
  -e POSTGRES_DB=marmarkos_test postgres:16

createdb -h localhost -p 55432 -U marmarkos marmarkos_dev
DATABASE_URL=postgresql+asyncpg://marmarkos:marmarkos@localhost:55432/marmarkos_dev \
  alembic upgrade head

# Tests (auto-creates schema via Base.metadata on marmarkos_test)
.venv/bin/pytest -q
```

## 16. Environment Variables

`backend/.env.example` documents every variable. **Real Neon credentials present in the original file were redacted to a placeholder.** Required: `DATABASE_URL` (asyncpg), `JWT_SECRET`, `JWT_REFRESH_SECRET`. Optional: Telegram/Brevo/Cloudinary keys (empty for now).

## 17. Performance Considerations

- Composite + partial indexes cover the hot paths (feed listing, unread counts, per-meeting/monthly attendance, active-QR lookup, outbox dispatch).
- `FOR UPDATE SKIP LOCKED` outbox claims scale horizontally.
- JSONB payloads avoid schema churn for notifications/audit/outbox.

## 18. Operational Notes

- `audit_logs.metadata` column is accessed via the `details` attribute (`metadata` is reserved by SQLAlchemy).
- Attendance percentage is computed only against ACTIVE users; absent-user reports exclude INACTIVE/SUSPENDED/BANNED.
- Comments are never hard-deleted; `status=DELETED` preserves accountability.

## 19. Deliverables Checklist

- [x] 18-table schema across 10 modules + shared outbox
- [x] Async Alembic migration with role seed; `alembic check` clean
- [x] Unit-of-Work + per-module repositories behind Protocols
- [x] Transactional outbox + 5 domain events
- [x] QR/refresh tokens stored hashed only
- [x] 89 tests passing (37 API + 52 database integration)
- [x] ruff / mypy / pytest / alembic gates green
- [x] `docs/database/DATABASE_DESIGN.md` with Mermaid ERD
- [x] Real credentials redacted from `.env.example`

---

## Assumptions

1. **ORM-as-domain (MVP):** SQLAlchemy models serve as domain objects; a full domain-entity layer is deferred until business logic complexity justifies it.
2. **Roles as a table:** Kept relational (INT PK, seeded) rather than a Python-only enum, allowing future role-permission expansion without a migration.
3. **Soft ban over delete:** Users are never hard-deleted in the primary workflow; deletion cascades exist only as a safety net.
4. **One active QR token per user:** Enforced by a partial unique index; rotation is the only supported flow.
5. **Attendance uniqueness per session:** A member cannot be marked present twice for the same service; multiple services on the same day are distinct events.
6. **`attendance_date` denormalized** onto records for cheap analytics; it must be kept in sync with `service_sessions.date` at write time. These dates are meeting dates: the weekly meeting is held on Thursday, and `weekly_attendance_records.meeting_date` always stores the Thursday of its meeting week.
7. **Comments are soft-moderated:** Status lifecycle (VISIBLE→HIDDEN/DELETED) instead of physical deletion.
8. **Categories, not tags:** Blog taxonomy uses a fixed set of categories for MVP simplicity.
9. **Notifications:** `user_id = NULL` means broadcast; delivery for both broadcast and per-user rows is resolved by `list_for_user`.
10. **Anonymous messages carry zero identity:** No user/contact columns exist; anonymity is a structural guarantee.
11. **One published verse per week:** Drafts may share a week; the partial unique index allows this.
12. **Media stored off-platform:** Only metadata + URLs; no BLOB columns.
13. **`audit_logs` and `user_ban_records` are append-only:** Records are never updated or deleted.
14. **Refresh token rotation:** A refresh replaces the token (old one revoked); logout revokes all.
15. **Timezone handling:** All timestamps UTC `timestamptz`; date arithmetic (`count_current_meeting`, meeting/month windows) uses the application-provided date.
16. **Outbox at-least-once:** Consumers must be idempotent; `mark_processed` is safe to call repeatedly.
17. **Enum values are stored as VARCHAR:** `native_enum=False` keeps schema identical across Neon and local Postgres and simplifies ALTERs.
18. **Test DB isolation:** Tests run against the disposable Docker Postgres only; Neon is never modified by the test suite.
19. **Migration `60db6157691a` is the baseline:** The earlier partial migration was deleted; the full schema is the single initial migration.
20. **Dev DB for migrations:** `alembic upgrade head` is validated on `marmarkos_dev`; production migrations are applied through the normal Neon deploy process.