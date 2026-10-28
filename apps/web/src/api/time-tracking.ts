import { useEffect, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import { authenticatedJson } from "@/api/client";
import {
  useAccountPreferences,
  useUpdateAccountPreferences,
} from "@/api/hooks";
import {
  DEFAULT_BREAK_REMINDERS,
  type BreakReminderSettings,
} from "@/lib/break-reminders";

/** The caller's open timer: running, or paused part-way through. */
export interface ApiTimer {
  id: string;
  taskId: string;
  tenantId: string;
  taskTitle: string;
  taskDisplayId: string | null;
  startedAt: string;
  isOpen: true;
  isRunning: boolean;
  /** Time logged so far, not counting the stretch running right now. */
  durationSeconds: number;
  /** The stretch running right now, when the server answered. */
  runningSeconds: number;
  elapsedSeconds: number;
}

export interface ApiTimeEntry {
  id: string;
  taskId: string;
  source: "timer" | "manual";
  startedAt: string;
  endedAt: string | null;
  note: string | null;
  isOpen: boolean;
  isRunning: boolean;
  durationSeconds: number;
  runningSeconds: number;
}

export interface ApiTaskTime {
  taskId: string;
  estimatedHours: string | null;
  /** The caller's own entries, newest first. */
  entries: ApiTimeEntry[];
  mySeconds: number;
  totalSeconds: number;
}

/** The timer, plus when it was fetched, so the clock can keep counting. */
export interface CurrentTimer {
  timer: ApiTimer | null;
  receivedAt: number;
}

export interface TimeEntryInput {
  /** ISO date-time when the work happened. */
  startedAt: string;
  minutes: number;
  note?: string | null;
}

export const timeTrackingKeys = {
  current: ["api", "me", "time-entries", "current"] as const,
  task: (taskId: string) =>
    ["api", "me", "tasks", taskId, "time-entries"] as const,
};

const encode = encodeURIComponent;

/** Task lists and details carry logged totals, so refresh them all. */
function refreshTaskTime(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    predicate: (query) =>
      query.queryKey.includes("tasks") || query.queryKey.includes("time-entries"),
  });
}

export function useCurrentTimer(enabled = true) {
  return useQuery({
    queryKey: timeTrackingKeys.current,
    enabled,
    // Another tab or computer may have started or stopped the timer.
    refetchOnWindowFocus: true,
    refetchInterval: (query) => (query.state.data?.timer ? 60_000 : false),
    queryFn: async (): Promise<CurrentTimer> => {
      const { timer } = await authenticatedJson<{ timer: ApiTimer | null }>(
        "/api/v1/me/time-entries/current",
      );
      return { timer, receivedAt: Date.now() };
    },
  });
}

function useTimerAction<TVariables = void>(
  request: (variables: TVariables) => Promise<{ timer: ApiTimer | null }>,
  options: { refreshTotals: boolean },
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    async onSuccess({ timer }) {
      queryClient.setQueryData<CurrentTimer>(timeTrackingKeys.current, {
        timer,
        receivedAt: Date.now(),
      });
      if (options.refreshTotals) await refreshTaskTime(queryClient);
    },
  });
}

/** Starts timing a task. Any other timer stops first, keeping its time. */
export function useStartTimer() {
  return useTimerAction(
    (taskId: string) =>
      authenticatedJson<{ timer: ApiTimer | null }>(
        "/api/v1/me/time-entries/timer/start",
        { method: "POST", body: JSON.stringify({ taskId }) },
      ),
    { refreshTotals: true },
  );
}

export function usePauseTimer() {
  return useTimerAction(
    () =>
      authenticatedJson<{ timer: ApiTimer | null }>(
        "/api/v1/me/time-entries/timer/pause",
        { method: "POST" },
      ),
    { refreshTotals: true },
  );
}

export function useResumeTimer() {
  return useTimerAction(
    () =>
      authenticatedJson<{ timer: ApiTimer | null }>(
        "/api/v1/me/time-entries/timer/resume",
        { method: "POST" },
      ),
    { refreshTotals: false },
  );
}

export function useStopTimer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      authenticatedJson<{ stopped: ApiTimeEntry | null }>(
        "/api/v1/me/time-entries/timer/stop",
        { method: "POST" },
      ),
    async onSuccess() {
      queryClient.setQueryData<CurrentTimer>(timeTrackingKeys.current, {
        timer: null,
        receivedAt: Date.now(),
      });
      await refreshTaskTime(queryClient);
    },
  });
}

/** The caller's time on one task, with the task's totals. */
export function useTaskTime(taskId: string, enabled = true) {
  return useQuery({
    queryKey: timeTrackingKeys.task(taskId),
    enabled: Boolean(taskId) && enabled,
    queryFn: () =>
      authenticatedJson<ApiTaskTime>(
        `/api/v1/me/tasks/${encode(taskId)}/time-entries`,
      ),
  });
}

export function useAddTimeEntry(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TimeEntryInput) =>
      authenticatedJson<ApiTimeEntry>(
        `/api/v1/me/tasks/${encode(taskId)}/time-entries`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    onSuccess: () => refreshTaskTime(queryClient),
  });
}

export function useUpdateTimeEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      entryId,
      input,
    }: {
      entryId: string;
      input: Partial<TimeEntryInput>;
    }) =>
      authenticatedJson<ApiTimeEntry>(
        `/api/v1/me/time-entries/${encode(entryId)}`,
        { method: "PATCH", body: JSON.stringify(input) },
      ),
    onSuccess: () => refreshTaskTime(queryClient),
  });
}

export function useDeleteTimeEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) =>
      authenticatedJson<{ id: string; taskId: string }>(
        `/api/v1/me/time-entries/${encode(entryId)}`,
        { method: "DELETE" },
      ),
    onSuccess: () => refreshTaskTime(queryClient),
  });
}

/** Re-renders every second while `active`, returning the current time. */
export function useTicker(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

/** Seconds in the stretch running right now, counted up to `now`. */
export function liveRunningSeconds(current: CurrentTimer | undefined, now: number) {
  const timer = current?.timer;
  if (!timer?.isRunning) return 0;
  return timer.runningSeconds + Math.max(0, (now - current!.receivedAt) / 1000);
}

/**
 * The open timer, ticking live. `extraSecondsFor(taskId)` is the running
 * stretch to add to a task's logged total (the server totals leave it out).
 */
export function useLiveTimer() {
  const query = useCurrentTimer();
  const timer = query.data?.timer ?? null;
  const now = useTicker(Boolean(timer?.isRunning));
  const running = liveRunningSeconds(query.data, now);
  return {
    query,
    timer,
    elapsedSeconds: timer ? timer.durationSeconds + running : 0,
    runningSeconds: running,
    extraSecondsFor: (taskId: string) =>
      timer && timer.taskId === taskId ? running : 0,
  };
}

/** The caller's break reminder settings, with defaults filled in. */
export function useBreakReminderSettings() {
  const query = useAccountPreferences();
  const stored = query.data?.breakReminders;
  const settings: BreakReminderSettings = {
    ...DEFAULT_BREAK_REMINDERS,
    ...(stored ?? {}),
  };
  return { settings, isLoaded: query.isSuccess || query.isError };
}

export function useSaveBreakReminderSettings() {
  const update = useUpdateAccountPreferences();
  return {
    save: (breakReminders: BreakReminderSettings) =>
      update.mutateAsync({ breakReminders }),
    isPending: update.isPending,
  };
}
