import { describe, expect, it } from "vitest";

import {
  fillRowGaps,
  getDashboardWidgetWidths,
  normalizeDashboardWidths,
} from "./dashboard-layout";

describe("fillRowGaps", () => {
  it("leaves rows that are already full unchanged", () => {
    expect(fillRowGaps([3, 2, 2, 3, 5, 5, 5], 5)).toEqual([3, 2, 2, 3, 5, 5, 5]);
  });

  it("widens the last widget in a row when the next one does not fit", () => {
    // Task health (2) then Priority workload (2) then Tasks (5) then Project progress (3)
    expect(fillRowGaps([2, 2, 5, 3], 5)).toEqual([2, 3, 5, 5]);
  });

  it("widens a lone narrow widget to the full row", () => {
    expect(fillRowGaps([2, 5], 5)).toEqual([5, 5]);
  });

  it("fills the final row", () => {
    expect(fillRowGaps([5, 3], 5)).toEqual([5, 5]);
    expect(fillRowGaps([2, 2], 5)).toEqual([2, 3]);
  });

  it("handles an empty dashboard", () => {
    expect(fillRowGaps([], 5)).toEqual([]);
  });
  describe("dynamic dashboard widths", () => {
    it("preserves existing layout sizes when no widths are saved", () => {
      expect(
        getDashboardWidgetWidths([
          { id: "task-health", span: 2 },
          { id: "priority-workload", span: 2 },
          { id: "tasks", span: 5 },
          { id: "stalled-papers", span: 3 },
        ]),
      ).toEqual([40, 60, 100, 100]);
    });

    it("supports complementary custom widths in one row", () => {
      expect(
        getDashboardWidgetWidths(
          [
            { id: "pipeline", span: 5 },
            { id: "conferences", span: 5 },
          ],
          { pipeline: 65, conferences: 35 },
        ),
      ).toEqual([65, 35]);
    });

    it("keeps a custom width when the widget sits alone", () => {
      expect(
        getDashboardWidgetWidths(
          [
            { id: "pipeline", span: 5 },
            { id: "conferences", span: 5 },
          ],
          { pipeline: 50 },
        ),
      ).toEqual([50, 100]);
    });

    it("retains full-width widgets", () => {
      expect(
        getDashboardWidgetWidths(
          [{ id: "task-health", span: 2 }],
          { "task-health": 100 },
        ),
      ).toEqual([100]);
    });

    it("ignores invalid saved widths and unknown widgets", () => {
      expect(
        normalizeDashboardWidths(
          {
            pipeline: 65.4,
            conferences: 101,
            tasks: "50",
            unknown: 50,
          },
          ["pipeline", "conferences", "tasks"],
        ),
      ).toEqual({ pipeline: 65 });
    });

    it("handles an empty dashboard", () => {
      expect(getDashboardWidgetWidths([])).toEqual([]);
    });
  });
});
