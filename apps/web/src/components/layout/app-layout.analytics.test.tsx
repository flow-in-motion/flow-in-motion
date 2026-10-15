import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  MemoryRouter,
  Outlet,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppLayout } from "@/components/layout/app-layout";

const analytics = vi.hoisted(() => ({
  tenantId: "",
  trackEvent: vi.fn(),
}));

vi.mock("@/api/hooks", () => ({
  useCurrentWorkspace: () => ({
    data: analytics.tenantId ? { id: analytics.tenantId } : undefined,
  }),
  useTrackEvent: () => analytics.trackEvent,
}));
vi.mock("@/theme/design-theme", () => ({
  useDesignTheme: () => ({ layout: "sidebar" }),
}));
vi.mock("@/components/layout/sidebar", () => ({ Sidebar: () => null }));
vi.mock("@/components/layout/compact-sidebar", () => ({
  CompactSidebar: () => null,
}));
vi.mock("@/components/layout/site-header", () => ({ SiteHeader: () => null }));
vi.mock("@/components/layout/top-nav", () => ({ TopNav: () => null }));
vi.mock("@/components/feedback/feedback-launcher", () => ({
  FeedbackLauncher: () => null,
}));
vi.mock("@/lib/client-error-reporter", () => ({
  registerErrorReporter: vi.fn(),
}));

function NavigationHarness() {
  const navigate = useNavigate();
  return (
    <>
      <button type="button" onClick={() => navigate("/daily-notes")}>
        Notes
      </button>
      <button type="button" onClick={() => navigate("/tasks")}>
        Tasks
      </button>
      <Outlet />
    </>
  );
}

function TestApp() {
  return (
    <MemoryRouter initialEntries={["/projects"]}>
      <Routes>
        <Route element={<NavigationHarness />}>
          <Route element={<AppLayout />}>
            <Route path="*" element={<div>Page</div>} />
          </Route>
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe("AppLayout usage tracking", () => {
  beforeEach(() => {
    analytics.tenantId = "";
    analytics.trackEvent.mockReset();
  });

  it("records the initial page after the workspace loads and every route visit", async () => {
    const view = render(<TestApp />);
    expect(analytics.trackEvent).not.toHaveBeenCalled();

    analytics.tenantId = "tenant-1";
    view.rerender(<TestApp />);
    await waitFor(() =>
      expect(analytics.trackEvent).toHaveBeenCalledWith({
        name: "page_view",
        path: "/projects",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Notes" }));
    fireEvent.click(screen.getByRole("button", { name: "Tasks" }));

    await waitFor(() => {
      expect(analytics.trackEvent.mock.calls).toEqual([
        [{ name: "page_view", path: "/projects" }],
        [{ name: "page_view", path: "/daily-notes" }],
        [{ name: "page_view", path: "/tasks" }],
      ]);
    });
  });
});
