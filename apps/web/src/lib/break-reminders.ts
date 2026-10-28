import type { BreakState } from "@/lib/break-state";

export interface BreakReminderSettings {
  enabled: boolean;
  workMinutes: number;
  breakMinutes: number;
  notifications: boolean;
  /** Play a chime with the reminder and when a break ends. */
  sound: boolean;
}

/** Minutes of continuous work before a reminder (25 is the Pomodoro rhythm). */
export const BREAK_WORK_MINUTES = [25, 45, 50, 60, 90] as const;
export const BREAK_LENGTH_MINUTES = [5, 10, 15, 20] as const;
/** The range allowed for a custom time, in whole minutes. */
export const BREAK_WORK_MINUTES_RANGE = { min: 5, max: 240 } as const;
export const BREAK_LENGTH_MINUTES_RANGE = { min: 1, max: 60 } as const;

export const DEFAULT_BREAK_REMINDERS: BreakReminderSettings = {
  enabled: true,
  workMinutes: 50,
  breakMinutes: 10,
  notifications: false,
  sound: true,
};

/** A pause at least this long counts as a break and starts a fresh spell. */
export const BREAK_RESET_MS = 5 * 60_000;
export const SNOOZE_MS = 10 * 60_000;
/** How often to note that the timer is still running. */
const HEARTBEAT_MS = 15_000;

export interface BreakSnapshot {
  now: number;
  settings: BreakReminderSettings;
  state: BreakState;
  /** A timer is open (running or paused). */
  timerOpen: boolean;
  /** When the running stretch began, or null when not running. */
  stretchStart: number | null;
}

export interface BreakDecision {
  /** Changes to store, or null when nothing changed. */
  update: Partial<BreakState> | null;
  /** Show the "time for a break" reminder now. */
  reminderDue: boolean;
  /** When the reminder is (or was) due. */
  reminderAt: number | null;
  /** How long the current spell of work has lasted. */
  workedMs: number;
  /** A break is in progress (the timer is paused for it). */
  onBreak: boolean;
  /** The break's time is up but work hasn't resumed. */
  breakOver: boolean;
}

/**
 * Decides, for one moment, whether to remind about a break. Work counts as
 * continuous across task switches and short pauses; a pause of five minutes
 * or more counts as a break.
 */
export function decideBreak({
  now,
  settings,
  state,
  timerOpen,
  stretchStart,
}: BreakSnapshot): BreakDecision {
  const next: Partial<BreakState> = {};
  const running = stretchStart !== null;

  let streakStart = state.streakStart;
  let snoozeUntil = state.snoozeUntil;
  let breakEndsAt = state.breakEndsAt;

  if (running) {
    const gap =
      state.lastSeenRunningAt === null
        ? Number.POSITIVE_INFINITY
        : stretchStart - state.lastSeenRunningAt;
    if (streakStart === null || gap >= BREAK_RESET_MS) {
      streakStart = stretchStart;
      snoozeUntil = null;
    }
    // Back at work, so any break is over.
    breakEndsAt = null;
    if (
      state.lastSeenRunningAt === null ||
      now - state.lastSeenRunningAt >= HEARTBEAT_MS
    ) {
      next.lastSeenRunningAt = now;
    }
  } else {
    if (
      streakStart !== null &&
      state.lastSeenRunningAt !== null &&
      now - state.lastSeenRunningAt >= BREAK_RESET_MS
    ) {
      streakStart = null;
      snoozeUntil = null;
    }
    // With the timer stopped there is nothing to come back to.
    if (!timerOpen) breakEndsAt = null;
  }

  if (streakStart !== state.streakStart) next.streakStart = streakStart;
  if (snoozeUntil !== state.snoozeUntil) next.snoozeUntil = snoozeUntil;
  if (breakEndsAt !== state.breakEndsAt) next.breakEndsAt = breakEndsAt;

  const reminderAt =
    streakStart === null
      ? null
      : Math.max(streakStart + settings.workMinutes * 60_000, snoozeUntil ?? 0);
  const onBreak = !running && timerOpen && breakEndsAt !== null;

  return {
    update: Object.keys(next).length > 0 ? next : null,
    reminderDue:
      settings.enabled && running && reminderAt !== null && now >= reminderAt,
    reminderAt,
    workedMs: streakStart === null ? 0 : Math.max(0, now - streakStart),
    onBreak,
    breakOver: onBreak && now >= (breakEndsAt ?? Infinity),
  };
}
