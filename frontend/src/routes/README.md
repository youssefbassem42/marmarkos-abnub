# Routes

The Marmarkos Abnub frontend uses **React Router** (`react-router-dom`).

The router configuration lives in `src/router.tsx` (`createBrowserRouter`).

Page components live in `src/pages/<module>/`.

## Planned public routes

| Path | Page |
| --- | --- |
| `/` | Landing page (`pages/landing/LandingPage.tsx`) |
| `/login`, `/register` | Auth pages |
| `/blog`, `/blog/:slug` | Blog list / post |
| `/profile` | User profile |
| `/attendance` | Attendance |

Admin routes (`/admin/...`) must be protected by authentication/authorization.