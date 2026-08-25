# Routes

The Marmarkos Abnub frontend uses **React Router** (`react-router-dom`).

The router configuration lives in `src/router.tsx` (`createBrowserRouter`).

Page components live in `src/pages/<module>/` and
`src/modules/{attendance,notifications,anonymous-messages}/pages/`.
Heavy pages (attendance, notifications, anonymous messages) are lazy
loaded so `html5-qrcode` / `recharts` stay out of the landing bundle.

## Public routes

| Path | Page |
| --- | --- |
| `/` | Landing page |
| `/login`, `/register`, `/forgot-password`, `/reset-password` | Auth pages |
| `/google/callback` | Google OAuth return |
| `/anonymous-messages` | Anonymous message form (public by design, D-9) |

## Authenticated routes

| Path | Guard | Page |
| --- | --- | --- |
| `/profile` | `RequireAuth` | Profile (+ "My attendance" card) |
| `/notifications` | `RequireAuth` | Member notification feed |

## Admin section — `/admin/*`, `RequireRole(["ADMIN", "SERVANT"])`

| Path | Layout | Page |
| --- | --- | --- |
| `/admin` | — | Redirects to `/admin/dashboard` |
| `/admin/dashboard` | `AdminLayout` (sidebar) | Attendance dashboard |
| `/admin/attendance/check-in` | `AttendanceLayout` (split, brand panel) | Check-in scanner |
| `/admin/attendance/history` | `AdminLayout` | Attendance history + CSV export |
| `/admin/notifications` | `AdminLayout` | Notification feed + admin push composer |
| `/admin/anonymous-messages` | `AdminLayout`, nested `RequireRole(["ADMIN"])` | Anonymous messages review |

A signed-in **MEMBER** who opens any `/admin/*` route sees the visible
403 page (`ForbiddenPage`); anonymous visitors are redirected to
`/login` with a `from` state. **SERVANT** gets the same 403 page on
`/admin/anonymous-messages` only.

Legacy bookmarks keep working via `Navigate … replace` redirects:

| Old path | New path |
| --- | --- |
| `/attendance` | `/admin/attendance/check-in` |
| `/attendance/check-in` | `/admin/attendance/check-in` |
| `/attendance/dashboard` | `/admin/dashboard` |
| `/attendance/history` | `/admin/attendance/history` |

## Planned public routes

| Path | Page |
| --- | --- |
| `/blog`, `/blog/:slug` | Blog list / post |
