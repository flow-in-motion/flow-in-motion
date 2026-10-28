import { describe, expect, it } from "vitest";

import {
  estimateSeconds,
  formatEstimate,
  formatClock,
  formatDuration,
  localDateInput,
  middayOn,
} from "@/lib/time-format";

describe("time formatting", () => {
  it.each([
    [0, "0m"],
    [30, "<1m"],
    [60, "1m"],
    [45 * 60, "45m"],
    [3600, "1h"],
    [4 * 3600 + 20 * 60 + 59, "4h 20m"],
  ])("formats %i seconds as %s", (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });

  it.each([
    [0, "00:00"],
    [245, "04:05"],
    [3729, "1:02:09"],
    [36000, "10:00:00"],
  ])("shows %i seconds on the clock as %s", (seconds, expected) => {
    expect(formatClock(seconds)).toBe(expected);
  });

  it("reads estimates in hours", () => {
    expect(estimateSeconds("1.50")).toBe(5400);
    expect(estimateSeconds("6")).toBe(21600);
    expect(estimateSeconds(null)).toBeNull();
    expect(estimateSeconds("0")).toBeNull();
    expect(estimateSeconds("abc")).toBeNull();
  });

  it("shows estimates the same way as logged time", () => {
    expect(formatEstimate("1.50")).toBe("1h 30m");
    expect(formatEstimate("2.00")).toBe("2h");
    expect(formatEstimate("0.25")).toBe("15m");
    expect(formatEstimate(null)).toBe("—");
  });

  it("works with local dates", () => {
    const midday = middayOn("2026-10-28");
    expect(localDateInput(midday)).toBe("2026-10-28");
    expect(midday.getHours()).toBe(12);
  });
});
