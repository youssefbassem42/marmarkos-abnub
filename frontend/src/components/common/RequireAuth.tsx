import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getAccessToken } from "@/lib/auth";

interface RequireAuthProps {
  children?: ReactNode;
}

/**
 * First codebase-wide route guard. Renders the route only for an
 * authenticated visitor; anonymous users are bounced to /login with a
 * `from` location so sign-in can bring them back.
 */
export function RequireAuth({ children }: RequireAuthProps) {
  const location = useLocation();

  if (!getAccessToken()) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children ?? <Outlet />;
}
