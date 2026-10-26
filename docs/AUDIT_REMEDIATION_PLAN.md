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
| 2.1 | Rate-limit the auth endpoints (login / forgot / resend / register) | SEC-007 | `[ ]` | Reuse `SlidingWindowRateLimiter`; 429 + existing `rate_limited` code. |
| 2.2 | Refresh tokens → HMAC-SHA-256 + `v2:` prefix, dual read, column widen | SEC-005 | `[ ]` | Expand migration first (`VARCHAR(64) → VARCHAR(128)`). |
| 2.3 | Attendance-PIN pepper: fail fast in production, loud warning | SEC-006 | `[~]` | Behaviour locked by tests (dedicated pepper decouples the PIN from `JWT_SECRET`); the production fail-fast is still to do. |
| 2.4 | Dependency patches: axios ≥ 1.20, zod 4 + resolvers 6, PyJWT, drop `passlib` | SEC-008 / DEP-005 | `[ ]` | `npm ci` reproducibility comes with Phase 5. |
| 2.5 | Security headers + CSP (report-only → enforce) | SEC-009 | `[ ]` | Additive middleware. |
| 2.6 | OpenAPI accuracy for the public anonymous-message route | SEC-010 | `[ ]` | `security=[]` on the decorator. |
| 2.7 | Uniform auth responses (anti-enumeration) | SEC-013 | `[ ]` | Same status + body for known/unknown users. |
| 2.8 | `frontend/.env.example` → same-origin `/api/v1` | SEC-012 | `[x]` | Local dev can no longer write to production. |
| 2.9 | Request-id middleware + `/metrics` counters | SEC-014 / OPS-004 | `[ ]` | Additive; makes the scheduler observable. |
| 2.10 | Deprecated `starlette.HTTP_422_UNPROCESSABLE_ENTITY` → `HTTP_422_UNPROCESSABLE_CONTENT` | DEP-003 | `[x]` | Same 422, no warning. |
| 2.11 | Deprecated httpx per-request `cookies=` → client jar | DEP-004 | `[x]` | Test-only change. |

## Phase 3 — Contract, performance and client-side session security

| # | Item | Finding | Status |
|---|---|---|---|
| 3.1 | Analytics: deprecate `year`, canonical `month=YYYY-MM` | ARCH-003 | `[~]` | Both shapes accepted, `year` marked deprecated; the legacy branch is removed one release later. |
| 3.2 | Frontend client + wiring for `/quiz-analytics/*` | ARCH-003 | `[ ]` |
| 3.3 | Remove the N+1 in `GET /quizzes` + query-count guard | PERF-001 | `[ ]` |
| 3.4 | Memory-first access token behind `VITE_AUTH_PERSISTENCE` | SEC-004 | `[ ]` |
| 3.5 | Explicit connection-pool sizing | PERF-003 | `[ ]` |
| 3.6 | `Cache-Control` on public read endpoints | PERF-004 | `[ ]` |

## Phase 4 — Architecture & maintainability

| # | Item | Finding | Status |
|---|---|---|---|
| 4.1 | `app/shared/contracts/` + re-exports (no call-site changes) | ARCH-001/002 | `[ ]` |
| 4.2 | Break `attendance ↔ notifications` | ARCH-001 | `[ ]` |
| 4.3 | Break `bible ↔ quiz` (read-model port) | ARCH-001 | `[ ]` |
| 4.4 | Domain ports speak domain objects (module by module) | ARCH-005 | `[ ]` |
| 4.5 | One `UnitOfWork` lifecycle | ARCH-004 | `[ ]` |
| 4.6 | Frontend direction handling (`useDirection`) + drop dead `"en"` arms | ARCH-007 | `[ ]` |
| 4.7 | Replace `assert` guards in request paths with explicit errors | CODE-006 | `[ ]` |
| 4.8 | Implement or remove the `TODO(phase-blog)` branch | CODE-007 | `[ ]` |
| 4.9 | `pyproject.toml` as the single dependency source + generated lock | DEP-002 | `[ ]` |
| 4.10 | Repo hygiene: LFS/external for design PNGs, drop the stray `.lovable-backup` file | OPS-006 / DOC-002 | `[~]` | The stray backup file is removed (`git rm`); the 53 MB of design PNGs still need a move to LFS/external storage. |

## Phase 5 — CI/CD, frontend quality and test depth

| # | Item | Finding | Status |
|---|---|---|---|
| 5.1 | `npm ci` + lint + `npm audit` + real test gate in frontend CI | CI-002 | `[ ]` |
| 5.2 | `pip-audit` + `gitleaks` + `alembic check` + coverage gates in backend CI | CI-003/004/005/007 | `[ ]` |
| 5.3 | Frontend formatting + the `exhaustive-deps` warnings + `--max-warnings 0` | CODE-005 | `[x]` |
| 5.4 | Frontend coverage 21.92 % → ≥ 70 % (quiz/attendance hooks first) | QA-001 | `[ ]` |
| 5.5 | E2E golden paths (Playwright) | QA-001 | `[ ]` |
| 5.6 | OpenAPI contract test (`schemathesis`) | QA-005 | `[ ]` |
| 5.7 | Multi-stage production frontend image (nginx) | OPS-001 | `[ ]` |
| 5.8 | Non-root containers, healthchecks, advisory-locked migrations | OPS-002/003/005 | `[ ]` |
| 5.9 | Dependency-update policy (Renovate, patches auto-merge) | DEP-001 | `[ ]` |
| 5.10 | `docs/business-rules.md` mapping every `BR-xx` / `D-xx` identifier | REUSE-005 | `[ ]` |

---

## Progress log

Newest first. Full detail in `docs/AUDIT_REMEDIATION_FEEDBACK.md`.

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
