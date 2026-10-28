import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { useCurrentWorkspace, useTrackEvent } from "@/api/hooks";
import { CompactSidebar } from "@/components/layout/compact-sidebar";
import { Sidebar } from "@/components/layout/sidebar";
import { SiteHeader } from "@/components/layout/site-header";
import { TopNav } from "@/components/layout/top-nav";
import { AppErrorBoundary } from "@/components/shared/error-boundary";
import { FeedbackLauncher } from "@/components/feedback/feedback-launcher";
import { BreakReminder } from "@/components/time-tracking/break-reminder";
import { RunningTimerBar } from "@/components/time-tracking/running-timer-bar";
import { registerErrorReporter } from "@/lib/client-error-reporter";
import { useDesignTheme } from "@/theme/design-theme";

export function AppLayout() {
  const { layout } = useDesignTheme();
  const location = useLocation();
  const workspace = useCurrentWorkspace();
  const tenantId = workspace.data?.id ?? "";
  const trackEvent = useTrackEvent(tenantId);

  useEffect(() => {
    if (!tenantId) return;
    trackEvent({ name: "page_view", path: location.pathname });
    // Re-fire when the workspace becomes available and whenever the user
    // visits a different route. Query-string-only changes are not page visits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, tenantId]);

  useEffect(() => {
    registerErrorReporter(trackEvent);
    return () => registerErrorReporter(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  if (layout === "topnav") {
    return (
      <div className="app-canvas flex min-h-screen flex-col">
        <TopNav />
        <RunningTimerBar className="top-[4.5rem]" />
        <BreakReminder />
        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8 xl:px-10">
          <div key={location.pathname} className="route-stage mx-auto w-full max-w-[1480px]">
            <AppErrorBoundary label="This page">
              <Outlet />
            </AppErrorBoundary>
          </div>
        </main>
        <FeedbackLauncher tenantId={workspace.data?.id ?? ""} />
      </div>
    );
  }

  const SidebarComponent = layout === "sidebar-compact" ? CompactSidebar : Sidebar;

  return (
    <div className="app-canvas flex min-h-screen">
      <SidebarComponent />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <SiteHeader />
        <RunningTimerBar className="top-16 lg:top-0" />
        <BreakReminder />
        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8 xl:px-10">
          <div key={location.pathname} className="route-stage mx-auto w-full max-w-[1480px]">
            <AppErrorBoundary label="This page">
              <Outlet />
            </AppErrorBoundary>
          </div>
        </main>
      </div>
      <FeedbackLauncher tenantId={workspace.data?.id ?? ""} />
    </div>
  );
}
