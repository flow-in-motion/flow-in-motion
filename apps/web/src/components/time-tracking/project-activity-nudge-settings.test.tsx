import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectActivityNudgeSettingsCard } from "./project-activity-nudge-settings";

const state = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("@/api/hooks", () => ({
  useAccountPreferences: () => ({ data: null, isSuccess: true }),
  useUpdateAccountPreferences: () => ({ mutate: state.save, isPending: false, isError: false }),
}));

describe("ProjectActivityNudgeSettingsCard", () => {
  beforeEach(() => state.save.mockClear());

  it("offers thresholds and saves a complete setting", () => {
    render(<ProjectActivityNudgeSettingsCard />);
    fireEvent.click(screen.getByRole("button", { name: "7 days" }));
    expect(state.save).toHaveBeenCalledWith({
      projectActivityNudges: { enabled: true, inactiveDays: 7 },
    });
    fireEvent.click(screen.getByRole("button", { name: "Nudges on" }));
    expect(state.save).toHaveBeenLastCalledWith({
      projectActivityNudges: { enabled: false, inactiveDays: 3 },
    });
  });
});
