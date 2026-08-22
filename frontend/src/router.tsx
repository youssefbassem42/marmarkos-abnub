import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { LandingPage } from "@/pages/landing/LandingPage";
import { RegisterPage } from "@/pages/auth/register/RegisterPage";
import { LoginPage } from "@/pages/auth/login/LoginPage";
import { ForgotPasswordPage } from "@/pages/auth/forgot-password/ForgotPasswordPage";
import { ResetPasswordPage } from "@/pages/auth/reset-password/ResetPasswordPage";
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
    path: "/profile",
    element: (
      <RequireAuth>
        <ProfilePage />
      </RequireAuth>
    ),
  },
  {
    // ADMIN + SERVANT only; a signed-in MEMBER sees the visible 403 page.
    element: <RequireRole roles={["ADMIN", "SERVANT"]} />,
    errorElement: <ForbiddenPage />,
    children: [
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
            path: "attendance/dashboard",
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
        ],
      },
    ],
  },
  {
    path: "/attendance",
    element: <Navigate to="/attendance/check-in" replace />,
  },
  {
    path: "/anonymous-messages",
    element: <PlaceholderPage titleKey="anonymous" />,
  },
  {
    path: "/blog",
    element: <PlaceholderPage titleKey="blog" />,
  },
  {
    path: "/gallery",
    element: <PlaceholderPage titleKey="gallery" />,
  },
  {
    path: "/about-us",
    element: <PlaceholderPage titleKey="aboutUs" />,
  },
  {
    path: "/notifications",
    element: <PlaceholderPage titleKey="notifications" />,
  },
  {
    path: "*",
    element: <NotFoundPage />,
  },
]);
