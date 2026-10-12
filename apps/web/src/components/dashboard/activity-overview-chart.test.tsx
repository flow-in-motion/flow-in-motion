import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ActivityOverviewChart } from "@/components/dashboard/activity-overview-chart";
import { clearSessionListState } from "@/hooks/use-session-list-state";

vi.mock("@/api/hooks", () => ({
  useCurrentWorkspace: () => ({ data: { id: "workspace-1" } }),
  useMe: () => ({ data: { id: "user-owner" } }),
}));

beforeEach(() => {
  window.sessionStorage.clear();
});

describe("ActivityOverviewChart session selection", () => {
  it("restores the selected range after returning", () => {
    const first = render(<ActivityOverviewChart />);

    fireEvent.click(screen.getByRole("button", { name: "Month" }));
    first.unmount();

    render(<ActivityOverviewChart />);

    expect(screen.getByRole("button", { name: "Month" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Week" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("returns to Week when session selections are cleared", () => {
    render(<ActivityOverviewChart />);

    fireEvent.click(screen.getByRole("button", { name: "Year" }));
    act(() => clearSessionListState());

    expect(screen.getByRole("button", { name: "Week" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
