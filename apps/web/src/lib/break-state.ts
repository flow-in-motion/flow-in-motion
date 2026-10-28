import { useSyncExternalStore } from "react";

/**
 * What the break reminder needs to remember between page loads and across
 * tabs: when the current spell of work began, a snooze, and a break in
 * progress. Kept in this browser only.
 */
export interface BreakState {
  /** When the current spell of work began (ms since epoch). */
  streakStart: number | null;
  /** The last moment a running timer was seen (ms), to spot real breaks. */
  lastSeenRunningAt: number | null;
  /** Don't remind again before this time (ms). */
  snoozeUntil: number | null;
  /** The break being taken ends at this time (ms). */
  breakEndsAt: number | null;
  /** The reminder time a system notification was already shown for. */
  notifiedFor: number | null;
  /** The break end a "break's over" notification was already shown for. */
  notifiedBreakEnd: number | null;
  /** The reminder time the chime already played for. */
  chimedFor: number | null;
  /** The break end the "break's over" chime already played for. */
  chimedBreakEnd: number | null;
}

export const EMPTY_BREAK_STATE: BreakState = {
  streakStart: null,
  lastSeenRunningAt: null,
  snoozeUntil: null,
  breakEndsAt: null,
  notifiedFor: null,
  notifiedBreakEnd: null,
  chimedFor: null,
  chimedBreakEnd: null,
};

const STORAGE_KEY = "rim:break-reminders";

let memory: BreakState = EMPTY_BREAK_STATE;
let cachedRaw: string | null | undefined;
const listeners = new Set<() => void>();

function readStorage(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function parse(raw: string | null): BreakState {
  if (!raw) return EMPTY_BREAK_STATE;
  try {
    const value = JSON.parse(raw) as Partial<BreakState>;
    const time = (input: unknown) =>
      typeof input === "number" && Number.isFinite(input) ? input : null;
    return {
      streakStart: time(value.streakStart),
      lastSeenRunningAt: time(value.lastSeenRunningAt),
      snoozeUntil: time(value.snoozeUntil),
      breakEndsAt: time(value.breakEndsAt),
      notifiedFor: time(value.notifiedFor),
      notifiedBreakEnd: time(value.notifiedBreakEnd),
      chimedFor: time(value.chimedFor),
      chimedBreakEnd: time(value.chimedBreakEnd),
    };
  } catch {
    return EMPTY_BREAK_STATE;
  }
}

export function getBreakState(): BreakState {
  const raw = readStorage();
  if (raw === null) return memory;
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    memory = parse(raw);
  }
  return memory;
}

export function setBreakState(update: Partial<BreakState>) {
  const next = { ...getBreakState(), ...update };
  memory = next;
  const raw = JSON.stringify(next);
  cachedRaw = raw;
  try {
    window.localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // Without storage the state still works for this page.
  }
  listeners.forEach((listener) => listener());
}

export function resetBreakState() {
  memory = EMPTY_BREAK_STATE;
  cachedRaw = undefined;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing stored.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab changed it.
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useBreakState() {
  return useSyncExternalStore(subscribe, getBreakState, () => EMPTY_BREAK_STATE);
}
