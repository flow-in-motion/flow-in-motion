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
  current: { timer: null, receivedAt: 0 },
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
  current: ["api", "me", "time-entries", "current"] as const,
  task: (taskId: string) =>
    ["api", "me", "tasks", taskId, "time-entries"] as const,
};

export function useCurrentTimer() {
  return { data: timeTrackingState.current, isPending: false, isError: false };
}

export function useLiveTimer() {
  const timer = timeTrackingState.current.timer;
  return {
    query: useCurrentTimer(),
    timer,
    elapsedSeconds: timer?.elapsedSeconds ?? 0,
    runningSeconds: timer?.isRunning ? timer.runningSeconds : 0,
    extraSecondsFor: (taskId: string) =>
      timer?.isRunning && timer.taskId === taskId ? timer.runningSeconds : 0,
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
