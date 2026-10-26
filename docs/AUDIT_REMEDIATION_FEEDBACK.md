# Audit Remediation — Feedback & Progress Report

**Plan:** `docs/AUDIT_REMEDIATION_PLAN.md` · **Audit:** `docs/CODEBASE_AUDIT_REPORT.md`
**Date:** 2026-10-26 · **Commit at start:** `28b6de2` · **Branch:** `main`

---

## 1. Executive feedback

The remediation started with the two phases that unlock everything else, and they are **complete**:

* **Phase 0 (safety)** — the test suite can no longer touch production systems, and the pipeline can no longer destroy a production database.
* **Phase 1 (truthful gates)** — all four backend gates are green, and the frontend lint gate is green too.

**Every backend quality gate is now passing for the first time in the project's history**, the frontend lint gate went from 820 problems to 0, and **Phase 2 (security hardening) is complete**: the auth endpoints are rate limited, the token hashes are keyed, the flows no longer leak which addresses exist, the responses carry hardening headers, and every request has an id.

**The dependency scanners are clean**: `npm audit` reports **0 findings** (was 3 high + 8 more) and `pip-audit` reports **0 findings** (was 3 vulnerabilities in 2 packages).

While doing that, the work uncovered **four genuine production defects** that no gate had ever caught (details in §4) — including two that would have returned HTTP 500 on the monthly-analytics endpoints, and a race that could publish a scheduled verse **twice**. A fifth finding turned out to be intentional redundancy, not a defect.

**What still needs a human:** the actual **secret rotation** (Phase 0.1/0.2) cannot be automated from the repository — it needs access to Neon, Google Cloud, Cloudinary, Gmail/Brevo and Telegram. Until that happens, the secrets on disk remain valid.

---

## 2. Before → after

| Gate | Before (audit) | After (now) | Status |
|---|---|---|---|
| `backend: ruff check .` | 35 errors (17 F401, 9 E501, 8 I001, **1 F821**) | **0** | ✅ |
| `backend: ruff format --check .` | 39 files to reformat | **0** | ✅ |
| `backend: mypy app` (strict) | 100 errors in 10 files | **0** | ✅ |
| `backend: pytest` | 373 passed / **8 failed** (381) | **386 passed / 0 failed** | ✅ |
| `backend: test warnings` | 4 (Starlette 422 + httpx cookies) | **0** | ✅ |
| `frontend: npm run lint` | 820 problems (808 errors, 12 warnings) | **0** (also with `--max-warnings 0`) | ✅ |
| `frontend: npm run test:run` | 48 passed (with React key warning + jsdom CORS noise) | **48 passed** | ✅ |
| `frontend: npm run build` | pass | **pass** | ✅ |
| Test-suite hermeticity | ❌ real Cloudinary API call observed | ✅ **no outbound socket is possible** | ✅ |
| Test-DB safety | ❌ `drop_all` on any `DATABASE_URL` | ✅ refuses non-`test` databases | ✅ |
| `npm audit` | 3 high (+ 8 more) | **0** | ✅ |
| `pip-audit` | 3 vulnerabilities / 2 packages | **0** | ✅ |
| Backend tests | 373 passed / 8 failed | **421 passed / 0 failed** | ✅ |

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

---

## 5. How it was verified

```bash
# Backend — all green
cd backend
.venv/bin/ruff check .                      # All checks passed!
.venv/bin/ruff format --check .             # 472 files already formatted
DEBUG=true .venv/bin/mypy app               # Success: no issues found in 387 source files
DEBUG=true APP_ENV=test \
DATABASE_URL='postgresql+asyncpg://marmarkos:marmarkos@127.0.0.1:55432/marmarkos_test' \
  .venv/bin/python -m pytest -q             # 386 passed

# Frontend — all green
cd frontend
npm run lint -- --max-warnings 0            # clean
npm run test:run                            # 48 passed
npm run build                               # built successfully
```

Additional checks performed:

* The network guard was proven by running the suite with the old `.env` present — **no** outbound call was made (the avatar test now takes the "not configured" branch).
* The concurrency regression test was run **5 times in a row** (5/5 green) and the whole suite was run repeatedly to confirm the flakiness is gone.
* Every changed test was checked to still assert the *intent* (not weakened to pass).

---

## 6. What is still open

### 6.1 Blocked — needs a human with provider access

| Item | Why it cannot be automated |
|---|---|
| **Rotate every production secret** (Neon, JWT ×2, attendance-PIN pepper, cron, Google OAuth, Cloudinary, Gmail, Brevo, Telegram) | Requires console access to each provider. Recipe R-01 in the audit report lists the rotation order and the blast radius of each secret |
| **Empty `backend/.env`** | Must happen *after* the rotation, otherwise the application stops working |

> Until this is done, the credentials on disk are still valid. This remains the **single highest-risk open item**.

### 6.2 Next phases (plan ready, not started)

| Phase | Content | Size |
|---|---|---|
| **Phase 3** | Frontend client for `/quiz-analytics/*` · remove the N+1 in `GET /quizzes` + query-count guard · memory-first access token behind a flag · connection-pool sizing · cache headers | ~4 days |
| **Phase 4** | `app/shared/contracts/` · break the two import cycles · domain ports speak domain objects · one `UnitOfWork` lifecycle · frontend direction handling · replace `assert` guards · the `TODO(phase-blog)` branch · single dependency source + lock · move the 53 MB of design PNGs out of git | ~2 weeks |
| **Phase 5** | CI hardening (`npm ci`, lint gate, `npm audit`, `pip-audit`, `gitleaks`, `alembic check`, coverage gates) · frontend coverage 21.92 % → ≥ 70 % · E2E golden paths · OpenAPI contract test · production frontend image (nginx) · non-root containers, healthchecks, advisory-locked migrations · Renovate | ~2 weeks |

### 6.3 Deliberately deferred (with reasons)

| Item | Reason |
|---|---|
| Memory-first access token (SEC-004) | Needs the flag + a staged rollout + the CSP first; rushing it risks locking every member out. The CSP is now in place, so Phase 3 can do it behind `VITE_AUTH_PERSISTENCE` |
| Domain-port rework (ARCH-005) | Large, type-level refactor; best done *after* the shared-contracts extraction in Phase 4.1 |
| `/metrics` as a Prometheus scrape target | The endpoint exists and speaks the exposition format; the scrape config and the alerting rules belong with the deployment (Phase 5) |
| Re-hashing the legacy token rows in bulk | Not needed: every legacy token is single-use and is replaced by a v2 one when it is redeemed, so the old format disappears on its own |

---

## 7. Recommended next session

1. **Phase 3.3** — the `GET /quizzes` N+1 with a query-count guard (visible performance win, low risk).
2. **Phase 3.4** — the memory-first access token behind `VITE_AUTH_PERSISTENCE` (the CSP it needs is now in place).
3. **Phase 5.1/5.2** — switch CI from "always red" to "always green and strict": `npm ci`, `--max-warnings 0`, `npm audit`, `pip-audit`, `gitleaks`, `alembic check`, coverage thresholds (start at the current values, only ever raise them).
4. **Phase 4.1** — `app/shared/contracts/` with re-exports, so the import cycles can be broken in two small follow-up PRs.
5. **Phase 3.1/3.2** — the frontend client for the analytics endpoints and the removal of the legacy `year`/`month` branch (one release after the deprecation).

> Rule for every follow-up PR: **one concern per PR**, behaviour-preserving, with the test that proves it. The pipeline is green now — the cheapest way to keep it that way is to never merge a red branch again.
