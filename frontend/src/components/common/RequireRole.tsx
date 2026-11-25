import type { ReactNode } from "react";
import { Navigate, Outlet } from "react-router-dom";
import type { UserRole } from "@/lib/auth";
import { hasAnyRole } from "@/lib/auth";
import { RequireAuth } from "./RequireAuth";
import { ForbiddenPage } from "@/pages/ForbiddenPage";

interface RequireRoleProps {
  roles: UserRole[];
  children?: ReactNode;
  /** Send an authenticated caller without the role to a safe route. */
  redirectTo?: string;
}

/**
 * Composes {@link RequireAuth}, then checks the caller's role.
 * A signed-in user without the right role sees a visible 403 page. A
 * route that names `redirectTo` sends that user to the safe route instead.
 */
export function RequireRole({ roles, children, redirectTo }: RequireRoleProps) {
  return (
    <RequireAuth>
      {hasAnyRole(...roles) ? (
        (children ?? <Outlet />)
      ) : redirectTo ? (
        <Navigate to={redirectTo} replace />
      ) : (
        <ForbiddenPage />
      )}
    </RequireAuth>
  );
}
