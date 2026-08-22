import type { ReactNode } from "react";
import { Outlet } from "react-router-dom";
import type { UserRole } from "@/lib/auth";
import { hasAnyRole } from "@/lib/auth";
import { RequireAuth } from "./RequireAuth";
import { ForbiddenPage } from "@/pages/ForbiddenPage";

interface RequireRoleProps {
  roles: UserRole[];
  children?: ReactNode;
}

/**
 * Composes {@link RequireAuth}, then checks the caller's role.
 * A signed-in user without the right role sees a visible 403 page —
 * never a silent redirect.
 */
export function RequireRole({ roles, children }: RequireRoleProps) {
  return (
    <RequireAuth>
      {hasAnyRole(...roles) ? (children ?? <Outlet />) : <ForbiddenPage />}
    </RequireAuth>
  );
}
