import { lazy, Suspense } from "react";
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
import { NotFoundPage } from "@/pages/NotFoundPage";
import { ForbiddenPage } from "@/pages/ForbiddenPage";
import { RequireAuth } from "@/components/common/RequireAuth";
import { RequireRole } from "@/components/common/RequireRole";
import { AttendanceLayout } from "@/layouts/AttendanceLayout";
import { AdminLayout } from "@/layouts/AdminLayout";
import { PageSkeleton } from "@/components/common/PageSkeleton";

// The attendance pages pull in html5-qrcode and recharts; they must
// never enter the landing-page bundle.
const CheckInPage = lazy(() =>
  import("@/modules/attendance/pages/CheckInPage").then((m) => ({
    default: m.CheckInPage,
  })),
);
const AttendanceDashboardPage = lazy(() =>
  import("@/modules/attendance/pages/AttendanceDashboardPage").then((m) => ({
    default: m.AttendanceDashboardPage,
  })),
);
const AttendanceHistoryPage = lazy(() =>
  import("@/modules/attendance/pages/AttendanceHistoryPage").then((m) => ({
    default: m.AttendanceHistoryPage,
  })),
);

const NotificationsPage = lazy(() =>
  import("@/modules/notifications/pages/NotificationsPage").then((m) => ({
    default: m.NotificationsPage,
  })),
);
const AdminNotificationsPage = lazy(() =>
  import("@/modules/notifications/pages/AdminNotificationsPage").then((m) => ({
    default: m.AdminNotificationsPage,
  })),
);
const AnonymousMessagePage = lazy(() =>
  import("@/modules/anonymous-messages/pages/AnonymousMessagePage").then(
    (m) => ({
      default: m.AnonymousMessagePage,
    }),
  ),
);
const AdminAnonymousMessagesPage = lazy(() =>
  import("@/modules/anonymous-messages/pages/AdminAnonymousMessagesPage").then(
    (m) => ({ default: m.AdminAnonymousMessagesPage }),
  ),
);

export const router = createBrowserRouter([
  {
    path: "/",
    element: <LandingPage />,
  },
  {
    path: "/register",
    element: <RegisterPage />,
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/forgot-password",
    element: <ForgotPasswordPage />,
  },
  {
    path: "/reset-password",
    element: <ResetPasswordPage />,
  },
  {
    path: "/google/callback",
    element: <GoogleCallbackPage />,
  },
  {
    // Step after registration: the account exists but stays inactive
    // until the emailed verification link is confirmed.
    path: "/verify-email",
    element: <CheckEmailPage />,
  },
  {
    // Target of the link inside the verification email.
    path: "/verify-email/confirm",
    element: <VerifyEmailResultPage />,
  },
  {
    path: "/profile",
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
    element: <RequireRole roles={["ADMIN", "SERVANT"]} />,
    errorElement: <ForbiddenPage />,
    children: [
      { index: true, element: <Navigate to="/admin/dashboard" replace /> },
      {
        element: <AttendanceLayout />,
        children: [
          {
            path: "attendance/check-in",
            element: (
              <Suspense fallback={<PageSkeleton />}>
                <CheckInPage />
              </Suspense>
            ),
          },
        ],
      },
      {
        element: <AdminLayout />,
        children: [
          {
            path: "dashboard",
            element: (
              <Suspense fallback={<PageSkeleton />}>
                <AttendanceDashboardPage />
              </Suspense>
            ),
          },
          {
            path: "attendance/history",
            element: (
              <Suspense fallback={<PageSkeleton />}>
                <AttendanceHistoryPage />
              </Suspense>
            ),
          },
          {
            path: "notifications",
            element: (
              <Suspense fallback={<PageSkeleton />}>
                <AdminNotificationsPage />
              </Suspense>
            ),
          },
          {
            // ADMIN-only: SERVANT gets the visible 403 page, not a blank.
            path: "anonymous-messages",
            element: <RequireRole roles={["ADMIN"]} />,
            children: [
              {
                index: true,
                element: (
                  <Suspense fallback={<PageSkeleton />}>
                    <AdminAnonymousMessagesPage />
                  </Suspense>
                ),
              },
            ],
          },
        ],
      },
    ],
  },

  // -- Legacy attendance paths: bookmarks keep working (R-4) ---------------
  {
    path: "/attendance",
    element: <Navigate to="/admin/attendance/check-in" replace />,
  },
  {
    path: "/attendance/check-in",
    element: <Navigate to="/admin/attendance/check-in" replace />,
  },
  {
    path: "/attendance/dashboard",
    element: <Navigate to="/admin/dashboard" replace />,
  },
  {
    path: "/attendance/history",
    element: <Navigate to="/admin/attendance/history" replace />,
  },

  {
    // Public (D-9): anyone may submit; no token required.
    path: "/anonymous-messages",
    element: (
      <Suspense fallback={<PageSkeleton />}>
        <AnonymousMessagePage />
      </Suspense>
    ),
  },
  {
    // Private section: content is members-only until signed in.
    path: "/blog",
    element: (
      <RequireAuth>
        <PlaceholderPage titleKey="blog" />
      </RequireAuth>
    ),
  },
  {
    // Private section: content is members-only until signed in.
    path: "/gallery",
    element: (
      <RequireAuth>
        <PlaceholderPage titleKey="gallery" />
      </RequireAuth>
    ),
  },
  {
    path: "/about-us",
    element: <PlaceholderPage titleKey="aboutUs" />,
  },
  {
    // Private: notifications are personal to the signed-in member.
    path: "/notifications",
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
    element: <NotFoundPage />,
  },
]);
