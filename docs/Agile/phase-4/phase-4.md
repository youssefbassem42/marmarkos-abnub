# Phase 4 — Notifications + Communication

## Sprint 4

### Notifications

```text
Notification entity
Notification service
Notification bell
Unread count
Mark read
Mark all read
Admin Push Notification Section in Admin Panel
```

### Email

```text
Email abstraction
New post email
Notification email
```

### Anonymous bot

```text
Anonymous message entity
Message form
Name Field optinal
Validation
Telegram integration
Admin Telegram notifications
Retry handling
```

### Anonymous Messages Section in Admin Panel

```text
Anonymous Messages Listing GET method
```

---

---

# Delivered in Phase 4

Implementation record: each backlog line mapped to its task id
(`docs/Agile/phase-4/phase-4-implementation-plan{,-part-2}.md`).

## Notifications

| Backlog line | Task(s) | Notes |
| --- | --- | --- |
| Notification entity | P4-101, P4-103 | Bilingual copy columns; `notification_reads` per-user read state (D-2); legacy `read_at` |
| Notification service | P4-104, P4-105 | Push + audit (BR-6), commit-then-email fan-out (BR-8), attendance consumer (BR-10), dormant blog consumer (D-13) |
| Notification bell | P4-401→403 | Live badge via 60s polling (D-4); sign-out cache purge (DEF-16 scoped) |
| Unread count | P4-102, P4-103 | Per-user for every row — broadcast fix locks DEF-1 |
| Mark read / mark all read | P4-102, P4-107 | Idempotent (BR-3); sweeps all visible rows (BR-4) |
| Member notifications page | P4-501→503 | `/notifications`, URL-mirrored tabs/filter/pager |
| Admin notifications page | P4-601 | Shared feed in the sidebar shell |
| Push composer | P4-602, P4-603 | ADMIN-only, bilingual required (BR-5), optional email with confirmation (D-10) |

## Email

| Backlog line | Task(s) | Notes |
| --- | --- | --- |
| Broadcast email fan-out | P4-105 | Inline after commit to ACTIVE + verified users only (BR-8) |
| New post email | P4-105 | **Consumer only** — `notify_blog_post_published` ships tested but dormant behind `TODO(phase-blog)` (D-13); the publisher arrives with the blog phase |

## Anonymous bot

| Backlog line | Task(s) | Notes |
| --- | --- | --- |
| Anonymous message entity | P4-101, P4-203 | Optional self-declared name/phone (D-1); attempt bookkeeping |
| Message form | P4-702, P4-703 | Public page (D-9); BR-16 validation; live counter |
| Validation | P4-204, P4-208 | Same bounds client and server |
| Telegram integration | P4-202, P4-205 | One chat, forward-only (D-20); persist-before-send (BR-13) |
| Retry handling | P4-206, P4-802 | ADMIN-only, audited, FAILED rows only (BR-14) |

## Anonymous Messages Section in Admin Panel

| Backlog line | Task(s) | Notes |
| --- | --- | --- |
| Listing (GET) | P4-206, P4-801 | Status filter + pagination in the URL (D-11) |

## Foundation & hardening

| Area | Task(s) |
| --- | --- |
| Baseline repair | P4-001→003 |
| Migration | P4-101 |
| Rate limiting | P4-201, P4-109 |
| RTL/branding foundation | P4-301→309 (P4-309 blocked on social URLs, D-19) |
| `/admin` route tree + sidebar | P4-310, P4-311 |
| i18n parity guard | P4-901 |
| RTL regression guard | P4-902 |
| Backend hardening | P4-903 (`datetime.now()` purge, mypy blocking in CI) |
