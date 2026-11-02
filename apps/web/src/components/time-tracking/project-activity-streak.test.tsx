import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectActivityStreak } from "./project-activity-streak";

const state = vi.hoisted(() => ({
  activity: {
    currentStreakDays: 0,
    lastActiveDate: "2026-10-29" as string | null,
    inactiveDays: 3,
  },
  enabled: true,
  threshold: 3 as 3 | 7 | 14,
}));

vi.mock("@/auth/auth-provider", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));
vi.mock("@/api/time-tracking", () => ({
  useProjectActivityStreak: () => ({
    data: state.activity,
    isPending: false,
    isError: false,
  }),
}));
vi.mock("@/api/hooks", () => ({
  useAccountPreferences: () => ({
    data: {
      projectActivityNudges: {
        enabled: state.enabled,
        inactiveDays: state.threshold,
      },
    },
    isSuccess: true,
  }),
}));

describe("ProjectActivityStreak", () => {
  beforeEach(() => {
    window.localStorage.clear();
    state.activity = {
      currentStreakDays: 0,
      lastActiveDate: "2026-10-29",
      inactiveDays: 3,
    };
    state.enabled = true;
    state.threshold = 3;
  });

  it("shows a nudge at the chosen inactivity threshold and lets the user dismiss it", () => {
    render(<ProjectActivityStreak projectId="project-1" />);
    expect(
      screen.getByText(/No visible work has been logged here for 3 full days/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(
      screen.queryByText(/No visible work has been logged here for 3 full days/),
    ).not.toBeInTheDocument();
    expect(
      window.localStorage.getItem("project-activity-nudge:user-1:project-1"),
    ).toBe("2026-10-29");
  });

  it("shows a streak even when nudges are disabled", () => {
    state.enabled = false;
    state.activity = {
      currentStreakDays: 2,
      lastActiveDate: "2026-11-01",
      inactiveDays: 0,
    };
    render(<ProjectActivityStreak projectId="project-1" />);
    expect(screen.getByText("2-day visible work streak")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Dismiss" }),
    ).not.toBeInTheDocument();
  });

  it("honours the seven-day option", () => {
    state.threshold = 7;
    render(<ProjectActivityStreak projectId="project-1" />);
    expect(
      screen.queryByRole("button", { name: "Dismiss" }),
    ).not.toBeInTheDocument();
  });
});
