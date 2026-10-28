import { useLiveTimer } from "@/api/time-tracking";
import { estimateSeconds } from "@/lib/time-format";

import { TimeProgress } from "./time-progress";

interface SummaryTask {
  id: string;
  estimatedHours?: string | null;
  loggedSeconds?: number;
}

/**
 * Estimated vs logged time across a set of tasks (a project's or a
 * paper's). Shows nothing until a task has an estimate or some time.
 */
export function TaskTimeSummary({
  tasks,
  label,
}: {
  tasks: SummaryTask[];
  label: string;
}) {
  const live = useLiveTimer();

  let estimate = 0;
  let hasEstimate = false;
  let logged = 0;
  for (const task of tasks) {
    const taskEstimate = estimateSeconds(task.estimatedHours);
    if (taskEstimate !== null) {
      estimate += taskEstimate;
      hasEstimate = true;
    }
    logged += (task.loggedSeconds ?? 0) + live.extraSecondsFor(task.id);
  }

  if (!hasEstimate && logged === 0) return null;

  return (
    <TimeProgress
      loggedSeconds={logged}
      estimateSeconds={hasEstimate ? estimate : null}
      label={label}
      className="mb-4 rounded-md border border-border/70 bg-muted/20 px-3 py-2.5"
    />
  );
}
