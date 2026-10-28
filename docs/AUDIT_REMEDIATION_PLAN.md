# Audit Remediation Plan — Marmarkos ABNUB Platform

Companion to `docs/CODEBASE_AUDIT_REPORT.md` (report ID `AUDIT-2026-10-26-FULL`, 73 findings).

**Goal:** eliminate every finding in the audit **without breaking the running system**.
**Method:** additive-first, dual-read windows, feature flags with safe defaults, expand/contract migrations, test-first, one concern per PR, formatting never mixed with behaviour.

**Legend:** `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked (needs a human with provider access)

---

## Phase 0 — Stop the bleeding (secrets, test safety, docs)

| # | Item | Finding | Status | Notes |
|---|---|---|---|---|
| 0.1 | Rotate every production secret in the platform secret store | SEC-001 | `[!]` | Requires provider access (Neon, Google Cloud, Cloudinary, Gmail, Brevo, Telegram). Recipe R-01 in the report. **Not started — needs a human.** |
| 0.2 | Empty `backend/.env` in the working copy; keep only `.env.example` | SEC-001 | `[!]` | Blocked until 0.1 is done (otherwise the app stops working). **Not started — needs a human.** |
| 0.3 | Make the test suite hermetic (no third-party credentials) | SEC-002 | `[x]` | `backend/tests/conftest.py` blanks every integration credential before `app.config` is imported. |
| 0.4 | Refuse to run the suite against a non-test database | SEC-003 | `[x]` | `tests/conftest.py` raises unless the database name contains `test`. |
| 0.5 | Block outbound sockets during tests | SEC-002 | `[x]` | Autouse `_no_outbound_network` fixture fails loudly on any external call. |
| 0.6 | `.gitignore`: `*.env.local`, `frontend/coverage/`, cache dirs | SEC-001 | `[x]` | `.gitignore` updated. |
| 0.7 | Document where secrets come from and how to rotate them | SEC-001 | `[x]` | `backend/README.md` — "Secrets & rotation" section. |
| 0.8 | Verify `.env.example` holds placeholders only | SEC-001 | `[x]` | Verified: `change-me` / `USER:PASSWORD@HOST` / empty third-party fields. |
| 0.9 | Verify no secrets in git history | SEC-001 | `[x]` | `git log --all --full-history -- backend/.env` → empty. |

## Phase 1 — Make the pipeline truthful (all four backend gates green)

### 1.1 Ruff (`ruff check .`) — 35 errors → 0

| # | Item | Finding | Status |
|---|---|---|---|
| 1.1.1 | Delete the dead `quiz_summary_query` (F821 `QuizSummaryResponse`) + unused DTOs | CODE-001 | `[x]` |
| 1.1.2 | Remove the 17 unused imports (`F401`) | CODE-002 | `[x]` |
| 1.1.3 | Fix the 9 `E501` long lines | CODE-002 | `[x]` |
| 1.1.4 | Sort the 8 `I001` import blocks | CODE-002 | `[x]` |
| 1.1.5 | `ruff check .` is clean | — | `[x]` |

### 1.2 Formatter (`ruff format --check .`) — 39 files → 0

| # | Item | Finding | Status |
|---|---|---|---|
| 1.2.1 | `ruff format .` (formatting-only commit, no logic change) | CODE-003 | `[x]` |

### 1.3 Mypy (`mypy app`) — 100 errors → 0

| # | Item | Finding | Status |
|---|---|---|---|
| 1.3.1 | 10 × `no-untyped-def` — add return annotations | CODE-004 | `[x]` |
| 1.3.2 | 7 × `operator` — explicit `Optional` handling | CODE-004 | `[x]` |
| 1.3.3 | 4 × `return-value` + 2 × `assignment` — repository signatures | CODE-004 | `[x]` |
| 1.3.4 | 54 × `arg-type` — narrow repository/query signatures | CODE-004 | `[x]` |
| 1.3.5 | 21 × `call-overload` + 2 remaining — SQLAlchemy/SQL typing | CODE-004 | `[x]` |
| 1.3.6 | `mypy app` is clean | — | `[x]` |

### 1.4 Tests (`pytest`) — 8 failures → 0

| # | Item | Finding | Status |
|---|---|---|---|
| 1.4.1 | `test_settings_defaults` — assert `DEBUG is False` (hardened default) | QA-002 (test #1) | `[x]` |
| 1.4.2 | Blog-post subject — assert the Arabic subject (platform is Arabic-only) | QA-002 (test #2) | `[x]` |
| 1.4.3 | Week-close boundary — assert the exclusive `00:00` bound + the property it protects | QA-002 (test #3) | `[x]` |
| 1.4.4 | Monthly attendance rate — assert the BR-4 per-meeting denominator | QA-002 (test #4) | `[x]` |
| 1.4.5 | Publication outbox — drain the registration event before publishing | QA-002 (test #5) | `[x]` |
| 1.4.6 | Analytics `month` — API accepts `YYYY-MM` **and** legacy `year`+`month` | ARCH-003 | `[x]` |
| 1.4.7 | Analytics `month` — tests use the canonical shape | QA-002 (tests #6/#7) | `[x]` |
| 1.4.8 | Avatar upload — force the "Cloudinary not configured" path explicitly | SEC-002 (test #8) | `[x]` |
| 1.4.9 | `pytest` is green | — | `[x]` |
| 1.4.10 | **Extra**: two production bugs found and fixed by the contract fix (`cast(float)` TypeError + `round(double precision, int)` undefined function in the monthly analytics queries) | ARCH-003 | `[x]` |
| 1.4.11 | **Extra**: flaky double-publication race in the scheduler fixed (claim lease + row lock) + regression test | QA-008 | `[x]` |

## Phase 2 — Security hardening

| # | Item | Finding | Status | Notes |
|---|---|---|---|---|
| 2.1 | Rate-limit the auth endpoints (login / forgot / resend / register) | SEC-007 | `[x]` | Failures only for the login, every attempt for the e-mail endpoints, 429 + `Retry-After`, never a lockout. |
| 2.2 | Refresh tokens → HMAC-SHA-256 + `v2:` prefix, dual read, column widen | SEC-005 | `[x]` | Keyed with `JWT_REFRESH_SECRET`; migration `b2e5c7a91d34` widens the two columns. |
| 2.3 | Attendance-PIN pepper: fail fast in production, loud warning | SEC-006 | `[x]` | `Settings` refuses to start with `APP_ENV=production` and no pepper. |
| 2.4 | Dependency patches: axios ≥ 1.20, zod 4, PyJWT, drop `passlib` | SEC-008 / DEP-005 | `[x]` | axios 1.20, zod 4.6.7, vitest 4.1.12, PyJWT 2.15; `npm audit` and `pip-audit` are clean. |
| 2.5 | Security headers + CSP (report-only → enforce) | SEC-009 | `[x]` | Additive middleware; `CSP_REPORT_ONLY` stages the rollout. |
| 2.6 | OpenAPI accuracy for the public anonymous-message route | SEC-010 | `[x]` | The optional token is read from the header, so the route declares no security; the cron secret is a scheme. |
| 2.7 | Uniform auth responses (anti-enumeration) | SEC-013 | `[x]` | 202 + one body everywhere; the mails are sent in the background, so the timing is uniform too. |
| 2.8 | `frontend/.env.example` → same-origin `/api/v1` | SEC-012 | `[x]` | Local dev can no longer write to production. |
| 2.9 | Request-id middleware + `/metrics` counters | SEC-014 / OPS-004 | `[x]` | `X-Request-ID` on every response, the id in every log line, counters behind the internal guard. |
| 2.10 | Deprecated `starlette.HTTP_422_UNPROCESSABLE_ENTITY` → `HTTP_422_UNPROCESSABLE_CONTENT` | DEP-003 | `[x]` | Same 422, no warning. |
| 2.11 | Deprecated httpx per-request `cookies=` → client jar | DEP-004 | `[x]` | Test-only change. |

## Phase 3 — Contract, performance and client-side session security

| # | Item | Finding | Status |
|---|---|---|---|
| 3.1 | Analytics: deprecate `year`, canonical `month=YYYY-MM` | ARCH-003 | `[~]` | Both shapes accepted, `year` marked deprecated; the legacy branch is removed one release later. The frontend only sends the canonical shape. |
| 3.2 | Frontend client + wiring for `/quiz-analytics/*` | ARCH-003 | `[x]` | New `src/modules/analytics` module (types, client, hooks, keys); the monthly page and the quiz analytics page are real pages now, not placeholders. |
| 3.3 | Remove the N+1 in `GET /quizzes` + query-count guard | PERF-001 | `[x]` | 2N+1 → 3 statements for the whole page; the guard asserts that the statement count does **not** grow with the page size. |
| 3.4 | Memory-first access token behind `VITE_AUTH_PERSISTENCE` | SEC-004 | `[x]` | The token lives in the memory of the page; the session is restored from the HttpOnly refresh cookie before the router renders. Rollback: `VITE_AUTH_PERSISTENCE=local`. |
| 3.5 | Explicit connection-pool sizing | PERF-003 | `[x]` | `DB_POOL_SIZE` / `DB_MAX_OVERFLOW` / `DB_POOL_TIMEOUT_SECONDS` / `DB_POOL_RECYCLE_SECONDS`, same effective values as before; `NullPool` in the tests. |
| 3.6 | `Cache-Control` on public read endpoints | PERF-004 | `[x]` | The feed is authenticated, so it is `private, max-age=30` (browser only); the endpoints with personal data are `no-store`. Off with one setting. |

## Phase 4 — Architecture & maintainability

| # | Item | Finding | Status | Notes |
|---|---|---|---|---|
| 4.1 | `app/shared/contracts/` + re-exports (no call-site changes) | ARCH-001/002 | `[x]` | `AttendanceStatus`, `AttemptStatus`, `QuizStatus`, `RoleName`, `UserStatus` live in `app/shared/contracts/`; every old path re-exports the same object (identity kept, no migration). |
| 4.2 | Break `attendance ↔ notifications` | ARCH-001 | `[x]` | The notifications module speaks the attendance status from the shared kernel. The mail client moved to `app/shared/infrastructure/email` (with re-export shims), so the auth and users modules do not depend on the notifications module any more. |
| 4.3 | Break `bible ↔ quiz` (read-model port) | ARCH-001 | `[x]` | `app/shared/contracts/quiz_read.py` + `QuizReadRepository`: the bible module asks the quiz module for the conditions and reads through the port. **Fixed a real bug**: the attempt map was keyed by verse id while the badge asked for the quiz id, so the feed never showed "in progress"/"completed". |
| 4.4 | Domain ports speak domain objects (module by module) | ARCH-005 | `[ ]` | The last import cycle (`auth ↔ users`, through the layers: the route guard returns the ORM model) is the remainder. The ports of the quiz and the read model are done. |
| 4.5 | One `UnitOfWork` lifecycle | ARCH-004 | `[x]` | `UnitOfWork.from_session()` is the one way to wrap a foreign session; the direct construction still works but warns (removed next release). New guard: no route may ask for the session and the unit of work at the same time. |
| 4.6 | Frontend direction handling (`useDirection`) + drop dead `"en"` arms | ARCH-007 | `[x]` | 138 redundant `dir="rtl"`/`lang="ar"` attributes removed (the document root carries both), the dead `lang: "ar" \| "en"` prop deleted from 17 auth components, `src/i18n/direction.ts` added, guard test included. |
| 4.7 | Replace `assert` guards in request paths with explicit errors | CODE-006 | `[x]` | Five asserts → `NotFoundError` / `RuntimeError`. The five `isinstance` narrowing asserts in the repositories stay (they narrow a type, they do not guard a request). |
| 4.8 | Implement or remove the `TODO(phase-blog)` branch | CODE-007 | `[x]` | The blog module has only its data layer (no publish command exists), so the consumer ships dormant on purpose — it is finished and tested. The marker is replaced by the truth. |
| 4.9 | `pyproject.toml` as the single dependency source + generated lock | DEP-002 | `[x]` | `scripts/sync_requirements.py` writes `requirements.txt` from `pyproject.toml`; a test fails when the two drift. The file stays in the repository: the serverless deployment reads it. |
| 4.10 | Repo hygiene: LFS/external for design PNGs, drop the stray `.lovable-backup` file | OPS-006 / DOC-002 | `[x]` | The 44 design images are WebP now: **52 MB → 4.5 MB** (`.gitattributes` marks them binary, the folder has a README). The history still holds the PNG — rewriting it is a decision of the team, not of a remediation. |

## Phase 5 — CI/CD, frontend quality and test depth

| # | Item | Finding | Status | Notes |
|---|---|---|---|---|
| 5.1 | `npm ci` + lint + `npm audit` + real test gate in frontend CI | CI-002 | `[x]` | `npm ci` (the lockfile decides), format check, `lint --max-warnings 0`, `tsc -b`, `npm audit --audit-level=high`, the tests with coverage, the build. `continue-on-error` is gone: the pipeline can no longer be red and green. |
| 5.2 | `pip-audit` + `gitleaks` + `alembic check` + coverage gates in backend CI | CI-003/004/005/007 | `[x]` | `pip-audit --skip-editable`, gitleaks 8.28.0 (pinned by digest) with an allowlist for the fake test secret, `alembic upgrade head` + `alembic check`, the coverage floor at 77 %. |
| 5.3 | Frontend formatting + the `exhaustive-deps` warnings + `--max-warnings 0` | CODE-005 | `[x]` | Prettier over the whole frontend; the thresholds only ever go up. |
| 5.4 | Frontend coverage 17.97 % → ≥ 70 % (quiz/attendance hooks first) | QA-001 | `[~]` | The floor is the measured value and **only goes up**: **65 % statements / 54 % branches / 59 % functions / 67 % lines** (277 unit tests + 5 E2E). The second half of the phase rendered the **pages** themselves (the entrance, the profile, the verses, the quiz, the attendance, the analytics, the administration, the router): the coverage went from 27.97 % to **65.11 %**. What is left is the scanner of the QR code, the schedule of the verses and the shell of the application. |
| 5.5 | E2E golden paths (Playwright) | QA-001 | `[x]` | Three journeys, five tests, **all green**: signing in (3), taking a quiz (1), the check-in of a member with the PIN (1). The run is hermetic: the database `marmarkos_e2e` is **rebuilt from the migrations** before every run (only a database whose name says "e2e" is ever dropped) and the seed refuses any other database. The step runs in the pipeline (`.github/workflows/e2e-ci.yml`). It found **five real bugs** in the first run. |
| 5.6 | OpenAPI contract test (`schemathesis`) | QA-005 | `[x]` | The schema now describes the real answers (401/403/400/429 added, `Allow` header on 405, the rate-limited routes marked). **3 466 cases, 0 failures**; the step runs in the backend pipeline. |
| 5.7 | Multi-stage production frontend image (nginx) | OPS-001 | `[x]` | node build → nginx 1.27 runtime, SPA fallback, the API upstream resolved per request, a healthcheck, the security headers in a snippet. |
| 5.8 | Non-root containers, healthchecks, advisory-locked migrations | OPS-002/003/005 | `[x]` | uid 10001 for the backend, healthchecks on both images, the migrations behind a PostgreSQL advisory lock (two replicas → one migration). |
| 5.9 | Dependency-update policy (Renovate, patches auto-merge) | DEP-001 | `[x]` | Patches auto-merge after three days, minors and majors need a human, a security advisory is always its own PR. |
| 5.10 | `docs/business-rules.md` mapping every `BR-xx` / `D-xx` identifier | REUSE-005 | `[x]` | The catalogue lists every rule of every module; four guard tests keep it in step with the code (the rule exists, the identifier is unique, the file is mentioned in the catalogue, the catalogue has no dead link). |

---

## Progress log

Newest first. Full detail in `docs/AUDIT_REMEDIATION_FEEDBACK.md`.

### 2026-10-27 — The end-to-end tests: five real bugs in one afternoon

The item 5.5 was the last chance to prove the golden paths of the platform. The
three journeys were written, run against a real browser — and they failed
**five times in a row**, each time on a real defect that no unit test had seen.

| # | What the browser found | The fix | Commit |
|---|---|---|---|
| 8 | A member with a session could not be deleted: the ORM nullified the foreign key of the refresh tokens, the column is NOT NULL | `passive_deletes=True` on every cascading relationship of the member | `7854887` + `49f6928` |
| 9 | The API was always the same origin: the built bundle asked `http://localhost:8000/api/v1` — the member's own machine — and the HttpOnly cookie never came back | The base URL is relative by default (`/api/v1`); a test reads the built bundle | `3e6d72a` |
| 10 | A reload logged the member out: two parallel restores used the same rotated refresh token, the second answer was a 401 | The restore is single-flight (one shared promise) | `060498a` |
| 11 | A member could not answer a quiz at all: the page asked the manager endpoint, which is reserved for the servants (403) | A member path `GET /quizzes/{id}/take` — without the correctness of the options | `a552102` |
| 12 | The page of the attempt waited for ever: the remount lost the id of the attempt, the second start answered 409, and the 409 was swallowed | The attempt is remembered outside React; the 409 is a resume signal (D-4) | `88948ad` |

The answers of the member are now kept in a draft (`localStorage`) and the page
**resumes on the last question he solved** after a refresh. The server stays the
source of truth: the draft holds no credential and the result belongs to the
server.

The lesson of the phase: the unit tests measured the pieces, the browser
measured the product. Every one of the five defects was invisible to a green
pipeline of 462 tests.

### 2026-10-27 — Phase 4 + Phase 5 (architecture, CI, operations) complete except 4.4 / 5.4 / 5.10

| Item | Result |
|---|---|
| Shared kernel | `app/shared/contracts/` (the vocabulary), `app/shared/infrastructure/email/` (the mail client), `app/shared/security/` (the password rules, the token codec). Every old import path re-exports the same objects — no call site outside the moved files changed. |
| Import cycles | **Three of five cycles broken** (attendance ↔ notifications, bible ↔ quiz, auth ↔ notifications). One remains (auth ↔ users, through the layers) and is on the list of item 4.4. A new test scans the module graph on every run: a **new** cycle fails the build. |
| Fifth real bug | The attempt map of the member feed was keyed by verse id while the badge asked for the quiz id — the quiz badge never showed "in progress" or "completed". Fixed with the read-model port; four new tests. |
| Unit of Work | One lifecycle: `from_session()` for a foreign session, `create()` for an owned one; the direct construction warns for one release. A route may no longer ask for two sessions. |
| Frontend direction | 138 redundant `dir="rtl"` / `lang="ar"` attributes removed (the document root carries both), the dead `lang: "ar" \| "en"` prop deleted, `useDirection()` added, guard test included. |
| Asserts | The five asserts in the request paths are explicit errors now (an assert vanishes under `python -O`). |
| Dependencies | One list: `pyproject.toml`. `requirements.txt` is generated, and a test fails when it drifts. |
| Design images | 52 MB → **4.5 MB** (WebP, quality 86, same 44 screens). |
| OpenAPI contract | The schema describes the real answers; **3 466 schemathesis cases, 0 failures**; the step is in the pipeline. |
| CI | `npm ci`, real lint/test gates, `npm audit`, `pip-audit`, gitleaks, `alembic check`, coverage floors, Renovate. |
| Operations | nginx production image, non-root containers, healthchecks, advisory-locked migrations. |

New gates: **449 backend tests** (was 431), **75 frontend tests** (was 71), `mypy` 0 (412 files), `ruff` 0, `tsc` 0, `eslint --max-warnings 0` 0, `npm audit` 0, `pip-audit` 0, `alembic check` clean.

### 2026-10-26 — Phase 3 complete (contract, performance, client session)

| Item | Result |
|---|---|
| Analytics contract | The frontend sends `month=YYYY-MM` only; the deprecated `?year=&month=` pair stays accepted on the server for one release |
| Analytics client | New `src/modules/analytics` (types mirroring the backend DTOs, API client, react-query hooks, key factory) and two real pages instead of "coming soon" placeholders |
| N+1 (`GET /quizzes`) | 2N+1 → 3 statements per page (list, verse references, grouped question counts). The guard tests that the statement count does not grow with the page size |
| Access token | Memory-first (`VITE_AUTH_PERSISTENCE`, default `memory`): the token is out of web storage; the session is restored from the HttpOnly refresh cookie before the router renders |
| Connection pool | Explicit `DB_POOL_SIZE` / `DB_MAX_OVERFLOW` / timeouts / recycle, `pool_pre_ping` kept; `NullPool` in the tests |
| Cache headers | `private, max-age=30` on the member feed (it is authenticated and carries the viewer's flags), `no-store` on the endpoints with personal or administrative data |

New gates: **431 backend tests** (was 421), **71 frontend tests** (was 52).

### 2026-10-26 — Phase 2 complete (security hardening)

| Item | Result |
|---|---|
| Auth rate limits | Login counts **failures** only (per IP and per account), the e-mail endpoints count every attempt, 429 + `Retry-After`, never a lockout |
| Token hashes | HMAC-SHA-256 keyed with `JWT_REFRESH_SECRET`, `v2:` marker, dual read with the legacy SHA-256, columns widened to `VARCHAR(128)` |
| PIN pepper | A production deployment without `ATTENDANCE_PIN_PEPPER` no longer starts |
| Dependencies | `npm audit`: 0 findings · `pip-audit`: 0 findings (python-jose, ecdsa, certifi and the whole axios/zod/vitest chain are gone) |
| Security headers | `nosniff`, `DENY`, referrer, permissions, COOP/CORP, a strict CSP (`default-src 'none'`), HSTS over TLS only |
| OpenAPI | The public route declares no security, the cron secret is a scheme, and `/openapi.json` is hidden in production (it used to be served) |
| Anti-enumeration | Register / reset / resend answer 202 with one body; the mails are sent in the background, so the timing is uniform too |
| Observability | `X-Request-ID` on every response, the id in every log line, `/api/v1/internal/metrics` behind the cron/admin guard |

New gates: **421 backend tests** (was 386), **52 frontend tests** (was 48), `mypy` 0, `ruff` 0, `npm audit` 0, `pip-audit` 0.

### 2026-10-26 — Phase 0 + Phase 1 complete (backend), frontend formatting done

| Gate | Before | After |
|---|---|---|
| `ruff check .` | 35 errors | **0** ✅ |
| `ruff format --check .` | 39 files | **0** ✅ |
| `mypy app` | 100 errors / 10 files | **0** ✅ |
| `pytest` | 373 passed / 8 failed | **386 passed / 0 failed** ✅ |
| `npm run lint` | 820 problems | **0** ✅ (even with `--max-warnings 0`) |
| `npm run test:run` | 48 passed | **48 passed** ✅ |
| `npm run build` | pass | **pass** ✅ |

Bugs found and fixed while making the gates green: the monthly-analytics
`cast(float)` TypeError, the PostgreSQL `round(double precision, int)` failure,
the double-publication race in the scheduler, the `ExportTooLargeError` message
that returned the row limit instead of a sentence, and the `points_awarded`
double-labelled column.

### 2026-10-28 — The last of Phase 5.4 and a hermetic end-to-end run

| Item | Result |
|---|---|
| Frontend coverage | **65.11 % statements / 54.93 % branches / 59.77 % functions / 67.05 % lines** — 277 unit tests in 44 files. The first half of the phase covered the logic (the clients, the hooks, the library), the second half covered the **markup**: one render test per screen. The floor followed the measurement at every step and only ever went up: 27 → 61 → 64 → 65. |
| The render tests | They found **six real defects** (the English page of "not found", the entrance that needed `IntersectionObserver`, the timer of the attempt that showed `00:00` and locked the answers, the skeleton that flashed twice, the result page that read `window.location.search`, the panel of the readiness that read `validation.rules` without a guard). They are bugs 13–18 of the feedback document. |
| The end-to-end run | The database of the run is now **rebuilt from the migrations** before every run (only a database whose name says "e2e" is ever dropped). The cleanup of the previous run could not delete a servant who had recorded an attendance — the schema protects that record — so the run died before the first test. The five tests are green with the stack started by Playwright itself. |
| Still open | Phase 4.4 (the last import cycle), the last 5 % of the frontend coverage (the scanner of the QR code, the schedule of the verses, the shell), Phase 3.1 (the end of the deprecation window) and the rotation of the secrets (a human with the consoles). |
