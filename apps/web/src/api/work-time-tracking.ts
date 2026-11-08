import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authenticatedJson } from "@/api/client";
import { useAuth } from "@/auth/auth-provider";
import type { ApiTimeEntry, TimeEntryInput } from "@/api/time-tracking";

export type WorkTimeKind = "project" | "note" | "hdr";
export interface WorkTimeTarget {
  kind: WorkTimeKind;
  targetId: string;
}
export interface WorkTimeEntry
  extends Omit<ApiTimeEntry, "taskId" | "moduleId">, WorkTimeTarget {}
export interface WorkTimer extends WorkTimeEntry {
  title: string;
  tenantId: string;
}
export interface WorkTimeData {
  entries: WorkTimeEntry[];
  mySeconds: number;
  receivedAt: number;
}
const base = "/api/v1/me/work-time-entries";
const prefix = ["api", "work-time-entries"] as const;
export function workItemPath(target: WorkTimeTarget) {
  return `${base}/items/${target.kind}/${encodeURIComponent(target.targetId)}`;
}
export function useCurrentWorkTimers() {
  const owner = useAuth().user?.id ?? "";
  return useQuery({
    queryKey: [...prefix, owner, "current"],
    enabled: Boolean(owner),
    staleTime: 30_000,
    // One shared request; focus/mutations refresh state. No polling workload.
    queryFn: async () => ({
      ...(await authenticatedJson<{ timers: WorkTimer[] }>(`${base}/current`)),
      receivedAt: Date.now(),
    }),
  });
}
export function useWorkTime(target: WorkTimeTarget) {
  const owner = useAuth().user?.id ?? "";
  return useQuery({
    queryKey: [...prefix, owner, target.kind, target.targetId],
    enabled: Boolean(owner && target.targetId),
    queryFn: async (): Promise<WorkTimeData> => ({
      ...(await authenticatedJson<Omit<WorkTimeData, "receivedAt">>(
        workItemPath(target),
      )),
      receivedAt: Date.now(),
    }),
  });
}
type Operation =
  | ({ action: "start" } & WorkTimeTarget)
  | { action: "pause" | "resume" | "stop" | "delete"; entryId: string }
  | ({ action: "add"; input: TimeEntryInput } & WorkTimeTarget)
  | { action: "edit"; entryId: string; input: TimeEntryInput };
export function useWorkTimeAction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (op: Operation) => {
      if (op.action === "start")
        return authenticatedJson(`${base}/timer/start`, {
          method: "POST",
          body: JSON.stringify({ kind: op.kind, targetId: op.targetId }),
        });
      if (op.action === "add")
        return authenticatedJson(workItemPath(op), {
          method: "POST",
          body: JSON.stringify(op.input),
        });
      if (op.action === "edit")
        return authenticatedJson(`${base}/${encodeURIComponent(op.entryId)}`, {
          method: "PATCH",
          body: JSON.stringify(op.input),
        });
      if (op.action === "delete")
        return authenticatedJson(`${base}/${encodeURIComponent(op.entryId)}`, {
          method: "DELETE",
        });
      return authenticatedJson(
        `${base}/timer/${encodeURIComponent(op.entryId)}/${op.action}`,
        { method: "POST" },
      );
    },
    onSuccess: () => client.invalidateQueries({ queryKey: prefix }),
  });
}
export function workElapsed(
  entry: WorkTimeEntry,
  receivedAt: number | undefined,
  now = Date.now(),
) {
  return (
    entry.durationSeconds +
    entry.runningSeconds +
    (entry.isRunning && receivedAt
      ? Math.max(0, Math.floor((now - receivedAt) / 1000))
      : 0)
  );
}
