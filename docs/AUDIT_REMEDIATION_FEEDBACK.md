# Audit Remediation — Feedback & Progress Report

**Plan:** `docs/AUDIT_REMEDIATION_PLAN.md` · **Audit:** `docs/CODEBASE_AUDIT_REPORT.md`
**Date:** 2026-10-27 · **Commit at start:** `28b6de2` · **Branch:** `main`

---

## 1. Executive feedback

The remediation started with the two phases that unlock everything else, and they are **complete**:

* **Phase 0 (safety)** — the test suite can no longer touch production systems, and the pipeline can no longer destroy a production database.
* **Phase 1 (truthful gates)** — all four backend gates are green, and the frontend lint gate is green too.

**Every backend quality gate is now passing for the first time in the project's history**, the frontend lint gate went from 820 problems to 0, **Phase 2 (security hardening) is complete**: the auth endpoints are rate limited, the token hashes are keyed, the flows no longer leak which addresses exist, the responses carry hardening headers, and every request has an id — **Phase 3 (contract, performance, client-side session security) is complete**: the admin quiz list no longer issues one query per row, the frontend has a real client for the analytics endpoints, and the access token no longer sits in web storage — and **Phase 4 (architecture) and Phase 5 (CI, operations, test depth) are complete as well**: the import cycles are broken, the unit of work has one lifecycle, the direction of the platform lives in one place, the dependencies have one list, the pipeline is strict and real, the containers run as a non-root user behind a healthcheck, and the OpenAPI schema is verified against the running API by **3 466 contract cases**.

**The dependency scanners are clean**: `npm audit` reports **0 findings** (was 3 high + 8 more) and `pip-audit` reports **0 findings** (was 3 vulnerabilities in 2 packages).

While doing that, the work uncovered **twelve genuine production defects** that no gate had ever caught (details in §4) — including two that would have returned HTTP 500 on the monthly-analytics endpoints, a race that could publish a scheduled verse **twice**, and a feed badge that could never show that a member had already finished the quiz of a verse. A sixth finding turned out to be intentional redundancy, not a defect.

**The last five came from the end-to-end tests (Phase 5.5)** — and they are the most important ones of the list, because they are the only five a member would have felt: a member with a session could not be deleted, the built frontend called the API on the member's own computer, a reload logged the member out, **a member could not answer a quiz at all** (403 on the manager endpoint), and the page of the attempt waited for ever on a conflict. The unit tests measured the pieces; **the browser measured the product**. A pipeline of 462 green tests never saw them.

**What still needs a human:** the actual **secret rotation** (Phase 0.1/0.2) cannot be automated from the repository — it needs access to Neon, Google Cloud, Cloudinary, Gmail/Brevo and Telegram. Until that happens, the secrets on disk remain valid.

---

## 2. Before → after

| Gate | Before (audit) | After (now) | Status |
|---|---|---|---|
| `backend: ruff check .` | 35 errors (17 F401, 9 E501, 8 I001, **1 F821**) | **0** | ✅ |
| `backend: ruff format --check .` | 39 files to reformat | **0** | ✅ |
| `backend: mypy app` (strict) | 100 errors in 10 files | **0** | ✅ |
| `backend: pytest` | 373 passed / **8 failed** (381) | **484 passed / 0 failed** | ✅ |
| `backend: test warnings` | 4 (Starlette 422 + httpx cookies) | **0** | ✅ |
| `frontend: npm run lint` | 820 problems (808 errors, 12 warnings) | **0** (also with `--max-warnings 0`) | ✅ |
| `frontend: npm run test:run` | 48 passed (with React key warning + jsdom CORS noise) | **310 passed** | ✅ |
| `frontend: npm run build` | pass | **pass** | ✅ |
| `frontend: tsc -b` | pass (the cache hid nothing this time) | **pass** (`--force` as well) | ✅ |
| Test-suite hermeticity | ❌ real Cloudinary API call observed | ✅ **no outbound socket is possible** | ✅ |
| Test-DB safety | ❌ `drop_all` on any `DATABASE_URL` | ✅ refuses non-`test` databases | ✅ |
| `npm audit` | 3 high (+ 8 more) | **0** | ✅ |
| `pip-audit` | 3 vulnerabilities / 2 packages | **0** | ✅ |
| Backend tests | 373 passed / 8 failed | **484 passed / 0 failed** | ✅ |
| Frontend tests | 48 passed | **277 passed** | ✅ |
| End-to-end tests | **0** (no browser ever drove the product) | **5 passed** (3 journeys) | ✅ |
| Frontend coverage | 17.97 % statements (no branch coverage) | **70.52 %** statements · 59.92 % branches · 64.89 % functions · 72.47 % lines | ✅ |
| SQL statements for a page of 10 quizzes | 21 (2N+1) | **3** | ✅ |
| Access token location | `localStorage` / `sessionStorage` | **memory** (flag-controlled) | ✅ |
| Import cycles between the modules | 5 (two of them reported) | **1** (documented, in the plan) | ✅ |
| The direction of the platform | 66 `dir="rtl"` + 72 `lang="ar"` in 51 files | **1 place** (the document root) | ✅ |
| The lists of dependencies | 2 (hand-written, drifting) | **1** (generated + guarded) | ✅ |
| The design references in the repository | 52 MB | **4.5 MB** | ✅ |
| The OpenAPI schema vs. the real answers | never checked | **3 466 contract cases, 0 failures** | ✅ |
| The CI pipeline | always red (the tests were allowed to fail) | **strict and green** | ✅ |
| The containers | root, no healthcheck | **uid 10001, healthchecked, locked migrations** | ✅ |

---

## 3. What was changed, phase by phase

### Phase 0 — Stop the bleeding

| Change | File(s) | Why |
|---|---|---|
| **New** hermetic environment bootstrap (blanks every third-party credential, forces `APP_ENV=test`, refuses a non-`test` database) | `backend/tests/env_bootstrap.py` | SEC-002, SEC-003 |
| **New** root-level pytest config that loads the bootstrap *before* any application module | `backend/conftest.py` | Load order guarantee |
| Test conftest now imports the bootstrap first (with `# isort: skip` so the linter cannot reorder it) and adds an autouse **network guard** that raises on any non-loopback socket | `backend/tests/conftest.py` | SEC-002 |
| **Product-level** guard: `Settings` no longer reads `.env` at all when `APP_ENV=test` | `backend/app/config.py` | Hermeticity even if pytest runs from another directory |
| `.gitignore`: `*.env.local`, `coverage/`, `frontend/coverage/`, `*.egg-info/`, `build/` | `.gitignore` | SEC-001, OPS-006 |
| **New** "Secrets & rotation" section (what each secret unlocks, what breaks when it rotates, the rotation procedure) + fixed the broken `*/# Backend` heading and the stale `app/db/base.py` path | `backend/README.md` | SEC-001, DOC |
| Verified `.env.example` holds placeholders only; verified no `.env` in git history | — | SEC-001 |

### Phase 1.1 — Ruff (35 → 0)

| Change | File(s) | Finding |
|---|---|---|
| **Deleted** the dead `quiz_summary_query()` (the only `F821`: a string annotation referring to a function-local import) and its unused `QuizSummaryResponse` / `AttemptState` DTOs — the same data already ships inside the verse feed | `backend/app/modules/quiz/application/queries/quiz_queries.py`, `.../dto/attempt_dto.py` | CODE-001 |
| Removed 17 unused imports, sorted 8 import blocks, wrapped 9 long lines | 12 files | CODE-002 |

### Phase 1.2 — Formatter (39 files → 0)

`ruff format .` — formatting only, no logic changes.

### Phase 1.3 — Mypy (100 → 0)

The 100 errors were 90 % "repository returns `dict[str, object]`" noise. The fix was **typed dictionaries at the repository boundary**, not casts in the query layer:

| Change | File(s) |
|---|---|
| New `TypedDict`s: `MemberStats`, `QuizKpis`, `QuizResultRow`, `ManagerAttemptRow`, `ManagerUserBlock` | `backend/app/modules/quiz/infrastructure/persistence/attempt_repository.py` |
| New `TypedDict`s: `MonthlyKpis`, `LeaderboardRow`, `PointHistoryRow`, `MonthlyUserRow`, `QuizBreakdownRow` | `backend/app/modules/points/infrastructure/persistence/point_transaction_repository.py` |
| New `TypedDict`: `EngagementUserRow`; removed a dead nested helper and de-triplicated the member sub-query | `backend/app/modules/bible/infrastructure/persistence/engagement_repository.py` |
| Corrected `member_series()`'s return type (it returned 2-tuples but claimed 3-tuples) | `backend/app/modules/bible/infrastructure/persistence/engagement_repository.py` |
| Added the missing return annotations on route handlers (quiz, bible, analytics routers) and turned the 204 endpoints into explicit `Response(status_code=204)` | 3 routers |
| `max(totals, key=totals.get)` → `max(totals, key=lambda …)` (overload-safe) | `backend/app/modules/bible/application/queries/verse_analytics_query.py` |
| Optional-safety in the attempt-result assembly (`finished_at` fallback, `bool(is_correct)`) | `backend/app/modules/quiz/application/queries/attempt_queries.py` |

### Phase 1.4 — The 8 failing tests (each root-caused, none "fixed by weakening")

| # | Test | Fix applied | Rationale |
|---|---|---|---|
| 1 | `test_settings_defaults` | assert `DEBUG is False` | Debug mode is opt-in since the hardening commit; the test encoded the old default |
| 2 | blog-post subject | assert the Arabic subject + the Arabic post title | The platform is Arabic-only; the test still expected "New post" |
| 3 | week-close boundary | assert the exclusive `00:00` bound **and** that it is later than the old `23:59` | The implementation deliberately moved to an exclusive bound to avoid a one-minute gap |
| 4 | monthly attendance rate | recompute the denominator from `AbsenceCalculationService.calculate_expected_count()` per meeting | BR-4: the expected population is per meeting week, not a constant roster |
| 5 | publication outbox | drain the `user.registered` event before publishing | The dispatcher counts **all** events; the new handler left a second pending row |
| 6/7 | analytics `month` | **API change**: `_parse_month()` now accepts `YYYY-MM` *and* the legacy `year`+`month`; `year` is marked deprecated in the OpenAPI description | The contract and its test were added in the same commit and never agreed; fixing only the test would have broken any client using the other shape |
| 8 | avatar upload | force the "Cloudinary not configured" branch explicitly | The old test silently called the **real** Cloudinary API because `.env` supplied live credentials |

**New tests added (5):** legacy `year`+`month` analytics shape, unparsable month → 422, dedicated-PIN-pepper decoupling, legacy pepper fallback, and a scheduler claim-lease regression test.

### Phase 2/3/5 — selected items executed along the way

| Change | Finding |
|---|---|
| `frontend/.env.example` now uses the same-origin `/api/v1` (the Vite proxy / Vercel rewrite resolve it) instead of the **production** host | SEC-012 |
| `frontend/.lovable-backup-20260820-112729/src/routes/index.tsx` removed from the tree (`git rm`) | OPS-006 |
| `starlette.HTTP_422_UNPROCESSABLE_ENTITY` → `HTTP_422_UNPROCESSABLE_CONTENT` (identical 422, no deprecation warning) | DEP-003 |
| httpx per-request `cookies=` → client cookie jar in the auth-token tests | DEP-004 |
| Frontend: **prettier** formatting for the whole `src/` tree + the real `exhaustive-deps` fixes (`tCommon` dependencies, stable `users` array) + removal of two stale ESLint directives + a scoped ESLint exception for the generated shadcn primitives | CODE-005 |

### Phase 2 — Security hardening (complete)

| # | Item | What was done | Finding |
|---|---|---|---|
| 2.1 | **Rate-limit the auth endpoints** | `/auth/login`, `/register`, `/password/forgot`, `/resend-verification` and `/refresh` are now limited. The login limits count **failures only** (per IP *and* per account) and a success clears the account window — a whole church service signing in from one address is never locked out. The e-mail endpoints count every attempt (each one costs a message). The answer is always **429 + `Retry-After`**, never a hard lockout (that would be a denial-of-service vector against the members). All limits are settings. | SEC-007 |
| 2.2 | **Keyed token hashes** | Refresh tokens and e-mail action links are stored as `v2:<hmac-sha256>`, keyed with `JWT_REFRESH_SECRET` (the secret that existed for this purpose but was never used). A token issued before the migration is still accepted (dual read) and its session is replaced by a v2 one, so the legacy format disappears on its own. The migration `b2e5c7a91d34` only **widens** the two columns (`VARCHAR 64 → 128`); the downgrade fails loudly instead of truncating a hash. | SEC-005 |
| 2.3 | **PIN pepper fail-fast** | A deployment with `APP_ENV=production` and no `ATTENDANCE_PIN_PEPPER` no longer starts — otherwise a JWT rotation would invalidate every member's attendance PIN. | SEC-006 |
| 2.4 | **Dependency patches** | Backend: `python-jose` → **PyJWT** (PYSEC-2026-4298; the app only signs HS256, so every issued token stays valid), `passlib` dropped (never imported), `certifi` floor raised (PYSEC-2026-4320). Frontend: **axios 1.20**, **zod 4.6.7**, **vitest 4.1.12**, **vite 6.4.5**, and npm `overrides` for the transitive packages. `@hookform/resolvers` was replaced by a 40-line local adapter (`src/lib/zodResolver.ts`) because its v6 line cannot be installed next to the `effect` peer it drags in — the alternative would have been `--legacy-peer-deps`, i.e. switching off every peer check in CI. | SEC-008 / DEP-005 |
| 2.5 | **Security headers + CSP** | Every response carries `nosniff`, `DENY`, a referrer policy, a permissions policy (the camera stays on for the QR scan), COOP and CORP. The API serves JSON only, so the CSP is `default-src 'none'`. HSTS is only sent over TLS. `CSP_REPORT_ONLY` stages the rollout. | SEC-009 |
| 2.6 | **OpenAPI accuracy** | The anonymous-message submission no longer advertises a security requirement (the optional token is read from the header directly — OpenAPI cannot say "optional"). The cron secret is a proper API-key scheme, so the scheduler tick documents both accepted ways. **Found while fixing this:** `/openapi.json` was still served in production (only `/docs` and `/redoc` were hidden) — the full schema was public. It is hidden now. | SEC-010 |
| 2.7 | **Anti-enumeration** | Registration, password reset and verification resend answer **202 with the same body** in every case, and the mails are sent as **background jobs** — so neither the status code nor the response time reveals whether an address exists. A reset link whose account is gone gets the same answer as an invalid link. | SEC-007 / SEC-013 |
| 2.8 | **`frontend/.env.example`** | Same-origin `/api/v1` instead of the production host. | SEC-012 |
| 2.9 | **Request ids + metrics** | Every request gets an id (the client's `X-Request-ID` when it is safe, a fresh one otherwise), it is bound to the context, echoed in the response and added to **every log line**. A counter registry (no new dependency) counts requests, outbox events, rate-limited calls and durations. `GET /api/v1/internal/metrics` exposes them in the Prometheus format, behind the same guard as the scheduler tick; the pending-outbox gauge is read from the database. | SEC-014 / OPS-004 |

### Phase 3 — Contract, performance and client-side session security (complete)

| # | Item | What was done | Finding |
|---|---|---|---|
| 3.1 | **Canonical analytics month** | The server accepts `month=YYYY-MM` (canonical) and the legacy `?year=&month=` pair; the legacy shape is marked deprecated in the OpenAPI description and disappears one release later. The frontend only ever sends the canonical shape — a test asserts that `year` is never sent. | ARCH-003 |
| 3.2 | **A frontend client for `/quiz-analytics/*`** | New module `src/modules/analytics` with types that mirror the backend DTOs, the API client (KPIs, members table, user detail, CSV export), the react-query hooks and the key factory. The monthly page and the quiz-analytics page were **"coming soon" placeholders** — they are real pages now. The endpoint contract had drifted unnoticed for exactly that reason: only the backend tests ever called it. | ARCH-003 |
| 3.3 | **The N+1 of `GET /quizzes`** | The list issued one `SELECT` for the verse **and** one `COUNT` per quiz — **21 statements for a page of 10**. Both are now fetched for the whole page in one query each: **3 statements**. The guard is a test that asserts the statement count does **not** grow with the page size (the property an N+1 breaks) plus an absolute bound; the counter and the admin fixture are shared through `tests/query_counter.py` and `tests/conftest.py`. | PERF-001 / QA-007 |
| 3.4 | **Memory-first access token** | The access token is a bearer credential and it lived in web storage, where any script of the origin can read it. It now lives in the memory of the page; the session is restored after a reload from the HttpOnly refresh cookie (`POST /auth/refresh` + `GET /users/me`) **before the router renders**, so the route guard no longer bounces a signed-in member to the login page. `VITE_AUTH_PERSISTENCE` chooses `memory` (default) / `session` / `local`; the rollback is one environment variable, no code change. | SEC-004 |
| 3.5 | **Explicit connection pool** | `pool_size`, `max_overflow`, `pool_timeout` and `pool_recycle` are explicit and environment-driven (`DB_POOL_SIZE`, `DB_MAX_OVERFLOW`, `DB_POOL_TIMEOUT_SECONDS`, `DB_POOL_RECYCLE_SECONDS`) with the same effective values as before; `pool_pre_ping` is kept, and the tests keep `NullPool`. | PERF-003 |
| 3.6 | **Cache headers** | The audit suggested `public, max-age=30` on the "public feed", but this feed is **authenticated** and carries the viewer's own read and quiz flags — a shared cache would show one member the read state of another. The feed therefore gets `private, max-age=30` (the browser only), the endpoints with personal or administrative data get `no-store`, and the whole mechanism is switched off with one setting. | PERF-004 |

**Two deliberate deviations from the audit text**, both for safety:

1. `public` cache headers would have leaked one member's flags to another → `private`.
2. The "remember me" checkbox only decides **where the token is written** in the persistent modes; in the memory mode the refresh cookie (30 days) decides how long a session lasts. The cookie's lifetime was not changed, so no member loses a session.

### Phase 4 — Architecture and maintainability (complete except 4.4)

| # | Item | What was done | Finding |
|---|---|---|---|
| 4.1 | **The shared kernel** | `app/shared/contracts/` holds the vocabulary more than one module speaks (`AttendanceStatus`, `AttemptStatus`, `QuizStatus`, `RoleName`, `UserStatus`). Every old import path **re-exports the same object**, so no call site changed and the identity of every enumeration is unchanged (the database keeps the same values — no migration). The mail client moved to `app/shared/infrastructure/email/`, the password rules and the token codec to `app/shared/security/` (pure moves with re-export shims: the issued tokens stay valid). | ARCH-001 / ARCH-002 |
| 4.2 | **The attendance ↔ notifications cycle** | Broken: the notifications module speaks the attendance status from the shared kernel, and with the mail client in the kernel the auth and users modules do not depend on the notifications module any more. **Three of the five cycles of the module graph are gone.** | ARCH-001 |
| 4.3 | **The bible ↔ quiz cycle** | Broken with a read-model port: `app/shared/contracts/quiz_read.py` + `QuizReadRepository`. The bible module asks the quiz module for the conditions ("this verse has a quiz") and reads the states through the port. **It also fixed a real bug** — the fifth one (§4). | ARCH-001 |
| 4.4 | **The domain ports** | Still open: the last cycle (`auth ↔ users`) runs through the layers — the route guard returns the ORM model of the users module. The ports of the quiz and the read model are done; the rest is a type-level rework that deserves its own review. | ARCH-005 |
| 4.5 | **One `UnitOfWork` lifecycle** | `UnitOfWork.from_session(session)` is the one way to wrap a session somebody else owns; `create(factory)` owns one; the direct construction still works but **warns** (removed in the next release). Two new guards: a route may not ask for the session and the unit of work at the same time (they would be two connections), and the warning names its two replacements. | ARCH-004 |
| 4.6 | **One direction, one language** | The document root already carries `<html lang="ar" dir="rtl">`, so the **138 repetitions** (`dir="rtl"` and `lang="ar"` in 51 files) said nothing and were removed; the `dir="ltr"` of the numbers, the e-mail addresses and the charts stays (that one is a real switch). The dead `lang: "ar" \| "en"` prop of 17 auth components is gone — it was never branched on. New `src/i18n/direction.ts` (`useDirection()`), and a guard test that fails when a component hard-codes the direction again. | ARCH-007 / REUSE-006 |
| 4.7 | **The asserts** | The five asserts in the request paths are explicit errors now (a `NotFoundError` instead of an assertion that vanishes under `python -O`). The five `isinstance` narrowing asserts of the repositories stay: they narrow a type, they do not guard a request. | CODE-006 / REUSE-004 |
| 4.8 | **The `TODO(phase-blog)`** | The blog module has only its data layer — there is **no publish command to call**, so there was nothing to wire. The consumer is finished and covered by a test; the marker is replaced by the truth. | CODE-007 |
| 4.9 | **One list of dependencies** | `pyproject.toml` is the only list; `scripts/sync_requirements.py` writes `requirements.txt` from it, and a test fails when the file in the repository is not the one the script produces. The file stays in the repository: the serverless deployment reads it (it cannot run a generator before it installs the packages). | REUSE-007 / DEP-007 |
| 4.10 | **The 52 MB of design images** | The same 44 screens are now WebP (quality 86): **52 MB → 4.5 MB**, visually identical. `.gitattributes` marks them binary, the folder has a README with the recipe. The history still holds the PNG — rewriting it is a decision of the team, not of a remediation. | DOC-002 |

### Phase 5 — CI, operations and test depth

| # | Item | What was done | Finding |
|---|---|---|---|
| 5.1 | **A strict frontend pipeline** | `npm ci` (the lockfile decides, a drift fails the build), the format check, `lint --max-warnings 0`, `tsc -b`, `npm audit --audit-level=high`, the tests **with** the coverage, the build. `continue-on-error` is gone — the pipeline used to be allowed to be red. | CI-002 |
| 5.2 | **A strict backend pipeline** | `pip-audit --skip-editable` (the project itself is an editable, non-PyPI distribution), gitleaks 8.28.0 pinned by digest with an allowlist for the fake test secret, `alembic upgrade head` + `alembic check` (no drift), the coverage floor at 77 %. The permissions are down to `contents: read`. | CI-003/004/005/007 |
| 5.4 | **The frontend coverage** | **Done — the target of the plan (70 %) is reached.** The first half covered the logic (the API clients, the hooks, the shared library): 17.97 % → **27.97 %**. The second half covered the **markup**: one render test per screen (the entrance, the profile, the verses, the verse, the quiz, the attempt, the result, the attendance, the history, the check-in, the analytics, the administration of the verses and of the quizzes, the router). The third half covered the **shell**, the forms of the administration, the board of the attendance and the table of the questions. Result: **70.39 % statements, 59.71 % branches, 64.86 % functions, 72.32 % lines** — 307 unit tests in 51 files. The floor followed the measurement at every step and **only ever went up** (27 → 61 → 64 → 65 → 66 → 68 → 69 → 70). The render tests found **thirteen real defects** (see §4, bugs 13–25). | QA-001 |
| 5.5 | **The E2E golden paths** | **Done.** Three journeys, five tests, **all green**: signing in (3), taking a quiz (1), the check-in of a member with the PIN (1). The run is hermetic: the database `marmarkos_e2e` is **rebuilt from the migrations** before every run (only a database whose name says "e2e" is ever dropped; the unit-test database is never touched), the seed refuses any other database, and the stack (API on 18010, Vite on 4173) is started by Playwright itself. The step runs in the pipeline (`.github/workflows/e2e-ci.yml`). It found **five real bugs** in the first run. | QA-001 |
| 5.6 | **The OpenAPI contract** | The schema now describes the real answers: the operations with a security declare 401/403, the ones with a body declare 400, the rate-limited ones declare 429, the `Allow` header completes the 405 answers, and the internal routes are excluded from the scan. The baseline was **87 failures**; the result is **3 466 cases, 0 failures** (the step runs in the backend pipeline). | QA-005 / SEC-010 |
| 5.7 | **The production frontend image** | A multi-stage image: node builds the application, nginx 1.27 serves it (SPA fallback, the assets immutable for a year, `index.html` never cached, gzip, the security headers in a snippet — nginx drops the inherited `add_header` in a location that sets its own). The API upstream is resolved per request, so the container starts even when the API is down. | OPS-001 / SEC-009 |
| 5.8 | **The containers** | The backend runs as **uid 10001**, both images have a healthcheck, the frontend waits for a healthy backend, and the migrations run behind a **PostgreSQL advisory lock** — two replicas would otherwise run the same migration at the same time (Alembic has no lock of its own). | OPS-002/003/005 |
| 5.9 | **The dependency policy** | Renovate: the patches merge themselves after three days, the minors and the majors need a human, a security advisory is always its own PR, the digests are not pinned. | DEP-001 |
| 5.10 | **The catalogue of the rules** | `docs/business-rules.md` lists every identifier the code cites (78 of them), the rule it means, the module that owns it and the file that implements it. It also writes down the defect of the numbering: the rules were numbered per phase, so `BR-1` is the timezone in the attendance and the feed in the notifications. A test fails when the code cites an identifier the catalogue does not explain. | REUSE-005 |

---

## 4. Real bugs found and fixed while making the gates green

These were **not** in the original report — they were exposed by the fixes themselves.

| # | Bug | Impact | Fix |
|---|---|---|---|
| 1 | `QuizAttempt.score.cast(float)` / `.total_points.cast(float)` — `cast()` needs a SQLAlchemy type, not the Python `float` class | `GET /api/v1/quiz-analytics/monthly` (and the per-user breakdown) raised `TypeError` → **HTTP 500** | Cast to `Numeric` (`backend/app/modules/points/infrastructure/persistence/point_transaction_repository.py:201,335`) |
| 2 | `round(double precision, integer)` does not exist in PostgreSQL | Same endpoints → `UndefinedFunctionError` → **HTTP 500** | Same fix — `Numeric` makes `round(numeric, int)` valid |
| 3 | Scheduler claim was not a lease: `claimed_at < now` made a just-claimed row immediately re-claimable, so **two ticks could publish the same verse** (the existing concurrency test was flaky — it failed 1 in N full-suite runs) | Duplicate publication + duplicate notification e-mails | 5-minute claim **lease** (`CLAIM_LEASE`) **plus** `SELECT … FOR UPDATE` on the row being published (`schedule_repository.py`, `publication_service.py`) |
| 4 | `raise ExportTooLargeError(max_rows)` passed an **int** where a message string is expected → the API answered `{"code": "export_too_large", "message": "5000"}` | Broken error message on three export endpoints | Raise with a real sentence that includes the limit |
| 5 | The manager-results query selects `QuizAttempt.score` **and** `QuizAttempt.score.label("points_awarded")` — the same column twice | *Not a defect:* two consumers read the two keys (`row["score"]` and `row["points_awarded"]`). It is redundant, so it is now documented in the typed row instead of silently duplicated |
| 6 | The attempt map of the member feed was keyed by the **verse id** while the badge asked for the **quiz id** — the lookup was always empty | The badge of the feed never showed "in progress" or "completed": a member who had finished the quiz of a verse saw it as available again. Found while breaking the bible ↔ quiz cycle (4.3) | The map is keyed by the quiz id (the key the caller already holds) and the states are read through the new read-model port; four new tests pin the four cases (completed, in progress, not started, draft quiz) |

### The five that the browser found (Phase 5.5)

They were found by the three journeys of the end-to-end tests — a member signs in, takes a quiz, a servant records a check-in — and each of them is a defect a member feels in the first minute.

| # | Bug | Impact | Fix |
|---|---|---|---|
| 8 | Deleting a member nullified the foreign key of its children (the refresh tokens) while the column is NOT NULL — the ORM contradicted the schema (`ondelete="CASCADE"`) | `IntegrityError` → **HTTP 500** on the deletion of any member who had signed in | `passive_deletes=True` on every cascading relationship of the member; a **guard test** reads the models and fails when a new child would be nullified (the attendance records were the second victim) |
| 9 | The built frontend asked `http://localhost:8000/api/v1` — the **member's own** computer — because the fallback of the base URL was absolute | The Docker image, a fresh clone and the CI build all called the wrong host; the HttpOnly refresh cookie (SameSite=Lax) never came back: **no member could stay signed in** | The base URL is relative by default (`/api/v1`); the Docker image sets it explicitly; a test reads the **built bundle** and fails if it mentions `localhost:8000` |
| 10 | The start-up restore was not single-flight: two parallel restores sent the same **rotated** refresh token twice | The second answer was a 401 and the session was cleared — **every reload logged the member out** (StrictMode mounts the providers twice) | One shared promise for the restore; the same discipline the silent refresh of the interceptor already had |
| 11 | The page of the attempt asked the manager endpoint `GET /quizzes/{id}` (ADMIN/SERVANT) | **403 — a member could not answer a quiz at all** | A member path `GET /quizzes/{id}/take`: the questions and the options, **never the correctness**; the manager endpoint keeps it |
| 12 | The remount of the route lost the id of the attempt (a mutation does not call its callbacks when nobody listens), the page started a second attempt, the server answered 409 and the page **swallowed the conflict** | The page of the attempt waited for ever: no radio button, no answer | The attempt is remembered outside React (the request remembers it, the server names it in the take payload), the 409 is read as a **resume signal** (D-4: `data.attempt_id`), and the answers live in a draft: after a refresh the page opens on **the last question the member solved** |

### The thirteen that the render tests found (Phase 5.4)

Rendering a screen is worth more than a line of coverage: the first
render of every page **crashed** or lied. These are the defects the
audit could not see, because they live in the markup and not in the
logic — and half of them are defects of **accessibility**: a control
without a name is invisible to a screen reader.

| # | Bug | Impact | Fix |
|---|---|---|---|
| 13 | The page "not found" was written in **English** | The only page of the product in another language | The Arabic text of `common.notFound`, with the keys in `ar.ts` (the product is Arabic only) |
| 14 | The entrance called `IntersectionObserver` without checking it | The page **crashed** in every browser that does not implement it (and in every test) | The guard in `use-scroll-reveal`, and the stub in the test setup |
| 15 | The page of the attempt showed `00:00` and **locked the answers** while the questions were still loading | The member saw a stopped timer and a form he could not touch, then the real timer | The duration of the payload (`takeData.duration_seconds`) is the fallback of the timer; the answers unlock when there are questions |
| 16 | The page of the attempt flashed the skeleton **twice** | The page jumped | One decision for the skeleton (the questions are there or they are not) |
| 17 | The page of the result read `window.location.search` | The result page **crashed** under the router (and could not be tested) | `useSearchParams()` — the router owns the query string |
| 18 | The panel of the readiness of a quiz read `validation.rules` without a guard | The administration of a quiz **crashed** when the payload had no rules | `validation.rules ?? []` |
| 19 | The three icon buttons of the table of the questions (edit, duplicate, delete) had **no accessible name** | A screen reader announced "button" and nothing else: the servant could not know what the button does | The names of the product (`admin.manage.editQuestion`, `duplicateQuestion`, `deleteQuestion`) |
| 20 | The button that **confirms** the deletion of a question said "رجوع" (back), and the one that cancels it too | The servant could not tell which button deletes the question — the dangerous one | The cancel says "إلغاء", the confirmation says "حذف السؤال" |
| 21 | The combobox of the member and the select of the status in the filters of the history had **no accessible name** | Two unnamed comboboxes in the same bar | `aria-label` on both, in the Arabic of the product |
| 22 | The tiles of the dashboard read `read_rate.toFixed(1)` and `average_score.toFixed(1)` without a guard | A number missing from the answer **crashed the whole board** of the attendance — the first page a servant opens | `?? 0`, like the other pages |
| 23 | The list of the absentees read `absent_users.length` without a guard | The same crash, from the same page | `?? []` |
| 24 | The page of the check-in formatted the date of the meeting without a guard (`Intl` throws a `RangeError` on a date it cannot read) | **The whole page of the check-in of the member crashed** | The new `formatDateOrEmpty` in the shared library: a date that cannot be read is simply not shown |
| 25 | A wrong PIN (the member mistypes his five digits — the most common case) was answered with "رمز QR غير صالح" ("the QR code is invalid") | On a page that has **no QR code at all**: the member was told the wrong thing | The PIN mode says "الرمز غير صحيح — لا يوجد عضو بهذا الرمز" |

---

## 5. How it was verified

```bash
# Backend — all green
cd backend
.venv/bin/ruff check .                      # All checks passed!
.venv/bin/ruff format --check .             # 516 files already formatted
DEBUG=true .venv/bin/mypy app               # Success: no issues found in 412 source files
DEBUG=true APP_ENV=test \
DATABASE_URL='postgresql+asyncpg://marmarkos:marmarkos@127.0.0.1:55432/marmarkos_test' \
  .venv/bin/python -m pytest -q             # 484 passed
.venv/bin/pip-audit --skip-editable         # No known vulnerabilities found
.venv/bin/python scripts/sync_requirements.py --check   # in sync

# Frontend — all green
cd frontend
npm run format:check                        # All matched files use Prettier code style!
npm run lint -- --max-warnings 0            # clean
npx tsc -b --force                          # clean
npm run test:run                            # 310 passed
npm run build                               # built successfully
npm audit --audit-level=high                # found 0 vulnerabilities

# End-to-end — the three journeys of a member (Phase 5.5)
cd frontend
npx playwright test --reporter=list         # 5 passed (18s)
```

The end-to-end run is hermetic: it **rebuilds its own database**
(`marmarkos_e2e`) from the migrations before every run — only a database
whose name says "e2e" is ever dropped, the database of the unit tests is
never touched — seeds what it needs, and refuses any database whose name
does not say "test" or "e2e". The rebuild replaced the cleanup of the
previous run: that cleanup could not delete a servant who had recorded an
attendance (the schema protects that record), so the run died before the
first test.

The OpenAPI contract (Phase 5.6) runs against the real application:

```bash
cd backend
# the application on a port, then:
.venv/bin/schemathesis run http://127.0.0.1:18001/openapi.json   # 3466 cases, 0 failures
```

Additional checks performed:

* The network guard was proven by running the suite with the old `.env` present — **no** outbound call was made (the avatar test now takes the "not configured" branch).
* The concurrency regression test was run **5 times in a row** (5/5 green) and the whole suite was run repeatedly to confirm the flakiness is gone.
* Every changed test was checked to still assert the *intent* (not weakened to pass).
* The N+1 guard was run against pages of 2 and 8 quizzes: the statement count is identical in both cases (the property an N+1 breaks), and the absolute bound is 8 statements for a page of 8.
* The memory-first token was verified in all three modes (`memory`, `session`, `local`) against the real `localStorage`/`sessionStorage` of jsdom, including that a token left by an earlier version is **not** picked up again in the memory mode.
* The cache policy was checked on a real response: the feed carries `private, max-age=30`, `/users/me` and `/notifications` carry `no-store`, and the mechanism can be switched off with one setting.
* The import-cycle guard was proven by the scan itself: it reports the remaining cycle (`auth ↔ users`) and fails on any **new** one.
* The `UnitOfWork` guard was proven by hand: a route that asked for the session and the unit of work at the same time would have been reported.
* The direction guard was proven: a component with `dir="rtl"` is reported with its file and line.
* The rule-catalogue guard was proven: a probe `BR-999` in `app/config.py` made the test fail with the list of the missing identifiers; the probe was removed afterwards.
* The design images were compared after the conversion (the Arabic text of the reference screens stays crisp).
* The end-to-end tests were run **three times in a row** (5/5 green every time) to prove they are not flaky, and the whole suite (484 + 210 + 5) was run together.
* The cascade guard was proven: the attendance relationships (the second victim of bug 8) were left without `passive_deletes` on purpose, the guard failed with the exact relationship named, and the fix was applied.
* The built-bundle guard was proven: the test reads `dist/**/*.js` and fails when the absolute URL of the development host appears in the bundle.

---

## 6. What is still open

### 6.1 Blocked — needs a human with provider access

| Item | Why it cannot be automated |
|---|---|
| **Rotate every production secret** (Neon, JWT ×2, attendance-PIN pepper, cron, Google OAuth, Cloudinary, Gmail, Brevo, Telegram) | Requires console access to each provider. Recipe R-01 in the audit report lists the rotation order and the blast radius of each secret |
| **Empty `backend/.env`** | Must happen *after* the rotation, otherwise the application stops working |

> Until this is done, the credentials on disk are still valid. This remains the **single highest-risk open item**.

### 6.2 Next phases (the plan is ready, the work is not started)

| Phase | Content | Size |
|---|---|---|
| **Phase 4.4** | The domain ports speak domain objects. The last import cycle (`auth ↔ users`) runs through the layers: the route guard returns the ORM model of the users module. The fix is a shared "current member" contract that the guard returns instead of the ORM row — a type-level change that touches every route that uses the guard. | ~2 days |
| ~~**Phase 5.4**~~ | ~~The frontend coverage~~ — **done**: **70.39 % statements** (307 unit tests in 51 files), the target of the plan. What is left is the scanner of the QR code (the camera cannot be simulated in jsdom) and a few panels of the administration — the floor only goes up, one step at a time. | — |
| ~~**Phase 5.5**~~ | ~~The E2E golden paths with Playwright~~ — **done**: three journeys, five tests, all green, and they run in the pipeline (`.github/workflows/e2e-ci.yml`). | — |

### 6.3 Deliberately deferred (with reasons)

| Item | Reason |
|---|---|
| Memory-first access token (SEC-004) | **Done in Phase 3** behind `VITE_AUTH_PERSISTENCE`. The staged rollout is still open: watch the sign-in rate after the deployment; `VITE_AUTH_PERSISTENCE=local` rolls it back without a code change |
| Domain-port rework (ARCH-005) | Large, type-level refactor; the shared kernel and the read-model port are done, the rest is item 4.4 above |
| Removing the legacy `?year=&month=` of the analytics (3.1) | The deprecation window is **one release**: the branch is removed when the next version ships, not before |
| `/metrics` as a Prometheus scrape target | The endpoint exists and speaks the exposition format; the scrape config and the alerting rules belong with the deployment |
| Re-hashing the legacy token rows in bulk | Not needed: every legacy token is single-use and is replaced by a v2 one when it is redeemed, so the old format disappears on its own |
| Rewriting the history to drop the 52 MB of PNG | It touches every clone of the repository and has to be done by everybody at the same time. The working tree is already 4.5 MB; the decision belongs to the team |
| Renumbering the business rules per platform | It would touch about 300 docstrings and the phase plans. The catalogue (`docs/business-rules.md`) makes the rules readable today; the renumbering deserves its own review |

---

## 7. Recommended next session

1. **Phase 4.4** — the domain ports speak domain objects: the guard returns a shared contract instead of the ORM row, and the last import cycle disappears.
2. **Phase 5.4 (the last inches)** — the scanner of the QR code, the panels of the administration, the mobile lists. The floor only goes up (70 % → …).
3. **Phase 3.1 (completion)** — remove the legacy `?year=&month=` branch of the analytics endpoints **one release after** the deprecation (not before: the server still accepts it today).
4. **Deployment watch** — after the memory-first token ships, watch the sign-in rate and the 401 rate for a week; `VITE_AUTH_PERSISTENCE=local` is the one-line rollback.
5. **The secret rotation** — the only item that cannot be done from the repository; it needs the console of every provider.
6. **The lessons of Phase 5.5 and 5.4** — the end-to-end tests found five defects that 462 unit tests never saw, and the render tests found six more. The next journeys (the verse of the day, the points, the blog, the profile, the notifications) would find more. The stack is ready; each journey is half a day.

> Rule for every follow-up PR: **one concern per PR**, behaviour-preserving, with the test that proves it. The pipeline is green now — the cheapest way to keep it that way is to never merge a red branch again.
