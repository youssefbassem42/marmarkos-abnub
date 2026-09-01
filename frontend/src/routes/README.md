# Frontend Routes

React Router v6 routes for the Marmarkos Abnub platform.  All routes are
rendered inside `<Layout>` (authenticated) or `<PublicLayout>` (guest).

## Route Table

| Path | Component | Access | Description |
|------|-----------|--------|-------------|
| `/` | `HomePage` | Public | Landing page |
| `/login` | `LoginPage` | Public | Email/password + Google login |
| `/register` | `RegisterPage` | Public | New user registration |
| `/verify-email` | `EmailVerificationPage` | Public | Email verification callback |
| `/profile` | `ProfilePage` | Authenticated | User profile (edit name, photo) |
| `/qrcode` | `QrCodePage` | Authenticated | Show personal QR code |
| `/notifications` | `NotificationsPage` | Authenticated | Bell notifications list |
| `/bible-verses` | `BibleVersesPage` | Authenticated | Member verse feed |
| `/bible-verses/:verseId` | `VerseDetailPage` | Authenticated | Verse detail + quiz gate |
| `/quiz/:quizId` | `QuizAttemptPage` | Authenticated | Take a quiz (timer, auto-save) |
| `/quiz/:quizId/result` | `QuizResultPage` | Authenticated | Graded result + review |
| `/points` | `PointsPage` | Authenticated | My points history + chart |
| `/anonymous-messages` | `AnonymousMessagesPage` | Authenticated | Send anonymous message |

### Admin / Manager Routes

| Path | Component | Access | Description |
|------|-----------|--------|-------------|
| `/admin/dashboard` | `AttendanceDashboardPage` | Admin | Dashboard with attendance + engagement tiles |
| `/admin/attendance/check-in` | `CheckInPage` | Admin/Servant | QR scan + manual check-in |
| `/admin/attendance/history` | `AttendanceHistoryPage` | Admin/Servant | Attendance records |
| `/admin/bible-verses` | `BibleManagementPage` | Admin/Servant | Verse list + stats |
| `/admin/bible-verses/new` | `VerseFormPage` | Admin/Servant | Create verse |
| `/admin/bible-verses/:verseId/edit` | `VerseFormPage` | Admin/Servant | Edit verse |
| `/admin/bible-verses/:verseId/schedule` | `VerseSchedulePage` | Admin/Servant | Schedule publication |
| `/admin/quizzes` | `QuizListPage` | Admin/Servant | Quiz list |
| `/admin/quizzes/new` | `QuizManagePage` | Admin/Servant | Create quiz |
| `/admin/quizzes/:quizId` | `QuizBuilderPage` | Admin/Servant | Edit quiz + questions |
| `/admin/quizzes/:quizId/analytics` | `QuizAnalyticsPage` | Admin/Servant | Quiz analytics |
| `/admin/bible-verses/:verseId/analytics` | `VerseAnalyticsPage` | Admin/Servant | Verse analytics |
| `/admin/analytics/verses` | `VerseAnalyticsPage` | Admin/Servant | Verse analytics (overview) |
| `/admin/analytics/quizzes` | `QuizAnalyticsPage` | Admin/Servant | Quiz analytics (overview) |
| `/admin/analytics/monthly` | `MonthlyAnalyticsPage` | Admin/Servant | Monthly analytics |
| `/admin/notifications` | `NotificationsPage` | Admin | Push notification management |
| `/admin/anonymous-messages` | `AnonymousMessagesPage` | Admin | View received anonymous messages |

## Auth Guard

- **Public**: No token required (`LoginPage`, `RegisterPage`, `EmailVerificationPage`, `HomePage`)
- **Authenticated**: Any valid token
- **Admin/Servant**: Requires `ADMIN` or `SERVANT` role (checked by `RequireRole` component)
- **Admin only**: Requires `ADMIN` role

## Navigation

Admin routes are accessible via the collapsible sidebar (`AdminSidebar`).
The sidebar groups routes under: Attendance, Bible Verses, Quizzes,
Notifications, Reports/Analytics.

## Adding a New Route

1. Create the page component in `src/modules/<module>/pages/`
2. Export it from the module's `pages/index.ts`
3. Add the route to `src/routes/index.tsx` under the appropriate layout
4. Add the i18n key to `src/i18n/resources/ar.ts`
5. Add the sidebar link in `AdminSidebar.tsx` if it's an admin route
