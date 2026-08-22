# Routes

The Marmarkos Abnub frontend uses **React Router** (`react-router-dom`).

The router configuration lives in `src/router.tsx` (`createBrowserRouter`).

Page components live in `src/pages/<module>/` and
`src/modules/attendance/pages/`. The three attendance pages are lazy
loaded so `html5-qrcode` / `recharts` stay out of the landing bundle.

## Public routes

| Path | Page |
| --- | --- |
| `/` | Landing page |
| `/login`, `/register`, `/forgot-password`, `/reset-password` | Auth pages |
| `/google/callback` | Google OAuth return |

## Authenticated routes

| Path | Guard | Page |
| --- | --- | --- |
| `/profile` | `RequireAuth` | Profile (+ "My attendance" card) |

## Attendance management — `RequireRole(["ADMIN", "SERVANT"])`

| Path | Layout | Page |
| --- | --- | --- |
| `/attendance/check-in` | `AttendanceLayout` (split, brand panel) | Check-in scanner |
| `/attendance/dashboard` | `AdminLayout` (sidebar) | Attendance dashboard |
| `/attendance/history` | `AdminLayout` | Attendance history + CSV export |

A signed-in **MEMBER** who opens any of the three attendance routes sees
the visible 403 page (`ForbiddenPage`); anonymous visitors are
redirected to `/login` with a `from` state. `/attendance` redirects to
`/attendance/check-in`.

## Planned public routes

| Path | Page |
| --- | --- |
| `/blog`, `/blog/:slug` | Blog list / post |

Admin routes outside attendance must be protected by
authentication/authorization.
