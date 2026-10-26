import { Navigate, Outlet } from "react-router-dom";

import { useCurrentWorkspace } from "@/api/hooks";
import { ErrorState } from "@/components/shared/error-state";
import { AppShellSkeleton } from "@/components/shared/page-skeleton";

export function RequireWorkspace({ shouldExist }: { shouldExist: boolean }) {
  const workspace = useCurrentWorkspace();

  if (workspace.isPending) {
    return <AppShellSkeleton title="Loading your workspace" />;
  }
  if (workspace.isError) {
    return (
      <ErrorState
        title="Your workspace could not be loaded"
        description={workspace.error.message}
        onRetry={() => void workspace.refetch()}
        className="app-canvas min-h-screen p-6"
      />
    );
  }
  if (shouldExist && !workspace.data) return <Navigate to="/onboarding" replace />;
  if (!shouldExist && workspace.data) return <Navigate to="/" replace />;
  return <Outlet />;
}
