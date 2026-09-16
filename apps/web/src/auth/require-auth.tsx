import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/auth-provider";

/**
 * Layout route: renders the protected subtree only when signed in.
 * Unauthenticated users are redirected to /sign-in with the attempted
 * path preserved, so sign-in can send them back afterward.
 */
export function RequireAuth() {
  const auth = useAuth();
  const location = useLocation();
  const returnTo = location.pathname + location.search;

  if (auth.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (auth.isSessionExpired) {
    return (
      <Navigate
        to={`/session-expired?returnTo=${encodeURIComponent(returnTo)}`}
        replace
      />
    );
  }

  if (!auth.isAuthenticated) {
    return <Navigate to="/sign-in" replace state={{ returnTo }} />;
  }

  return <Outlet />;
}
