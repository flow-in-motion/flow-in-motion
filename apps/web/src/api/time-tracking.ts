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
  taskId: string | null;
  moduleId?: string | null;
  tenantId: string;
  taskTitle: string | null;
  paperTitle?: string | null;
  paperDisplayId?: string | null;
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
  taskId: string | null;
  moduleId?: string | null;
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
export interface ApiPaperTime {
  moduleId: string;
  entries: ApiTimeEntry[];
  mySeconds: number;
  totalSeconds: number;
}

/** The timer, plus when it was fetched, so the clock can keep counting. */
export interface CurrentTimer {
  timers: ApiTimer[];
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
  paper: (moduleId: string) =>
    ["api", "me", "modules", moduleId, "time-entries"] as const,
};

const encode = encodeURIComponent;

/** Task lists and details carry logged totals, so refresh them all. */
/** Refresh saved totals and entries for tasks and papers. */
function refreshTaskTime(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    predicate: (query) =>
      query.queryKey.includes("tasks") ||
      query.queryKey.includes("modules") ||
      query.queryKey.includes("time-entries"),
  });
}

export function useCurrentTimer(enabled = true) {
  return useQuery({
    queryKey: timeTrackingKeys.current,
    enabled,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
    queryFn: async (): Promise<CurrentTimer> => {
      const { timers } = await authenticatedJson<{ timers: ApiTimer[] }>(
        "/api/v1/me/time-entries/current",
      );

      return { timers, receivedAt: Date.now() };
    },
  });
}

function useTimerAction<TVariables>(
  request: (variables: TVariables) => Promise<{ timer: ApiTimer | null }>,
  options: { refreshTotals: boolean },
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: request,
    async onSuccess() {
      if (options.refreshTotals) {
        await refreshTaskTime(queryClient);
      } else {
        await queryClient.invalidateQueries({
          queryKey: timeTrackingKeys.current,
        });
      }
    },
  });
}

/** Starts this task's timer without stopping other timers. */
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
    (entryId: string) =>
      authenticatedJson<{ timer: ApiTimer | null }>(
        `/api/v1/me/time-entries/timer/${encode(entryId)}/pause`,
        { method: "POST" },
      ),
    { refreshTotals: true },
  );
}

export function useResumeTimer() {
  return useTimerAction(
    (entryId: string) =>
      authenticatedJson<{ timer: ApiTimer | null }>(
        `/api/v1/me/time-entries/timer/${encode(entryId)}/resume`,
        { method: "POST" },
      ),
    { refreshTotals: false },
  );
}

export function useStopTimer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (entryId: string) =>
      authenticatedJson<{ stopped: ApiTimeEntry | null }>(
        `/api/v1/me/time-entries/timer/${encode(entryId)}/stop`,
        { method: "POST" },
      ),
    onSuccess: () => refreshTaskTime(queryClient),
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
export function useStartPaperTimer() {
  return useTimerAction(
    (moduleId: string) =>
      authenticatedJson<{ timer: ApiTimer | null }>(
        "/api/v1/me/time-entries/timer/start-paper",
        { method: "POST", body: JSON.stringify({ moduleId }) },
      ),
    { refreshTotals: true },
  );
}

export function usePaperTime(moduleId: string, enabled = true) {
  return useQuery({
    queryKey: timeTrackingKeys.paper(moduleId),
    enabled: Boolean(moduleId) && enabled,
    queryFn: () =>
      authenticatedJson<ApiPaperTime>(
        `/api/v1/me/modules/${encode(moduleId)}/time-entries`,
      ),
  });
}

export function useAddPaperTimeEntry(moduleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TimeEntryInput) =>
      authenticatedJson<ApiTimeEntry>(
        `/api/v1/me/modules/${encode(moduleId)}/time-entries`,
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
      authenticatedJson<{
        id: string;
        taskId: string | null;
        moduleId: string | null;
      }>(
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

/** The running stretch for one entry, counted up to `now`. */
export function liveRunningSeconds(
  current: CurrentTimer | undefined,
  now: number,
  entryId: string,
) {
  const timer = current?.timers.find((item) => item.id === entryId);

  if (!current || !timer?.isRunning) return 0;

  return (
    timer.runningSeconds +
    Math.max(0, (now - current.receivedAt) / 1000)
  );
}

/** All open timers, each with its own live elapsed time. */
export function useLiveTimer() {
  const query = useCurrentTimer();
  const storedTimers = query.data?.timers ?? [];
  const now = useTicker(storedTimers.some((timer) => timer.isRunning));

  const timers = storedTimers.map((timer) => {
    const runningSeconds = liveRunningSeconds(query.data, now, timer.id);

    return {
      ...timer,
      runningSeconds,
      elapsedSeconds: timer.durationSeconds + runningSeconds,
    };
  });

  return {
    query,
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
