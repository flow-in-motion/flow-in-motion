import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { useCurrentWorkspace, useTrackEvent } from "@/api/hooks";
import { CompactSidebar } from "@/components/layout/compact-sidebar";
import { Sidebar } from "@/components/layout/sidebar";
import { SiteHeader } from "@/components/layout/site-header";
import { TopNav } from "@/components/layout/top-nav";
import { AppErrorBoundary } from "@/components/shared/error-boundary";
import { registerErrorReporter } from "@/lib/client-error-reporter";
import { useDesignTheme } from "@/theme/design-theme";

export function AppLayout() {
  const { layout } = useDesignTheme();
  const location = useLocation();
  const workspace = useCurrentWorkspace();
  const trackEvent = useTrackEvent(workspace.data?.id ?? "");

  useEffect(() => {
    trackEvent({ name: "page_view", path: location.pathname });
    // Only re-fire when the path actually changes, not on every trackEvent identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    registerErrorReporter(trackEvent);
    return () => registerErrorReporter(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.data?.id]);

  if (layout === "topnav") {
    return (
      <div className="app-canvas flex min-h-screen flex-col">
        <TopNav />
        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8 xl:px-10">
          <div key={location.pathname} className="route-stage mx-auto w-full max-w-[1480px]">
            <AppErrorBoundary label="This page">
              <Outlet />
            </AppErrorBoundary>
          </div>
        </main>
      </div>
    );
  }

  const SidebarComponent = layout === "sidebar-compact" ? CompactSidebar : Sidebar;

  return (
    <div className="app-canvas flex min-h-screen">
      <SidebarComponent />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <SiteHeader />
        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8 xl:px-10">
          <div key={location.pathname} className="route-stage mx-auto w-full max-w-[1480px]">
            <AppErrorBoundary label="This page">
              <Outlet />
            </AppErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
