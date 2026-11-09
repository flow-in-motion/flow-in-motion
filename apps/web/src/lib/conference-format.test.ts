import { describe, expect, it } from "vitest";
import {
  conferenceUrgencyClass,
  conferenceUrgencyLabel,
  matchesConferenceDeadline,
} from "./conference-format";

describe("conference deadline urgency", () => {
  it.each([
    [null, "No deadline", "No deadline"],
    [-5, "5 days overdue", "Deadline passed"],
    [-1, "1 day overdue", "Deadline passed"],
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

  it("preserves deadline filters and urgency for pending submissions", () => {
    expect(conferenceUrgencyClass(-5)).toContain("text-destructive");
    expect(conferenceUrgencyClass(5)).toContain("text-orange-600");
    expect(matchesConferenceDeadline(-5, "Past")).toBe(true);
    expect(matchesConferenceDeadline(5, "This week")).toBe(true);
  });
});
