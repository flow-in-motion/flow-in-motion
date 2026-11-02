/**
 * A stand-in for "@/api/time-tracking" in page tests that don't render a
 * QueryClientProvider. Use it with:
 *   vi.mock("@/api/time-tracking", () => import("@/test/time-tracking-mock"));
 * and set `timeTrackingState` to show a running timer.
 */
import { vi } from "vitest";

import type {
  ApiTaskTime,
  CurrentTimer,
} from "@/api/time-tracking";

export const timeTrackingState: {
  current: CurrentTimer;
  taskTime: ApiTaskTime | undefined;
  breakReminders: {
    enabled: boolean;
    workMinutes: number;
    breakMinutes: number;
    notifications: boolean;
    sound: boolean;
  };
  saveBreakReminders: ReturnType<typeof vi.fn>;
  /** What the Pause button does; replace it to simulate pausing. */
  pauseTimer: ReturnType<typeof vi.fn>;
} = {
  current: { timers: [], receivedAt: 0 },
  taskTime: undefined,
  breakReminders: {
    enabled: true,
    workMinutes: 50,
    breakMinutes: 10,
    notifications: false,
    sound: true,
  },
  saveBreakReminders: vi.fn().mockResolvedValue(undefined),
  pauseTimer: vi.fn().mockResolvedValue({ timer: null }),
};

function mutation() {
  return {
    mutateAsync: vi.fn().mockResolvedValue({ timer: null }),
    isPending: false,
  };
}

export const timeTrackingKeys = {
  projectActivity: (projectId: string, timeZone: string) =>
    ["api", "me", "projects", projectId, "time-entries", "activity-streak", timeZone] as const,
  current: ["api", "me", "time-entries", "current"] as const,
  task: (taskId: string) =>
    ["api", "me", "tasks", taskId, "time-entries"] as const,
  paper: (moduleId: string) =>
    ["api", "me", "modules", moduleId, "time-entries"] as const,
};

export function useProjectActivityStreak() {
  return {
    data: { currentStreakDays: 0, lastActiveDate: null, inactiveDays: 0 },
    isPending: false,
    isError: false,
  };
}

export function useCurrentTimer() {
  return { data: timeTrackingState.current, isPending: false, isError: false };
}

export function useLiveTimer() {
  const current = timeTrackingState.current;

  const timers = current.timers.map((timer) => {
    const runningSeconds = timer.isRunning
      ? timer.runningSeconds +
        Math.max(0, (Date.now() - current.receivedAt) / 1000)
      : 0;

    return {
      ...timer,
      runningSeconds,
      elapsedSeconds: timer.durationSeconds + runningSeconds,
    };
  });

  return {
    query: useCurrentTimer(),
    timers,
    elapsedSecondsFor: (entryId: string, fallback = 0) =>
      timers.find((timer) => timer.id === entryId)?.elapsedSeconds ??
      fallback,
    extraSecondsFor: (taskId: string) =>
      timers.find((timer) => timer.taskId === taskId)?.runningSeconds ?? 0,
    extraSecondsForPaper: (moduleId: string) =>
      timers.find((timer) => timer.moduleId === moduleId)?.runningSeconds ??
      0,
  };
}

export function useTaskTime(taskId: string) {
  return {
    data: timeTrackingState.taskTime ?? {
      taskId,
      estimatedHours: null,
      entries: [],
      mySeconds: 0,
      totalSeconds: 0,
    },
    isPending: false,
    isError: false,
  };
}
export function usePaperTime(moduleId: string) {
  return {
    data: {
      moduleId,
      entries: [],
      mySeconds: 0,
      totalSeconds: 0,
    },
    isPending: false,
    isError: false,
  };
}

export const useStartPaperTimer = mutation;
export const useAddPaperTimeEntry = mutation;

export const useStartTimer = mutation;
export function usePauseTimer() {
  return { mutateAsync: timeTrackingState.pauseTimer, isPending: false };
}
export const useResumeTimer = mutation;
export const useStopTimer = mutation;
export const useAddTimeEntry = mutation;
export const useUpdateTimeEntry = mutation;
export const useDeleteTimeEntry = mutation;

export function useTicker() {
  return Date.now();
}

export function liveRunningSeconds() {
  return 0;
}

export function useBreakReminderSettings() {
  return { settings: timeTrackingState.breakReminders, isLoaded: true };
}

export function useSaveBreakReminderSettings() {
  return { save: timeTrackingState.saveBreakReminders, isPending: false };
}
