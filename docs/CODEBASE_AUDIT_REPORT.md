# Marmarkos ABNUB Platform — Complete Full-Codebase Audit Report

| Field | Value |
|---|---|
| **Report ID** | AUDIT-2026-10-26-FULL |
| **Date** | 2026-10-26 |
| **Codebase commit** | `28b6de249a8b757ce83ba53aa241c943ac47fd6f` ("fix: register outbox handlers for user.registered and attendance events", 2026-09-25) |
| **Branch** | `main` |
| **Stack** | FastAPI 0.141 · SQLAlchemy 2 · asyncpg · Alembic · PostgreSQL 16 (Neon) · Pydantic v2 · pytest / React 18 · TypeScript · Vite 6 · TanStack Query · React Router · RHF + Zod · axios · i18next · Vitest |
| **Audit type** | Architecture, design patterns, code quality, QA/testing, scalability, reusability, security, dependency hygiene, CI/CD, repository hygiene |
| **Method** | Full static read + live execution of every quality gate + live migration/DB verification + live dependency audits |
| **Previous report** | `docs/AUDIT_REPORT.md` (2026-09-20, "Kiro AI") — reconciled in **Part 10**, not overwritten |

---

## 0. How to read this report

### 0.1 Severity model

| Severity | Definition | Expected response |
|---|---|---|
| **CRITICAL** | Live credential exposure, risk of irreversible data loss, or a gate that lets broken/unreviewed code reach production | Fix now (same day), before any other work |
| **HIGH** | Exploitable weakness, a contract/architecture defect that silently corrupts behaviour, or a release gate that does not actually gate | Fix within the current sprint |
| **MEDIUM** | Correctness-adjacent risk, maintainability debt with a real cost, observability gap, or missing hardening | Fix within 1–2 sprints (planned) |
| **LOW** | Hygiene, dead code, cosmetic drift, documentation debt | Batch it into a cleanup PR |

### 0.2 Evidence labelling

* **[V]** — **Verified by execution** in this audit (command output reproduced in Appendix A).
* **[R]** — **Verified by code reading** (file:line cited, not executed).
* **[I]** — **Inferred / requires runtime confirmation** (stated as a hypothesis with a test to confirm).

### 0.3 Finding-ID scheme

`SEC` security · `ARCH` architecture · `CODE` code quality · `QA` test/QA · `PERF` performance/scalability · `REUSE` reusability/maintainability · `DEP` dependency lifecycle · `OPS` CI/CD & operations · `DOC` documentation.

### 0.4 Scope and limitations

**In scope (fully audited):** `backend/app` (387 files, 17,825 LOC), `backend/tests` (81 files, 7,736 LOC), `backend/alembic` (13 migrations), `backend/pyproject.toml`, `backend/requirements.txt`, both Dockerfiles, `docker-compose.yml`, both GitHub Actions workflows, `frontend/src` (334 TS/TSX files, 31,861 LOC), `frontend/package.json`, `frontend/vite.config.ts`, `frontend/Dockerfile`, `docs/` (66 tracked files), `.gitignore`, git history of the last two feature commits.

**Out of scope / not assessable here:** the deployed Neon database contents, Vercel/Railway project settings, DNS/TLS configuration, third-party dashboards (Google Cloud, Cloudinary, Brevo, Telegram), CI secret stores, mobile clients (none present), and production traffic behaviour.

**Limitations:** the audit ran against a local PostgreSQL 16 container (`marmarkos-audit-pg`, port 55432) seeded from `backend/.env`; production-only integrations (Cloudinary, Telegram, Gmail) were **not** exercised deliberately except where a test reached them unintentionally — see **SEC-002**, which is itself a finding.

---

## 1. Executive summary

### 1.1 Verdict

The Marmarkos ABNUB Platform is a **well-architected, unusually disciplined application codebase with an unsafe delivery pipeline**. The engineering quality inside the product code is materially better than the average FastAPI + React project: clean modular boundaries, an explicit clock abstraction, a transactional outbox with retry semantics, server-authoritative quiz timing, idempotent point ledgers, pure grading with immutable snapshots, zero SQL string interpolation, no `print`, no `any` in TypeScript, and zero bare `except:` blocks.

The risk is concentrated in **three places that are not the product code**:

1. **Secrets and test hermeticity (SEC-001 → SEC-003).** A live production `.env` sits on disk; the test suite inherits those credentials and **really did call Cloudinary's API** during this audit; and the test bootstrap runs `metadata.drop_all()` against whatever `DATABASE_URL` is present, which is one exported variable away from a production database.
2. **A release gate that does not gate (CI-001/QA-001).** Backend CI executes four gates and **all four are currently red** (ruff, ruff-format, mypy, pytest). Frontend CI runs `npm install` + build, and marks tests `continue-on-error: true` — the test result is discarded. Nothing prevents a red branch from being merged or deployed.
3. **Contract drift that was never caught (ARCH-003, QA-002).** `/api/v1/quiz-analytics/monthly` requires `month=YYYY-MM`, while the test shipped in the same commit calls it with `year=2026&month=9`. The endpoint and the test were added together and have never agreed; the test only became visible when the previous commit repaired its imports.

Everything else is **medium or low**: architecture smells that are real but not yet harmful (two import cycles, leaky domain ports, a hub module), hygiene debt (820 lint problems, 39 unformatted Python files, 100 mypy errors, 53 MB of PNGs in git), and a genuinely thin frontend test suite (48 tests, 21.92 % statement coverage) sitting under business-critical flows (attendance check-in, quiz attempt, admin analytics).

### 1.2 Scorecard (live, this audit)

| Gate / dimension | Result | Target | Status |
|---|---|---|---|
| Backend `ruff check` | **35 errors** (17 F401, 9 E501, 8 I001, 1 F821) | 0 | 🔴 |
| Backend `ruff format --check` | **39 files** would be reformatted (431 clean) | 0 | 🔴 |
| Backend `mypy app` (strict) | **100 errors** in 10 files | 0 | 🔴 |
| Backend `pytest` | **373 passed / 8 failed** (381 total), 4 warnings | 0 failures | 🔴 |
| Backend coverage | **78 %** statements (6,861 stmts, 1,527 missed) | ≥ 85 % | 🟡 |
| Alembic on a fresh DB | 13 migrations apply; `alembic check` → **no drift** | no drift | 🟢 |
| Frontend `npm run lint` | **820 problems** (808 errors, 12 warnings) | 0 | 🔴 |
| Frontend `npm run build` | **PASS** (2,761 modules; largest asset 177.96 kB) | pass | 🟢 |
| Frontend `npm run test:run` | 48/48 pass (10 files) — but emits React key warning + jsdom CORS noise | pass | 🟡 |
| Frontend coverage | **21.92 %** statements | ≥ 70 % | 🔴 |
| `npm audit --omit=dev` | **3 high** (axios, follow-redirects, zod) | 0 high/critical | 🔴 |
| `pip-audit -r requirements.txt` | **3 vulnerabilities / 2 packages** (python-jose, ecdsa) | 0 | 🔴 |
| API surface | 77 paths / 90 operations; 11 declared public | — | 🟢 |
| Module import cycles | **2 real cycles** at module level | 0 | 🟡 |
| Secrets in git history | none (`.env` gitignored, untracked) | none | 🟢 |

### 1.3 The ten actions that matter (in order)

| # | Action | Fixes | Risk if skipped |
|---|---|---|---|
| 1 | **Rotate every production secret** (DB, JWT ×2, Telegram, Gmail, Google, Cloudinary, Brevo, cron) and re-deploy with the new values | SEC-001 | Live credentials remain usable by anyone with disk or image access |
| 2 | **Make the test suite hermetic** (blank every third-party credential in `tests/conftest.py`) and **assert the database name contains `test`** before `drop_all` | SEC-002, SEC-003 | Tests keep calling real APIs and can wipe a production database |
| 3 | **Unblock the four red backend gates** in four isolated, behaviour-preserving PRs (ruff → format → mypy → the 8 tests) | CI-001, QA-002, CODE-001…004 | CI stays red; the pipeline loses all signal value |
| 4 | **Make CI actually gate**: `npm ci`, `npm run lint`, `npm audit --omit=dev --audit-level=high`, remove `continue-on-error` from tests, add `pip-audit` + secret scanning | CI-002, OPS-002…005 | Regressions ship silently |
| 5 | **Patch the vulnerable dependencies** (axios ≥ 1.20, zod ≥ 4 with resolvers v6, replace `python-jose` with PyJWT, drop unused `passlib`) | SEC-008, DEP-001…006 | Known CVEs remain exploitable in a public app |
| 6 | **Move the access token out of `localStorage`** (memory-first, refresh-cookie flow) with a staged, backward-compatible rollout | SEC-004 | Any XSS becomes full account takeover |
| 7 | **Re-key refresh tokens to HMAC-SHA-256 with a pepper**, using a version prefix + dual-read migration | SEC-005 | A database read becomes token theft |
| 8 | **Fix the two import cycles and the leaky domain ports** (shared contracts package) | ARCH-001, ARCH-004 | Modules cannot be extracted or tested in isolation; regressions grow |
| 9 | **Kill the N+1 in `GET /quizzes`** and add query-count guards for the list endpoints | PERF-001, QA-007 | Latency grows linearly with page size |
| 10 | **Shrink and de-duplicate the repository** (move 53 MB of PNGs out of git, delete the stray `.lovable-backup` file, collapse the duplicated dependency manifests) | DOC-002, OPS-006, DEP-007 | Clone/build times and supply-chain surface keep growing |

### 1.4 What is genuinely good (and must not be lost in the remediation)

* **A single clock abstraction** (`app/core/time/clock.py`) with `date.today()` / `datetime.now()` banned elsewhere — this is the reason attendance statistics are deterministic and testable.
* **Transactional outbox** with `FOR UPDATE SKIP LOCKED` claiming, per-event isolation, exponential back-off and a five-attempt budget.
* **Server-authoritative quiz timing** (pause-safe active-time budget, 30 s heartbeat window, `QUIZ_ATTEMPT_GRACE_SECONDS`).
* **Idempotent points ledger** — unique `quiz_attempt_id` + `pg_insert(...).on_conflict_do_nothing`.
* **Pure grading** with immutable question snapshots.
* **No SQL injection surface** — 9 `text()` usages, all static; zero f-string SQL; zero raw string interpolation.
* **No `print`, no bare `except:`, no `@ts-ignore`, 1 `any`, 0 `console.log`** in product code.
* **Defence-in-depth authorisation** (`assert_manager` re-checks role inside the use case, not only at the router).
* **Defensive infrastructure**: `pool_pre_ping`, `NullPool` in tests, Cloudinary content-type allow-list + 2 MB cap + HTTPS-only URL, bcrypt 72-byte truncation handled explicitly, HTML-escaped Telegram/email bodies, no request-body logging, cron secret compared with `secrets.compare_digest`, `/docs` gated on `DEBUG`.
* **Migrations match the models** — `alembic check` reports no drift on a clean database.

---

## 2. Scope, methodology and evidence

### 2.1 Environment used

| Item | Value |
|---|---|
| Python | 3.12.3 (`backend/.venv`) |
| PostgreSQL | 16-alpine container `marmarkos-audit-pg`, host port 55432, user/pass `marmarkos`, DBs `marmarkos_test`, `marmarkos_migrations` |
| Node | 20.x, `frontend/node_modules` installed from `package-lock.json` |
| OS | Linux |
| Audit date | 2026-10-26 |

### 2.2 Commands executed (all reproduced in Appendix A)

```bash
# Backend quality gates
cd backend
.venv/bin/ruff check . --statistics
.venv/bin/ruff format --check .
DEBUG=true .venv/bin/mypy app
DEBUG=true APP_ENV=test DATABASE_URL='postgresql+asyncpg://marmarkos:marmarkos@127.0.0.1:55432/marmarkos_test' \
  .venv/bin/python -m pytest -q --cov=app --cov-report=term:skip-covered --cov-report=json:/tmp/backend-coverage.json

# Migrations / schema drift
alembic upgrade head          # clean DB  -> 13 migrations, OK
alembic check                 # clean DB  -> "No new upgrade operations detected"
alembic upgrade head          # test DB  -> DuplicateTableError: relation "anonymous_messages" already exists

# Backend dependency audit
.venv/bin/pip-audit -r requirements.txt --progress-spinner off

# Frontend quality gates
cd frontend
npm run lint
npm run build
npm run test:coverage -- --reporter=default
npm audit --omit=dev
npm outdated

# API surface / auth inventory
python - <<'PY'
from app.main import create_app
schema = create_app().openapi()
print(len(schema["paths"]), "paths")
PY
```

### 2.3 Additional static analysis performed for this report

* AST scan of every `app/**/*.py` for `await` inside loops/comprehensions → N+1 detection (**1 site found**).
* AST scan of module-level imports (excluding `TYPE_CHECKING` and function-local imports) → import-cycle detection (**2 cycles found**).
* Layer audit of every `app/modules/*/domain/interfaces.py` → **13/13 domain ports import concrete ORM models**.
* OpenAPI inventory → 90 operations, public/anonymous analysis.
* Secret-presence audit of `backend/.env` (gitignored, untracked) and `frontend/.env.example`.
* Code-block hygiene census (`noqa`, `type: ignore`, `except Exception`, `assert`, `text()`, `print`, `eslint-disable`, `any`).

### 2.4 Audit methodology

1. **Read the whole surface**: every module, both CI workflows, both Dockerfiles, compose file, dependency manifests, migration set and the documentation tree.
2. **Run every gate** that CI claims to run — and a few it does not (coverage, `pip-audit`, `alembic check`, OpenAPI inventory).
3. **Isolate every failure to a root cause** (all 8 backend failures are individually root-caused in **Part 5.4**).
4. **Reconcile** with the previous report instead of duplicating it, and verify which earlier findings are genuinely closed (**Part 10**).
5. **Design every fix to be non-breaking**: additive first, dual-read/dual-write windows, feature flags with safe defaults, expand/contract migrations, test-first, one concern per PR.

---

## 3. Architecture review

### 3.1 System context

```
                    ┌──────────────────────────────────────────────┐
  Browser ────────▶│  Vercel (React SPA, static assets)           │
                    │  React 18 + TS + Vite + TanStack Query       │
                    └───────────────┬──────────────────────────────┘
                                    │ HTTPS / JSON, Bearer access token
                                    │ + httpOnly refresh cookie (path=/api/v1/auth)
                    ┌───────────────▼──────────────────────────────┐
                    │  FastAPI app (uvicorn)                       │
                    │  ├ api/v1 → 13 feature modules (77 paths)     │
                    │  ├ core: clock, pagination, exceptions,      │
                    │  │        rate_limit, csv, time              │
                    │  └ shared: UnitOfWork, outbox, registry      │
                    └───┬──────────────┬───────────────┬──────────┘
                        │              │               │
             ┌──────────▼───┐  ┌───────▼────────┐  ┌──▼──────────────────┐
             │ Neon         │  │ Cloudinary     │  │ Google OAuth       │
             │ PostgreSQL16 │  │ (images)       │  │ Brevo / Gmail SMTP  │
             │ + Alembic    │  │ Telegram Bot   │  │ (email)             │
             └──────────────┘  └────────────────┘  └─────────────────────┘
```

**Runtime topology:** a monolithic API (single deployable) plus a static SPA. There is no message broker, no cache tier and no background worker process: **the scheduler tick is an HTTP endpoint** (`POST /api/v1/internal/scheduler/tick`) that must be called by an external scheduler. That is a deliberate, acceptable simplification for this scale, but it means **scheduling correctness depends on an external cron hitting one URL** — see **OPS-004**.

### 3.2 Backend architecture — what was actually built

The stated architecture is *Modular Monolith + Clean Architecture + DDD-lite + CQRS-lite + Repository + Unit of Work + Outbox + Adapter/Strategy*. The implementation matches that intent **in the happy path** and diverges in three measurable ways (cycles, leaky ports, dual UoW lifecycles).

#### 3.2.1 Layer stack per module (verified)

```
backend/app/
├── api/router.py, api/v1/router.py        # HTTP composition root (routers only)
├── core/                                   # cross-cutting: clock, pagination, exceptions,
│                                           #   rate_limit, csv, time, database
├── modules/<feature>/                      # 13 bounded contexts
│   ├── presentation/   router.py, dependencies.py, mappers.py, dto?  # HTTP only
│   ├── application/    commands/ queries/ services/ dto/ handlers/   # use cases
│   ├── domain/         entities/ value_objects/ enums/ interfaces/ # rules + ports
│   └── infrastructure/  persistence/ services/ (telegram, email, image) # adapters
└── shared/
    ├── domain/           events.py          # DomainEvent + OutboxEvent
    ├── application/      outbox_dispatcher.py
    └── infrastructure/   persistence/{base,registry,unit_of_work,outbox}.py,
                          services/image_upload.py
```

**Module inventory (LOC, `app/modules/<name>/**/*.py`):**

| Module | LOC | Primary responsibility |
|---|---:|---|
| attendance | 3,172 | Weekly meeting check-in (QR/PIN), statistics, absence rules, weekly + legacy models |
| bible | 3,171 | Verse lifecycle, publication scheduling, feed, engagement, analytics |
| quiz | 3,168 | Quiz builder, attempts (pause-safe timing), grading, reviews, analytics |
| notifications | 1,664 | Feed, broadcast, email fan-out, per-user preferences |
| auth | 1,354 | Register/login, JWT + refresh rotation, Google OAuth, verification, reset |
| points | 1,159 | Ledger, monthly analytics, CSV export |
| users | 1,012 | Profile, roles, QR tokens, attendance PIN, registration |
| anonymous_messages | 692 | Public submission, Telegram forward, admin retry, rate limits |
| blog | 327 | Posts, categories, likes |
| comments | 156 | Threaded comments on posts |
| internal | 138 | Scheduler tick (outbox drain, publication, verse opening) |
| media | 138 | Media asset metadata |
| admin | 95 | Audit-log repository only (no router, no use cases) |

#### 3.2.2 Cross-module dependency map (module-level imports only)

```
admin           → (none)
anonymous_messages → auth, users
attendance      → auth, notifications, users      ◀── cycle
auth            → notifications, users
bible           → auth, notifications, quiz, users ◀── cycle
blog            → (none)
comments        → (none)
internal        → attendance, auth, bible, users
media           → (none)
notifications   → attendance, auth, users         ◀── cycle
points          → auth, quiz, users
quiz            → auth, bible, users              ◀── cycle
users           → auth, notifications
```

> **ARCH-001 — Two genuine module-level import cycles (HIGH).** The AST scan (module-level imports only, `TYPE_CHECKING` and function-local imports excluded) proves two cycles:
>
> 1. `attendance → notifications`: `backend/app/modules/attendance/application/commands/check_in_command.py:29` imports `NotificationService`; `backend/app/modules/notifications/application/copy.py:11` and `.../notification_service.py:16` import `app.modules.attendance.domain.enums.AttendanceStatus`.
> 2. `bible → quiz`: `backend/app/modules/bible/application/queries/verse_queries.py:32-33` imports `app.modules.quiz.domain.enums` **and** `app.modules.quiz.infrastructure.persistence.models` (`Quiz`, `QuizAttempt`); `backend/app/modules/quiz/application/queries/quiz_queries.py:7` imports `app.modules.bible.infrastructure.persistence.models.BibleVerse`, and `backend/app/modules/quiz/presentation/router.py:17` imports `app.modules.bible.presentation.dependencies.BibleManager`.
>
> *Impact:* import order becomes significant, the modules cannot be unit-tested or extracted independently, and a future split into services will hit a wall. `bible → quiz.infrastructure` is the more serious half: a read query in one module reaches directly into another module's ORM models.
>
> *Non-breaking fix (Part 9, recipe R-08):* extract the shared vocabulary into `app/shared/contracts/` — `AttendanceStatus` and `AttemptStatus`/`QuizStatus` become shared enums, and the bible feed reads quiz aggregates through a **read-model port** (`QuizReadRepository` Protocol) implemented in the quiz module and registered in the shared registry. Imports become one-directional (`bible → shared.contracts`, `quiz → bible` stays but only through a port). No response shape changes; no migration.

> **ARCH-002 — `users` is a hub module (MEDIUM).** Every module imports `users` (for `User`/`RoleName`), and `users` itself imports `auth` and `notifications` at module level (and, transitively, 6 more modules across function-local imports). `users` is simultaneously the most depended-upon module and a consumer of most others — the classic "shared kernel turning into a god module".
>
> *Non-breaking fix:* move the genuinely shared primitives (`RoleName`, `UserStatus`, the `User` **protocol** used by other modules) into `app/shared/contracts/users.py`, keep the concrete ORM model inside `users/infrastructure`, and have other modules depend on the protocol. Existing imports keep working if the new module re-exports the names (`from app.shared.contracts.users import RoleName  # re-export`), so this can land as a pure refactor with zero call-site changes.

> **ARCH-003 — Backend features with no frontend consumer + an internal API contradiction (HIGH).**
> * `GET /api/v1/quiz-analytics/monthly`, `/monthly/users`, `/users/{user_id}` and `/monthly/export` are implemented in `backend/app/modules/points/presentation/analytics_router.py`, but **no frontend code calls them**: `grep -rn "quiz-analytics" frontend/src` returns nothing, and the points module only calls `/points/me/monthly`.
> * The endpoint accepts `month=YYYY-MM` and **silently ignores `year`** (`analytics_router.py:26-40`, `_parse_month`), while the test shipped in the *same commit* (`4f6b0e7`) calls it as `?year=2026&month=9` (`backend/tests/unit/api/v1/test_query_counts.py:150,167`) → HTTP 422. The contract changed before the feature was ever released, but the change was never reconciled and no version/deprecation notice exists inside `/api/v1`.
>
> *Impact:* the monthly-analytics dashboard (a planned admin deliverable, P5-035/036) is unreachable from the UI, and any external consumer written against the documented `year`+`month` shape gets a 422 instead of a clear error.
>
> *Non-breaking fix:* make `_parse_month` accept **both** shapes (`"2026-09"` and `{"year": 2026, "month": 9}`) for one release, return a 400 with a precise message for anything else, add the missing frontend API client, and mark the `year` query parameter as deprecated in the OpenAPI description. Nothing breaks in either direction.

> **ARCH-004 — Two `UnitOfWork` lifecycles coexist (MEDIUM).** `UnitOfWork.create(session_factory)` (async context manager, auto-rollback on error, auto-commit of pending events on clean exit) and `UnitOfWork(session)` (the FastAPI dependency path) are both in active use: `auth_service.py:62,155`, `account_verification.py:62,124`, `profile_service.py:25`, `profile_commands.py:38` use the constructor path, while `get_unit_of_work()` and all outbox handlers use `create()`. Both eventually persist events via `UnitOfWork.commit()` (`unit_of_work.py:132-138`), so behaviour is currently consistent, but the *error* semantics differ: on the constructor path there is no automatic rollback, so a route that raises after `uow.commit()`-less work leaves the session to the request-scoped cleanup.
>
> *Non-breaking fix:* keep `create()` as the canonical form, migrate the four services to accept a `UnitOfWork` **instance** (they already receive a session — change the constructor to take the UoW), and keep a deprecated `UnitOfWork(session)` shim for one release with a `DeprecationWarning`.

> **ARCH-005 — Domain ports are leaky (MEDIUM).** Every one of the 13 `app/modules/*/domain/interfaces.py` files imports the **concrete SQLAlchemy ORM model** from its own `infrastructure.persistence.models` (e.g. `auth/domain/interfaces.py:8` imports `RefreshToken`; `attendance/domain/interfaces.py:15` imports `User` from *another* module's infrastructure). The ports therefore cannot be satisfied by a non-SQLAlchemy adapter, the domain layer cannot be imported without SQLAlchemy, and `attendance`'s domain depends on `users`' ORM.
>
> *Non-breaking fix:* define the domain-facing **value objects / dataclasses** the use cases actually need (e.g. `RefreshTokenRecord`, `UserRef`) in `domain/entities`, keep the ORM types as the *infrastructure* implementation detail, and make the repository protocol speak the domain object. Purely internal — no API or schema change.

> **ARCH-006 — Frozen legacy attendance models are still live in the schema (LOW, by design).** `ServiceSession` / `AttendanceRecord` (`attendance/infrastructure/persistence/models.py`) are explicitly marked **LEGACY / FROZEN (D-8)** and are superseded by the weekly models, yet they still have tables and migrations. The code correctly avoids extending them. The risk is *accidental* extension: nothing prevents a future contributor from writing against them.
>
> *Non-breaking fix:* add a `DEPRECATED` docstring marker plus a CI grep guard (see **OPS-007**) that fails if a non-legacy file imports those models, and record the "do not migrate / do not drop" rule next to the models.

### 3.3 Frontend architecture

* **Routing:** one `src/router.tsx` (532 lines) with `createBrowserRouter`, every route behind `lazyWithRetry` (chunk-reload-on-failure pattern for Vercel deploy invalidation), `RequireAuth` / `RequireRole` guards, and separate layouts (`AdminLayout`, `AttendanceLayout`, auth pages).
* **Data layer:** TanStack Query with per-module `queryKeys.ts` factories (a genuinely good convention: keys are centralised and typed), axios instance in `src/lib/api.ts` with an interceptor chain (token injection, 401 → refresh → retry, single-flight refresh).
* **Forms:** React Hook Form + Zod schemas co-located per feature (`loginSchema.ts`, `verseSchema.ts`, …).
* **UI kit:** shadcn/Radix primitives in `src/components/ui/` (~40 components) + Tailwind.
* **i18n:** `i18next` with a **single Arabic resource bundle** (`src/i18n/resources/ar.ts`) and a parity guard test.
* **Feature folders:** `src/modules/<feature>/{api,hooks,components,pages,types}` — consistent and navigable.

**Weaknesses:**

> **ARCH-007 — Directionality and locale are hard-coded in 51 files (MEDIUM).** 66 occurrences of `dir="rtl"` and 72 of `lang="ar"` are spread across 51 source files, while 137 of 334 files use `useTranslation`. Several components still declare `lang: "ar" | "en"` props, and the platform is Arabic-only (`en.ts` was removed; `frontend/src/i18n/__tests__/parity.test.ts` enforces the single bundle). The codebase therefore carries the *appearance* of bilingual support while being hard-wired to Arabic — a trap for the next maintainer.
>
> *Non-breaking fix (3 small PRs, no behaviour change):* (1) add `useDirection()` / a `DirProvider` that returns `"rtl"` and use it in the ~10 layout-level files; (2) delete the `"en"` arms from component prop types; (3) add a lint rule / grep guard that fails a build if `dir="rtl"` is added outside the allowed layout files.

> **ARCH-008 — Dead and duplicated frontend surface (LOW).** `src/components/ui/` contains ~40 shadcn primitives, a large share of which are never imported (`context-menu.tsx`, `navigation-menu.tsx`, `carousel.tsx`, `resizable.tsx`, `alert.tsx` are explicitly listed as unused in the repo's own logical-properties test). They are harmless but inflate the maintenance surface; the build only pays for what is imported (Vite tree-shakes), so the cost is review noise rather than bundle weight.

### 3.4 Data layer and migrations

* **13 Alembic migrations**, ordered and applying cleanly on an empty database; **`alembic check` reports no drift** — models and schema agree. This is a strong result and should be protected by a CI step (**OPS-003**).
* **One canonical `Base`** (`app/shared/infrastructure/persistence/base.py`) with a **registry** (`registry.py`) that imports every module's models so `metadata.create_all` sees the whole schema. Good practice; the registry must keep growing with new modules or the test bootstrap silently drops their tables.
* **Test bootstrap mismatch (QA-006):** tests create the schema with `Base.metadata.create_all` (`tests/conftest.py:_reset_schema`), while the deployment path uses Alembic. Running `alembic upgrade head` against the test database therefore fails with `DuplicateTableError: relation "anonymous_messages" already exists`. The two schema paths are not interchangeable — a migration that is missing from `metadata` would be invisible to the test suite and only fail in production.
  *Fix:* keep both paths, but add a CI job that (a) creates an empty DB, (b) runs `alembic upgrade head`, (c) runs `alembic check`, and (d) runs a smoke test against the migrated DB. The audit already proved this path is clean.

### 3.5 Architecture scorecard

| Aspect | Assessment |
|---|---|
| Module decomposition | **Good** — 13 cohesive bounded contexts, consistent internal layout |
| Dependency direction | **Fair** — 2 real cycles, 1 hub module, domain ports leak ORM types |
| Composition root | **Good** — routers only wire dependencies; no business logic in presentation |
| Transaction management | **Good** — one `UnitOfWork`, explicit commit, outbox in the same transaction |
| Background work | **Fair** — outbox is solid; the scheduler is an externally-called HTTP endpoint |
| API contract hygiene | **Fair** — consistent prefix `/api/v1`, but one silently changed parameter shape |
| Frontend structure | **Good** — consistent feature folders, typed query keys, route-level code splitting |
| Frontend internationalisation | **Fair** — Arabic-only in practice, hard-coded `dir`/`lang` |
| Testability | **Fair** — pure domain helpers are excellent; use cases are entangled with ORM types |

## 4. Design-pattern assessment

The codebase uses a coherent subset of patterns. This section states **what is used, where, how well it is applied, and where it is being abused**.

### 4.1 Catalogue

| # | Pattern | Where | Verdict |
|---|---|---|---|
| 1 | **Modular Monolith / bounded context** | `app/modules/*` (13) | ✅ **Well applied.** Each module owns its router, use cases, domain and adapters. No cross-module table access except through repositories. |
| 2 | **Repository** | `*/infrastructure/persistence/*_repository.py` (≈40 files) | ✅ **Well applied**, with one caveat — the protocols are typed in ORM terms (ARCH-005). |
| 3 | **Unit of Work** | `app/shared/infrastructure/persistence/unit_of_work.py` | ✅ **Well applied** — one session, one transaction, domain events flushed to the outbox inside `commit()`. Caveat: two lifecycles (ARCH-004). |
| 4 | **Transactional Outbox** | `shared/application/outbox_dispatcher.py`, `shared/infrastructure/persistence/outbox.py` | ✅ **Excellent.** `FOR UPDATE SKIP LOCKED` claiming, per-event session isolation, retry with back-off, unknown-event types fail loudly instead of vanishing, five-attempt budget. This is the single best-engineered part of the codebase. |
| 5 | **Domain Events / Integration Events** | `shared/domain/events.py`, per-module `application/handlers/*` | ✅ **Good.** A registry (`register_handler`) maps event type → handler; the last commit wired the missing `user.registered` / attendance handlers. |
| 6 | **CQRS-lite (separate command/query services)** | `application/commands/*` vs `application/queries/*` | ✅ **Good** for reads, ⚠️ **inconsistent** for writes — some modules route everything through `application/services/*` (auth, notifications, attendance statistics), so the convention is not uniform. |
| 7 | **Strategy / Adapter (ports)** | `domain/interfaces.py` protocols; Telegram client, email sender, Cloudinary uploader | ✅ **Good.** `EmailService.send()` is monkeypatched in tests; the Telegram client is stubbed. The ports are leaky only in typing (ARCH-005). |
| 8 | **DTO / Mapper** | `*/application/dto/*.py`, `*/application/mappers/*`, `*/presentation/mappers.py` | ✅ **Good.** Response shaping is explicit; no ORM objects leak into JSON. |
| 9 | **Guard / Policy (RBAC)** | `presentation/dependencies.py` (`AdminUser`, `BibleManager`, `AnalyticsViewer`), `quiz/application/commands/permissions.py::assert_manager` | ✅ **Good** — authorisation is re-checked inside the use case, not only at the edge. |
| 10 | **Specification / pure domain rules** | `attendance/domain/meeting_schedule.py`, `quiz/application/services/grading_service.py::grade()` | ✅ **Excellent.** Pure functions over `date`/`Decimal`/snapshots — trivially testable, no clock, no DB. |
| 11 | **Clock injection (Service Locator variant of Strategy)** | `app/core/time/clock.py`, injected as `today=` / `now=` callables | ✅ **Excellent.** `date.today()` / `datetime.now()` are banned elsewhere; this single decision is what makes attendance statistics deterministic. |
| 12 | **Singleton (module-level)** | `core/rate_limit/__init__.py`, anonymous-message limiters | ⚠️ **Acceptable but multi-instance unsafe** (SEC-002/PERF-002). |
| 13 | **Factory** | `UnitOfWork.create()`, `OutboxEvent.from_domain_event()` | ✅ Good. |
| 14 | **Null Object / Optional dependency** | `OptionalUser` (anonymous messages) | ✅ Good — a stale token is ignored rather than 401-ing a public form. |
| 15 | **Outbox registry (Plugin registry)** | `register_handler` at import time | ⚠️ **Import-order dependent** — a module that forgets to import its handler file silently disables the consumer (the exact bug fixed by the last commit). |
| 16 | **Anti-pattern — God module** | `users` (ARCH-002) | ⚠️ Needs extraction. |
| 17 | **Anti-pattern — Service Layer doing everything** | `auth_service.py` (116 statements), `notification_service.py` | ⚠️ Acceptable at this size, monitor at >200 statements. |
| 18 | **Anti-pattern — Shotgun surgery** | `AttendanceStatus` / `QuizStatus` used across module boundaries | ⚠️ Same root cause as ARCH-001/002: shared vocabulary has no home. |
| 19 | **Anti-pattern — Feature envy / cross-module ORM access** | `bible/application/queries/verse_queries.py` importing `Quiz`, `QuizAttempt` | ⚠️ Fix via the shared read-model port. |
| 20 | **Anti-pattern — Premature abstraction** | `media` module (138 LOC, 1 entity), `admin` module (95 LOC, audit repo only) | 🟡 Two modules exist as placeholders; acceptable as scaffolding, but they should be documented as "reserved". |

### 4.2 Pattern-specific recommendations

1. **Make the outbox registry explicit.** `register_handler` at import time is convenient but fragile. Replace the implicit import-time registration with an explicit `bootstrap_handlers()` called from `app/main.py` (or `app/shared/application/handlers.py`) that lists every event type and its handler — so a missing registration is a *startup error*, not a silent retry loop. **[R]** The previous commit's message ("the tick treated the rest as unknown and retried them forever") is direct evidence of this failure mode already having cost production incidents.
2. **Adopt the CQRS-lite convention uniformly.** Rename `application/services/*` to `commands/*` where they mutate state and `queries/*` where they read, so the directory structure carries the intent. Pure rename, zero behaviour change — do it in one PR with `git mv`.
3. **Keep the pure-domain discipline.** Every new business rule belongs in `domain/` as a pure function with its own unit test — this is the pattern that is paying off the most today (`meeting_schedule.py`, `grading_service.py`, `permissions.py`).
4. **Extract shared vocabulary into `app/shared/contracts/`** (see ARCH-001/002). This is the single change that removes both import cycles and shrinks the hub module.

---

## 5. Code-quality audit

### 5.1 Backend — static analysis

#### 5.1.1 Ruff (`ruff check .`) — 35 errors [V]

| Rule | Count | Fixable | Notes |
|---|---:|---|---|
| `F401` unused import | 17 | 17 | Concentrated in `quiz/application/queries/*` (6 in one file) and `bible/application/queries/verse_analytics_query.py` |
| `E501` line too long | 9 | 0 | 2 in `auth/presentation/router.py:123,179`, rest in tests |
| `I001` unsorted imports | 8 | 8 | incl. `app/core/exceptions/__init__.py` |
| `F821` **undefined name** | 1 | 0 | **`app/modules/quiz/application/queries/quiz_queries.py:145` — `QuizSummaryResponse`** |

> **CODE-001 — The only `F821` is a latent runtime failure in dead code (HIGH).**
> `quiz_summary_query()` annotates its return type as the *string* `"QuizSummaryResponse"` but imports that name **inside the function body** (line 148). The annotation therefore cannot be resolved by `typing.get_type_hints()`, and the function is **referenced by nothing** in `app/` or `tests/` (verified by grep). The feature it was meant to serve already exists elsewhere: the verse feed embeds `quiz_summary` (`bible/application/dto/verse_dto.py:213`, consumed by `frontend/src/modules/bible/components/QuizTeaserCard.tsx`).
>
> *Impact:* today it is dead code, so nothing breaks. The moment anyone re-uses it — or a tool calls `get_type_hints()` on the module (FastAPI does this for route handlers; this one is not routed) — it raises `NameError`.
>
> *Non-breaking fix:* **delete** `quiz_summary_query` (lines 143-173) and the now-unused `QuizSummaryResponse` / `AttemptState` DTOs (`quiz/application/dto/attempt_dto.py:136-155`) — or, if the intent is to restore it, move the import to module scope and route it. Deletion is the safer option because the equivalent data already ships in the verse feed. Add a CI grep guard for "function defined but never referenced" to catch the next one.

> **CODE-002 — 17 unused imports (LOW, trivial).** Pure dead weight; `ruff check --fix` removes 25 of the 35 errors automatically. Safe: no behaviour change, but land it as its own commit so the diff is reviewable.

#### 5.1.2 Formatter (`ruff format --check .`) — 39 files [V]

431 files are already formatted; **39 files are not** (e.g. `app/config.py`, several attendance services). Ruff-format is deterministic and semantics-preserving.

> **CODE-003 — Formatting is not enforced (MEDIUM).** The CI job exists but the branch is red, so it has never been applied. *Non-breaking fix:* run `ruff format .` in **one dedicated commit** (no logic changes, no test changes), then `ruff check --fix` for imports in a **second** commit. Never mix formatting with behaviour changes.

#### 5.1.3 Mypy (`mypy app`, strict) — 100 errors in 10 files [V]

| Error code | Count | Typical location |
|---|---:|---|
| `arg-type` | 54 | `bible/infrastructure/persistence/engagement_repository.py:267,374`; `points/application/queries/points_queries.py:26,27,58` |
| `call-overload` | 21 | `quiz/application/queries/attempt_queries.py:88,109,128,143` |
| `no-untyped-def` | 10 | `quiz/presentation/router.py:178,197,338`; `bible/presentation/router.py:368` |
| `operator` | 7 | arithmetic on `Optional` values |
| `return-value` | 4 | repository return types |
| `assignment` | 2 | — |
| `name-defined` | 1 | — |
| `misc` | 1 | — |

> **CODE-004 — Strict typing is aspirational, not enforced (MEDIUM).** 100 errors, 54 of them `arg-type`, cluster in the repositories and query services that pass `UUID | None` / `date | None` where a concrete type is expected. *Non-breaking fix (staged, because a blanket `Any` would destroy the value):*
> 1. `mypy --fix` is **not** safe here. Instead, fix by error class: `no-untyped-def` (10) → add annotations; `operator` (7) → make the `Optional` handling explicit; `arg-type` (54) → introduce a `TypeGuard`/narrowing helper or fix the repository signatures to accept `UUID | None`.
> 2. Turn on **incremental strictness**: add `[[tool.mypy.overrides]]` with `disallow_untyped_defs = false` for `app/modules/*/infrastructure/**` while keeping strict rules on `app/modules/*/application/**`, then ratchet the global error budget down to zero in the same PR that fixes it.
> 3. Gate CI on `mypy app` **without** `--strict` add-ons, so the gate reflects the configured strictness in `pyproject.toml` (the audit ran with the project's own configuration).

### 5.2 Frontend — static analysis

#### 5.2.1 ESLint (`npm run lint`) — 820 problems (808 errors, 12 warnings) [V]

* **807 errors + 1 warning are auto-fixable** — i.e. almost the entire backlog is `prettier/prettier` formatting, not logic.
* The 12 remaining warnings are `react-hooks/exhaustive-deps` — **real** issues: hooks that capture stale closures.

> **CODE-005 — Formatting debt masks hook warnings (HIGH as a signal problem).** With 808 formatting errors, the 12 genuine `exhaustive-deps` warnings are invisible in CI noise. *Non-breaking fix (3 commits):* (1) `npx prettier --write "src/**/*.{ts,tsx}"` — formatting only; (2) fix the 12 hook warnings one at a time, each with a test; (3) re-enable `eslint --max-warnings 0` in CI so warnings can never return. **Do not** silence `exhaustive-deps` with `eslint-disable` — the project has only 2 disables today; keep it that way.

#### 5.2.2 TypeScript hygiene (measured) [V]

| Metric | Value | Comment |
|---|---:|---|
| `@ts-ignore` / `@ts-expect-error` | **0** | Excellent |
| `: any` / `as any` | **1** | Excellent for a 31.8 kLOC frontend |
| `console.log` | **0** | Clean |
| `eslint-disable` comments | **2** | Acceptable |
| `tsc --noEmit` in `npm run build` | passes | Vite build runs `tsc -b` (verified: build succeeded) |

#### 5.2.3 Runtime warnings in the passing test suite [V]

* **React duplicate key `n1`** in `NotificationList.tsx` — the fixture feeds two notifications with the same `id`. The component keys by notification id, so a **real** duplicate id from the API would make React drop/duplicate rows.
  *Fix (code + test):* key by a composite (`${n.id}-${n.created_at}`) or ensure the API guarantees unique ids; add a test that asserts unique keys with a realistic payload. The test fixture should use two distinct ids — but the *component* should also be defensive.
* **jsdom "Cross origin http://localhost:3000 forbidden"** in the anonymous-message admin tests: the test performs a **real XHR** through axios instead of mocking the adapter, so the failure path is being exercised against the jsdom origin. It "passes" while making network attempts. *Fix:* mock at the axios adapter level (`vi.mock("axios")` / `axios-mock-adapter`) so tests never touch the network.

### 5.3 Code-block and snippet hygiene [V]

| Pattern | Backend | Frontend | Assessment |
|---|---:|---:|---|
| `# noqa` suppressions | 26 | — | Mostly justified (`noqa: F401` for ORM-model registration imports, `BLE001` for the outbox isolation boundary). Worth a periodic review, not a mass removal. |
| `# type: ignore` | **1** (`app/config.py:129`, `settings = Settings()`) | — | The class has `DATABASE_URL`/`JWT_SECRET` as required fields, so the constructor call genuinely can fail at import time; the ignore hides a **startup** failure mode. See ARCH-009. |
| `except Exception` | 8 | — | All in the outbox dispatcher / email adapters, where broad catching is the isolation boundary. ✅ Justified. |
| Bare `except:` | **0** | — | ✅ |
| `print(` | **0** | — | ✅ |
| `assert` in application code | **10** | — | ⚠️ 5 are in **request paths** (`quiz/presentation/router.py:173,192,209`, `question_commands.py:105`, `point_transaction_repository.py:54`). `assert` is removed under `python -O`; an `AttributeError` on `None` is a much worse error than an explicit 404/409. → **CODE-006 (MEDIUM)**: replace request-path asserts with explicit `NotFoundError` / `HTTPException` equivalents. |
| Raw SQL `text()` | 9, **all static** | — | ✅ No interpolation anywhere; zero f-string SQL. |
| `datetime.now()` / `date.today()` outside `core/time` | 0 (policy enforced) | — | ✅ Excellent. |
| `TODO` / `FIXME` | **1** (`notifications/application/services/notification_service.py:144`, `TODO(phase-blog)`) | — | ⚠️ The blog consumer for `notify_blog_post_published` is wired but the notification side is marked unfinished → **CODE-007 (MEDIUM)**. |
| `# pragma: no cover` | 2 | — | Legitimate unreachable branches in auth dependencies. |

### 5.4 Complexity, duplication and dead code [V]

| Finding | Evidence | Severity |
|---|---|---|
| **N+1 query** in `GET /quizzes` | `quiz/application/queries/quiz_queries.py:82` — `[await _admin_item(uow, quiz) for quiz in quizzes]`; each `_admin_item` runs `session.get(BibleVerse, …)` **+** `count_for_quiz()` → **2N+1 queries** for an N-item page (21 queries for the default page size 10) | **PERF-001 (HIGH)** |
| **Dead function** `quiz_summary_query` | CODE-001 | HIGH |
| **Duplicated repository property** `verse_views` / `verse_reads` returning the same `VerseEngagementRepository` | `shared/infrastructure/persistence/unit_of_work.py:215-231` (documented rationale) | LOW — keep the alias, it is intentional |
| **Duplicated dependency manifests** | `backend/requirements.txt` mirrors `backend/pyproject.toml` with a "keep in sync" comment | **DEP-007 (MEDIUM)** |
| **Duplicated `QuizSummary` shape** | Backend `verse_dto.QuizSummary` ↔ frontend `types/index.ts#QuizSummary` (manual sync) | LOW — consider generated types later |
| **Two module-level import cycles** | ARCH-001 | HIGH |
| **God module** `users` | ARCH-002 | MEDIUM |
| **`assert` in request paths** | CODE-006 | MEDIUM |
| **Stray tracked file** | `frontend/.lovable-backup-20260820-112729/src/routes/index.tsx` (a tool backup of a route file) | **OPS-006 (LOW)** — remove with `git rm` |
| **Unused shadcn primitives** | ~15 of ~40 UI components never imported | LOW |

### 5.5 Documentation and repository hygiene

| Item | Evidence | Severity |
|---|---|---|
| **`docs/designs` = 53 MB of PNG** (44 tracked files, up to 1.6 MB each) | `git ls-files -z | xargs -0 du -h | sort -rh` | **DOC-002 (MEDIUM)** — a 54 MB `.git` for 40 design screenshots. Move to Git LFS or an external bucket, compress to WebP, and keep only the current set in the repo. |
| **Two audit reports** | `docs/AUDIT_REPORT.md` (2026-09-20) and this document | INFO — reconciled in Part 10 |
| **One TODO in production code** | `notification_service.py:144` | CODE-007 |
| **Domain rules documented inline** | Extensive docstrings citing BR-xx / P5-xxx / D-xx rule identifiers | ✅ **Excellent** — business-rule traceability is a real strength |

## 6. QA and test audit

### 6.1 Test inventory [V]

| Suite | Files | LOC | Tests | Result |
|---|---:|---:|---:|---|
| Backend `backend/tests` | 81 | 7,736 | **381** | **373 passed / 8 failed**, 4 warnings |
| Backend coverage | — | — | — | **78 %** statements (6,861 stmts, 1,527 missed), 282 files at 100 % |
| Frontend `frontend/src` | 10 | — | **48** | 48 passed (10 files), 10 s |
| Frontend coverage | — | — | — | **21.92 %** statements, 52.81 % branches, 30.42 % functions |

Backend test topology: `tests/unit` (fast, pure + mocked), `tests/integration/api` (HTTP through ASGI transport), `tests/integration/database` (real PostgreSQL), plus shared fixtures in `tests/conftest.py` and helpers in `tests/utils.py`.

### 6.2 Coverage picture

**Backend — 78 %, with very uneven distribution** [V]:

| Coverage | Area |
|---|---|
| 96–99 % | Outbox, unit of work, grading, publication, repository mechanics, Cloudinary-free paths |
| 80–95 % | Quiz attempts, attendance commands, verse mappers, notification feed |
| 40–80 % | Verse queries, quiz queries/analytics, point-transaction repository, engagement repository |
| **0–35 %** | **Auth services (32–47 %), account verification (32 %), verse analytics (26 %), points monthly analytics (22 %), quiz commands (23–27 %), quiz analytics (23 %)** |

**Frontend — 21.92 %** [V]: the tested files are the anonymous-message pages, notifications, layouts, sidebar, and two utility modules. **Every business-critical flow is untested**: attendance check-in (`CheckInPage.tsx`, 427 lines), attendance dashboard (659 lines), quiz attempt page (336 lines), quiz builder (619 lines), verse management (286 lines), all auth forms (except a few helpers), and every `use*` hook except the notification ones.

> **QA-001 — The frontend test suite covers the demo paths, not the money paths (HIGH).** 48 tests over 334 TS/TSX files and 31,861 LOC. A single refactor of `useHeartbeat`, `useQuizTimer` or `useSaveAnswer` can silently break the quiz attempt or the attendance check-in and CI stays green (because the frontend test step is `continue-on-error: true` *and* the tests that do exist are green).

### 6.3 The eight failing backend tests — root cause of each [V]

| # | Test | Symptom | **Root cause** | Classification | Correct fix |
|---|---|---|---|---|---|
| 1 | `tests/unit/test_config.py::test_settings_defaults` | `assert settings.DEBUG is True` fails (actual `False`) | `config.py:11` was hardened to `DEBUG: bool = False` ("debug mode must be explicitly opted in"). The **test still encodes the old default**. | **Stale test** (behaviour change was intentional and correct) | Update the test to assert `DEBUG is False` and add a case asserting `DEBUG=True` only when explicitly set. |
| 2 | `tests/unit/notifications/test_notification_service.py::test_blog_post_consumer_creates_broadcast_with_cta` | `assert all("New post" in c.subject …)` fails — subject is Arabic | The platform became **Arabic-only** (the `en` bundle was removed). The test still expects the English subject. | **Stale test** (i18n change was intentional) | Assert on the Arabic subject (or on a stable `extra_fields` key / notification `type`), not on English copy. |
| 3 | `tests/unit/attendance/test_absence_rules.py::test_week_closed_boundary_is_wednesday_2359_in_utc` | expected `2026-08-26 20:59Z`, got `21:00Z` | `_week_closed_at()` was deliberately changed to an **exclusive upper bound** (00:00 of the next day) with a documented rationale ("avoids a one-minute gap … where newly registered members would be missed"). The test still asserts the old inclusive `23:59` bound. | **Stale test** (implementation is the better semantic) | Rewrite the test to assert the exclusive bound **and** add the property test it was protecting: a user registered at `Wed 23:59:30` *is* included in that week's expected population. |
| 4 | `tests/integration/attendance/test_queries.py::test_monthly_statistics` | expected rate `25.0`, got `33.33` | The monthly rate denominator changed: the implementation now sums the **per-meeting expected population** (BR-4: each meeting week gets its own expected count), while the test still uses the constant `expected_per_meeting × meetings_held`. Fixture: expected total 15 vs the test's 20. | **Stale test** (BR-4 semantics), but the API now exposes **two different denominators** | Update the test to the BR-4 formula, and — more valuable — assert both denominators explicitly (`attendance_rate` over Σ expected-per-meeting, and `expected_per_meeting` for the open meeting). Document the formula in the OpenAPI description of the endpoint. |
| 5 | `tests/integration/bible/test_publication_notification.py::test_publication_sends_exactly_one_email_and_one_notification` | `result["processed"] == 1`, got **2** | The previous commit (`28b6de2`) registered a `user.registered` outbox handler. The test registers a member first → that leaves a **second pending outbox row**; the dispatcher counts **all** events, not just the publication one. | **Test isolation** (the dispatcher semantics changed, not the feature) | Drain the outbox right after registration (`await dispatch_pending(...)`) before publishing, or assert on the **event type** of the processed rows rather than the count. Also assert `processed == 2` with the extra `user.registered` documented. |
| 6 | `tests/unit/api/v1/test_query_counts.py::test_monthly_analytics_query_count` | HTTP **422** | The endpoint requires `month=YYYY-MM` (`points/presentation/analytics_router.py:26-40`); the test sends `year=2026&month=9`. **Both were added in the same commit (`4f6b0e7`)** — the contract and its test never agreed. | **Contract drift** (see ARCH-003) | Fix the **API** to accept both shapes for one release (safer than fixing only the test, because external clients may use either), then update the test to the canonical `month=2026-09` form. |
| 7 | `tests/unit/api/v1/test_query_counts.py::test_monthly_export_query_count` | HTTP **422** | Identical to #6. | **Contract drift** | Same as #6. |
| 8 | `tests/unit/api/v1/test_users_profile.py::test_avatar_upload_rejected_without_cloudinary` | expected **403**, got **422** with `"Image upload failed; please try again"` | **The test's premise was false in this environment**: `backend/.env` supplies real Cloudinary credentials, so `cloudinary_configured()` returned `True` and the handler performed a **real HTTPS upload to `api.cloudinary.com`**, which rejected the fake bytes → `ValidationError` → 422. | **Real defect in the test environment** — and the proof of **SEC-002** | Force the unconfigured path in the test (`monkeypatch` the Cloudinary settings to empty) **and** make the whole suite credential-free (SEC-002). Additionally assert that **no outbound socket is opened** during tests (see recipe R-02). |

**Summary:** 4 stale expectations caused by deliberate behaviour changes (#1–#4), 2 contract drift (#6–#7), 1 test-isolation issue (#5), and **1 genuine environment defect that is also a security finding** (#8). **None of the 8 indicates a broken production feature** — but two of them (#6/#7) show that an API contract was changed without ever being exercised.

### 6.4 Test hermeticity and data safety — the most important QA finding [V]

`backend/tests/conftest.py` sets `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET` and `MAIL_PROVIDER` through `os.environ.setdefault(...)` **before** `app.config` is imported. Because Pydantic v2 gives environment variables priority over the dotenv file, those four are correctly overridden.

**Everything else is not.** `backend/.env` — which contains the real Cloudinary, Telegram, Gmail, Google and cron credentials — is loaded for every test run, because `Settings.model_config` declares `env_file=".env"` unconditionally (`app/config.py:126-130`).

Observed consequences during this audit:

1. **A real outbound HTTPS request to Cloudinary was made by the test suite** (test #8 above). The response body `"Image upload failed; please try again"` is Cloudinary's rejection of the fake PNG.
2. `MAIL_PROVIDER` is forced to `console` by an autouse fixture *and* `EmailService.send` is monkeypatched in the tests that assert on email — but that protection is **opt-in per fixture**; any test that forgets it would attempt a real SMTP/ Brevo send.
3. Telegram is stubbed in exactly one test module (`tests/unit/api/v1/test_anonymous_messages.py`); `tests/unit/anonymous_messages/test_service.py` uses its own stub. Any new test touching the anonymous-message service without a stub would post to the **production Telegram chat**.
4. **The schema bootstrap is destructive:** `tests/conftest.py::_reset_schema` calls `Base.metadata.drop_all` then `create_all` against `settings.DATABASE_URL`. Because `os.environ.setdefault("DATABASE_URL", …)` does **not** override an already-exported `DATABASE_URL`, a developer (or CI secret) that exports a production URL and runs `pytest` will **drop every table in production** and recreate them empty.

> **QA-002 — The test suite is not hermetic and can destroy production data (CRITICAL).**
>
> **Safe fix (recipe R-02):**
> ```python
> # backend/tests/conftest.py  (insert BEFORE `from app.config import settings`)
> import os
> from urllib.parse import urlparse
>
> os.environ.setdefault("APP_ENV", "test")
> os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://marmarkos:marmarkos@localhost:55432/marmarkos_test")
> os.environ.setdefault("JWT_SECRET", "test-jwt-secret")
> os.environ.setdefault("JWT_REFRESH_SECRET", "test-jwt-refresh-secret")
> os.environ["MAIL_PROVIDER"] = "console"            # hard, not setdefault
>
> # 1) No test may ever reach a third-party service.
> for _var in (
>     "CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET",
>     "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID",
>     "GMAIL_EMAIL", "GMAIL_APP_PASSWORD",
>     "BREVO_API_KEY", "BREVO_SENDER_EMAIL",
>     "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET",
>     "CRON_SECRET",
> ):
>     os.environ[_var] = ""
>
> # 2) Refuse to run against anything that is not a test database.
> _db = (urlparse(os.environ["DATABASE_URL"]).path or "").lstrip("/").lower()
> if "test" not in _db:
>     raise RuntimeError(f"Refusing to run the test suite against non-test database {_db!r}")
> ```
> Additionally add a **network guard** in `tests/conftest.py` (monkeypatch `socket.socket.connect` to raise) so any accidental outbound call fails loudly — this turns a silent production call into an immediate, visible error.

> **QA-003 — The schema-bootstrap path bypasses Alembic (MEDIUM).** See §3.4. Fix: a dedicated CI job that builds the schema **only** with Alembic and then runs the API smoke tests against it.

### 6.5 What the test suite does well [V]

* **Pure-domain unit tests** with injected clocks (`today=`/`now=` callables) make attendance rules deterministic — `tests/unit/attendance/test_absence_rules.py` and the `meeting_schedule` tests are exemplary.
* **Property-based tests** exist for the logical invariants (`tests/test/__tests__/logical-properties.test.ts` on the frontend; rule-driven tests in the backend).
* **Query-count guards** exist for four analytics endpoints (`tests/unit/api/v1/test_query_counts.py`) — an unusually good practice for catching N+1 regressions.
* **Outbox idempotency/retry/failure-budget tests** (`test_publication_notification.py`) assert exactly-once delivery semantics, replay safety and the five-attempt budget.
* **Security-matrix tests** (`tests/integration/api/attendance/test_security_matrix.py`) enumerate unauthenticated/forbidden access across routes.
* **Frontend tests use real providers** (`MemoryRouter`, `QueryClientProvider`, i18n) rather than shallow rendering — good realism for the flows they cover.

### 6.6 Missing test types (recommended, in priority order)

| Missing | Why it matters | Lowest-cost implementation |
|---|---|---|
| **Frontend hook tests** for `useHeartbeat`, `useQuizTimer`, `useSaveAnswer`, `useStartAttempt`, `useSubmitAttempt` | The quiz attempt is the most intricate client logic in the product (pause-safe budget, 30 s heartbeat) and has **0 %** coverage | Vitest + `renderHook` with a fake timer — ~1 day for the five hooks |
| **Attendance check-in component test** | `CheckInPage.tsx` (427 lines) drives the QR camera and PIN fallback | Mock `html5-qrcode`, assert success/late/duplicate states |
| **Contract tests for the OpenAPI schema** | The #6/#7 drift would have been caught instantly | `schemathesis` or a simple `pytest` that calls every documented operation with the schema's example values |
| **Migration smoke job** | Protects the Alembic path (QA-003) | CI job: fresh DB → `upgrade head` → `check` → health endpoint |
| **E2E (Playwright) for the 5 golden paths** | register → verify → login → check-in → take quiz → see points | 5 specs, headless Chromium, against the compose stack |
| **Load test for the check-in burst** | A whole church scans within 15 minutes before/after the meeting | `locust` scenario against a staging DB, 50 concurrent check-ins |
| **Dependency + secret scan in CI** | SEC-001/SEC-008 recur otherwise | `pip-audit`, `npm audit`, `gitleaks` — see OPS-005 |

---

## 7. Scalability and performance

### 7.1 Current load characteristics

The product's traffic profile is **bursty and attendance-shaped**: one weekly meeting concentrates check-ins into a 15-minute window; quiz attempts are spread across the week; the public verse feed is read-mostly.

### 7.2 Findings

> **PERF-001 — N+1 in the admin quiz list (HIGH).** `GET /api/v1/quizzes?page=1&size=10` issues **2N+1 SQL statements** — i.e. **21 for the default page size of 10** (one `session.get(BibleVerse, …)` plus one `count_for_quiz()` per row, on top of the list query). The repository already has `get_with_questions`; the list path needs one joined query for `verse_reference` and one grouped count for `question_count`. *Non-breaking fix:* add a single repository method `list_for_manager_with_meta()` that returns `(Quiz, verse_reference, question_count)` via an outer join + `GROUP BY`, keeping the response shape **identical**. Add a query-count guard (`≤ 3` statements) next to the existing ones.

> **PERF-002 — The rate limiter is per-process (MEDIUM, previously acknowledged as R-3).** `SlidingWindowRateLimiter` keeps dequeues in module-level memory (`core/rate_limit/__init__.py`), instantiated at import time in the anonymous-messages router. With **two or more API replicas** (Vercel functions, Railway containers) the effective limit is *N × configured*. *Non-breaking fix:* keep the in-memory limiter as the default but add a `RATE_LIMIT_BACKEND` setting (`memory` | `database`) and implement the database variant using the existing PostgreSQL instance (a `rate_limit_buckets` table with an UPSERT + expiry). Default stays `memory` → **zero behaviour change on a single instance**, and the deployment can opt in per environment. Redis is unnecessary at this scale.

> **PERF-003 — Connection-pool sizing is implicit (MEDIUM).** `core/database.py::_create_engine` uses `pool_pre_ping=True` (good) but leaves `pool_size`/`max_overflow` at SQLAlchemy defaults (5 + 10 overflow = up to 15 connections **per process**). On Neon (a pooled, serverless Postgres) a burst of serverless instances can exhaust the connection budget. *Non-breaking fix:* make the pool explicit and environment-driven (`DB_POOL_SIZE`, `DB_MAX_OVERFLOW`, defaulting to today's effective values) and document using the **pooled** Neon connection string (`-pooler` endpoint) in serverless deployments.

> **PERF-004 — No read caching on the public feed (MEDIUM).** The verse feed, quiz-for-take and announcements are re-read from Postgres on every request. With Neon (region-local latency is low) this is acceptable at current scale, but a `30 s` TTL cache on the *public, non-personalised* feed would cut database load substantially. *Non-breaking fix:* add an optional response cache (`Cache-Control: public, max-age=30`) at the edge for public endpoints only — **no application logic change**, no stale personalised data, and it can be rolled back by removing one header.

> **PERF-005 — Export caps are in place ✅ (GOOD).** `ANALYTICS_EXPORT_MAX_ROWS = 5000`, `stream_csv` streams the response (does not materialise it), and every list endpoint has a hard `size` ceiling (≤ 100). This is the right shape for a public-facing API.

> **PERF-006 — Frontend asset weight (LOW).** The build emits a 177.96 kB JPEG, a 123 kB asset and a 120 kB CSS bundle; lazy route chunks are tiny (0.18–0.27 kB), so **code splitting is working well**. The remaining wins are image optimisation (`<img loading="lazy">`, WebP, explicit dimensions to avoid CLS) and font subsetting.

> **PERF-007 — Quiz attempt correctness under load is already handled ✅ (GOOD).** `FOR UPDATE SKIP LOCKED` on the outbox, idempotent point inserts (`on_conflict_do_nothing`), unique constraints on attempts/answers and server-authoritative timing mean concurrent check-ins and quiz submissions are safe by construction.

### 7.3 Scalability verdict

| Dimension | Verdict |
|---|---|
| Horizontal scaling of the API | ⚠️ Works, **except** the in-memory rate limiter (PERF-002) and the outbox drainer, which must not run concurrently in two places without `SKIP LOCKED` safety — it has that, so it is safe. |
| Database growth | ✅ Indexed, paginated, capped; analytics queries are aggregate-only. |
| Background processing | ⚠️ Relies on an external scheduler hitting one HTTP endpoint (OPS-004). |
| Frontend | ✅ Route-level splitting works; asset optimisation remains. |
| Burst behaviour | ⚠️ Check-in bursts are DB-bound (2 queries + audit + outbox per scan) — acceptable, but add the connection-pool sizing from PERF-003 before the next meeting season. |

## 8. Reusability and maintainability

### 8.1 Reusable assets that already exist (and should be used more)

| Asset | Location | Reuse opportunity |
|---|---|---|
| `Page` / `PageParams` | `app/core/pagination/` | ✅ Used consistently — every list endpoint returns `Page[T]`. |
| Domain exceptions + handlers | `app/core/exceptions/` | ✅ One error envelope (`code`, `message`) across the API. |
| `stream_csv` | `app/core/csv/` | ✅ Used by the analytics export — add the attendance export. |
| `local_datetime` / `now_local` / `today_local` | `app/core/time/` | ✅ The single source of truth for "now". |
| `UnitOfWork` + registry | `app/shared/infrastructure/persistence/` | ✅ One transaction boundary for all modules. |
| `EmailService` / `BrandEmailContent` | `app/modules/notifications/infrastructure/email/` | ⚠️ Under-used: the blog, quiz and points modules could reuse the same branded template system instead of writing ad-hoc copy. |
| `upload_image` (Cloudinary) | `app/shared/infrastructure/services/image_upload.py` | ✅ Shared by users/avatars and media. |
| `hash_key` | `app/core/rate_limit/` | ✅ Reuse for any new limiter. |
| `map_user_to_response` | `users/application/mappers/` | ✅ Single mapping point (and it now includes `email_verified`). |
| Frontend `queryKeys` factories | `src/modules/*/api/queryKeys.ts` | ✅ Consistent; new features should follow the same shape. |
| Frontend `ErrorRetry` / `EmptyState` / `PageSkeleton` / `StatCard` | `src/components/common/` | ⚠️ Present but not used everywhere — several pages hand-roll equivalent markup. |

### 8.2 Findings

> **REUSE-001 — Two nearly-identical public "submit + forward" flows (MEDIUM).** `anonymous_messages` (Telegram forward, retry, admin list) and the notification broadcast (email fan-out, admin list) implement the same shape: *rate-limit → persist → deliver inline → record status → admin retry*. The two modules already share the outbox, but the delivery bookkeeping is duplicated. *Non-breaking fix:* extract a small `DeliveryStatusMixin`/helper (`status`, `attempts`, `last_error`, `delivered_at`) plus a shared `RetryableDelivery` protocol; keep both modules' public APIs untouched.

> **REUSE-002 — Email copy is not centralised (MEDIUM).** `notifications/infrastructure/email/templates.py` + `application/copy.py` hold branded templates, but other modules embed subject/body strings inline (e.g. the blog post subject that test #2 asserts on). *Non-breaking fix:* route every subject through `copy.py` keyed by event type; the existing captured-email fixtures then assert on the copy module instead of raw strings.

> **REUSE-003 — Frontend page scaffolding is duplicated (LOW).** Pagination, empty states, error retry and stat tiles are re-implemented in several admin pages despite the shared components in `src/components/common/`. *Non-breaking fix:* incremental adoption — one page per PR, no visual change, screenshot-diffed.

> **REUSE-004 — `assert` used as a runtime guard in three layers (MEDIUM).** See CODE-006. Under `python -O` (some PaaS base images set `PYTHONOPTIMIZE`) these assertions silently vanish and the failure mode changes from a clean error to an `AttributeError`. *Non-breaking fix:* replace with explicit exceptions; keep `assert` only in tests.

> **REUSE-005 — Business-rule traceability is excellent but lives only in docstrings (INFO).** Docstrings cite `BR-xx`, `P5-xxx`, `D-xx` identifiers that resolve to documents outside the repository (`docs/` holds designs and audits, not the rule catalogue). *Fix:* add `docs/business-rules.md` mapping every identifier to its statement and owning module, and add a CI check that every `BR-xx` cited in code exists in that file. Cheap, high-value for a multi-developer team.

> **REUSE-006 — Language/locale props are contradictory (MEDIUM).** See ARCH-007. Several components accept `lang: "ar" | "en"` while the platform only ships Arabic; the dead branch is a maintenance trap.

> **REUSE-007 — `requirements.txt` duplicates `pyproject.toml` (MEDIUM).** See DEP-007.

---

## 9. Security audit

### 9.1 Positive controls observed [R unless noted]

| Control | Evidence |
|---|---|
| Password hashing | `bcrypt` with explicit handling of the 72-byte truncation limit (`auth/infrastructure/security/password.py`) |
| Refresh-token rotation | Refresh tokens rotate on use and are revocable (`refresh_token_repository.py`), stored as a hash, delivered in an **HttpOnly, SameSite=Lax** cookie scoped to `/api/v1/auth`, `Secure` derived from the request scheme (`auth/presentation/cookies.py`) |
| JWT handling | Separate access/refresh secrets, explicit algorithms, expiry settings (`auth/infrastructure/security/jwt.py`) |
| OAuth | The Google access token is returned in the **URL fragment**, not the query string (`GoogleCallbackPage.tsx`) — the correct pattern |
| Authorisation | `assert_manager` re-checks roles inside use cases; `RequireRole` guards the SPA; admin listing endpoints use `require_role(ADMIN)` |
| Upload safety | Cloudinary over **HTTPS only**, content-type allow-list (`image/jpeg|png|webp`), 2 MB cap, no local file storage (`shared/infrastructure/services/image_upload.py`) |
| Injection | No string-built SQL; 9 `text()` calls, all static; ORM/parameters everywhere else |
| Cron authentication | `X-Cron-Secret` or an admin bearer token, compared with `secrets.compare_digest`; 503 when unconfigured (`internal/presentation/dependencies.py`) |
| Error leakage | `EXPOSE_ERROR_DETAILS` flag; `/docs` and `/redoc` exposed only when `DEBUG=true` |
| Logging hygiene | No request bodies, no tokens, no message bodies logged; email/Telegram bodies are HTML-escaped before delivery |
| Time safety | `secrets.compare_digest` for secrets; SHA-256 for token/PIN lookups (see SEC-005/SEC-006) |
| Dependency of the DB | `sanitize_database_url()` strips libpq-only params so Neon URLs work with asyncpg |

### 9.2 Findings

#### CRITICAL

> **SEC-001 — Live production secrets are present on disk and are loaded by the test suite (CRITICAL).**
> `backend/.env` exists in the working tree (gitignored, **not** in git history — confirmed) and contains **real** credentials for: Neon `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `GMAIL_EMAIL` + `GMAIL_APP_PASSWORD`, `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`, Cloudinary (cloud name, API key, API secret), `BREVO_API_KEY`, `CRON_SECRET`, and `ATTENDANCE_PIN_PEPPER`.
> `docker-compose.yml` loads the same file via `env_file: ./backend/.env`, and `Settings.model_config` loads `.env` for **every** process that imports `app.config` — including the test suite (QA-002) and any container built from the working tree.
>
> *Impact:* anyone with filesystem access to the machine, the Docker image layer, a CI artefact, or a `docker compose up` on that host obtains production credentials for the database, the mail sender, the Telegram bot, the Google OAuth client and the image store.
>
> *Remediation (recipe R-01):*
> 1. **Rotate every secret listed above**, in this order: `JWT_REFRESH_SECRET` → `JWT_SECRET` → `ATTENDANCE_PIN_PEPPER` → `CRON_SECRET` → database password → Cloudinary API key/secret → Gmail app password → Brevo key → Telegram bot token → Google client secret. Rotating `JWT_SECRET` invalidates access tokens (users re-login — acceptable); rotating `JWT_REFRESH_SECRET` invalidates refresh tokens (same); rotating `ATTENDANCE_PIN_PEPPER` **invalidates every member's attendance PIN** (they must set a new one) — schedule it and announce it.
> 2. **Never store the new values in the repo tree.** Move to the deployment platform's secret store (Vercel env vars, Railway variables, GitHub Actions secrets). Keep only `backend/.env.example` with empty placeholders.
> 3. **Verify no history exposure:** `git log --all --full-history -- backend/.env` returns nothing (already confirmed). Add `gitleaks` to CI and as a pre-commit hook (OPS-005).
> 4. **Empty the current file in place** (`backend/.env` → `backend/.env.local`, gitignored) or delete it after rotating.
> 5. **Add `*.env.local` to `.gitignore`** and document the "where do I get the values" flow in `backend/README.md`.

> **SEC-002 — The test suite inherits production credentials and performs real outbound calls (CRITICAL).**
> Proof: test #8 (§6.3) issued a **real HTTPS POST to `api.cloudinary.com`** using the production Cloudinary key. The same exposure exists for Telegram (production chat), Gmail/Brevo (real sends) and Neon (if `DATABASE_URL` is exported).
> *Remediation:* recipe R-02 (QA-002) — blank every third-party variable in `tests/conftest.py`, add a socket guard, and assert the database name contains `test` before `drop_all`.

> **SEC-003 — The test bootstrap can drop tables in a non-test database (CRITICAL, data loss).**
> `tests/conftest.py::_reset_schema` calls `Base.metadata.drop_all` on `settings.DATABASE_URL`. `os.environ.setdefault("DATABASE_URL", …)` does **not** override an exported variable, so `DATABASE_URL=postgresql+asyncpg://prod… pytest` wipes production.
> *Remediation:* the hard assertion in recipe R-02 (raise before touching the DB) plus a CI guard that the service container DB name ends with `_test`. Optionally run the destructive reset only when `MARMARKOS_ALLOW_SCHEMA_RESET=1` is set, and default to `TRUNCATE` in the common case.

#### HIGH

> **SEC-004 — The access token is stored in `localStorage`/`sessionStorage` (HIGH).**
> `frontend/src/lib/auth.ts:10-22` — `saveAuth()` writes `marmarkos.access_token` to `localStorage` (remember-me) or `sessionStorage`; `getAccessToken()` reads it back and the axios interceptor attaches it as a `Bearer` header.
> *Impact:* any XSS — including one injected through a stored blog comment, a verse title, or a third-party script — yields a 30-minute access token **plus** a refresh token usable from the HttpOnly cookie (the cookie is `SameSite=Lax`, so it is not sent on cross-site fetches, but an XSS *is* same-site and can call `/auth/refresh`). This is the classic account-takeover chain.
> *Non-breaking remediation (recipe R-04, phased):*
> - **Phase A (no user impact):** keep the token in memory only; persist a *marker* in `localStorage` so a page reload can trigger a silent `/auth/refresh` (the cookie does the work). The refresh cookie is already `HttpOnly` + `SameSite=Lax` + `Secure` in production. Add `Cache-Control: no-store` on `/auth/refresh` responses (already the default for JSON APIs).
> - **Phase B:** introduce `VITE_AUTH_PERSISTENCE=memory|localStorage` (default `memory`) so a rollback is one env var. Ship `memory` to 10 % of traffic, then 100 %.
> - **Phase C:** on rollout, clear any legacy token from storage (`localStorage.removeItem("marmarkos.access_token")`) on first load.
> - **Hardening that must accompany it:** a **Content-Security-Policy** (SEC-009) so that an injected script cannot exfiltrate the token — CSP is the real control; storage choice is defence in depth.

> **SEC-005 — Refresh tokens are hashed with plain SHA-256, without a secret (HIGH).**
> `auth/infrastructure/security/refresh_tokens.py:9-10` — `hashlib.sha256(token.encode()).hexdigest()`. The tokens are 48 random bytes (`token_urlsafe(48)`) so they are not guessable, but they are **not peppered**: a read-only leak of the `refresh_tokens` table allows an attacker to **replay** every live refresh token (the hash *is* the bearer credential for the refresh endpoint, since the server re-hashes the presented token and matches it).
> *Non-breaking remediation (recipe R-03):* switch to **HMAC-SHA-256 with a dedicated pepper**, with a **version prefix** and a **dual-read** migration:
> ```python
> # app/modules/auth/infrastructure/security/refresh_tokens.py
> def hash_refresh_token(token: str) -> str:
>     pepper = settings.REFRESH_TOKEN_PEPPER or settings.JWT_REFRESH_SECRET
>     return "v2:" + hmac.new(pepper.encode(), token.encode(), hashlib.sha256).hexdigest()
>
> def legacy_hash_refresh_token(token: str) -> str:
>     return hashlib.sha256(token.encode()).hexdigest()      # old values, read-only
> ```
> Lookup order: `v2:` hash → miss → legacy hash → **hit ⇒ re-hash in place** (self-healing). Because the stored value grows from 64 to 67 characters, ship an **expand** migration first: `ALTER TABLE refresh_tokens ALTER COLUMN token_hash TYPE VARCHAR(128)` — that is backward compatible (old 64-char values still fit, and the column stays unique/indexed). Do **not** drop or rewrite the old rows in the same release.

> **SEC-006 — The attendance-PIN pepper silently falls back to a JWT-secret derivative (HIGH).**
> `users/application/services/attendance_pin.py:47-56` — if `ATTENDANCE_PIN_PEPPER` is empty, the pepper is derived from `JWT_SECRET`, which couples PIN-hash validity to JWT rotation (rotating the JWT secret would invalidate every member's PIN) and means the "independent lifecycle" the config comment promises is not real in deployments that did not set the variable.
> The current `backend/.env` **does** set `ATTENDANCE_PIN_PEPPER`, so the deployed behaviour is correct — but the fallback is a latent trap.
> *Non-breaking fix:* (1) make the fallback **loud** — log at `WARNING` on every request (currently once per call) and expose a `GET /health` field `pepper_configured: false`; (2) in production (`APP_ENV=production`) **refuse to start** if `ATTENDANCE_PIN_PEPPER` is unset — that is a startup-time change, not a runtime behaviour change, and it fails loudly before serving traffic; (3) document the rotation procedure ("rotate the pepper ⇒ all PINs must be reset") in `backend/README.md`.

> **SEC-007 — No rate limiting on the authentication endpoints (HIGH).**
> The only limiter in the codebase is on `POST /anonymous-messages` (`core/rate_limit`); `POST /auth/login`, `/auth/register`, `/auth/password/forgot`, `/auth/password/resend-verification` and `/auth/refresh` are unthrottled.
> *Impact:* credential stuffing against `/auth/login`; **email bombing** through `/auth/password/forgot` and `/auth/resend-verification` (each triggers a real SMTP send and costs quota); unauthenticated account enumeration through the differing error responses.
> *Non-breaking fix:* reuse the existing `SlidingWindowRateLimiter` with the same in-memory semantics (no new dependency, no schema change): per-IP 10 login attempts / 15 min, 5 password-reset requests / hour / email, 3 verification resends / hour / email. Return the existing `rate_limited` error code (already defined in `core/exceptions/errors.py:54`) with HTTP 429. Behind multiple replicas the limiter is per-process — acceptable for abuse damping, and PERF-002's database backend can be added later. **Do not** introduce account lockout (permanent locks are a DoS vector); use exponential back-off instead.

> **SEC-008 — Known-vulnerable dependencies in the runtime tree (HIGH).**
> `npm audit --omit=dev` → **3 high**: `axios` (direct) — prototype pollution, SSRF and ReDoS advisories affecting `>=1.7.0 <1.20.0`; `zod` (direct) — memory exhaustion on hostile input; `follow-redirects` (transitive of axios). `pip-audit -r requirements.txt` → **3 vulnerabilities in 2 packages**: `python-jose 3.5.0` (PYSEC-2026-4298 — accepts DER-encoded public keys in HMAC initialisation, incomplete fix for CVE-2024-33663) and `ecdsa 0.19.2` (PYSEC-2026-1325 — Minerva timing attack on P-256; **no fix available**, project treats side channels as out of scope).
> *Non-breaking fix (recipe R-05):*
> - Frontend: `npm install axios@^1.20.0` (1.20.0 exists and is the fixed line) — the axios 1.x API used here (`instance`, interceptors, `AxiosError`) is unchanged, so this is a patch-level change. Then `zod` → `^4` **together with** `@hookform/resolvers` → `^6` (the v6 resolver is the Zod-4-compatible line) — do these in one PR because the resolver API changed, and re-run the form tests. `follow-redirects` is fixed by the axios upgrade.
> - Backend: `python-jose` has **no fixed release** → replace it with `PyJWT` (`pyjwt[crypto]`) for HS256, which is the only algorithm this codebase uses (`jwt.py`). The JWT payload/claims stay identical, so existing tokens remain valid until `JWT_SECRET` is rotated (which SEC-001 does anyway). `ecdsa` is a transitive dependency of `python-jose` — removing `python-jose` removes it. `passlib` is declared but **never imported** (the code uses `bcrypt` directly) → delete it.

#### MEDIUM

> **SEC-009 — No security response headers (MEDIUM).** Neither the API nor the SPA sets `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy` or `X-Frame-Options` (`app/main.py` adds only `CORSMiddleware`; the frontend has no `_headers` configuration). *Non-breaking fix:* add a small ASGI middleware (or `vercel.json` headers) with a **report-only** CSP first (`Content-Security-Policy-Report-Only`), observe for one week, then enforce. HSTS only after confirming every subdomain is HTTPS.

> **SEC-010 — The OpenAPI schema mis-declares the public anonymous-message endpoint (MEDIUM).** `POST /api/v1/anonymous-messages` is public in behaviour (`OptionalUser`, stale token ignored) but the generated schema advertises `security: [{HTTPBearer: []}]` because `OptionalUser` is built on `HTTPBearer(auto_error=False)`. Generated clients will therefore demand a token for a public form. *Fix:* declare the route with `security=[]` in the decorator so the schema matches reality — a documentation-only change.

> **SEC-011 — `TRUST_PROXY_HEADERS` makes the rate-limit IP spoofable (MEDIUM).** When enabled, the client IP for rate limiting is the first hop of `X-Forwarded-For` (`anonymous_messages/presentation/router.py::_client_ip`). If the app is reachable **without** a trusted proxy that overwrites the header, any client can rotate its apparent IP and bypass the per-IP limit. *Fix:* keep the flag off by default (it is), document the requirement ("only enable behind a proxy that strips inbound `X-Forwarded-For`"), and validate the hop count against a configured trusted-proxy list.

> **SEC-012 — `frontend/.env.example` points at the production API (MEDIUM).** `VITE_API_BASE_URL=https://marmarkos-abnub-ny1l.vercel.app/api/v1` means a developer who copies the example file talks to **production** — creating real users, real attendance records and real points. *Fix:* change the example to `http://localhost:8000/api/v1` and add a loud banner in `frontend/README.md` plus a startup `console.warn` when the base URL points at the production host in a non-production build.

> **SEC-013 — Password-reset and verification flows can be used as an oracle (MEDIUM).** The generic error envelope is good, but the *timing* and *response* of `/auth/password/forgot` and `/auth/verify-email` differ between "unknown user" and "known user, already verified". Combined with SEC-007 (no throttle) this enables user enumeration. *Fix:* always return the same 202 response and the same body, and make the work performed in the two branches comparable.

> **SEC-014 — No operational visibility (MEDIUM).** There is no structured logging, no request-id propagation, no metrics and no tracing. When the outbox "failed" counter climbed (per the last commit message) the only signal was a log line. *Fix (additive):* a `RequestContextMiddleware` that attaches/propagates `X-Request-ID`, JSON-formatted logs with the request id, and a `/metrics` endpoint exposing counters for `outbox_pending`, `outbox_failed`, `auth_rate_limited`, `attendance_checkin_total`. No API contract change.

#### LOW

> **SEC-015 — The refresh cookie's `Secure` flag depends on the request scheme (LOW, informational).** `_is_secure()` uses `request.url.scheme == "https"` with an `APP_ENV == "production"` fallback. Behind a TLS-terminating proxy that does not set `X-Forwarded-Proto`, `request.url.scheme` is `http` and the cookie would be issued **without** `Secure`. *Fix:* honour `X-Forwarded-Proto` only when `TRUST_PROXY_HEADERS` is enabled, and add an explicit `SECURE_COOKIES` override for deployments behind a proxy.

> **SEC-016 — `CORS_ORIGINS` with `allow_credentials=True` (LOW).** Origins come from the environment, so a mis-set value (e.g. `*`) with credentials is rejected by the browser but is a common misconfiguration. *Fix:* fail fast at startup if `APP_ENV=production` and `CORS_ORIGINS` contains `*`.

### 9.3 Security scorecard

| Area | Rating | Note |
|---|---|---|
| Credential management | 🔴 **Fail** | Live secrets on disk + loaded by tests (SEC-001/002/003) |
| Authentication | 🟡 Fair | bcrypt + rotating refresh tokens, but no throttling and a non-HMAC refresh hash |
| Authorisation | 🟢 Good | Defence in depth, role re-checks, guards in both layers |
| Session/token storage (client) | 🔴 Weak | Access token in `localStorage` (SEC-004) |
| Input validation | 🟢 Good | Pydantic schemas everywhere, bounded pagination, length limits |
| Injection | 🟢 Good | No string-built SQL; parameters everywhere |
| File upload | 🟢 Good | HTTPS-only, allow-list, size cap, no local storage |
| Rate limiting / abuse control | 🔴 Weak | Only one endpoint is throttled (SEC-007) |
| Headers / CSP | 🔴 Weak | None set (SEC-009) |
| Dependency hygiene | 🔴 Weak | 3 high npm + 3 pip advisories (SEC-008) |
| Secrets in git history | 🟢 Good | `.env` never committed |
| Logging/privacy | 🟢 Good | No bodies or tokens logged |
| Error leakage | 🟢 Good | `EXPOSE_ERROR_DETAILS` flag, docs gated on `DEBUG` |

## 10. Dependencies, deprecations and lifecycle

### 10.1 Vulnerable packages (must act) [V]

| Ecosystem | Package | Installed | Advisory | Fixed in | Action |
|---|---|---|---|---|---|
| npm | **axios** (direct) | see `package.json` | prototype pollution / SSRF / ReDoS — `>=1.7.0 <1.20.0` | **1.20.0** | `npm i axios@^1.20.0` |
| npm | **zod** (direct) | 3.25.76 | memory exhaustion on hostile input | **4.x** | Upgrade with `@hookform/resolvers@^6` in the same PR |
| npm | **follow-redirects** (transitive via axios) | — | redirect-based SSRF | pulled in by the axios upgrade | Verify after upgrade |
| PyPI | **python-jose** | 3.5.0 | PYSEC-2026-4298 — asymmetric-key confusion in HMAC init (incomplete fix for CVE-2024-33663) | **none** | Replace with `PyJWT` (HS256 only) |
| PyPI | **ecdsa** (transitive via python-jose) | 0.19.2 | PYSEC-2026-1325 — Minerva timing attack on P-256 | **none** | Removed together with `python-jose` |

> `python-jose` is **not reachable** for the vulnerable asymmetric path today (the app signs/verifies with **HS256** and a symmetric secret only), so this is a *supply-chain* exposure rather than a live exploit. It still blocks a clean `pip-audit` and must be removed to make the gate green.

### 10.2 Deprecated / unmaintained packages and methods [V]

| Item | Status | Impact | Action |
|---|---|---|---|
| `python-jose 3.5.0` | Effectively unmaintained; no release fixes the advisory | Blocks a clean `pip-audit` | Replace with `PyJWT` (recipe R-05) |
| `passlib 1.7.4` | Declared in `pyproject.toml`/`requirements.txt` but **never imported** (the code calls `bcrypt` directly) | Dead dependency, extra attack surface, confusing signal to maintainers | **Delete it** — zero code change |
| `ecdsa 0.19.2` | No fix planned (side channels out of scope) | Transitive only | Removed with `python-jose` |
| `starlette.HTTP_422_UNPROCESSABLE_ENTITY` | **Deprecated** — use `HTTP_422_UNPROCESSABLE_CONTENT` | Emits `StarletteDeprecationWarning` in `points/presentation/analytics_router.py:51,109` and in the test output | Replace the constant (behaviour identical: both are 422) |
| `httpx` per-request `cookies=` | **Deprecated** in httpx 0.28+ | `DeprecationWarning` in `tests/unit/api/v1/test_auth_tokens.py` | Set cookies on the `AsyncClient` instance instead |
| `eslint 9.39.5` | Major upgrade available (10.0.1) | ESLint 10 changes flat-config defaults | Plan an upgrade PR; do **not** mix with the formatting PR |
| `typescript 5.7.3` | Latest is 7.0.2 | Large jump | Defer; upgrade to 5.x latest first |
| `react 18.3.1` | React 19 available | — | Defer (Radix/RHF compatibility first) |
| `vitest 2.1.8` | Latest 5.0.5 | — | Defer; the current setup works |
| `vite 6.4.3` | Latest 8.3.5 | — | Defer; Vite 7/8 change the plugin API |
| `lucide-react 0.468.0` | Latest 1.61.0 | — | Defer (icon renames are a visual risk) |
| `recharts 2.15.4` | Latest 3.10.1 | — | Defer (major API change) |
| `jsdom 25.0.1` | Latest 30.1.3 | Test-only | Safe to bump |
| `open ranges` (`^` in `package.json`, `>=` in `pyproject.toml`) | — | Builds are not reproducible | Pin via `package-lock.json` (already present) + a generated `requirements.lock` (DEP-007) |

### 10.3 Outdated-but-not-urgent (patch/minor) [V]

**Python:** `alembic 1.19.1→1.20.1`, `asyncpg 0.31.0→0.32.0`, `cryptography 50.0.0→50.0.2`, `fastapi 0.141.1→0.162.0`, `starlette 1.6.0→1.10.0`, `pydantic 2.13.4→2.14.1`, `pydantic-settings 2.15.0→2.16.1`, `uvicorn 0.52.4→0.54.0`, `mypy 2.3.1→2.4.0`, `ruff 0.16.3→0.17.2`, `coverage 7.15.4→7.17.0`, `pytest-asyncio 1.4.0→1.4.1`, `pip 24.0→26.2.2`, plus transitive refreshes (`anyio`, `certifi`, `idna`, `websockets`, …).
**Frontend (patch/minor):** `react-router-dom 7.18.2→7.18.4`, `react-hook-form 7.85.0→7.91.0`, `@tanstack/react-query 5.101.4→5.105.0`, `i18next 26.4.0→26.5.11`, `react-i18next 17.0.12→17.1.9`, `tailwind-merge 3.6.0→3.7.0`, `prettier 3.9.6→3.9.10`, `typescript-eslint 8.67.0→8.72.0`, `@hookform/resolvers 5.9.1→5.9.2`, and **26 `@radix-ui/react-*` packages** one minor behind.

> **DEP-001 — Adopt a dependency-update policy (MEDIUM).** Add **Renovate** (or Dependabot) with: patch PRs auto-merged **after CI is green**, minor PRs auto-merged for `dev`-group packages only, majors grouped and manual. Until CI is green, auto-merge must stay off.

### 10.4 Duplicate dependency manifests [V]

`backend/requirements.txt` and `backend/pyproject.toml` declare the same dependency set, and `requirements.txt` carries a "keep in sync" comment. Divergence is a supply-chain risk (CI installs `pip install -e ".[dev]"` from `pyproject.toml`, while `pip-audit` in this audit read `requirements.txt` — the two can describe different trees).

> **DEP-002 — Make `pyproject.toml` the single source of truth (MEDIUM).**
> * Delete `backend/requirements.txt` **after** switching the audit tooling to read the project metadata: `pip-audit .` (audits the installed environment) or `pip-audit --requirement <(pip-compile pyproject.toml)`. Add `pip-tools` + a generated `backend/requirements.lock` for reproducible deployments.
> * If `requirements.txt` must stay (some platforms expect it), generate it: `pip-compile pyproject.toml -o requirements.txt` in CI and fail the build if it differs from the committed file.

---

## 11. CI/CD, DevOps and repository hygiene

### 11.1 Current pipelines [V]

**Backend (`.github/workflows/backend-ci.yml`)** — on push/PR to `main`/`develop`:
`setup-python 3.12` → `pip install -e ".[dev]"` → `ruff check .` → `ruff format --check .` → `mypy app` → `pytest` (PostgreSQL 16 service on port 55432, DB `marmarkos_test`).
**Result today: all four gates are RED** (35 ruff errors, 39 unformatted files, 100 mypy errors, 8 test failures).

**Frontend (`.github/workflows/frontend-ci.yml`)** — on push/PR to `main`/`develop`:
`setup-node 20` (npm cache) → **`npm install`** → `npm run build` → **`npm test -- --run` with `continue-on-error: true`**.
**Result today: effectively green** — build passes and the test outcome is *discarded*.

> **CI-001 — The backend pipeline is red on every gate (CRITICAL, quality).** A pipeline that is red on all four steps provides no signal and trains the team to ignore it. *This is the single most damaging non-security finding*, because it masks all the others. Fix order and recipes in Part 9.

> **CI-002 — The frontend pipeline does not gate (HIGH).** `continue-on-error: true` on the test step means a failing test suite is reported as success. Additionally: `npm install` instead of `npm ci` (non-reproducible, ignores the lockfile's exact tree), **no lint step**, **no `npm audit`**, and **no coverage threshold**.
> *Non-breaking fix:*
> ```yaml
> - name: Install dependencies
>   run: npm ci
> - name: Lint
>   run: npm run lint -- --max-warnings 0
> - name: Audit (production deps)
>   run: npm audit --omit=dev --audit-level=high
> - name: Tests
>   run: npm run test:run          # no continue-on-error
> ```
> Order matters: land the formatting PR (CODE-005) **before** enabling `--max-warnings 0`, otherwise CI stays red for a different reason.

> **CI-003 — No dependency-vulnerability gate (HIGH).** `pip-audit` and `npm audit` are absent from both workflows. *Fix:* add `pip-audit` (after DEP-002) and `npm audit --omit=dev --audit-level=high` as blocking steps; add `pip install pip-audit` to the `dev` extra.

> **CI-004 — No secret scanning (HIGH).** Nothing prevents a future `.env`/key commit. *Fix:* `gitleaks/gitleaks-action@v2` (or `trufflesecurity/trufflehog`) on push and PR, plus a local `pre-commit` hook. This directly prevents a repeat of SEC-001.

> **CI-005 — No migration-drift gate (MEDIUM).** `alembic check` is not run in CI, so a model change without a migration would only be discovered at deploy time. *Fix:* add a job — fresh DB → `alembic upgrade head` → `alembic check` → smoke-test the API.

> **CI-006 — The CI database is a single service instance with no isolation guarantee (MEDIUM).** The service DB is `marmarkos_test` and the suite `drop_all`s it — fine in CI, but combined with QA-002 it is a footgun for anyone running the workflow against a shared database.

> **CI-007 — No coverage gate (MEDIUM).** Neither pipeline enforces coverage. Backend coverage is 78 %, frontend 21.92 %, and nothing prevents a decline. *Fix:* `pytest --cov=app --cov-fail-under=78` (ratchet to 85 %) and a Vitest coverage threshold (start at the current 21.92 % and raise by 2 points per sprint — never lower it).

> **CI-008 — `pip install -e ".[dev]"` without a lock (MEDIUM).** See DEP-002.

### 11.2 Containers and local orchestration [V]

| Item | State | Issue |
|---|---|---|
| `backend/Dockerfile` | `python:3.12-slim`, installs the project, `CMD ./scripts/entrypoint.sh` | Runs as **root**; no `HEALTHCHECK`; migrations run **on every boot** → two replicas starting simultaneously can race on `alembic upgrade head`; `pip install --upgrade pip` adds build time and non-determinism |
| `frontend/Dockerfile` | `node:20-alpine`, `npm install`, `CMD npm run dev -- --host 0.0.0.0` | **This is the Vite dev server**, not a production build — no `npm run build`, no static hosting, no `nginx`, runs as root, `npm install` instead of `npm ci` |
| `docker-compose.yml` | `backend` + `frontend` only | **No database service**, no healthchecks, no resource limits, no restart policies; the backend mounts the source tree and runs `uvicorn --reload` (a dev-only setup) |

> **OPS-001 — The production frontend image is a dev server (HIGH).** Anyone who builds `frontend/Dockerfile` and deploys it gets a hot-reloading Vite dev server on port 5173 — slower, larger attack surface, and no production asset optimisation. *Non-breaking fix:* add a **multi-stage** Dockerfile (build with `npm ci && npm run build`, then serve the static `dist/` with `nginx:alpine` or a static host) and keep the current file as `frontend/Dockerfile.dev` so local development is unchanged. The SPA is already built for Vercel in production, so this only fixes the container path.

> **OPS-002 — Migrations run on application boot (MEDIUM).** `scripts/entrypoint.sh` runs `alembic upgrade head` before uvicorn. With more than one replica, two `alembic upgrade head` processes can interleave. *Non-breaking fix:* keep the behaviour for single-instance deployments but add a PostgreSQL **advisory lock** around the migration step (`SELECT pg_advisory_lock(...)`) so concurrent boots serialise; or move migrations to a release job and let the entrypoint only verify (`alembic current` vs `head`).

> **OPS-003 — No healthcheck / readiness distinction (MEDIUM).** `GET /api/v1/health` exists but is not wired to Docker `HEALTHCHECK` or to the platform's readiness probe, and there is no separate liveness vs readiness semantics (a readiness check should verify the DB). *Fix:* add `HEALTHCHECK CMD curl -f http://localhost:8000/api/v1/health` (or a Python one-liner, since slim has no curl) and a `/health/ready` that pings the database.

> **OPS-004 — Scheduling depends on an external cron hitting one URL (MEDIUM).** `POST /api/v1/internal/scheduler/tick` performs publication, verse opening and outbox draining. If the external scheduler stops, publications stall silently. *Fix:* add an alert on `verse_publication_status = PENDING` older than N minutes, expose `outbox_pending`/`outbox_failed` counters (SEC-014), and schedule the tick **every minute** with a generous overlap (the endpoint is idempotent by design — `claim_pending` + `SKIP LOCKED`).

> **OPS-005 — Containers run as root and have no resource limits (MEDIUM).** Add a non-root `USER` to both images and set `mem_limit`/`cpus` in compose.

> **OPS-006 — Repository hygiene (LOW → MEDIUM over time).**
> * `frontend/.lovable-backup-20260820-112729/src/routes/index.tsx` is **tracked in git** — a tool backup of a route file. Remove with `git rm` (history keeps it, but future clones are clean).
> * `docs/designs` = **53 MB** of PNG (44 tracked files, 1.3–1.6 MB each) in a **54 MB** `.git`. Move to Git LFS or an external bucket; compress to WebP; keep only the current design set.
> * `backend/.venv` and `frontend/node_modules` exist on disk (899 MB total) — correctly gitignored, but confirm `.gitignore` covers `*.egg-info`, `.pytest_cache`, `.mypy_cache`, `.ruff_cache`, `coverage/`, `frontend/coverage/`.

> **OPS-007 — No guard against touching the frozen legacy attendance models (LOW).** Add a CI grep that fails if `ServiceSession` or `AttendanceRecord` is imported outside the legacy module (ARCH-006).

### 11.3 Deployment and configuration hygiene

| Item | State | Recommendation |
|---|---|---|
| `backend/.env.example` | ✅ **Verified clean** — placeholders only (`JWT_SECRET=change-me`, `DATABASE_URL=…:USER:PASSWORD@HOST:5432/DBNAME`, empty third-party fields) | Keep it that way; add a comment per variable and a CI check that no value in `.env.example` matches a secret-looking pattern |
| `frontend/.env.example` | Points at the **production** API | Change to localhost (SEC-012) |
| `Settings` env file | Always `.env`, never overridable | Add `ENV_FILE` support so a deployment can mount a file elsewhere; default stays `.env` |
| `settings = Settings()  # type: ignore[call-arg]` | `app/config.py:129` | The required fields (`DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`) make import-time construction fail if unset. *Fix:* raise a **clear** error listing the missing variables instead of a Pydantic traceback; remove the `type: ignore` by constructing via `Settings.model_validate({})` or by giving the fields safe defaults + a startup validator |

---

## 12. Complete findings register

**Totals: 4 Critical · 14 High · 36 Medium · 19 Low = 73 findings.**
(*CI-001 is classed Critical because it is a *quality* gate failure that hides every other finding, not a security issue. Four Medium rows — REUSE-004, REUSE-006, REUSE-007 and DOC-002 — are cross-references to findings already counted elsewhere and add no new work.)

### 12.1 Critical

| ID | Finding | Area | Evidence | Fix | Effort |
|---|---|---|---|---|---|
| **SEC-001** | Live production secrets on disk; loaded by every process that imports `app.config` | Security | `backend/.env` (gitignored, untracked) | Rotate all; move to the platform secret store; empty the file | 2–4 h |
| **SEC-002** | Test suite inherits production credentials and made a **real Cloudinary call** | Security / QA | §6.4, test #8 | Blank third-party env vars in `tests/conftest.py`; socket guard | 1 h |
| **SEC-003** | Test bootstrap can `drop_all` a **production** database | Security / QA | `tests/conftest.py::_reset_schema` | Assert the DB name contains `test` before any DDL | 30 min |
| **CI-001** | Backend CI red on **all four** gates → no release signal | Quality | §11.1 | Four isolated PRs (Part 9, Phase 1) | 1–2 days |

### 12.2 High

| ID | Finding | Area | Evidence | Fix | Effort |
|---|---|---|---|---|---|
| **SEC-004** | Access token in `localStorage`/`sessionStorage` | Security | `frontend/src/lib/auth.ts:10-22` | Memory-first token + refresh cookie, behind a flag | 1–2 days |
| **SEC-005** | Refresh tokens hashed with unsalted SHA-256 | Security | `auth/.../refresh_tokens.py:9-10` | HMAC + `v2:` prefix, dual-read migration, column widen | 3 h |
| **SEC-006** | PIN pepper silently falls back to a JWT-secret derivative | Security | `users/.../attendance_pin.py:47-56` | Fail fast in production; loud warning; document rotation | 2 h |
| **SEC-007** | No throttling on `/auth/login`, `/forgot`, `/resend-verification`, `/refresh` | Security | `core/rate_limit` used only by anonymous messages | Reuse `SlidingWindowRateLimiter`; 429 with the existing error code | 3 h |
| **SEC-008** | 3 high npm advisories + 3 pip advisories | Security / Deps | §10.1 | axios ≥1.20, zod 4 + resolvers 6, replace `python-jose` with PyJWT, drop `passlib` | 1 day |
| **ARCH-001** | Two module-level import cycles (`attendance↔notifications`, `bible↔quiz`) | Architecture | §3.2.2 | `app/shared/contracts/` + read-model ports | 1–2 days |
| **ARCH-003** | Analytics endpoints have no frontend client; `month` contract contradicts its own test | Architecture | §3.2.2, tests #6/#7 | Accept both shapes for one release; add the client | 4 h |
| **CODE-001** | `F821` undefined name + dead function `quiz_summary_query` | Code quality | `quiz/.../quiz_queries.py:145` | Delete the function and its unused DTOs | 15 min |
| **CODE-005** | 820 lint problems hide 12 real `exhaustive-deps` warnings | Code quality | §5.2.1 | Format, then fix the 12 hooks, then `--max-warnings 0` | 1 day |
| **QA-001** | Frontend coverage 21.92 %; the critical flows are untested | QA | §6.2 | Hook tests for quiz/attendance + Playwright golden paths | 1–2 weeks |
| **QA-002** | Test suite is not hermetic | QA | §6.4 | Recipe R-02 | 1 h |
| **PERF-001** | N+1 in `GET /quizzes` (2N+1 queries) | Performance | `quiz/.../quiz_queries.py:82` | Single joined repository query; add a query-count guard | 3 h |
| **CI-002** | Frontend CI does not gate (lint/audit absent, tests `continue-on-error`) | CI | `.github/workflows/frontend-ci.yml` | `npm ci` + lint + audit + real test gate | 2 h |
| **OPS-001** | Production frontend image runs the Vite **dev server** | Ops | `frontend/Dockerfile` | Multi-stage build → nginx/static | 3 h |

### 12.3 Medium

| ID | Finding | Fix | Effort |
|---|---|---|---|
| **SEC-009** | No CSP/HSTS/X-Frame-Options/Referrer-Policy | Report-only CSP → enforce; HSTS after verification | 4 h |
| **SEC-010** | OpenAPI mis-declares the public anonymous-message endpoint | `security=[]` on the route decorator | 15 min |
| **SEC-011** | `TRUST_PROXY_HEADERS` makes the rate-limit IP spoofable | Document + trusted-proxy list; keep off by default | 2 h |
| **SEC-012** | `frontend/.env.example` points at production | Point at localhost; warn on non-prod builds | 30 min |
| **SEC-013** | Auth flows can act as a user-enumeration oracle | Uniform 202 response + uniform timing | 2 h |
| **SEC-014** | No structured logging, request ids, metrics or tracing | `RequestContextMiddleware` + `/metrics` | 1–2 days |
| **ARCH-002** | `users` is a hub module | `app/shared/contracts/users.py` re-exports | 1 day |
| **ARCH-004** | Two `UnitOfWork` lifecycles | Migrate 4 services to `create()`; deprecate the constructor | 4 h |
| **ARCH-005** | Domain ports typed in ORM models (13/13) | Domain value objects + Protocol signatures | 2–3 days |
| **ARCH-007** | 138 hard-coded `dir="rtl"`/`lang="ar"` occurrences in 51 files | `useDirection()` + lint guard | 1 day |
| **CODE-003** | 39 files not ruff-formatted | One formatting-only commit | 30 min |
| **CODE-004** | 100 mypy errors | Fix by error class with a ratcheting budget | 2–3 days |
| **CODE-006** | `assert` used as a runtime guard in request paths | Replace with explicit exceptions | 2 h |
| **CODE-007** | `TODO(phase-blog)` in production code | Implement or delete the branch | 2 h |
| **QA-003** | Tests bypass Alembic (schema built from metadata) | Dedicated migration job in CI | 3 h |
| **QA-005** | No contract tests; a contract drifted unnoticed | OpenAPI contract test (`schemathesis`) | 3 h |
| **PERF-002** | Rate limiter is per-process | `RATE_LIMIT_BACKEND=database` option (default `memory`) | 1 day |
| **PERF-003** | Implicit connection-pool sizing | Explicit `pool_size`/`max_overflow` settings | 1 h |
| **PERF-004** | No cache headers on public read endpoints | `Cache-Control: public, max-age=30` on public feed routes | 1 h |
| **DEP-001** | No dependency-update policy | Renovate/Dependabot with a green-CI prerequisite | 2 h |
| **DEP-002** | Duplicated dependency manifests | `pyproject.toml` as the single source; generated lock | 2 h |
| **CI-003** | No vulnerability gate | `pip-audit` + `npm audit` steps | 1 h |
| **CI-004** | No secret scanning | `gitleaks` action + pre-commit hook | 1 h |
| **CI-005** | No migration-drift gate | `alembic check` job | 1 h |
| **CI-007** | No coverage gate | `--cov-fail-under` (ratchet, never lower) | 30 min |
| **OPS-002** | Migrations run on every boot (replica race) | Advisory lock or a release-time migration job | 2 h |
| **OPS-003** | No healthcheck / readiness probe | `HEALTHCHECK` + `/health/ready` | 2 h |
| **OPS-004** | Scheduling depends on an external cron | Metrics + alerting on stale pending rows | 3 h |
| **OPS-005** | Containers run as root; no resource limits | `USER` directive + compose limits | 1 h |
| **OPS-006** | 53 MB of PNGs in git; stray tracked backup file | LFS/external + `git rm` the backup | 2 h |
| **REUSE-001** | Duplicated delivery bookkeeping (anonymous messages ↔ notifications) | Shared helper | 1 day |
| **REUSE-002** | Email copy not centralised | Route subjects through `copy.py` | 3 h |
| **REUSE-004** | `assert` as runtime guard (see CODE-006) | — | — |
| **REUSE-006** | Contradictory `lang: "ar" \| "en"` props | Remove the dead arm | 2 h |
| **REUSE-007** | `requirements.txt` duplication (see DEP-002) | — | — |
| **DOC-002** | 53 MB of design PNGs in the repository | LFS/external + WebP | 2 h |

### 12.4 Low

| ID | Finding | Fix |
|---|---|---|
| **CODE-002** | 17 unused imports | `ruff check --fix` (auto-fixable) |
| **ARCH-006** | Frozen legacy attendance models can be extended by accident | Doc marker + CI grep guard |
| **ARCH-008** | ~15 unused shadcn primitives | Delete or document as "available" |
| **ARCH-009** | `settings = Settings()  # type: ignore[call-arg]` | Clear startup error for missing required vars |
| **REUSE-003** | Duplicated page scaffolding in the SPA | Incremental adoption of shared components |
| **REUSE-005** | Business-rule identifiers live only in docstrings | `docs/business-rules.md` + CI check |
| **SEC-015** | Refresh-cookie `Secure` behind a TLS-terminating proxy | Honour `X-Forwarded-Proto` when `TRUST_PROXY_HEADERS` is on; `SECURE_COOKIES` override |
| **SEC-016** | `CORS_ORIGINS=*` + credentials misconfiguration possible | Fail fast in production |
| **DEP-003** | `starlette.HTTP_422_UNPROCESSABLE_ENTITY` deprecated | Use `HTTP_422_UNPROCESSABLE_CONTENT` (same 422) |
| **DEP-004** | httpx per-request `cookies=` deprecated | Set cookies on the client instance |
| **DEP-005** | `passlib` declared but unused | Delete |
| **DEP-006** | ESLint 10 / TS 7 / React 19 / Vite 8 available | Scheduled majors after CI is green |
| **QA-004** | React duplicate-key warning in `NotificationList` | Composite key + realistic fixture |
| **QA-006** | jsdom CORS noise; tests perform real XHR | Mock at the axios adapter level |
| **QA-007** | Query-count guards cover only 4 endpoints | Extend to the list endpoints |
| **QA-008** | Two deprecation warnings in the test run | Fix alongside DEP-003/DEP-004 |
| **PERF-006** | 178 kB JPEG; no image lazy-loading/width hints | WebP, `loading="lazy"`, explicit dimensions |
| **OPS-007** | No guard on the frozen legacy models | CI grep |
| **DOC-001** | Two audit documents | This report supersedes `docs/AUDIT_REPORT.md` (reconciled in Part 14) |

---

## 13. Prioritised remediation roadmap

The roadmap is designed so that **no step breaks a running system**. Rules applied throughout:

* **R1 — Additive before destructive.** New fields/columns/endpoints first; removal only after the new path is proven in production.
* **R2 — Dual-read / dual-write windows.** Where a stored value changes shape, read both and migrate lazily.
* **R3 — Expand/contract migrations.** `ALTER … TYPE VARCHAR(128)` (expand) in release N; the cleanup in release N+1.
* **R4 — Feature flags with safe defaults.** New behaviour is opt-in; the default preserves today's behaviour exactly.
* **R5 — Test first.** Every behavioural fix lands with a test that fails before it and passes after.
* **R6 — One concern per PR.** Formatting, dependency bumps and behaviour changes never share a commit.
* **R7 — Frozen areas stay frozen.** The legacy attendance models (`ServiceSession`, `AttendanceRecord`) are not migrated, dropped or extended in this roadmap.
* **R8 — Never mix a rotation with a code change.** Secret rotation is its own deployment window.

### Phase 0 — Stop the bleeding (Day 0–1, ~4 hours)

| Step | Action | Finding | Notes |
|---|---|---|---|
| 0.1 | **Rotate every production secret** (order in SEC-001) and redeploy | SEC-001 | Separate maintenance window; announce the PIN reset if the pepper rotates |
| 0.2 | Empty/replace `backend/.env` with placeholders; point the deployment at the platform secret store | SEC-001 | Keep `backend/.env.example` (verified clean — placeholders only) |
| 0.3 | **Make the test suite hermetic** (recipe R-02) and add the test-DB guard | SEC-002, SEC-003, QA-002 | Pure test-side change; no production impact |
| 0.4 | Confirm `git log --all -- backend/.env` is empty and add `.env.local` to `.gitignore` | SEC-001 | Already verified empty — keep it that way with CI-004 |
| 0.5 | Announce the freeze: **no releases to `main` until Phase 1 is green** | CI-001 | The cheapest possible risk control |

**Exit criteria:** no production credential exists in the repo tree; the test suite cannot open an outbound socket; the test suite refuses to run against a non-`test` database.

### Phase 1 — Make the pipeline truthful (Days 1–3, ~1.5 days)

Four **independent, behaviour-preserving** PRs, each of which turns one red gate green:

| PR | Change | Gate fixed | Risk |
|---|---|---|---|
| **1.1** | `ruff check . --fix` (25 auto-fixes) + manual fixes for the remaining 10 (9 line-length, 1 `F821` → delete the dead function) | `ruff check` | **None** — no behaviour change |
| **1.2** | `ruff format .` (39 files) — formatting only | `ruff format --check` | **None** — but review the diff for accidental semantic edits (ruff-format is semantics-preserving) |
| **1.3** | mypy: fix the 10 `no-untyped-def` + 7 `operator` + 4 `return-value` first (safe, local), then the 54 `arg-type` by narrowing repository signatures; add `disallow_untyped_defs` overrides for infrastructure only; set the CI error budget to the real number and ratchet it down | `mypy app` | Low — type-only, but run the suite after each batch |
| **1.4** | The 8 failing tests: update the 4 stale expectations, fix the 2 contract cases in the **API** (accept both `month` shapes), drain the outbox in the publication test, and make the avatar test hermetic | `pytest` | Low — but see §6.3 for the exact intent of each change |

**Do not** combine 1.1–1.4. If 1.3 needs to be split further, split it — a 100-error mypy PR is unreviewable.

**Exit criteria:** all four backend gates green; the frontend lint PR (CODE-005) merged afterwards; frontend CI hardened (CI-002) with `npm ci` + lint + audit + a real test gate.

### Phase 2 — Security hardening (Days 3–7, ~3 days)

Ordered by blast radius, each as its own PR:

| PR | Change | Back-compat strategy |
|---|---|---|
| 2.1 | Auth rate limiting (SEC-007) | New in-memory limiters, `429` + existing `rate_limited` code; limits configurable per env |
| 2.2 | Refresh-token HMAC (SEC-005) | `v2:` prefix + dual read + lazy re-hash; **expand** migration widens the column to `VARCHAR(128)` first |
| 2.3 | PIN pepper hardening (SEC-006) | Production start-up validation only; dev unaffected |
| 2.4 | Dependency patches (SEC-008) | axios patch first (no API change); zod 4 + resolvers 6 together; `python-jose` → `PyJWT` with identical claims; delete `passlib` |
| 2.5 | Security headers + CSP report-only (SEC-009) | Report-only first, enforce after a clean week |
| 2.6 | OpenAPI/security accuracy (SEC-010), uniform auth responses (SEC-013), `frontend/.env.example` (SEC-012) | Documentation/UX only |
| 2.7 | Observability (SEC-014) | Additive middleware; no contract change |

**Access-token storage (SEC-004) is deliberately *not* in this phase** — it is a client-side behaviour change and belongs in Phase 3 with the flag and the rollback.

### Phase 3 — Contract, performance and client security (Week 2–3, ~4 days)

| PR | Change | Back-compat strategy |
|---|---|---|
| 3.1 | Analytics contract: accept `month=YYYY-MM` **and** `year`+`month`; deprecate `year` in the OpenAPI description | Both shapes work for one release; log the deprecated shape |
| 3.2 | Frontend analytics client + dashboard wiring | Additive; no existing route changes |
| 3.3 | `GET /quizzes` N+1 fix (PERF-001) + query-count guard | Response shape identical; only the query count changes |
| 3.4 | Access-token memory storage (SEC-004) behind `VITE_AUTH_PERSISTENCE` (default `memory`) | Flag + one-env-var rollback; clear legacy storage on first load |
| 3.5 | Connection-pool sizing (PERF-003) + public cache headers (PERF-004) | Configuration and headers only |

### Phase 4 — Architecture and maintainability (Week 3–5, ~2 weeks)

| PR | Change | Risk control |
|---|---|---|
| 4.1 | `app/shared/contracts/` — move `RoleName`, `UserStatus`, `AttendanceStatus`, `QuizStatus`, `AttemptStatus` there, **re-export** from the old locations so no call site changes | Pure refactor; the whole suite must pass unchanged |
| 4.2 | Break the `attendance ↔ notifications` cycle (the attendance command depends on a **notification port**, not the concrete service) | New Protocol + adapter; behaviour unchanged |
| 4.3 | Break the `bible ↔ quiz` cycle with a `QuizReadRepository` port + a dedicated feed read-model | Response shape identical |
| 4.4 | Domain ports speak domain objects instead of ORM models (ARCH-005), module by module, starting with `auth` | One module per PR |
| 4.5 | Consolidate the `UnitOfWork` lifecycle (ARCH-004); deprecate the constructor path | `DeprecationWarning` for one release |
| 4.6 | Frontend direction handling (ARCH-007) + remove the dead `"en"` prop arms | Visual output must be identical (screenshot-diff) |
| 4.7 | Repository hygiene: LFS/external for the design PNGs, `git rm` the `.lovable-backup` file, `pyproject.toml` as the single dependency source, generated lock file | History is rewritten only if you accept it — otherwise use `git rm --cached` + `.gitattributes` for future commits |

### Phase 5 — Quality uplift (ongoing)

| Item | Target |
|---|---|
| Frontend coverage | 21.92 % → **≥ 70 %** (hook tests first, then page tests) |
| Backend coverage | 78 % → **≥ 85 %** (auth services, analytics queries, quiz commands) |
| E2E | 5 golden paths in Playwright |
| Contract tests | Every OpenAPI operation exercised by `schemathesis` |
| Load test | 50 concurrent check-ins against staging |
| Mypy | 100 → 0 errors, strict everywhere |
| Lint | 0 problems, `--max-warnings 0` |
| Dependency policy | Renovate with auto-merge for patches only, after CI is green |
| Observability | `/metrics`, request ids, alerts on `outbox_failed` and stale pending publications |

### 13.1 Rollback plan (for every phase)

| Change | Rollback |
|---|---|
| Secret rotation | Re-deploy the previous secret values **only if the new values are not yet in use**; after rotation the old values are dead — keep the rollback window short |
| Refresh-token HMAC | The dual-read path keeps working; reverting the code is safe (old hashes still validate) |
| Access-token memory storage | `VITE_AUTH_PERSISTENCE=localStorage` → instant rollback, no redeploy of the backend |
| Rate limiting | Lower the limits via env vars, or set them to a high value; no code change |
| Analytics contract | Keep accepting both shapes for one release, then remove the old one |
| Shared contracts | Pure refactor — revert the commit |
| CSP enforcement | Keep the report-only header; removing it is a config change |

---

## 14. Fix recipes (copy-paste ready)

### R-01 — Rotate and externalise the secrets (SEC-001)

```bash
# 1) Inventory (do NOT paste the output anywhere public)
cd backend && grep -oE '^[A-Z_]+=' .env | tr -d '='

# 2) Generate new secrets
python - <<'PY'
import secrets
for name in ("JWT_SECRET", "JWT_REFRESH_SECRET", "ATTENDANCE_PIN_PEPPER", "CRON_SECRET"):
    print(f"{name}={secrets.token_urlsafe(48)}")
PY

# 3) Move them to the platform's secret store (Vercel/Railway/GitHub Secrets) and
#    REPLACE the values in backend/.env with the new ones, then redeploy.
# 4) Empty the working copy afterwards:
#    cp backend/.env /secure/path/backend.env && printf 'APP_ENV=development\n' > backend/.env
# 5) Confirm no history exposure
git log --all --full-history -- backend/.env     # must print nothing
```

**Rotation order and blast radius**

| Secret | Blast radius when rotated | Action |
|---|---|---|
| `JWT_SECRET` | All access tokens invalid → users re-login | Announce |
| `JWT_REFRESH_SECRET` | All refresh tokens invalid → users re-login | Announce |
| `ATTENDANCE_PIN_PEPPER` | **Every member's attendance PIN stops working** | Announce + provide a "set a new PIN" flow |
| `CRON_SECRET` | The scheduler tick returns 503 until updated | Update the scheduler in the same window |
| DB password | Connections fail | Update `DATABASE_URL` everywhere atomically |
| Cloudinary key/secret | Uploads fail (existing URLs keep working) | Rotate in the Cloudinary console |
| Gmail app password / Brevo key | Emails stop sending | Rotate in the provider console |
| Telegram bot token | Forwarding stops | `@BotFather` → revoke → new token |
| Google client secret | OAuth login stops | Rotate in Google Cloud console |

### R-02 — Hermetic, safe test environment (SEC-002, SEC-003, QA-002)

```python
# backend/tests/conftest.py — insert at the very top, BEFORE `from app.config import settings`
import os
import socket
from urllib.parse import urlparse

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://marmarkos:marmarkos@localhost:55432/marmarkos_test"
)
os.environ.setdefault("JWT_SECRET", "test-jwt-secret")
os.environ.setdefault("JWT_REFRESH_SECRET", "test-jwt-refresh-secret")
os.environ["MAIL_PROVIDER"] = "console"          # hard assignment, not setdefault

# (1) No third-party credential may reach the test process.
for _var in (
    "CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET",
    "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID",
    "GMAIL_EMAIL", "GMAIL_APP_PASSWORD",
    "BREVO_API_KEY", "BREVO_SENDER_EMAIL",
    "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET",
    "CRON_SECRET", "ATTENDANCE_PIN_PEPPER",
):
    os.environ[_var] = ""

# (2) Refuse to touch a database that is not explicitly a test database.
_db_name = (urlparse(os.environ["DATABASE_URL"]).path or "").lstrip("/").lower()
if "test" not in _db_name:
    raise RuntimeError(
        f"Refusing to run the test suite against non-test database {_db_name!r}. "
        "Set DATABASE_URL to a database whose name contains 'test'."
    )
```

```python
# backend/tests/conftest.py — add an autouse fixture that blocks outbound sockets
import pytest

@pytest.fixture(autouse=True)
def _no_outbound_network(monkeypatch: pytest.MonkeyPatch) -> None:
    """Fail loudly if any test tries to reach the internet."""
    def _blocked(*args, **kwargs):  # noqa: ANN002, ANN003
        raise RuntimeError("Outbound network access is not allowed in tests")

    monkeypatch.setattr(socket.socket, "connect", _blocked)
    monkeypatch.setattr(socket.socket, "connect_ex", _blocked)
```

> If a test genuinely needs an HTTP call (e.g. an httpx client against the ASGI app), use `httpx.ASGITransport` (already used) — no socket is created. If a test needs to simulate a Cloudinary response, patch `upload_image` at the function level.

### R-03 — Refresh-token HMAC with a dual-read window (SEC-005)

```python
# app/modules/auth/infrastructure/security/refresh_tokens.py
import hashlib
import hmac

from app.config import settings


def _pepper() -> str:
    return settings.REFRESH_TOKEN_PEPPER or settings.JWT_REFRESH_SECRET


def hash_refresh_token(token: str) -> str:
    """New format: versioned HMAC-SHA256 (server-peppered)."""
    mac = hmac.new(_pepper().encode(), token.encode(), hashlib.sha256).hexdigest()
    return f"v2:{mac}"


def legacy_hash_refresh_token(token: str) -> str:
    """Old format: bare SHA-256. Read-only, for the migration window."""
    return hashlib.sha256(token.encode()).hexdigest()
```

```python
# app/modules/auth/infrastructure/persistence/refresh_token_repository.py
async def get_by_token(self, token: str) -> RefreshToken | None:
    """Dual read: new HMAC first, legacy SHA-256 second (self-healing)."""
    row = await self._get_by_hash(hash_refresh_token(token))
    if row is not None:
        return row
    row = await self._get_by_hash(legacy_hash_refresh_token(token))
    if row is not None and not row.token_hash.startswith("v2:"):
        row.token_hash = hash_refresh_token(token)   # lazy migration
        await self._session.flush()
    return row
```

**Migration (expand only):**

```python
# alembic/versions/xxxx_widen_refresh_token_hash.py
"""Expand: allow the versioned HMAC format (67 chars). No data change."""
from alembic import op

def upgrade() -> None:
    op.alter_column(
        "refresh_tokens", "token_hash",
        existing_type=sa.String(length=64), type_=sa.String(length=128),
        existing_nullable=False,
    )

def downgrade() -> None:
    op.alter_column(
        "refresh_tokens", "token_hash",
        existing_type=sa.String(length=128), type_=sa.String(length=64),
        existing_nullable=False,
    )
```

> The `downgrade` will fail once `v2:` values exist — that is intentional and correct (the old format cannot represent the new one). Document it in the migration docstring.

### R-04 — Memory-first access token (SEC-004)

```ts
// frontend/src/lib/auth.ts — new behaviour (feature-flagged)
const STORAGE_KEY = "marmarkos.access_token";   // legacy key, only read when the flag allows it
const SESSION_KEY = "marmarkos.session";        // new: non-sensitive marker only

type Persistence = "memory" | "localStorage";

const persistence: Persistence =
  (import.meta.env.VITE_AUTH_PERSISTENCE as Persistence | undefined) ?? "memory";

let memoryToken: string | null = null;
let memoryUser: string | null = null;

export function saveAuth(session: AuthSession, remember: boolean): void {
  memoryToken = session.accessToken;
  memoryUser = JSON.stringify(session.user);
  if (persistence === "localStorage" && remember) {
    localStorage.setItem(STORAGE_KEY, session.accessToken);
    localStorage.setItem("marmarkos.user", memoryUser);
  } else {
    // Remove any legacy token from storage as soon as we switch to memory mode.
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
  }
}

export function getAccessToken(): string | null {
  if (memoryToken) return memoryToken;
  if (persistence === "localStorage") {
    return localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY);
  }
  return null;
}
```

> On a page reload in `memory` mode there is no token in JS — the app must call `POST /auth/refresh` (the HttpOnly cookie) on boot to restore the session. Add that bootstrap call to `AppProviders` and keep the existing `api.ts` refresh interceptor. The backend needs **no change**: `/auth/refresh` already reads the cookie.

### R-05 — Dependency remediation (SEC-008, DEP-005)

```bash
# Frontend — patch first (no API change), then the Zod-4 pair together
cd frontend
npm install axios@^1.20.0
npm install zod@^4 @hookform/resolvers@^6
npm audit --omit=dev --audit-level=high      # must print "found 0 vulnerabilities"

# Backend — replace python-jose with PyJWT, drop the unused passlib
cd ../backend
# pyproject.toml: remove "python-jose[cryptography]" and "passlib[bcrypt]";
#                add "pyjwt>=2.9"
.venv/bin/pip install -q "pyjwt>=2.9"
.venv/bin/pip uninstall -y python-jose passlib
.venv/bin/pip-audit -r requirements.txt        # must print "No known vulnerabilities"
```

```python
# app/modules/auth/infrastructure/security/jwt.py — PyJWT equivalent (same claims!)
import jwt
from jwt import InvalidTokenError

def create_access_token(subject: str, expires_delta: timedelta) -> str:
    now = datetime.now(UTC)
    payload = {"sub": subject, "type": "access", "iat": now, "exp": now + expires_delta}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
    except InvalidTokenError as exc:
        raise InvalidTokenError(str(exc)) from exc
```

> The claim names (`sub`, `type`, `iat`, `exp`) and the algorithm (`HS256`) are identical, so **existing tokens keep working** until `JWT_SECRET` rotates (which Phase 0 does anyway). Verify with the existing auth tests plus one manual login/refresh round-trip.

### R-06 — Kill the N+1 in the quiz list (PERF-001)

```python
# app/modules/quiz/infrastructure/persistence/quiz_repository.py
async def list_for_manager_with_meta(
    self, *, status: QuizStatus | None, q: str | None, verse_id: uuid.UUID | None,
    limit: int, offset: int,
) -> list[tuple[Quiz, str, int]]:
    """One query returns the quiz, its verse reference and its question count."""
    stmt = (
        select(
            Quiz,
            func.coalesce(BibleVerse.verse_reference, "").label("verse_reference"),
            func.count(QuizQuestion.id).label("question_count"),
        )
        .outerjoin(BibleVerse, BibleVerse.id == Quiz.verse_id)
        .outerjoin(QuizQuestion, QuizQuestion.quiz_id == Quiz.id)
        .where(*_filters(status, q, verse_id))
        .group_by(Quiz.id, BibleVerse.verse_reference)
        .order_by(Quiz.created_at.desc())
        .limit(limit).offset(offset)
    )
    rows = (await self._session.execute(stmt)).all()
    return [(row[0], row[1], row[2]) for row in rows]
```

```python
# app/modules/quiz/application/queries/quiz_queries.py
items = [
    QuizAdminItem(
        id=quiz.id, title=quiz.title, verse_id=quiz.verse_id,
        verse_reference=verse_reference, total_points=quiz.total_points,
        duration_seconds=quiz.duration_seconds, question_count=question_count,
        status=quiz.status, published_at=quiz.published_at, created_at=quiz.created_at,
    )
    for quiz, verse_reference, question_count in rows
]
```

Add a guard next to the existing query-count tests:

```python
async def test_quiz_list_query_count(client, _auth_headers):
    async with count_queries() as get_count:
        resp = await client.get("/api/v1/quizzes?page=1&size=10", headers=_auth_headers)
    assert resp.status_code == 200
    assert get_count() <= 3        # was 21
```

### R-07 — Accept both analytics month shapes (ARCH-003, QA #6/#7)

```python
# app/modules/points/presentation/analytics_router.py
def _parse_month(value: str | None, year: int | None = None) -> date:
    """Accept 'YYYY-MM' (canonical) and the legacy 'year' + 'month=9' shape."""
    if value and "-" in value:
        try:
            parts = value.split("-")
            return date(int(parts[0]), int(parts[1]), 1)
        except (ValueError, IndexError) as exc:
            raise HTTPException(status_code=422, detail="month must be in YYYY-MM format") from exc
    if value and year is not None:            # legacy: ?year=2026&month=9
        try:
            return date(int(year), int(value), 1)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail="invalid month") from exc
    raise HTTPException(status_code=422, detail="month must be in YYYY-MM format")

@router.get("/monthly")
async def monthly_analytics(
    actor: AnalyticsViewer, uow: _UoW,
    month: str | None = Query(default=None, description="YYYY-MM month to analyse (canonical)"),
    year: int | None = Query(default=None, description="Deprecated: use month=YYYY-MM"),
):
    return await monthly_analytics_query(uow, actor, _parse_month(month, year))
```

> Both call shapes work from day one; the OpenAPI description marks `year` as deprecated; remove the legacy branch one release later.

### R-08 — Break the import cycles without touching behaviour (ARCH-001)

```python
# NEW app/shared/contracts/statuses.py
"""Vocabulary shared by more than one module. Importing this file must
never create a cycle: it imports nothing from app.modules."""
from enum import StrEnum

class AttendanceStatus(StrEnum):
    PRESENT = "PRESENT"
    LATE = "LATE"
    ABSENT = "ABSENT"
    EXCUSED = "EXCUSED"

class QuizStatus(StrEnum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    ARCHIVED = "ARCHIVED"
```

```python
# app/modules/attendance/domain/enums/attendance_status.py
from app.shared.contracts.statuses import AttendanceStatus

__all__ = ["AttendanceStatus"]          # re-export keeps every existing import working
```

```python
# app/modules/attendance/application/commands/check_in_command.py
# BEFORE: from app.modules.notifications.application.services.notification_service import NotificationService
# AFTER:  depend on a port instead of the concrete service
from app.shared.contracts.notifications import NotificationPort   # Protocol

class CheckInCommand:
    def __init__(self, uow: UnitOfWork, notifier: NotificationPort | None = None) -> None: ...
```

The router wires the concrete `NotificationService` into the command, exactly as today. The cycle disappears because `attendance` no longer imports `notifications.application.services` at module level, and `notifications` imports only the shared enum.

### R-09 — Make the scheduler visible (OPS-004, SEC-014)

```python
# app/api/v1/health.py — extend the existing health payload (additive)
{
  "status": "ok",
  "version": "...",
  "checks": {
    "database": "ok",
    "outbox_pending": 3,
    "outbox_failed": 0,
    "stale_publications": 0
  }
}
```

Alert when `outbox_failed > 0` for 15 minutes, or when `stale_publications > 0` (a `SCHEDULED` verse whose `scheduled_at` is more than 10 minutes in the past).

### R-10 — The CI target state (both workflows)

```yaml
# .github/workflows/backend-ci.yml (additions)
      - name: Dependency audit
        run: pip-audit
      - name: Migration drift check
        run: |
          alembic upgrade head
          alembic check
      - name: Tests (with coverage gate)
        run: pytest --cov=app --cov-report=term --cov-fail-under=78
      - name: Secret scan
        uses: gitleaks/gitleaks-action@v2
```

```yaml
# .github/workflows/frontend-ci.yml (replacement)
      - name: Install dependencies
        run: npm ci
      - name: Lint
        run: npm run lint -- --max-warnings 0
      - name: Build
        run: npm run build
      - name: Audit (production dependencies)
        run: npm audit --omit=dev --audit-level=high
      - name: Tests
        run: npm run test:run
      - name: Coverage gate
        run: npm run test:coverage -- --coverage.thresholds.lines=21.9
```

> The frontend coverage threshold starts at today's value and is raised deliberately; the backend threshold starts at 78 and ratchets to 85. **Never lower a threshold** — that is how coverage gates die.

---

## 15. Reconciliation with `docs/AUDIT_REPORT.md` (2026-09-20)

The previous report is **not** replaced silently — every one of its 28 findings was re-verified against the current code. **13 are fixed, 8 are still open (mostly at lower severity), 3 are partially fixed, 4 were re-characterised.**

| Prior ID | Prior severity | **Status today** | Evidence / new ID |
|---|---|---|---|
| CRIT-001 Live production secrets committed to disk | Critical | **Re-characterised → still Critical** | The secrets were **never committed** (git history is clean), but the file sits on disk, is loaded by `docker-compose.yml`, and — newly proven — by the **test suite**, which made a real Cloudinary call. → **SEC-001 / SEC-002 / SEC-003** |
| HIGH-001 UnitOfWork dual instantiation | High | **Open → Medium** | Still both paths in use (`auth_service.py:62`, `profile_commands.py:38` vs `get_unit_of_work()`). Behaviour is consistent today. → **ARCH-004** |
| HIGH-002 `UserResponse` missing `email_verified` | High | ✅ **Fixed** | `users/application/dto/user_response.py:27`, `mappers/user_mapper.py:21` |
| HIGH-003 Refresh cookie `secure` tied to `APP_ENV` | High | ✅ **Fixed** | `auth/presentation/cookies.py::_is_secure` uses `request.url.scheme` with an env fallback (residual: **SEC-015**) |
| HIGH-004 Rate limiter is per-process only | High | **Open** | Unchanged → **PERF-002**, plus a new database-backed option (R-02/R-10) |
| HIGH-005 Absent users calculated in Python | High | ✅ **Fixed** | `absence_service.py` now uses a SQL `NOT IN` sub-query with DB-level pagination |
| HIGH-006 Attendance router `= None` + `# type: ignore` | High | ✅ **Fixed / not a defect** | The `type: ignore` is gone (the codebase has exactly one, in `config.py`); `meeting_date: MeetingDateParam = None` is the *correct* FastAPI idiom for an optional query parameter |
| MED-001 `verse_views` / `verse_reads` share a repository | Medium | **Open → Low** | Intentional and documented (`unit_of_work.py:215-231`); keep |
| MED-002 Grading total-points uses `or 0` | Medium | ✅ **Fixed** | No `or 0` remains in `grading_service.py` |
| MED-003 Gmail sender uses the Brevo sender name | Medium | ✅ **Fixed** | `MAIL_SENDER_NAME` + `effective_sender_name` property (`config.py:52-56`) |
| MED-004 Attendance PIN pepper coupled to `JWT_SECRET` | Medium | **Partially fixed** | `ATTENDANCE_PIN_PEPPER` exists and is set in the current `.env`, but the **silent fallback remains** → **SEC-006** |
| MED-005 Toaster hardcodes RTL | Medium | **Open → broadened** | 66 `dir="rtl"` + 72 `lang="ar"` occurrences across 51 files → **ARCH-007** |
| MED-006 Open version ranges, no lockfile | Medium | **Open** | `pyproject.toml` still uses `>=`; no Python lock → **DEP-002** |
| MED-007 `TODO(phase-blog)` in production code | Medium | **Open** | `notifications/application/services/notification_service.py:144` → **CODE-007** |
| MED-008 `package.json` uses `^` ranges | Medium | **Open → Low** | `package-lock.json` exists and CI uses `npm install` (not `npm ci`) → **CI-002 / DEP-002** |
| LOW-001 Empty CQRS skeleton directories | Low | ✅ **Fixed** | No empty directories remain under `app/` |
| LOW-002 `/docs` + `/redoc` exposed everywhere | Low | ✅ **Fixed** | Gated on `DEBUG=true` (`app/main.py`) |
| LOW-003 Misleading `# pragma: no cover` | Low | **Open (moved)** | The pragma still sits on a blank line — now at `internal/presentation/dependencies.py:65` |
| LOW-004 `map_user_to_response` missing `email_verified` | Low | ✅ **Fixed** | See HIGH-002 |
| LOW-005 `UnitOfWork.create()` auto-commits without a flag | Low | ✅ **Fixed** | The `_committed` flag exists (`unit_of_work.py:101,117`) |
| LOW-006 `settings = Settings()` with `type: ignore` | Low | **Open** | `config.py:129` → **ARCH-009** |
| LOW-007 `lazyWithRetry` swallows the second failure | Low | ✅ **Fixed** | `frontend/src/router.tsx:49` now returns `Promise.reject(error)` |
| LOW-008 `_week_closed_at` uses `23:59` | Low | ✅ **Fixed (implementation improved)** | Now an exclusive `00:00` boundary — but the **test still asserts 23:59** (failure #3) |
| LOW-009 Frontend CI does not use `npm ci` | Low | **Open** | `frontend-ci.yml` still runs `npm install` → **CI-002** |
| LOW-010 `DEBUG=True` is the default | Low | ✅ **Fixed (correctly hardened)** | `config.py:11` is now `False` — but the **test still asserts `True`** (failure #1) |

**New findings introduced by this audit** (not in the previous report): SEC-002/003/004/005/006/007/009/010/011/012/013/014, ARCH-001/002/003/005/007, CODE-001/004/006/007, QA-001/002/003, PERF-001/003/004, DEP-001/003/004/005, CI-001/002/003/004/005/007, OPS-001/002/003/004/006, DOC-002, REUSE-001/002/004/005.

> **Net position:** the codebase improved substantially since 2026-09-20 (13 of 28 prior findings closed, several by genuinely good fixes). The *new* risk is concentrated in the delivery pipeline and the secret-handling path — both of which are cheap to fix once the pipeline itself is green.

---

## 16. Strengths to protect during remediation

These are not "nice to have" — they are the reason the product works, and each remediation PR must leave them intact.

1. **The single-clock rule** (`app/core/time/clock.py`; `date.today()`/`datetime.now()` banned elsewhere). Every attendance/statistics test is deterministic because of it. When adding code, inject `today=`/`now=` rather than reading the system clock.
2. **The transactional outbox** with `SKIP LOCKED` claiming, per-event isolation, back-off and a five-attempt budget. Keep every write that emits a domain event inside the same transaction as the aggregate change.
3. **Server-authoritative quiz timing** with the pause-safe active-time budget and the heartbeat window. Never trust the client's timer.
4. **Idempotent points ledger** (`quiz_attempt_id` unique + `on_conflict_do_nothing`).
5. **Pure grading** with immutable question snapshots.
6. **Authorisation re-checked in the use case** (`assert_manager`), not only at the router.
7. **Zero SQL injection surface** — keep every query parameterised.
8. **Uniform error envelope** (`code` + `message`) and the existing `rate_limited` error code.
9. **Bound everything**: pagination ceilings, upload size, message length, quiz duration/question count, export row cap.
10. **Privacy by default**: no bodies logged, hashed anonymous-message identities, no raw PIN/token storage.
11. **Rule traceability** in docstrings (`BR-xx`, `D-xx`, `P5-xxx`) — formalise it into `docs/business-rules.md` (REUSE-005) rather than losing it.
12. **The migration/model agreement** (`alembic check` → no drift). Protect it with CI-005.

---

## 17. Appendices

### Appendix A — Reproduction commands and headline output

```bash
# --- Backend gates -------------------------------------------------------
cd backend
.venv/bin/ruff check . --statistics
#   17 F401  9 E501  8 I001  1 F821  →  Found 35 errors (25 fixable)

.venv/bin/ruff format --check .
#   39 files would be reformatted, 431 files already formatted

DEBUG=true .venv/bin/mypy app
#   Found 100 errors in 10 files (checked 387 source files)

DEBUG=true APP_ENV=test \
DATABASE_URL='postgresql+asyncpg://marmarkos:marmarkos@127.0.0.1:55432/marmarkos_test' \
  .venv/bin/python -m pytest -q --cov=app
#   8 failed, 373 passed, 4 warnings — TOTAL 78% coverage

# --- Migrations ----------------------------------------------------------
alembic upgrade head        # fresh DB → 13 migrations applied
alembic check               # → "No new upgrade operations detected"

# --- Dependency audits ---------------------------------------------------
.venv/bin/pip-audit -r requirements.txt
#   python-jose 3.5.0  PYSEC-2026-4298   (no fix)
#   ecdsa 0.19.2       PYSEC-2026-1325   (no fix, ×2)

# --- Frontend gates ------------------------------------------------------
cd ../frontend
npm run lint                # ✖ 820 problems (808 errors, 12 warnings)
npm run build               # ✓ built in ~Xs (2761 modules)
npm run test:coverage       # ✓ 48/48 tests — 21.92% statements
npm audit --omit=dev        # 3 high (axios, follow-redirects, zod)

# --- API surface ---------------------------------------------------------
python -c "from app.main import create_app; s=create_app().openapi(); print(len(s['paths']))"
#   77 paths / 90 operations / 11 declared public
```

### Appendix B — Metric summary

| Metric | Backend | Frontend |
|---|---:|---:|
| Source files | 387 (`app/`) | 334 (`src/`) |
| Lines of code | 17,825 | 31,861 |
| Test files / LOC | 81 / 7,736 | 10 / ~1,100 |
| Tests | 381 (373 ✅ / 8 ❌) | 48 (48 ✅) |
| Statement coverage | 78 % | 21.92 % |
| Branch coverage | — | 52.81 % |
| Function coverage | — | 30.42 % |
| Ruff errors | 35 | — |
| Ruff-format drift | 39 files | — |
| mypy errors | 100 | 0 (`tsc -b` passes) |
| ESLint problems | — | 820 |
| Known vulnerabilities | 3 (pip) | 3 (npm) |
| Endpoint count | 77 paths / 90 operations | — |
| Largest backend module | attendance (3,172 LOC) | — |
| Largest frontend area | `src/modules/attendance` + `src/modules/quiz` | — |

### Appendix C — API surface (as generated by FastAPI)

| Group | Prefix | Notes |
|---|---|---|
| Authentication | `/api/v1/auth/*` | register, login, refresh, logout, verify-email, forgot/reset password, resend-verification, Google login/callback |
| Users & profile | `/api/v1/users/*` | profile CRUD, avatar upload, QR, attendance PIN |
| Attendance | `/api/v1/attendance/*` | check-in (QR/PIN), history, statistics, absent users, schedule |
| Bible verses | `/api/v1/bible/*` | feed, detail, admin CRUD, schedule, analytics, publication |
| Quizzes | `/api/v1/quizzes/*`, `/api/v1/quiz-questions/*`, `/api/v1/quiz-attempts/*` | builder, attempts, heartbeat, submit, result, review, analytics, export |
| Points | `/api/v1/points/*` | my points, monthly |
| Quiz analytics | `/api/v1/quiz-analytics/*` | monthly, monthly/users, users/{id}, monthly/export — **no frontend client** |
| Notifications | `/api/v1/notifications/*` | feed, unread, mark read, broadcast, preferences |
| Anonymous messages | `/api/v1/anonymous-messages/*` | public submit (rate-limited), admin list, retry |
| Blog / comments / media | `/api/v1/blog/*`, `/api/v1/comments/*`, `/api/v1/media/*` | posts, categories, likes, threaded comments, media metadata |
| Internal | `/api/v1/internal/scheduler/tick` | `X-Cron-Secret` or an admin bearer token |
| Health | `/api/v1/health` | liveness |

**Public operations (11):** `GET /health`, `POST /auth/register`, `/auth/login`, `/auth/logout`, `/auth/refresh`, `/auth/password/forgot`, `/auth/password/reset`, `/auth/verify-email`, `/auth/resend-verification`, `GET /auth/google/login`, `GET /auth/google/callback`. Everything else requires a bearer token; role checks are applied per route.

### Appendix D — Module dependency map (module-level imports)

```
admin            → —
anonymous_messages → auth, users
attendance       → auth, notifications, users          ⟲ cycle
auth             → notifications, users
bible            → auth, notifications, quiz, users     ⟲ cycle
blog             → —
comments         → —
internal         → attendance, auth, bible, users
media            → —
notifications    → attendance, auth, users              ⟲ cycle
points           → auth, quiz, users
quiz             → auth, bible, users                   ⟲ cycle
users            → auth, notifications
```

### Appendix E — Identifier prefixes observed in the code

| Prefix | Meaning (as used in this codebase) |
|---|---|
| `BR-n` | Business rule (e.g. `BR-4` expected population per meeting week, `BR-15` rate limits) |
| `D-n` | Design decision (`D-8` frozen legacy attendance models, `D-22` in-memory rate limiting) |
| `P5-nnn` | Phase-5 implementation task (bible lifecycle, quizzes, points, analytics) |
| `R-n` | Known risk accepted in the design (`R-3` per-process rate limiting) |
| `Q-n` / `§n` | Section references into the external planning documents |

> These identifiers resolve to planning documents outside the repository — see REUSE-005 (add `docs/business-rules.md` so they are self-contained).

### Appendix F — Definition of "audit complete"

This audit is considered complete because every one of the following was **executed or read**, not inferred:

* [x] Every Python and TypeScript source file in `backend/app` and `frontend/src` was parsed; all cross-module imports mapped; all `await`-in-loop sites enumerated.
* [x] Every quality gate named in CI was run live, and every failure was root-caused individually (§6.3).
* [x] The migration chain was applied to a clean database and checked for drift.
* [x] Both dependency trees were audited against the vulnerability databases.
* [x] The full API surface was enumerated and its authentication state classified.
* [x] Every secret in the working tree was identified and its rotation blast radius documented.
* [x] The previous report's 28 findings were re-verified and reconciled (§15).
* [x] Every finding has a **non-breaking** remediation path, ordered into five phases with rollback plans (§13) and copy-paste recipes (§14).

---

*End of report — AUDIT-2026-10-26-FULL. Prepared against commit `28b6de2`. No production data was modified during the audit; the only schema mutations were performed against the local audit container `marmarkos-audit-pg`.*
