import { describe, expect, it } from "vitest";
import {
  conferenceEventCountdown,
  conferenceUrgencyClass,
  conferenceUrgencyLabel,
  matchesConferenceDeadline,
} from "./conference-format";

describe("conference deadline urgency", () => {
  it.each([
    [null, "No deadline", "No deadline"],
    [-5, "Deadline passed", "Deadline passed"],
    [-1, "Deadline passed", "Deadline passed"],
    [0, "Due today", "Deadline today"],
    [1, "1 day left", "Deadline in 1 day"],
    [5, "5 days left", "Deadline in 5 days"],
  ] as const)(
    "describes %s days according to pending state",
    (days, pendingLabel, historicalLabel) => {
      expect(conferenceUrgencyLabel(days)).toBe(pendingLabel);
      expect(conferenceUrgencyLabel(days, true)).toBe(pendingLabel);
      expect(conferenceUrgencyLabel(days, false)).toBe(historicalLabel);
      expect(conferenceUrgencyClass(days, false)).toBe("text-muted-foreground");
    },
  );

  it("preserves deadline filters and future urgency without expired warnings", () => {
    expect(conferenceUrgencyClass(-5)).toBe("text-muted-foreground");
    expect(conferenceUrgencyClass(5)).toContain("text-orange-600");
    expect(matchesConferenceDeadline(-5, "Past")).toBe(true);
    expect(matchesConferenceDeadline(5, "This week")).toBe(true);
  });
});


describe("event start countdown", () => {
  const today = new Date(2026, 10, 22, 23, 45);
  it.each([
    [null, null], ["", null], ["not-a-date", null], ["2027-02-30", null],
    ["2026-11-21", null], ["2026-11-22", "Starts today"],
    ["2026-11-23", "1 day until event"], ["2026-12-02", "10 days until event"],
  ])("handles start date %s", (date, expected) => {
    expect(conferenceEventCountdown(date, today)).toBe(expected);
  });
  it("counts calendar days across month, year and daylight-saving boundaries", () => {
    expect(conferenceEventCountdown("2027-01-01", new Date(2026, 11, 31, 23, 59))).toBe("1 day until event");
    expect(conferenceEventCountdown("2026-10-05", new Date(2026, 9, 3, 23, 59))).toBe("2 days until event");
  });
});
