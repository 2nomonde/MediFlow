import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import type { UserRole } from "@/types/auth";

interface RoleRouteProps {
  allowedRoles: UserRole[];
}

/**
 * Restricts a page to specific roles, redirecting anyone else to the
 * dashboard. Must sit inside <ProtectedRoute> — it assumes `user` is
 * already set. Like ProtectedRoute, this is a UX layer: the real
 * enforcement for any given action lives in the Phase 4 backend's
 * `requireRole` middleware on the corresponding API route, and this
 * component will never be the only thing standing between a role and
 * data it shouldn't see.
 */
export function RoleRoute({ allowedRoles }: RoleRouteProps) {
  const { user } = useAuth();

  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
