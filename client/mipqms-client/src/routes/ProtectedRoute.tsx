import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { PageLoader } from "@/components/ui/PageLoader";

/**
 * Redirects unauthenticated users to /login, preserving where they were
 * headed so login can return them there. This is a UX convenience only —
 * the Phase 4 backend rejects any unauthenticated request regardless of
 * what this component does.
 */
export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <PageLoader label="Checking your session..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
