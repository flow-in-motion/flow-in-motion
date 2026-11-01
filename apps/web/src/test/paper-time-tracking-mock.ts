/**
 * A stand-in for "@/api/paper-time-tracking" in page tests that don't render a
 * QueryClientProvider. Use it with:
 *   vi.mock("@/api/paper-time-tracking", () => import("@/test/time-tracking-mock"));
 * and set `paperTimeTrackingState` to show a running timer.
 */
import { vi } from "vitest";

import type {
  ApiPaperTime,
  CurrentPaperTimer,
} from "@/api/paper-time-tracking";

export const paperTimeTrackingState: {
  current: CurrentPaperTimer;
  paperTime: ApiPaperTime | undefined;
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
  paperTime: undefined,
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

export const paperTimeTrackingKeys = {
  current: ["api", "me", "paper-time-entries", "current"] as const,
  paper: (paperId: string) =>
    ["api", "me", "modules", paperId, "paper-time-entries"] as const,
};

export function useCurrentPaperTimer() {
  return {
    data: paperTimeTrackingState.current,
    isPending: false,
    isError: false,
  };
}

export function useLivePaperTimer() {
  const timer = paperTimeTrackingState.current.timer;
  return {
    query: useCurrentPaperTimer(),
    timer,
    elapsedSeconds: timer?.elapsedSeconds ?? 0,
    runningSeconds: timer?.isRunning ? timer.runningSeconds : 0,
    extraSecondsFor: (paperId: string) =>
      timer?.isRunning && timer.paperId === paperId ? timer.runningSeconds : 0,
  };
}

export function usePaperTime(paperId: string) {
  return {
    data: paperTimeTrackingState.paperTime ?? {
      paperId,
      entries: [],
      mySeconds: 0,
      totalSeconds: 0,
    },
    isPending: false,
    isError: false,
  };
}

export const useStartPaperTimer = mutation;
export function usePausePaperTimer() {
  return { mutateAsync: paperTimeTrackingState.pauseTimer, isPending: false };
}
export const useResumePaperTimer = mutation;
export const useStopPaperTimer = mutation;
export const useAddPaperTimeEntry = mutation;
export const useUpdatePaperTimeEntry = mutation;
export const useDeletePaperTimeEntry = mutation;

export function useTicker() {
  return Date.now();
}

export function liveRunningSeconds() {
  return 0;
}
