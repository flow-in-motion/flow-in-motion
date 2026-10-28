import { describe, expect, it } from "vitest";

import {
  BREAK_RESET_MS,
  DEFAULT_BREAK_REMINDERS,
  decideBreak,
} from "@/lib/break-reminders";
import { EMPTY_BREAK_STATE, type BreakState } from "@/lib/break-state";

const MINUTE = 60_000;
const NOW = Date.UTC(2026, 9, 28, 1, 0, 0);
const settings = { ...DEFAULT_BREAK_REMINDERS, workMinutes: 50 };

function decide(
  state: Partial<BreakState>,
  options: { stretchStart?: number | null; timerOpen?: boolean; now?: number; enabled?: boolean } = {},
) {
  const stretchStart = options.stretchStart === undefined ? NOW : options.stretchStart;
  return decideBreak({
    now: options.now ?? NOW,
    settings: { ...settings, enabled: options.enabled ?? true },
    state: { ...EMPTY_BREAK_STATE, ...state },
    timerOpen: options.timerOpen ?? stretchStart !== null,
    stretchStart,
  });
}

describe("decideBreak", () => {
  it("starts counting when a timer starts", () => {
    const decision = decide({}, { stretchStart: NOW - 10 * MINUTE });
    expect(decision.update).toEqual({
      streakStart: NOW - 10 * MINUTE,
      lastSeenRunningAt: NOW,
    });
    expect(decision.reminderDue).toBe(false);
    expect(decision.reminderAt).toBe(NOW + 40 * MINUTE);
  });

  it("reminds after the chosen time of continuous work", () => {
    const decision = decide(
      { streakStart: NOW - 51 * MINUTE, lastSeenRunningAt: NOW - 5_000 },
      { stretchStart: NOW - 51 * MINUTE },
    );
    expect(decision.reminderDue).toBe(true);
    expect(decision.workedMs).toBe(51 * MINUTE);
  });

  it("never reminds when reminders are off", () => {
    const decision = decide(
      { streakStart: NOW - 90 * MINUTE, lastSeenRunningAt: NOW - 5_000 },
      { stretchStart: NOW - 90 * MINUTE, enabled: false },
    );
    expect(decision.reminderDue).toBe(false);
  });

  it("keeps counting across a switch to another task", () => {
    const decision = decide(
      { streakStart: NOW - 55 * MINUTE, lastSeenRunningAt: NOW - 10_000 },
      { stretchStart: NOW - 2_000 },
    );
    expect(decision.update?.streakStart).toBeUndefined();
    expect(decision.reminderDue).toBe(true);
  });

  it("treats a pause of five minutes or more as a break", () => {
    const decision = decide(
      { streakStart: NOW - 70 * MINUTE, lastSeenRunningAt: NOW - BREAK_RESET_MS - 1 },
      { stretchStart: NOW },
    );
    expect(decision.update?.streakStart).toBe(NOW);
    expect(decision.reminderDue).toBe(false);
  });

  it("forgets the spell of work once paused for five minutes", () => {
    const decision = decide(
      { streakStart: NOW - 40 * MINUTE, lastSeenRunningAt: NOW - BREAK_RESET_MS },
      { stretchStart: null, timerOpen: true },
    );
    expect(decision.update).toEqual({ streakStart: null });
  });

  it("waits out a snooze", () => {
    const state = {
      streakStart: NOW - 55 * MINUTE,
      lastSeenRunningAt: NOW - 5_000,
      snoozeUntil: NOW + 5 * MINUTE,
    };
    expect(decide(state, { stretchStart: NOW - 55 * MINUTE }).reminderDue).toBe(false);
    expect(
      decide(state, { stretchStart: NOW - 55 * MINUTE, now: NOW + 5 * MINUTE }).reminderDue,
    ).toBe(true);
  });

  it("counts a break down, and ends it when work resumes", () => {
    const onBreak = decide(
      { breakEndsAt: NOW + 3 * MINUTE, lastSeenRunningAt: NOW - MINUTE },
      { stretchStart: null, timerOpen: true },
    );
    expect(onBreak.onBreak).toBe(true);
    expect(onBreak.breakOver).toBe(false);

    const over = decide(
      { breakEndsAt: NOW - 1, lastSeenRunningAt: NOW - 11 * MINUTE },
      { stretchStart: null, timerOpen: true },
    );
    expect(over.breakOver).toBe(true);

    const resumed = decide(
      { breakEndsAt: NOW + 3 * MINUTE, lastSeenRunningAt: NOW - 7 * MINUTE },
      { stretchStart: NOW },
    );
    expect(resumed.update).toEqual(
      expect.objectContaining({ breakEndsAt: null, streakStart: NOW }),
    );
  });

  it("drops a break when the timer is stopped", () => {
    const decision = decide(
      { breakEndsAt: NOW + 3 * MINUTE },
      { stretchStart: null, timerOpen: false },
    );
    expect(decision.update).toEqual({ breakEndsAt: null });
    expect(decision.onBreak).toBe(false);
  });
});
