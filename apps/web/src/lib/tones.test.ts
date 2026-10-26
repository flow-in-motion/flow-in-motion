import { describe, expect, it } from "vitest";

import {
  rolePillClass,
  statusBadgeClass,
  statusPillClass,
  toneFor,
} from "@/lib/tones";

describe("tones", () => {
  it.each([
    ["Active", "neutral"],
    ["To do", "neutral"],
    ["Underway", "neutral"],
    ["Low", "neutral"],
    ["Medium", "neutral"],
    ["Owner", "neutral"],
    ["Complete", "success"],
    ["Accepted", "success"],
    ["High", "attention"],
    ["Stalled", "attention"],
    ["Waiting", "attention"],
    ["Critical", "danger"],
    ["Blocked", "danger"],
    ["Rejected", "danger"],
    [null, "neutral"],
    ["Something new", "neutral"],
  ] as const)("gives %s the %s tone", (value, tone) => {
    expect(toneFor(value)).toBe(tone);
  });

  it("never colours the normal state or a role", () => {
    expect(statusPillClass("Active")).toBe("border-border text-muted-foreground");
    expect(rolePillClass()).toBe("border-border text-muted-foreground");
  });

  it("uses the same colour for the same meaning across value types", () => {
    // A high priority and a stalled paper both need a look.
    expect(statusPillClass("High")).toBe(statusPillClass("Stalled"));
    expect(statusBadgeClass("Critical")).toBe(statusBadgeClass("Blocked"));
  });
});
