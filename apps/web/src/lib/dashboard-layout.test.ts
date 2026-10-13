import { describe, expect, it } from "vitest";

import { fillRowGaps } from "./dashboard-layout";

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
});
