import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useCurrentWorkspace, useMe } from "@/api/hooks";
import { ErrorState } from "@/components/shared/error-state";
import { AppShellSkeleton } from "@/components/shared/page-skeleton";

export function RequireApiSession() {
  const location = useLocation();
  const me = useMe();
  // Start loading the workspace now, alongside the account, rather than
  // after it. RequireWorkspace reads the same cached request, so nothing is
  // fetched twice; this one just isn't kept waiting for /me to finish.
  useCurrentWorkspace();

  if (me.isPending) {
    return <AppShellSkeleton title="Loading your account" />;
  }
  if (me.isError) {
    return (
      <ErrorState
        title="Your account could not be loaded"
        description={me.error.message}
        onRetry={() => void me.refetch()}
        className="app-canvas min-h-screen p-6"
      />
    );
  }
  if (me.data.status !== "active" && !location.pathname.startsWith("/membership-status/")) {
    return <Navigate to={`/membership-status/${me.data.status}`} replace />;
  }
  return <Outlet />;
}
