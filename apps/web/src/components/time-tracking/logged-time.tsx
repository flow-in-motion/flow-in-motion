import { useLiveTimer } from "@/api/time-tracking";
import { formatDuration } from "@/lib/time-format";

/** A task's logged time (everyone's), counting a running timer live. */
export function LoggedTime({
  task,
  emptyLabel = "—",
}: {
  task: { id: string; loggedSeconds?: number };
  emptyLabel?: string;
}) {
  const live = useLiveTimer();
  const seconds = (task.loggedSeconds ?? 0) + live.extraSecondsFor(task.id);
  return <>{seconds > 0 ? formatDuration(seconds) : emptyLabel}</>;
}
