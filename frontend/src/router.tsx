import { lazy, Suspense, useEffect, type ComponentType } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { LandingPage } from "@/pages/landing/LandingPage";
import { RegisterPage } from "@/pages/auth/register/RegisterPage";
import { LoginPage } from "@/pages/auth/login/LoginPage";
import { ForgotPasswordPage } from "@/pages/auth/forgot-password/ForgotPasswordPage";
import { ResetPasswordPage } from "@/pages/auth/reset-password/ResetPasswordPage";
import { CheckEmailPage } from "@/pages/auth/verify-email/CheckEmailPage";
import { VerifyEmailResultPage } from "@/pages/auth/verify-email/VerifyEmailResultPage";
import { GoogleCallbackPage } from "@/pages/auth/google-callback/GoogleCallbackPage";
import { ProfilePage } from "@/pages/profile/ProfilePage";
import { PlaceholderPage } from "@/pages/placeholder/PlaceholderPage";
import { AboutUsPage } from "@/pages/about/AboutUsPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { ForbiddenPage } from "@/pages/ForbiddenPage";
import { RequireAuth } from "@/components/common/RequireAuth";
import { RequireRole } from "@/components/common/RequireRole";
import { AttendanceLayout } from "@/layouts/AttendanceLayout";
import { AdminLayout } from "@/layouts/AdminLayout";
import { PageSkeleton } from "@/components/common/PageSkeleton";

// Code-split chunk loader that survives redeploys.
//
// A browser tab that was opened before a deploy keeps the OLD index.js
// manifest, which references chunk file names that the new deploy has
// purged. Requesting them returns the SPA fallback (text/html) instead of
// JS, so `import()` rejects and the whole route crashes with
// "Failed to fetch dynamically imported module". This used to surface as
// a broken blank page on every redeploy for anyone with a stale tab.
//
// The fix: on the first import failure, force one full page reload so the
// browser revalidates index.html (Cache-Control: must-revalidate) and
// picks up the CURRENT manifest, whose chunks are guaranteed to exist.
// `reloadedChunkOnce` only lives for the page's lifetime, so a genuine
// second failure (broken server, truly missing chunk) falls through to
// the router's error boundary instead of reload-looping.
let revalidatedChunkManifest = false;

function lazyWithRetry<T extends ComponentType>(
  factory: () => Promise<{ default: T }>,
) {
  const loadModule = () =>
    factory().catch((error) => {
      if (!revalidatedChunkManifest) {
        revalidatedChunkManifest = true;
        window.location.assign(
          window.location.pathname +
            window.location.search +
            window.location.hash,
        );
      }
      return Promise.reject(error) as never;
    });

  return lazy(loadModule);
}

// The attendance pages pull in html5-qrcode and recharts; they must
// never enter the landing-page bundle.
const CheckInPage = lazyWithRetry(() =>
  import("@/modules/attendance/pages/CheckInPage").then((m) => ({
    default: m.CheckInPage,
  })),
);
const AttendanceDashboardPage = lazyWithRetry(() =>
  import("@/modules/attendance/pages/AttendanceDashboardPage").then((m) => ({
    default: m.AttendanceDashboardPage,
  })),
);
const AttendanceHistoryPage = lazyWithRetry(() =>
  import("@/modules/attendance/pages/AttendanceHistoryPage").then((m) => ({
    default: m.AttendanceHistoryPage,
  })),
);
const AbsentUsersPage = lazyWithRetry(() =>
  import("@/modules/attendance/pages/AbsentUsersPage").then((m) => ({
    default: m.AbsentUsersPage,
  })),
);
const UsersAdminPage = lazyWithRetry(() =>
  import("@/modules/users/pages/UsersAdminPage").then((m) => ({
    default: m.UsersAdminPage,
  })),
);

const NotificationsPage = lazyWithRetry(() =>
  import("@/modules/notifications/pages/NotificationsPage").then((m) => ({
    default: m.NotificationsPage,
  })),
);
const AdminNotificationsPage = lazyWithRetry(() =>
  import("@/modules/notifications/pages/AdminNotificationsPage").then((m) => ({
    default: m.AdminNotificationsPage,
  })),
);
const AnonymousMessagePage = lazyWithRetry(() =>
  import("@/modules/anonymous-messages/pages/AnonymousMessagePage").then(
    (m) => ({
      default: m.AnonymousMessagePage,
    }),
  ),
);
const AdminAnonymousMessagesPage = lazyWithRetry(() =>
  import("@/modules/anonymous-messages/pages/AdminAnonymousMessagesPage").then(
    (m) => ({ default: m.AdminAnonymousMessagesPage }),
  ),
);

// Bible module
const BibleVersesPage = lazyWithRetry(
  () => import("@/modules/bible/pages/BibleVersesPage"),
);
const VerseDetailPage = lazyWithRetry(
  () => import("@/modules/bible/pages/VerseDetailPage"),
);
const BibleManagementPage = lazyWithRetry(
  () => import("@/modules/bible/pages/admin/BibleManagementPage"),
);
const VerseFormPage = lazyWithRetry(
  () => import("@/modules/bible/pages/admin/VerseFormPage"),
);
const VerseSchedulePage = lazyWithRetry(
  () => import("@/modules/bible/pages/admin/VerseSchedulePage"),
);
const VerseAnalyticsPage = lazyWithRetry(
  () => import("@/modules/bible/pages/admin/VerseAnalyticsPage"),
);
const VerseQuizRedirectPage = lazyWithRetry(
  () => import("@/modules/bible/pages/admin/VerseQuizRedirectPage"),
);

// Quiz module
const QuizAttemptPage = lazyWithRetry(
  () => import("@/modules/quiz/pages/QuizAttemptPage"),
);
const QuizResultPage = lazyWithRetry(
  () => import("@/modules/quiz/pages/QuizResultPage"),
);
const QuizListPage = lazyWithRetry(
  () => import("@/modules/quiz/pages/admin/QuizListPage"),
);
const QuizManagePage = lazyWithRetry(
  () => import("@/modules/quiz/pages/admin/QuizManagePage"),
);
const QuizBuilderPage = lazyWithRetry(
  () => import("@/modules/quiz/pages/admin/QuizBuilderPage"),
);
const QuestionFormPage = lazyWithRetry(
  () => import("@/modules/quiz/pages/admin/QuestionFormPage"),
);
const QuizAnalyticsPage = lazyWithRetry(
  () => import("@/modules/quiz/pages/admin/QuizAnalyticsPage"),
);

// Points module
const PointsPage = lazyWithRetry(
  () => import("@/modules/points/pages/PointsPage"),
);

// Media module
const SlidesPage = lazyWithRetry(() =>
  import("@/modules/media/pages/admin/SlidesPage").then((m) => ({
    default: m.SlidesPage,
  })),
);

// Analytics module
const MonthlyAnalyticsPage = lazyWithRetry(
  () => import("@/modules/analytics/pages/MonthlyAnalyticsPage"),
);

// eslint-disable-next-line react-refresh/only-export-components
export const router = createBrowserRouter([
  {
    path: "/",
    handle: { parent: "/" },
    element: <LandingPage />,
  },
  {
    path: "/register",
    handle: { parent: "/" },
    element: <RegisterPage />,
  },
  {
    path: "/login",
    handle: { parent: "/" },
    element: <LoginPage />,
  },
  {
    path: "/forgot-password",
    handle: { parent: "/" },
    element: <ForgotPasswordPage />,
  },
  {
    path: "/reset-password",
    handle: { parent: "/" },
    element: <ResetPasswordPage />,
  },
  {
    path: "/google/callback",
    handle: { parent: "/" },
    element: <GoogleCallbackPage />,
  },
  {
    // Step after registration: the account exists but stays inactive
    // until the emailed verification link is confirmed.
    path: "/verify-email",
    handle: { parent: "/" },
    element: <CheckEmailPage />,
  },
  {
    // Target of the link inside the verification email.
    path: "/verify-email/confirm",
    handle: { parent: "/" },
    element: <VerifyEmailResultPage />,
  },
  {
    path: "/profile",
    handle: { parent: "/" },
    element: (
      <RequireAuth>
        <ProfilePage />
      </RequireAuth>
    ),
  },

  // -- Admin section (D-15): everything staff-facing lives under /admin ----
  {
    // ADMIN + SERVANT only; a signed-in MEMBER sees the visible 403 page.
    path: "/admin",
    handle: { parent: "/admin/dashboard" },
    element: <RequireRole roles={["ADMIN", "SERVANT"]} />,
    errorElement: <ForbiddenPage />,
    children: [
      {
        index: true,
        handle: { parent: "/admin/dashboard" },
        element: <Navigate to="/admin/dashboard" replace />,
      },
      {
        handle: { parent: "/admin/dashboard" },
        element: <AttendanceLayout />,
        children: [
          {
            path: "attendance/check-in",
            handle: { parent: "/admin/dashboard" },
            element: (
              <Suspense fallback={<PageSkeleton />}>
                <CheckInPage />
              </Suspense>
            ),
          },
        ],
      },
      {
        handle: { parent: "/admin/dashboard" },
        element: <AdminLayout />,
        children: [
          {
            path: "dashboard",
            handle: { parent: "/admin/dashboard" },
            element: (
              <Suspense fallback={<PageSkeleton />}>
                <AttendanceDashboardPage />
              </Suspense>
            ),
          },
          {
            path: "attendance/history",
            handle: { parent: "/admin/dashboard" },
            element: (
              <Suspense fallback={<PageSkeleton />}>
                <AttendanceHistoryPage />
              </Suspense>
            ),
          },
          {
            path: "attendance/absent",
            handle: { parent: "/admin/dashboard" },
            element: (
              <Suspense fallback={<PageSkeleton />}>
                <AbsentUsersPage />
              </Suspense>
            ),
          },
          {
            path: "notifications",
            handle: { parent: "/admin/dashboard" },
            element: (
              <Suspense fallback={<PageSkeleton />}>
                <AdminNotificationsPage />
              </Suspense>
            ),
          },
          {
            // ADMIN-only: SERVANT gets the visible 403 page, not a blank.
            path: "users",
            handle: { parent: "/admin/dashboard" },
            element: <RequireRole roles={["ADMIN"]} />,
            children: [
              {
                index: true,
                handle: { parent: "/admin/dashboard" },
                element: (
                  <Suspense fallback={<PageSkeleton />}>
                    <UsersAdminPage />
                  </Suspense>
                ),
              },
            ],
          },
          {
            // ADMIN-only: SERVANT gets the visible 403 page, not a blank.
            path: "anonymous-messages",
            handle: { parent: "/admin/dashboard" },
            element: <RequireRole roles={["ADMIN"]} />,
            children: [
              {
                index: true,
                handle: { parent: "/admin/dashboard" },
                element: (
                  <Suspense fallback={<PageSkeleton />}>
                    <AdminAnonymousMessagesPage />
                  </Suspense>
                ),
              },
            ],
          },
          {
            path: "bible-verses",
            handle: { parent: "/admin/dashboard" },
            element: (
              <Suspense fallback={<PageSkeleton />}>
                <BibleManagementPage />
              </Suspense>
            ),
          },
          {
            path: "bible-verses/new",
            handle: { parent: "/admin/dashboard" },
            element: (
              <Suspense fallback={<PageSkeleton />}>
                <VerseFormPage />
              </Suspense>
            ),
          },
          {
            path: "bible-verses/:verseId/edit",
            handle: { parent: "/admin/dashboard" },
            element: (
              <Suspense fallback={<PageSkeleton />}>
                <VerseFormPage />
              </Suspense>
            ),
          },
          {
            path: "bible-verses/:verseId/schedule",
            handle: { parent: "/admin/dashboard" },
            element: (
              <Suspense fallback={<PageSkeleton />}>
                <VerseSchedulePage />
              </Suspense>
            ),
          },
          {
            path: "bible-verses/:verseId/quiz",
            handle: { parent: "/admin/dashboard" },
            element: (
              <Suspense fallback={<PageSkeleton />}>
                <VerseQuizRedirectPage />
              </Suspense>
            ),
          },
          {
            path: "quizzes",
            handle: { parent: "/admin/dashboard" },
            element: (
              <Suspense fallback={<PageSkeleton />}>
                <QuizListPage />
              </Suspense>
            ),
          },
          {
            // The slides are managed by the admin alone (the owner,
            // 2026-10-29): SERVANT gets the visible 403 page.
            path: "landing/slides",
            handle: { parent: "/admin/dashboard" },
            element: (
              <RequireRole roles={["ADMIN"]}>
                <Suspense fallback={<PageSkeleton />}>
                  <SlidesPage />
                </Suspense>
              </RequireRole>
            ),
          },
          {
            path: "quizzes/manage",
            handle: { parent: "/admin/dashboard" },
            element: (
              <Suspense fallback={<PageSkeleton />}>
                <QuizManagePage />
              </Suspense>
            ),
          },
          {
            path: "quizzes/:quizId/manage",
            handle: { parent: "/admin/dashboard" },
            element: (
              <Suspense fallback={<PageSkeleton />}>
                <QuizManagePage />
              </Suspense>
            ),
          },
          {
            path: "quizzes/new",
            handle: { parent: "/admin/dashboard" },
            element: (
              <Suspense fallback={<PageSkeleton />}>
                <QuizBuilderPage />
              </Suspense>
            ),
          },
          {
            path: "quizzes/:quizId/builder",
            handle: { parent: "/admin/dashboard" },
            element: (
              <Suspense fallback={<PageSkeleton />}>
                <QuizBuilderPage />
              </Suspense>
            ),
          },
          {
            path: "quizzes/:quizId/questions/new",
            handle: { parent: "/admin/dashboard" },
            element: (
              <Suspense fallback={<PageSkeleton />}>
                <QuestionFormPage />
              </Suspense>
            ),
          },
          {
            path: "quizzes/:quizId/questions/:questionId/edit",
            handle: { parent: "/admin/dashboard" },
            element: (
              <Suspense fallback={<PageSkeleton />}>
                <QuestionFormPage />
              </Suspense>
            ),
          },
          {
            path: "analytics/verses",
            handle: { parent: "/admin/dashboard" },
            element: (
              <Suspense fallback={<PageSkeleton />}>
                <VerseAnalyticsPage />
              </Suspense>
            ),
          },
          {
            path: "analytics/quizzes",
            handle: { parent: "/admin/dashboard" },
            element: (
              <Suspense fallback={<PageSkeleton />}>
                <QuizAnalyticsPage />
              </Suspense>
            ),
          },
          {
            path: "analytics/monthly",
            handle: { parent: "/admin/dashboard" },
            element: (
              <Suspense fallback={<PageSkeleton />}>
                <MonthlyAnalyticsPage />
              </Suspense>
            ),
          },
        ],
      },
    ],
  },

  // -- Legacy attendance paths: bookmarks keep working (R-4) ---------------
  {
    path: "/attendance",
    handle: { parent: "/admin/dashboard" },
    element: <Navigate to="/admin/attendance/check-in" replace />,
  },
  {
    path: "/attendance/check-in",
    handle: { parent: "/admin/dashboard" },
    element: <Navigate to="/admin/attendance/check-in" replace />,
  },
  {
    path: "/attendance/dashboard",
    handle: { parent: "/admin/dashboard" },
    element: <Navigate to="/admin/dashboard" replace />,
  },
  {
    path: "/attendance/history",
    handle: { parent: "/admin/dashboard" },
    element: <Navigate to="/admin/attendance/history" replace />,
  },

  {
    // Public (D-9): anyone may submit; no token required.
    path: "/anonymous-messages",
    handle: { parent: "/" },
    element: (
      <Suspense fallback={<PageSkeleton />}>
        <AnonymousMessagePage />
      </Suspense>
    ),
  },
  {
    path: "/bible-verses",
    handle: { parent: "/" },
    element: (
      <RequireAuth>
        <Suspense fallback={<PageSkeleton />}>
          <BibleVersesPage />
        </Suspense>
      </RequireAuth>
    ),
  },
  {
    path: "/bible-verses/:verseId",
    handle: { parent: "/" },
    element: (
      <RequireAuth>
        <Suspense fallback={<PageSkeleton />}>
          <VerseDetailPage />
        </Suspense>
      </RequireAuth>
    ),
  },
  {
    path: "/quizzes/:quizId/take",
    handle: { parent: "/" },
    element: (
      <RequireAuth>
        <Suspense fallback={<PageSkeleton />}>
          <QuizAttemptPage />
        </Suspense>
      </RequireAuth>
    ),
  },
  {
    path: "/quizzes/:quizId/result",
    handle: { parent: "/" },
    element: (
      <RequireAuth>
        <Suspense fallback={<PageSkeleton />}>
          <QuizResultPage />
        </Suspense>
      </RequireAuth>
    ),
  },
  {
    path: "/points",
    handle: { parent: "/" },
    element: (
      <RequireAuth>
        <Suspense fallback={<PageSkeleton />}>
          <PointsPage />
        </Suspense>
      </RequireAuth>
    ),
  },
  {
    // Private section: content is members-only until signed in.
    path: "/blog",
    handle: { parent: "/" },
    element: (
      <RequireAuth>
        <PlaceholderPage titleKey="blog" />
      </RequireAuth>
    ),
  },
  {
    // The gallery is gone: the old address keeps working as a redirect to
    // the landing page so bookmarks and old links never answer 404.
    path: "/gallery",
    handle: { parent: "/" },
    element: <Navigate to="/" replace />,
  },
  {
    path: "/about-us",
    handle: { parent: "/" },
    element: <AboutUsPage />,
  },
  {
    // Private: notifications are personal to the signed-in member.
    path: "/notifications",
    handle: { parent: "/" },
    element: (
      <RequireAuth>
        <Suspense fallback={<PageSkeleton />}>
          <NotificationsPage />
        </Suspense>
      </RequireAuth>
    ),
  },
  {
    path: "*",
    handle: { parent: "/" },
    element: <NotFoundPage />,
  },
]);

/**
 * After a navigation, the focus goes to the `h1` of the new page (or to the
 * main region when the page has no `h1`): a member who moves from page to
 * page lands straight at the content of the page.
 *
 * Every navigation goes through the history of the browser, so the component
 * watches `pushState`/`replaceState` and `popstate` and moves the focus once
 * the new page has rendered. It needs no hook of the router, so it can be
 * mounted once next to the router and it stays mounted for every page.
 */
export function FocusAfterNavigation() {
  useEffect(() => {
    const moveFocus = () => {
      const target =
        document.querySelector<HTMLElement>("h1") ??
        document.querySelector<HTMLElement>("main, [role=main]");
      if (target) {
        target.focus({ preventScroll: true });
      }
    };

    // The router renders the new page in a transition, so the focus must be
    // moved after the render - a macrotask, not a microtask.
    const scheduleFocus = () => {
      setTimeout(moveFocus, 0);
    };

    const pushState = window.history.pushState;
    const replaceState = window.history.replaceState;
    window.history.pushState = function (
      this: History,
      data: unknown,
      unused: string,
      url?: string | URL | null,
    ) {
      pushState.call(this, data, unused, url);
      scheduleFocus();
    };
    window.history.replaceState = function (
      this: History,
      data: unknown,
      unused: string,
      url?: string | URL | null,
    ) {
      replaceState.call(this, data, unused, url);
      scheduleFocus();
    };

    window.addEventListener("popstate", scheduleFocus);
    scheduleFocus();

    return () => {
      window.history.pushState = pushState;
      window.history.replaceState = replaceState;
      window.removeEventListener("popstate", scheduleFocus);
    };
  }, []);

  return null;
}
