import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import { authenticatedJson } from "@/api/client";
import { useAuth } from "@/auth/auth-provider";
import { useTicker } from "@/api/time-tracking";

/** The caller's open timer: running, or paused part-way through. */
export interface ApiPaperTimer {
  id: string;
  paperId: string;
  tenantId: string;
  paperTitle: string;
  paperDisplayId: string | null;
  startedAt: string;
  isOpen: true;
  isRunning: boolean;
  /** Time logged so far, not counting the stretch running right now. */
  durationSeconds: number;
  /** The stretch running right now, when the server answered. */
  runningSeconds: number;
  elapsedSeconds: number;
}

export interface ApiPaperTimeEntry {
  id: string;
  paperId: string;
  source: "timer" | "manual";
  startedAt: string;
  endedAt: string | null;
  note: string | null;
  isOpen: boolean;
  isRunning: boolean;
  durationSeconds: number;
  runningSeconds: number;
}

export interface ApiPaperTime {
  paperId: string;
  /** The caller's own entries, newest first. */
  entries: ApiPaperTimeEntry[];
  mySeconds: number;
  totalSeconds: number;
}

/** The timer, plus when it was fetched, so the clock can keep counting. */
export interface CurrentPaperTimer {
  timer: ApiPaperTimer | null;
  receivedAt: number;
}

export interface PaperTimeEntryInput {
  /** ISO date-time when the work happened. */
  startedAt: string;
  minutes: number;
  note?: string | null;
}

export const paperTimeTrackingKeys = {
  current: ["api", "me", "paper-time-entries", "current"] as const,
  paper: (paperId: string) =>
    ["api", "me", "modules", paperId, "paper-time-entries"] as const,
};

const encode = encodeURIComponent;

/** Refresh only paper time queries; task and paper content caches are unchanged. */
function refreshPaperTime(queryClient: QueryClient, owner: string) {
  return queryClient.invalidateQueries({
    predicate: (query) =>
      query.queryKey.includes("paper-time-entries") &&
      query.queryKey.includes(owner),
  });
}

export function useCurrentPaperTimer(enabled = true) {
  const owner = useAuth().user?.id ?? "";
  return useQuery({
    queryKey: [...paperTimeTrackingKeys.current, owner],
    enabled: Boolean(owner) && enabled,
    // Another tab or computer may have started or stopped the timer.
    refetchOnWindowFocus: true,
    refetchInterval: (query) => (query.state.data?.timer ? 60_000 : false),
    queryFn: async (): Promise<CurrentPaperTimer> => {
      const { timer } = await authenticatedJson<{
        timer: ApiPaperTimer | null;
      }>("/api/v1/me/paper-time-entries/current");
      return { timer, receivedAt: Date.now() };
    },
  });
}

function usePaperTimerAction<TVariables = void>(
  request: (variables: TVariables) => Promise<{ timer: ApiPaperTimer | null }>,
  options: { refreshTotals: boolean },
) {
  const queryClient = useQueryClient();
  const owner = useAuth().user?.id ?? "";
  return useMutation({
    mutationFn: request,
    async onSuccess({ timer }) {
      queryClient.setQueryData<CurrentPaperTimer>(
        [...paperTimeTrackingKeys.current, owner],
        {
          timer,
          receivedAt: Date.now(),
        },
      );
      if (options.refreshTotals) await refreshPaperTime(queryClient, owner);
    },
  });
}

/** Starts timing a paper. Any other paper timer stops first, keeping its time. */
export function useStartPaperTimer() {
  return usePaperTimerAction(
    (paperId: string) =>
      authenticatedJson<{ timer: ApiPaperTimer | null }>(
        "/api/v1/me/paper-time-entries/timer/start",
        { method: "POST", body: JSON.stringify({ paperId }) },
      ),
    { refreshTotals: true },
  );
}

export function usePausePaperTimer() {
  return usePaperTimerAction(
    () =>
      authenticatedJson<{ timer: ApiPaperTimer | null }>(
        "/api/v1/me/paper-time-entries/timer/pause",
        { method: "POST" },
      ),
    { refreshTotals: true },
  );
}

export function useResumePaperTimer() {
  return usePaperTimerAction(
    () =>
      authenticatedJson<{ timer: ApiPaperTimer | null }>(
        "/api/v1/me/paper-time-entries/timer/resume",
        { method: "POST" },
      ),
    { refreshTotals: false },
  );
}

export function useStopPaperTimer() {
  const queryClient = useQueryClient();
  const owner = useAuth().user?.id ?? "";
  return useMutation({
    mutationFn: () =>
      authenticatedJson<{ stopped: ApiPaperTimeEntry | null }>(
        "/api/v1/me/paper-time-entries/timer/stop",
        { method: "POST" },
      ),
    async onSuccess() {
      queryClient.setQueryData<CurrentPaperTimer>(
        [...paperTimeTrackingKeys.current, owner],
        {
          timer: null,
          receivedAt: Date.now(),
        },
      );
      await refreshPaperTime(queryClient, owner);
    },
  });
}

/** The caller's time on one paper, with the paper's totals. */
export function usePaperTime(paperId: string, enabled = true) {
  const owner = useAuth().user?.id ?? "";
  return useQuery({
    queryKey: [...paperTimeTrackingKeys.paper(paperId), owner],
    enabled: Boolean(paperId && owner) && enabled,
    queryFn: () =>
      authenticatedJson<ApiPaperTime>(
        `/api/v1/me/modules/${encode(paperId)}/time-entries`,
      ),
  });
}

export function useAddPaperTimeEntry(paperId: string) {
  const queryClient = useQueryClient();
  const owner = useAuth().user?.id ?? "";
  return useMutation({
    mutationFn: (input: PaperTimeEntryInput) =>
      authenticatedJson<ApiPaperTimeEntry>(
        `/api/v1/me/modules/${encode(paperId)}/time-entries`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    onSuccess: () => refreshPaperTime(queryClient, owner),
  });
}

export function useUpdatePaperTimeEntry() {
  const queryClient = useQueryClient();
  const owner = useAuth().user?.id ?? "";
  return useMutation({
    mutationFn: ({
      entryId,
      input,
    }: {
      entryId: string;
      input: Partial<PaperTimeEntryInput>;
    }) =>
      authenticatedJson<ApiPaperTimeEntry>(
        `/api/v1/me/paper-time-entries/${encode(entryId)}`,
        { method: "PATCH", body: JSON.stringify(input) },
      ),
    onSuccess: () => refreshPaperTime(queryClient, owner),
  });
}

export function useDeletePaperTimeEntry() {
  const queryClient = useQueryClient();
  const owner = useAuth().user?.id ?? "";
  return useMutation({
    mutationFn: (entryId: string) =>
      authenticatedJson<{ id: string; paperId: string }>(
        `/api/v1/me/paper-time-entries/${encode(entryId)}`,
        { method: "DELETE" },
      ),
    onSuccess: () => refreshPaperTime(queryClient, owner),
  });
}

/** The paper clock ticks locally; no request is made every second. */
export function useLivePaperTimer() {
  const query = useCurrentPaperTimer();
  const timer = query.data?.timer ?? null;
  const now = useTicker(Boolean(timer?.isRunning));
  const running = timer?.isRunning
    ? timer.runningSeconds + Math.max(0, (now - query.data!.receivedAt) / 1000)
    : 0;
  return {
    query,
    timer,
    elapsedSeconds: timer ? timer.durationSeconds + running : 0,
    runningSeconds: running,
    extraSecondsFor: (paperId: string) =>
      timer?.paperId === paperId ? running : 0,
  };
}
