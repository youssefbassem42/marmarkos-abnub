# Phase 4 Implementation Plan — Part 1 of 2

**Document type:** binding execution plan (implementer handoff)
**Covers:** `docs/Agile/phase-4/phase-4.md` — Notifications, Email, Anonymous bot, Admin sections
**Design source of truth:** `docs/designs/Notification-Page-en.jpg`, `docs/designs/Notification-Page-ar.jpg`, `docs/designs/Anonymous-Message--en.jpg`, `docs/designs/Anonymous-Message-ar.jpg`
**Visual identity source of truth:** `docs/Design-Guide.md`
**Domain source of truth:** `docs/database/DATABASE_DESIGN.md` + this document §1
**Status of previous phase:** Phase 2 (weekly attendance) shipped; Phase 3 (blog/comments/moderation) **not started**
**Part 2:** `docs/Agile/phase-4/phase-4-implementation-plan-part-2.md`
**Task ID series:** `P4-nnn` (prefixed to avoid collision with the `TASK-nnn` series reused by Phase 1 and Phase 2)

---

# 0. Rules of Engagement

Read this section before touching any file.

1. **Read before you write.** Every task in Part 2 lists the exact files it touches. Open and read each one first. The `notifications` and `anonymous_messages` modules already have tables, models, repositories, a working bilingual email stack and Unit-of-Work wiring. Do not re-create any of it. §2 is the inventory.
2. **Section 2 is binding.** Anything listed under "Already done — do not redo" must not be rewritten, renamed, or re-migrated.
3. **Section 3 freezes the contracts.** Settings names, column names, enum values, endpoint paths, error codes, DTO field names, i18n keys, React Query keys, route paths and design tokens in §3 are frozen. If a task forces a change to a frozen contract, stop and escalate instead of improvising.
4. **Every decision in §1.2 came from the product owner.** Do not "improve" any of them. If a case is not covered by §1.2/§1.3, stop and ask — this plan was written under an explicit no-assumptions instruction.
5. **Backend commands must be prefixed.** The shell exports `DEBUG=release`, which crashes `pydantic-settings`. Always run:
   `cd backend && DEBUG=true APP_ENV=test .venv/bin/python -m pytest`
6. **Never migrate against `backend/.env`.** It points at remote Neon and contains live credentials. Always override `DATABASE_URL` to the local scratch DB:
   `postgresql+asyncpg://marmarkos:marmarkos@localhost:55432/marmarkos_test`
7. **Run the Acceptance block of a task before marking it done.** A task without a green Acceptance run is not done.
8. **No git operations** (no commit, branch, push, PR) unless explicitly requested. Branch name when requested: `feature/notifications` (`docs/Sprint-Guide.md:71`). Commit style: `feat: …`, `fix: …`, `test: …`.
9. **Design fidelity beats invention.** The four screenshots are the visual target. Where the design conflicts with the domain, the **copy** changes, never the domain (§1.4). Where the design uses a colour outside the palette, the **palette wins** (§1.4, DR-6).
10. **Arabic first.** `i18next` is initialised with `lng: "ar"`, `fallbackLng: "ar"`, and the TypeScript key types are derived from `ar.ts`. Add keys to `frontend/src/i18n/resources/ar.ts` **before** `en.ts` or `t()` calls will not type-check.
11. **No new infrastructure.** `docs/Sprint-Guide.md:157-184` forbids Redis, Kafka, RabbitMQ and Kubernetes in V1. Phase 4 adds **no** queue, no broker, no worker process and no websocket server (D-3).
12. **Anonymity is a security property, not a feature flag.** Never log, store or return an IP address, user id, session id or access token in association with an anonymous message. The rate-limit key is a salted hash and lives in memory only (BR-12).

---

# 1. Authoritative Business Specification

## 1.1 The two domains

### Notifications

A notification is a bilingual message shown in the in-app bell and on the notifications page.

```text
Notification
├── audience
│   ├── per-user  → notifications.user_id = <uuid>
│   └── broadcast → notifications.user_id IS NULL   (visible to every user)
├── copy       → Arabic (title/message) + English (title_en/message_en), both required
├── type       → BLOG_POST | ANNOUNCEMENT | ATTENDANCE | SYSTEM   (unchanged, 4 values)
├── data       → JSONB: optional icon override, cta_url, event ids
└── read state → notification_reads(notification_id, user_id, read_at)   ← NEW, per user
```

Read state is **per user for every notification**, including per-user rows. `notifications.read_at`
becomes legacy and is no longer written or read by application code (DEF-1, D-2).

### Anonymous messages

A message submitted by anyone — signed in or not — forwarded to one Telegram chat and
listed in the admin panel.

```text
AnonymousMessage
├── message          → required, 10–1000 characters
├── sender_name      → optional, ≤120 chars    ← NEW column
├── sender_phone     → optional, ≤32 chars     ← NEW column
├── status           → PENDING | SENT | FAILED
├── telegram_status  → PENDING | SENT | FAILED
├── attempts         → int, incremented per delivery attempt   ← NEW column
└── never stores     → user_id, email, author_id, session, IP, user agent
```

There is **no link to a user account, ever**, even when a signed-in user submits (D-1, BR-11).

## 1.2 Decisions taken by the product owner

These were asked and answered before this plan was written. They are binding.

| # | Decision | Consequence |
| --- | --- | --- |
| **D-1** | Anonymous messages get **optional `sender_name` and `sender_phone`** columns, exactly as drawn. The documented guarantee changes from "no identity data" to **"no account linkage"**. | Migration adds two nullable columns. `tests/integration/database/test_anonymous_messages.py::test_table_has_no_identity_columns` is updated to assert absence of `user_id`/`author_id`/`email`/`ip_address`/`user_agent` and presence of the two optional self-declared fields. `docs/database/DATABASE_DESIGN.md` + `IMPLEMENTATION_REPORT.md` updated. |
| **D-2** | Broadcast read state uses a new **`notification_reads`** join table. | One broadcast row, correct per-user unread counts. `NotificationRepository.mark_read` is rewritten (DEF-1). |
| **D-3** | Telegram and email are sent **inline in the request** (after commit), with a **manual admin retry** action. No worker, no cron, no queue. | `POST /anonymous-messages/{id}/retry` is required, not optional. Delivery latency is inside the request. Risks R-1/R-2 in Part 2 §16. |
| **D-4** | The bell polls: **`refetchInterval: 60_000` + `refetchOnWindowFocus`**. | No SSE, no websocket. Badge is at most 60s stale. |
| **D-5** | `NotificationType` **keeps its 4 values**. Design tabs map onto them (§3.4). | No enum change, no migration for types. |
| **D-6** | Notification copy **stores both languages** (`title`/`message` = Arabic, `title_en`/`message_en` = English). | No `users.locale` column. Content follows the UI language switch instantly. Admin push requires all four fields. |
| **D-7** | **Two pages**: `/notifications` (member-facing, public shell) and `/admin/notifications` (sidebar shell, includes the push composer). | Feed components are shared; only the shell and the composer differ. |
| **D-8** | The admin sidebar renders **all eight design nav items**; unbuilt ones (Members, Events, Reports, Settings) are **visible but disabled** with the existing `common.comingSoon` tooltip — the same pattern Phase 2 used for the bell. | `AdminSidebar` gains a `disabled` flag per item. |
| **D-9** | Anonymous submission is **public** (no token required). Rate limits apply to **both** paths: per-IP and per-user. | `POST /anonymous-messages` is in `AUTH_FREE_PREFIXES` on the client and unguarded on the server. |
| **D-10** | Admin push targets **everyone (one broadcast row)** plus an **optional "also send email"** checkbox. No role targeting, no single-user targeting, no scheduling. | `PushNotificationRequest.send_email: bool`. |
| **D-11** | The admin anonymous section is **list + status filter + retry**. No handled flag, no notes. | Three endpoints total for the module. |
| **D-12** | Email is produced only for **admin broadcasts with `send_email=true`** and for **new blog posts**. Attendance and system notifications are in-app only. No preferences table. | No Settings UI in Phase 4. |
| **D-13** | **New post email**: build the `blog.post_published` **consumer** now with a unit test against a synthetic event. The publisher ships with the blog phase. | `NotificationService.notify_blog_post_published()` exists and is tested but is called by nothing in production code. A `TODO(phase-blog)` marker documents the wiring point. |
| **D-14** | Design copy that promises unbuilt behaviour is **reworded** (§1.5). Everything else ships verbatim in both languages. | Three claims change. |
| **D-15** | A **new `/admin/*` route tree** is introduced and the existing attendance screens **move into it**, with redirects from the old paths. | `common.adminPanel` retargets to `/admin/dashboard`. `src/routes/README.md` updated. |
| **D-16** | RTL fixes cover **the vendored primitives actually rendered plus all app code**, and are locked by a regression test. Unused vendor primitives are out of scope. | Scope list in §3.11. |
| **D-17** | Branding cleanup is the **full token pass plus brand-name unification**. | `--shadow-card`, `card-elevated`, emerald removal, `index.css` de-duplication, Amiri on every verse, one canonical name. |
| **D-18** | Canonical brand name is the **Design-Guide wording**: Arabic `إجتماع الشباب بأبنوب`, English `Marmarkos Abnub`. | `index.html`, `common.brand.name`, both footers and all `alt` text are aligned. |
| **D-19** | Footer: **real social URLs** (supplied by the product owner, see DoR) replace the dead `#` anchors; **phone/email stay placeholders**, moved into i18n. | Blocks P4-309 until the URLs are supplied. |
| **D-20** | Telegram is **one chat, forwarding only**. `TELEGRAM_CHAT_ID` receives anonymous messages; "Admin Telegram notifications" is that same forward, not a second feature. | No `TELEGRAM_ADMIN_CHAT_ID`. No operational alerting over Telegram. |
| **D-21** | Event consumers in scope: **`attendance.recorded`** (notify the member) and **`blog.post_published`** (notify + email). `attendance.excused`, `user.registered`, `user.banned`, `comment.created` get no consumer. | Two consumer methods, one of them dormant per D-13. |
| **D-22** | Rate limits: **5 messages/hour per IP** and **10/day per authenticated user**, **in-memory** (per instance, reset on restart). | New `app/core/rate_limit/`. Documented limitation in R-3. |
| **D-23** | The baseline test suite is repaired **first**, as a prerequisite stage (DEF-0). | Stage 0 blocks everything else. |

Decisions taken by the implementer under §0.4 autonomy (minor, non-business):

| # | Decision | Rationale |
| --- | --- | --- |
| **D-24** | The design's "Filter ▾" control is a **time-range filter** (All time / Today / Last 7 days / Last 30 days) mapping to a `since` query param. | The tabs already filter by type and read state; a second type filter would be redundant. |
| **D-25** | Notification page size is **20** (`NOTIFICATIONS_PAGE_SIZE`), max 100, matching the attendance history convention. | Consistency with `ATTENDANCE_HISTORY_PAGE_SIZE`. |
| **D-26** | The "New" pill is shown when a notification is **unread and younger than 24 hours**. | The design shows it on the newest row only; this is the smallest rule that reproduces it. |
| **D-27** | Notification retention/purging is out of scope. | Not requested; no volume problem at MVP scale. |

## 1.3 New business rules

| # | Rule | Rationale |
| --- | --- | --- |
| **BR-1** | A user's feed is `notifications WHERE user_id = me OR user_id IS NULL`, ordered `created_at DESC`, paginated. | Existing repository contract, preserved. |
| **BR-2** | A notification is **read for a user** iff a `notification_reads` row exists for `(notification_id, user_id)`. Unread count = feed size minus read rows. Marking a broadcast read affects **only the acting user**. | Fixes DEF-1. |
| **BR-3** | `mark_read` is **idempotent**: a second call for the same pair is a no-op returning 200 (`ON CONFLICT DO NOTHING`). | The list UI marks rows read on interaction; double-fires must not 409. |
| **BR-4** | `mark_all_read` inserts read rows for **every currently visible unread notification** of the acting user, ignoring the active tab and filter. It returns the number of rows created. | The design's control says "Mark all as read", not "mark this tab read". |
| **BR-5** | Every notification carries **both languages**, both non-empty. A notification cannot be created with only one language. | D-6. Enforced by `NOT NULL` columns and DTO validation. |
| **BR-6** | Only **ADMIN** may push a broadcast. SERVANT and MEMBER receive 403. Every push writes an `audit_logs` row (`action="notification.push"`). | Consistent with Phase 2's D-6 (admin-only mutations are audited). |
| **BR-7** | Reading and mutating **one's own** notifications requires only authentication (MEMBER, SERVANT, ADMIN). A user can never read or mark another user's notification; `mark_read` for a foreign per-user notification returns 404, not 403. | Not-found is the correct answer for a resource the caller cannot see. |
| **BR-8** | When `send_email=true`, email is fanned out **inline, after the notification row is committed**, to every user whose `status = ACTIVE` **and** `email_verified = true`. Failures are counted and reported, never raised: the notification stays created. | Reuses the existing "commit first, then mail" rule from `auth_service.py`. |
| **BR-9** | A blog post publication creates **one broadcast notification** of type `BLOG_POST` and, per D-12, an email fan-out under the same rules as BR-8. | D-13, D-21. |
| **BR-10** | A recorded attendance creates **one per-user notification** of type `ATTENDANCE` for the attendee, inside the same Unit of Work as the check-in. A notification failure must never abort a check-in that already succeeded. | Check-in is the higher-value transaction. Wrapped and logged, never raised. |
| **BR-11** | An anonymous message row must never contain, and no endpoint may ever return, any value derived from the submitter's account, IP or user agent. `sender_name`/`sender_phone` are **self-declared free text** and are the only identity-adjacent data permitted. | D-1, security property. |
| **BR-12** | Rate-limit keys are `sha256(pepper + value)` where `value` is the client IP or the user id, held in an in-memory sliding window. The clear value is never stored or logged. | D-9, D-22, BR-11. |
| **BR-13** | Submission persists **first**, then attempts Telegram delivery inline. A delivery failure returns **201 with `status: "FAILED"`**, not an error: the message is safely stored and an admin can retry. The submitter always sees a success state. | D-3. Losing a pastoral-care message is worse than a stale status. |
| **BR-14** | Every delivery attempt increments `attempts` and sets `last_attempt_at`. Retry is **ADMIN-only**, audited (`action="anonymous_message.retry"`), and permitted only for rows whose `telegram_status = FAILED`. | D-11. |
| **BR-15** | Exceeding a rate limit returns **429 `rate_limited`** with a `Retry-After` header. The message is not persisted. | D-22. |
| **BR-16** | The anonymous message form validates: `message` 10–1000 chars after trimming; `sender_name` ≤120 chars; `sender_phone` matches `^[0-9+()\s-]{7,32}$` when present. Client and server enforce the same limits. | Design shows a `0 / 1000` counter. |
| **BR-17** | Both new pages, and every component they use, must render correctly under `dir="rtl"` **and** `dir="ltr"` using logical Tailwind properties only. A regression test enforces this repo-wide for app code. | `Design-Guide.md:466-490`, D-16. |

## 1.4 Design ↔ domain reconciliation

| # | Design shows | Domain / palette says | Resolution |
| --- | --- | --- | --- |
| **DR-1** | Optional Name and Phone on the anonymous form | Table had no identity columns, guaranteed by a test | **Domain changes** (D-1): two nullable columns added, guarantee restated as "no account linkage", test and docs updated. |
| **DR-2** | Tabs `All / Unread / Announcements / Reminders / System` | Enum is `BLOG_POST / ANNOUNCEMENT / ATTENDANCE / SYSTEM` | **Copy changes**: tabs are a presentation grouping over the enum (§3.4). No enum change (D-5). |
| **DR-3** | Feed rows "New Member Joined", "New Message Received", "Congratulations!" | No such notification types and no producers for them | Those rows are **illustrative admin announcements**. They render as `ANNOUNCEMENT` with a `data.icon` override from the allowlist (§3.5). No new producers (D-21). |
| **DR-4** | Purple accent on the "New Message Received" row | `Design-Guide.md:151-241` defines navy/blue/mint/orange/red only, and `§30` forbids inventing colours | **Palette wins**: purple is replaced by `brand-blue`. |
| **DR-5** | Sidebar items Members, Events, Reports, Settings | Those features do not exist | Rendered **disabled** with the `comingSoon` tooltip (D-8). |
| **DR-6** | Pastel circular icon backgrounds | Palette + `§13` (64px circular containers, subtle backgrounds) | Implemented as brand colour at low opacity (`bg-mint/10` etc.), never as new hex values. |
| **DR-7** | "Phone Namber (Optional)" | — | Typo in the design. Ships as **"Phone Number (Optional)"**. |
| **DR-8** | `© 2025 Youth Service Abnub` | Canonical name is `Marmarkos Abnub` / `إجتماع الشباب بأبنوب` (D-18) and the current year is 2026 | Ships as the canonical name with a computed year. |
| **DR-9** | Anonymous page drawn inside an authenticated shell (avatar, bell) | Submission is public (D-9) | The page uses the **public shell** (`Navbar` + brand panel + `Footer`). The avatar/bell area renders the signed-in cluster when a session exists and the login CTA when it does not — which is exactly what `Navbar` already does. |
| **DR-10** | Notification page's left panel merges the brand panel **and** the nav | `AdminSidebar` is a collapsible icon sidebar | `AdminSidebar` gains a brand block in `SidebarHeader` and a user card in `SidebarFooter`, both hidden in `collapsible=icon` state. Structure matches; behaviour stays. |

## 1.5 Copy corrections (D-14)

Three design claims promise behaviour Phase 4 does not build. These are the **only** copy deviations permitted.

| Where | Design copy | Ships as |
| --- | --- | --- |
| Anonymous page, "Important Information" card, 3rd item | EN "Response within 48 hours" / "We aim to respond to your message within 48 hours." · AR "ردود خلال 48 ساعة" / "نسعى للرد على رسالتك والصلاة من أجلك خلال 48 ساعة." | EN "Every message is read" / "Our servants read every message and pray over it." · AR "كل رسالة تُقرأ" / "يقرأ الخدام كل رسالة ويصلّون من أجلها." |
| Notifications page, info card 2 | EN "Never Miss Out" / "Enable push notifications to receive important updates instantly." · AR "لا تفوّت أي شيء" / "فعّل الإشعارات الفورية لتصلك أهم التحديثات لحظة بلحظة." | EN "Never Miss Out" / "Announcements, reminders and events all land here in one place." · AR "لا تفوّت أي شيء" / "الإعلانات والتذكيرات والفعاليات كلها تصلك في مكان واحد." |
| Notifications page, info card 3 | EN "Customize" / "Manage your notification preferences in settings to get what matters to you." · AR "تخصيص الإشعارات" / "إدارة تفضيلات الإشعارات في الإعدادات بما يناسبك." | EN "Filter your view" / "Use the tabs to see announcements, reminders or system notices only." · AR "رتّب إشعاراتك" / "استخدم التصنيفات لعرض الإعلانات أو التذكيرات أو إشعارات النظام وحدها." |

---

# 2. Already Done — Do Not Redo

## 2.1 Backend — shipped and working

| Area | Files | Status |
| --- | --- | --- |
| `notifications` table | `alembic/versions/60db6157691a_initial_full_schema.py` | Migrated at revision 1. Do not re-create. |
| `anonymous_messages` table | same | Migrated at revision 1. Do not re-create. |
| `Notification` model | `app/modules/notifications/infrastructure/persistence/models.py` (46 L) | Keep. Only **add** `title_en`, `message_en` and the `NotificationRead` model. |
| `NotificationType` enum | `app/modules/notifications/domain/enums/notification_type.py` | Frozen at 4 values (D-5). |
| `NotificationRepository` | `.../persistence/notification_repository.py` (73 L) | `add`/`create`/`list_for_user`/`count_unread` are the base; `mark_read` is rewritten (DEF-1). |
| `AnonymousMessage` model + repo | `app/modules/anonymous_messages/infrastructure/persistence/{models,anonymous_message_repository}.py` | Keep. `claim_pending` stays for a future worker but is **unused** in Phase 4 (D-3). |
| Bilingual email stack | `app/modules/notifications/infrastructure/email/{sender,templates,messages,service}.py` | **Complete. Do not rewrite.** `notification_email(title_ar, title_en, message_ar, message_en, cta_label, cta_url)` already has exactly the signature Phase 4 needs. Providers: Brevo / Gmail SMTP / console, selected by `MAIL_PROVIDER`. |
| Unit of Work | `app/shared/infrastructure/persistence/unit_of_work.py:168-174` | `uow.notifications` and `uow.anonymous_messages` are already wired. Add `uow.notification_reads`. |
| Audit log | `app/modules/admin/infrastructure/persistence/audit_log_repository.py` | Use `uow.audit.record(...)` for pushes and retries. Do not build a second audit mechanism. |
| Pagination envelope | `app/core/pagination/__init__.py` (50 L) | `PageParams` + `Page[T].build()` exist and are **unused**. Phase 4 is their first consumer — use them, do not hand-roll. |
| Error envelope | `app/core/exceptions/{errors,handlers}.py` | `{"detail": {"code", "message"}}`. Add exactly one new error class (§3.6). |
| Role guard | `app/modules/auth/presentation/dependencies.py` | `get_current_user`, `require_role(*RoleName)`. Do not invent a permission system. |
| Clock | `app/core/time/clock.py` | `now_utc()` is mandatory. `datetime.now()` outside this module is a defect. |
| Telegram config | `app/config.py:25-26` | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` already declared and documented in `.env.example`. |
| Outbox | `app/shared/infrastructure/persistence/outbox.py` | Keeps recording domain events as the event log. Phase 4 adds **no** consumer loop (D-3). |

## 2.2 Frontend — shipped and working

| Area | Files | Status |
| --- | --- | --- |
| Brand tokens | `frontend/src/index.css:145-192` | `navy`, `brand-blue`, `mint`, `brand-orange`, `brand-red`, `soft`, `ink`, `font-sans/heading/arabic/verse` all exist. **Do not add new colours.** |
| i18n runtime | `frontend/src/i18n/{index.ts,LanguageProvider.tsx,context.ts}` | `lng: "ar"`, typed resources, `localStorage["marmarkos.lang"]`, `document.dir`/`lang` applied, pre-paint script in `index.html:20-32`. Do not touch the mechanism; only add namespaces. |
| shadcn primitives | `frontend/src/components/ui/*` (45 files) | `tabs.tsx`, `pagination.tsx`, `dropdown-menu.tsx`, `dialog.tsx`, `skeleton.tsx`, `badge.tsx`, `sonner.tsx`, `sidebar.tsx` all exist. **Use them** — `tabs` and `pagination` are currently unused and Phase 4 is their first consumer. |
| API client | `frontend/src/lib/api.ts` | axios instance, bearer interceptor, `AUTH_FREE_PREFIXES`, `ApiError`, `getApiErrorMessage`. Extend, do not replace. |
| Auth helpers | `frontend/src/lib/auth.ts` | `getAccessToken`, `getAuthUser`, `getUserRole`, `hasAnyRole`, `isAttendanceManager`. |
| Guards | `frontend/src/components/common/{RequireAuth,RequireRole}.tsx` | Reuse as-is. |
| Layouts | `frontend/src/layouts/{AdminLayout,AttendanceLayout}.tsx`, `frontend/src/components/layout/{AdminSidebar,AdminTopbar,Navbar,Footer}.tsx` | Reuse and extend. `AdminTopbar` already accepts `title`/`subtitle`/`backHref`. |
| Brand panel | `frontend/src/pages/auth/components/BrandPanel.tsx` | Already renders the exact left panel in both designs (logo box, FAITH/FRIENDS/PURPOSE, supporting text, illustration, verse + mint reference) and already uses logical properties. **Reuse it. Do not redraw it.** |
| Module API pattern | `frontend/src/modules/attendance/api/{index.ts,queryKeys.ts}` | The pattern every new module copies. |
| Query defaults | `frontend/src/providers/AppProviders.tsx` | `staleTime: 60_000`, `retry: 1`, direction-aware `Toaster` at `top-center`. |
| Test harness | `frontend/vitest.config.ts`, `frontend/src/test/setup.ts`, `frontend/src/layouts/__tests__/layouts.test.tsx` | `renderWithProviders` pattern, Arabic assertions, `matchMedia` stub. Copy the convention. |

## 2.3 Known defects this plan fixes

| # | Defect | Evidence | Fixed by |
| --- | --- | --- | --- |
| **DEF-0** | `tests/utils.py` never sets `email_verified`, but `AuthenticationService.login` raises `EmailNotVerifiedError` for unverified accounts, so several existing auth/user tests fail. Nothing stubs `EmailService`, so registration tests attempt a real Gmail SMTP connection. | `backend/tests/utils.py`, `app/modules/auth/application/services/auth_service.py:147-148`, commits `7a71617`/`89df5a5` | P4-001, P4-002 |
| **DEF-1** | `NotificationRepository.mark_read` matches `user_id IS NULL`, so marking a broadcast read marks it read **for every user**, and `count_unread` is wrong for everyone. | `notification_repository.py:62-73` | P4-102, P4-103 |
| **DEF-2** | `mark_read` and `AnonymousMessageRepository.mark_sent` use naked `datetime.now()` (naive, server-local) instead of `app.core.time.now_utc()`, which the clock module bans elsewhere. | `notification_repository.py:72`, `anonymous_message_repository.py:49` | P4-103, P4-203 |
| **DEF-3** | The `AdminTopbar` bell is a permanently disabled placeholder with no badge. | `AdminTopbar.tsx:109-118` | P4-401 |
| **DEF-4** | The `Navbar` bell links to a placeholder page and has no unread badge. | `Navbar.tsx:142-148`, `router.tsx:154-162` | P4-401, P4-501 |
| **DEF-5** | `Navbar.tsx:152` and `:237` use `ml-1` while `:160` uses `ms-1` — the file is internally inconsistent and breaks in RTL. | `Navbar.tsx` | P4-303 |
| **DEF-6** | `dropdown-menu.tsx` (rendered by both topbars) uses `pl-8 pr-2`, `left-2`, `ml-auto`; `dialog.tsx`/`sheet.tsx` close buttons use `right-4`; `input-otp.tsx` uses `border-r` + `rounded-l/r` on the attendance PIN; `sidebar.tsx` has unguarded `right-3`, `text-left`, `pr-8`, `border-l`. | `frontend/src/components/ui/*` | P4-302 |
| **DEF-7** | `BibleVerse.tsx:44` uses `text-right`; `Pillars.tsx:46` uses `lg:border-l`. | landing sections | P4-303 |
| **DEF-8** | `shadow-[0_2px_24px_rgba(37,61,99,0.08)]` — the navy brand colour as a raw rgba — is copy-pasted in 13 files, in three slightly different variants. | see §3.11 | P4-304 |
| **DEF-9** | `text-emerald-700` (Tailwind's palette, not the brand's) in `AttendanceStatusBadge.tsx:9` and `AttendancePinCard.tsx:115`. | — | P4-304 |
| **DEF-10** | `index.css` declares `:root` twice, `.dark` twice and `@theme inline` three times, with `--chart-*` defined in three places; `btn-primary`/`btn-outline` contain raw hex (`#1c3050`, `#fff`, `#0f1929`, `#46b78c`). | `index.css` | P4-305 |
| **DEF-11** | Amiri (`font-verse`) is used in exactly one place (`BrandPanel.tsx:133`) although `Design-Guide.md:318-336` requires it for **every** scripture quotation; `landing.bibleVerse` renders without it. | — | P4-306 |
| **DEF-12** | Four different brand names are in use: `index.html` (`إجتماع الشباب بأبنوب \| Youth Service`), `common.brand.name` (`إجتماع الشباب`), `landing.footer` (`خدمة الشباب`), `Footer.tsx:53` (hardcoded `إجتماع الشباب بأبنوب`, outside i18n). `alt` texts are hardcoded although `common.brand.logoAlt` exists. | — | P4-307 |
| **DEF-13** | `Footer.tsx` hardcodes `+20 123 456 7890` and `youth@churchname.org`, and every footer link is a dead `#` anchor. | `Footer.tsx` | P4-309 |
| **DEF-14** | `PlaceholderPage.tsx:46-48` hardcodes Arabic and English copy inline instead of using i18n. | — | P4-308 |
| **DEF-15** | `components.json` points `tailwind.css` at `src/styles.css`, which does not exist (the real file is `src/index.css`), so shadcn CLI additions misfire. | `frontend/components.json` | P4-301 |
| **DEF-16** | There is no `useAuth`/user context: `Navbar` and `AdminTopbar` read `localStorage` on every render. A login/logout that does not remount them leaves the bell and its badge stale. | `Navbar.tsx:61` | P4-402 (scoped: a query-invalidation hook, **not** a new auth context) |

---

# 3. Frozen Contracts

## 3.1 Settings (`backend/app/config.py`)

Append after the Phase 2 attendance block, with a `# -- Notifications & anonymous messages (Phase 4) --` header. Every one must also be added to `backend/.env.example` with its default.

```python
# Notifications
NOTIFICATIONS_PAGE_SIZE: int = 20
NOTIFICATIONS_MAX_PAGE_SIZE: int = 100
NOTIFICATION_EMAIL_CONCURRENCY: int = 10      # simultaneous inline sends during fan-out

# Anonymous messages
ANONYMOUS_MESSAGE_MIN_LENGTH: int = 10
ANONYMOUS_MESSAGE_MAX_LENGTH: int = 1000
ANONYMOUS_MESSAGE_RATE_LIMIT_PER_IP: int = 5          # per hour   (BR-15, D-22)
ANONYMOUS_MESSAGE_RATE_LIMIT_PER_USER: int = 10       # per day    (BR-15, D-22)
TELEGRAM_TIMEOUT_SECONDS: float = 15.0
TELEGRAM_SEND_ATTEMPTS: int = 2                       # inline attempts within one request
TRUST_PROXY_HEADERS: bool = False                     # read X-Forwarded-For first hop
```

Also add the two vars `.env.example` is missing today: `GOOGLE_CLIENT_SECRET`, `FRONTEND_URL`.

## 3.2 Target database schema

One migration. Revision `e3b7d1c95f42`, down-revision `f8a2c4e61b90` (current head).

```text
notifications                          (EXISTING — two columns added)
├── id                UUID PK
├── user_id           UUID FK users.id ON DELETE CASCADE, NULL = broadcast
├── type              VARCHAR(30)  BLOG_POST|ANNOUNCEMENT|ATTENDANCE|SYSTEM
├── title             VARCHAR(255) NOT NULL   ← Arabic copy (default language)
├── message           TEXT         NOT NULL   ← Arabic copy
├── title_en          VARCHAR(255) NOT NULL   ← NEW  (add nullable → backfill from title → SET NOT NULL)
├── message_en        TEXT         NOT NULL   ← NEW  (add nullable → backfill from message → SET NOT NULL)
├── data              JSONB NULL
├── read_at           TIMESTAMPTZ NULL        ← LEGACY. Never written or read again (D-2).
└── created_at        TIMESTAMPTZ NOT NULL
    ix_notifications_user_created (user_id, created_at)      [existing]
    ix_notifications_created_at   (created_at)               [NEW — feed ordering for broadcasts]

notification_reads                     (NEW)
├── notification_id   UUID FK notifications.id ON DELETE CASCADE   ┐ composite PK
├── user_id           UUID FK users.id      ON DELETE CASCADE      ┘
└── read_at           TIMESTAMPTZ NOT NULL server_default now()
    ix_notification_reads_user (user_id)

anonymous_messages                     (EXISTING — four columns added)
├── id                UUID PK
├── message           TEXT NOT NULL
├── sender_name       VARCHAR(120) NULL     ← NEW, self-declared, never account-derived
├── sender_phone      VARCHAR(32)  NULL     ← NEW, self-declared, never account-derived
├── status            VARCHAR(20) PENDING|SENT|FAILED
├── telegram_status   VARCHAR(20) PENDING|SENT|FAILED
├── telegram_message_id VARCHAR(100) NULL
├── attempts          INTEGER NOT NULL server_default '0'   ← NEW
├── last_attempt_at   TIMESTAMPTZ NULL                      ← NEW
├── created_at        TIMESTAMPTZ NOT NULL
├── sent_at           TIMESTAMPTZ NULL
└── failure_reason    TEXT NULL
    ix_anonymous_messages_status_created (status, created_at)   [existing]
```

`downgrade()` must drop `notification_reads` and the six added columns. No table is ever dropped.

## 3.3 Module signatures

```python
# app/modules/notifications/application/services/notification_service.py
class NotificationService:
    def __init__(self, uow: UnitOfWork, email: EmailService | None = None) -> None: ...

    async def create_for_user(self, *, user_id: UUID, type: NotificationType,
                              copy: NotificationCopy, data: dict | None = None) -> Notification: ...
    async def create_broadcast(self, *, type: NotificationType, copy: NotificationCopy,
                               data: dict | None = None) -> Notification: ...
    async def push_announcement(self, *, actor: User, request: PushNotificationRequest
                                ) -> PushNotificationResponse: ...      # BR-6, BR-8
    async def notify_attendance_recorded(self, *, user_id: UUID, meeting_date: date,
                                         status: AttendanceStatus) -> None: ...   # BR-10
    async def notify_blog_post_published(self, *, post_id: UUID, slug: str,
                                         title_ar: str, title_en: str) -> None: ...  # BR-9, dormant
    async def email_fan_out(self, *, copy: NotificationCopy, cta_url: str | None
                            ) -> tuple[int, int]: ...                   # (sent, failed)

# app/modules/notifications/application/copy.py
@dataclass(frozen=True)
class NotificationCopy:
    title_ar: str
    title_en: str
    message_ar: str
    message_en: str

def attendance_recorded_copy(*, meeting_date: date, status: AttendanceStatus) -> NotificationCopy: ...
def blog_post_published_copy(*, title_ar: str, title_en: str) -> NotificationCopy: ...

# app/modules/anonymous_messages/application/services/anonymous_message_service.py
class AnonymousMessageService:
    def __init__(self, uow: UnitOfWork, telegram: TelegramClient | None = None) -> None: ...
    async def submit(self, request: AnonymousMessageCreateRequest
                     ) -> AnonymousMessageCreateResponse: ...      # BR-13
    async def retry(self, *, message_id: UUID, actor: User) -> AnonymousMessageAdminResponse: ...  # BR-14
    async def list_messages(self, *, params: PageParams, status: MessageStatus | None
                            ) -> Page[AnonymousMessageAdminResponse]: ...

# app/modules/anonymous_messages/infrastructure/telegram/client.py
class TelegramClient(Protocol):
    async def send_message(self, text: str) -> str | None: ...   # returns telegram message_id
class HttpTelegramClient:  ...     # httpx, api.telegram.org/bot{token}/sendMessage, parse_mode=HTML
class LoggingTelegramClient: ...   # used when the token/chat id are absent (dev + tests)
def get_telegram_client() -> TelegramClient: ...

# app/core/rate_limit/__init__.py
class SlidingWindowRateLimiter:
    def __init__(self, *, limit: int, window_seconds: int) -> None: ...
    def hit(self, key: str) -> None: ...   # raises RateLimitedError(retry_after=…) when exceeded
def hash_key(value: str) -> str: ...       # sha256(JWT_SECRET + value), BR-12
```

## 3.4 Tab mapping (frozen)

`NotificationTab` (`app/modules/notifications/domain/enums/notification_tab.py`):

| Tab value | Filter | Design label EN / AR |
| --- | --- | --- |
| `all` | no filter | All / الكل |
| `unread` | no read row for the caller | Unread / غير المقروءة |
| `announcements` | `type IN (ANNOUNCEMENT, BLOG_POST)` | Announcements / الإعلانات |
| `reminders` | `type = ATTENDANCE` | Reminders / التذكيرات |
| `system` | `type = SYSTEM` | System / النظام |

## 3.5 Type → icon and accent (frozen)

| `type` | Lucide icon | Accent token | Circle background |
| --- | --- | --- | --- |
| `ANNOUNCEMENT` | `Megaphone` | `mint` | `bg-mint/10` |
| `BLOG_POST` | `BookOpen` | `brand-blue` | `bg-brand-blue/10` |
| `ATTENDANCE` | `CalendarCheck` | `brand-orange` | `bg-brand-orange/10` |
| `SYSTEM` | `ShieldAlert` | `brand-red` | `bg-brand-red/10` |

`data.icon` may override the glyph **within the same accent**, restricted to this allowlist:
`Megaphone, BookOpen, CalendarCheck, ShieldAlert, Bell, Users, MessageSquare, Trophy, Heart, Clock`.
Any other value falls back to the type's default icon. No arbitrary strings reach the DOM.

## 3.6 API surface

All paths are prefixed `/api/v1`. `[A]` = ADMIN, `[S]` = SERVANT, `[M]` = MEMBER, `[-]` = anonymous.

| Method | Path | `-` | M | S | A | Purpose |
| --- | --- | :-: | :-: | :-: | :-: | --- |
| GET | `/notifications` | ✗ | ✓ | ✓ | ✓ | Feed. `?tab=&page=&size=&since=` → `Page[NotificationResponse]` |
| GET | `/notifications/summary` | ✗ | ✓ | ✓ | ✓ | `NotificationSummaryResponse` — bell badge + tab counts |
| POST | `/notifications/{id}/read` | ✗ | ✓ | ✓ | ✓ | Idempotent (BR-3) → `MarkReadResponse` |
| POST | `/notifications/read-all` | ✗ | ✓ | ✓ | ✓ | BR-4 → `MarkReadResponse{marked}` |
| POST | `/notifications/push` | ✗ | ✗ | ✗ | ✓ | BR-6, BR-8 → `PushNotificationResponse` |
| POST | `/anonymous-messages` | ✓ | ✓ | ✓ | ✓ | BR-13, BR-15 → 201 `AnonymousMessageCreateResponse` |
| GET | `/anonymous-messages` | ✗ | ✗ | ✗ | ✓ | `?status=&page=&size=` → `Page[AnonymousMessageAdminResponse]` |
| POST | `/anonymous-messages/{id}/retry` | ✗ | ✗ | ✗ | ✓ | BR-14 → `AnonymousMessageAdminResponse` |

Routers are owned by their own modules (`modules/<m>/presentation/router.py`) and mounted in
`app/api/v1/router.py`. **No `admin` module router is created** — admin-only routes live in the
module that owns the data, guarded by `require_role(RoleName.ADMIN)`, exactly as Phase 2 did.

Error codes used: `unauthorized` 401, `forbidden` 403, `not_found` 404, `validation_error` 422,
plus **one new class**:

```python
# app/core/exceptions/errors.py
class RateLimitedError(AppError):
    status_code = 429
    code = "rate_limited"
    message = "Too many messages. Please try again later"
    def __init__(self, message: str | None = None, *, retry_after: int = 60) -> None: ...
```

`app/core/exceptions/handlers.py` gains one behaviour: when the error exposes `retry_after`,
the response carries a `Retry-After` header. Nothing else about the envelope changes.

## 3.7 DTOs (field names frozen)

```python
# notifications/application/dto/
class NotificationResponse(BaseModel):
    id: UUID
    type: str                  # NotificationType value
    title_ar: str              # ← notifications.title
    title_en: str
    message_ar: str            # ← notifications.message
    message_en: str
    data: dict[str, Any] | None
    is_read: bool
    is_broadcast: bool
    created_at: datetime

class NotificationTabCounts(BaseModel):
    all: int
    unread: int
    announcements: int
    reminders: int
    system: int

class NotificationSummaryResponse(BaseModel):
    unread_count: int
    tab_counts: NotificationTabCounts

class MarkReadResponse(BaseModel):
    marked: int

class PushNotificationRequest(BaseModel):
    title_ar: str    = Field(min_length=3,  max_length=255)
    title_en: str    = Field(min_length=3,  max_length=255)
    message_ar: str  = Field(min_length=3,  max_length=2000)
    message_en: str  = Field(min_length=3,  max_length=2000)
    cta_url: str | None = Field(default=None, max_length=500)
    send_email: bool = False

class PushNotificationResponse(BaseModel):
    notification_id: UUID
    recipients: int          # users the email fan-out targeted (0 when send_email is false)
    emails_sent: int
    emails_failed: int

# anonymous_messages/application/dto/
class AnonymousMessageCreateRequest(BaseModel):
    message: str = Field(min_length=10, max_length=1000)
    sender_name: str | None  = Field(default=None, max_length=120)
    sender_phone: str | None = Field(default=None, max_length=32,
                                    pattern=r"^[0-9+()\s-]{7,32}$")

class AnonymousMessageCreateResponse(BaseModel):
    id: UUID
    status: str              # MessageStatus value — FAILED still means "safely stored" (BR-13)
    delivered: bool

class AnonymousMessageAdminResponse(BaseModel):
    id: UUID
    message: str
    sender_name: str | None
    sender_phone: str | None
    status: str
    telegram_status: str
    telegram_message_id: str | None
    attempts: int
    failure_reason: str | None
    created_at: datetime
    sent_at: datetime | None
    last_attempt_at: datetime | None
```

`AnonymousMessageAdminResponse` must never gain a user, IP or session field (BR-11).

## 3.8 Frontend routes (after Phase 4)

```text
/                                 LandingPage                    public
/anonymous-messages               AnonymousMessagePage           public          ← replaces placeholder
/notifications                    NotificationsPage              RequireAuth     ← replaces placeholder
/admin                            → Navigate /admin/dashboard    RequireRole[A,S]
/admin/dashboard                  AttendanceDashboardPage        RequireRole[A,S]  AdminLayout   (moved)
/admin/attendance/check-in        CheckInPage                    RequireRole[A,S]  AttendanceLayout (moved)
/admin/attendance/history         AttendanceHistoryPage          RequireRole[A,S]  AdminLayout   (moved)
/admin/notifications              AdminNotificationsPage         RequireRole[A,S]  AdminLayout   (new)
/admin/anonymous-messages         AdminAnonymousMessagesPage     RequireRole[A]    AdminLayout   (new)

/attendance                       → Navigate /admin/attendance/check-in   (legacy redirect)
/attendance/check-in              → Navigate /admin/attendance/check-in   (legacy redirect)
/attendance/dashboard             → Navigate /admin/dashboard             (legacy redirect)
/attendance/history               → Navigate /admin/attendance/history    (legacy redirect)
```

`common.adminPanel` in both topbars retargets to `/admin/dashboard`. `src/routes/README.md` is
updated in the same task as `router.tsx` — they must never disagree.

## 3.9 React Query keys

```ts
// src/modules/notifications/api/queryKeys.ts
export const notificationKeys = {
  all: ["notifications"] as const,
  summary: () => [...notificationKeys.all, "summary"] as const,
  list: (params: NotificationListParams) => [...notificationKeys.all, "list", params] as const,
};

// src/modules/anonymous-messages/api/queryKeys.ts
export const anonymousMessageKeys = {
  all: ["anonymous-messages"] as const,
  list: (params: AnonymousMessageListParams) => [...anonymousMessageKeys.all, "list", params] as const,
};
```

Every notification mutation invalidates `notificationKeys.all`. The summary query is the only one
with `refetchInterval: 60_000` and `refetchOnWindowFocus: true` (D-4).

## 3.10 i18n — new namespaces

Two new namespaces plus one `admin` namespace for the sidebar. Add to `ar.ts` **first**.
Verbatim bilingual copy is in Part 2 §14.

```text
notifications
├── title, subtitle
├── tabs.{all,unread,announcements,reminders,system}
├── actions.{markAllRead,markRead,filter,retry}
├── filter.{allTime,today,last7,last30}
├── badges.{new,unread}
├── time.{minutesAgo,hoursAgo,yesterdayAt,on}
├── empty.{title,body}
├── error.{title,body}
├── infoCards[4].{title,description}
├── admin.{title,subtitle,composer.*,confirm.*,result.*}
└── toast.{markedAllRead,pushed,pushFailed}

anonymousMessages
├── title, subtitle
├── card.{title,subtitle,secureHighlight}
├── anonymityNotice.{title,body}
├── form.{name,namePlaceholder,nameHint,phone,phonePlaceholder,phoneHint,
│         message,messagePlaceholder,counter,submit,submitting,footnote}
├── validation.{messageRequired,messageMin,messageMax,nameMax,phoneInvalid,rateLimited}
├── topics.{title,items[4]}
├── importantInfo.{title,items[3].{title,description}}
├── beforeYouSend.{title,items[4]}
├── success.{title,body,sendAnother}
└── admin.{title,subtitle,filters.*,table.*,status.*,empty.*,retry.*}

admin
└── nav.{section,dashboard,members,attendance,checkIn,history,events,messages,
        notifications,reports,settings}
```

Rules: never concatenate translated fragments; counts use i18next interpolation
(`"unreadCount": "{{count}} غير مقروءة"`); a parity test asserts the recursive key sets of
`ar.ts` and `en.ts` are identical.

## 3.11 Design tokens and the RTL/branding fix scope

New tokens in `frontend/src/index.css` (no new colours — D-17):

```css
:root {
  --shadow-card: 0 2px 24px rgba(37, 61, 99, 0.08);
  --shadow-card-strong: 0 2px 18px rgba(37, 61, 99, 0.12);
}
@utility card-elevated { box-shadow: var(--shadow-card); }
```

**RTL fix scope (D-16) — exactly these files:**

| Group | Files |
| --- | --- |
| Rendered primitives | `ui/dropdown-menu.tsx`, `ui/sidebar.tsx`, `ui/dialog.tsx`, `ui/sheet.tsx`, `ui/select.tsx`, `ui/calendar.tsx`, `ui/input-otp.tsx`, `ui/pagination.tsx`, `ui/alert-dialog.tsx`, `ui/accordion.tsx`, `ui/scroll-area.tsx`, `ui/table.tsx` (verify only), `ui/command.tsx` |
| App code | `layout/Navbar.tsx`, `landing/sections/BibleVerse.tsx`, `landing/sections/Pillars.tsx`, `modules/attendance/components/ScannerFrame.tsx` |
| Deliberately untouched | `landing/sections/{About,Hero}.tsx` decorative `right-[…]` offsets (they must **not** mirror), `ui/{context-menu,menubar,navigation-menu,carousel,resizable,chart}.tsx` (not rendered anywhere) |

Conversion table: `ml-`→`ms-`, `mr-`→`me-`, `pl-`→`ps-`, `pr-`→`pe-`, `left-`→`start-`,
`right-`→`end-`, `text-left`→`text-start`, `text-right`→`text-end`, `border-l`→`border-s`,
`border-r`→`border-e`, `rounded-l-*`→`rounded-s-*`, `rounded-r-*`→`rounded-e-*`,
`space-x-*`→`gap-*`. Directional glyphs use `rtl:rotate-180` or paired `rtl:hidden` /
`hidden rtl:block`, never a mirrored container.

**Branding fix scope (D-17):** the 13 files carrying the hardcoded navy shadow (DEF-8) —
`pages/auth/{login,forgot-password,reset-password}/AuthCard.tsx`,
`pages/auth/register/RegistrationCard.tsx`,
`pages/auth/verify-email/{CheckEmailPage,VerifyEmailResultPage}.tsx`,
`pages/profile/{ProfilePage,AttendancePinCard}.tsx`,
`modules/attendance/pages/{CheckInPage,AttendanceHistoryPage,AttendanceDashboardPage}.tsx`,
`modules/attendance/components/{HistoryFilters,MeetingStatsCard,RecentCheckInsCard}.tsx`,
`pages/auth/components/BrandPanel.tsx`, `components/layout/Navbar.tsx` — plus DEF-9 to DEF-14.

---

Continue in `docs/Agile/phase-4/phase-4-implementation-plan-part-2.md`.
