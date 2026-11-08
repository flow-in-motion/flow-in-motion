import { lazy, Suspense, useState } from "react";
import { Pause, Play, Square } from "lucide-react";
import { Link } from "react-router-dom";
import {
  useCurrentWorkTimers,
  useWorkTimeAction,
  workElapsed,
  type WorkTimer,
} from "@/api/work-time-tracking";
import { useTicker } from "@/api/time-tracking";
import { Button } from "@/components/ui/button";
import { formatClock } from "@/lib/time-format";
import { cn } from "@/lib/utils";
const WorkTimeDialog = lazy(async () => ({
  default: (await import("./work-time-dialog")).WorkTimeDialog,
}));
function WorkTimerRow({
  timer,
  receivedAt,
}: {
  timer: WorkTimer;
  receivedAt: number;
}) {
  const action = useWorkTimeAction();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  async function run(verb: "pause" | "resume" | "stop") {
    setError(null);
    try {
      await action.mutateAsync({ action: verb, entryId: timer.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the timer.");
    }
  }
  const path =
    timer.kind === "project"
      ? `/projects/${timer.targetId}`
      : timer.kind === "note"
        ? `/daily-notes/${timer.targetId}`
        : null;
  return (
    <div
      role="region"
      aria-label={`${timer.kind === "hdr" ? "HDR" : timer.kind === "project" ? "Project" : "Note"} timer: ${timer.title}`}
      className={cn(
        "border-b last:border-b-0",
        timer.isRunning
          ? "border-emerald-200 bg-emerald-50/90 dark:border-emerald-900 dark:bg-emerald-950/70"
          : "border-amber-200 bg-amber-50/90 dark:border-amber-900 dark:bg-amber-950/70",
      )}
    >
      <div className="mx-auto flex w-full max-w-[1480px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 sm:px-6 xl:px-10">
        <span className="flex min-w-0 flex-1 items-center gap-2 text-sm">
          <span
            aria-hidden="true"
            className={cn(
              "h-2.5 w-2.5 shrink-0 rounded-full",
              timer.isRunning ? "animate-pulse bg-emerald-500" : "bg-amber-500",
            )}
          />
          <span className="shrink-0 text-muted-foreground">
            {timer.isRunning ? "Working on" : "Paused"}
          </span>
          {path ? (
            <Link
              className="truncate font-semibold text-foreground hover:underline"
              to={path}
            >
              {timer.title}
            </Link>
          ) : (
            <button
              type="button"
              className="truncate font-semibold text-foreground hover:underline"
              onClick={() => setOpen(true)}
            >
              {timer.title}
            </button>
          )}
        </span>
        <span
          role="timer"
          aria-label={`Time on ${timer.title}`}
          className="font-mono text-sm font-semibold tabular-nums"
        >
          {formatClock(workElapsed(timer, receivedAt))}
        </span>
        <span className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={action.isPending}
            aria-label={`${timer.isRunning ? "Pause" : "Resume"} timer for ${timer.title}`}
            onClick={() => void run(timer.isRunning ? "pause" : "resume")}
          >
            {timer.isRunning ? <Pause /> : <Play />}
            {timer.isRunning ? "Pause" : "Resume"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={action.isPending}
            aria-label={`Stop timer for ${timer.title}`}
            onClick={() => void run("stop")}
          >
            <Square /> Stop
          </Button>
        </span>
        {error ? (
          <p role="alert" className="w-full text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>
      {open ? (
        <Suspense fallback={null}>
          <WorkTimeDialog
            kind={timer.kind}
            targetId={timer.targetId}
            title={timer.title}
            onClose={() => setOpen(false)}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
export function WorkRunningTimers() {
  const query = useCurrentWorkTimers();
  const timers = query.data?.timers ?? [];
  useTicker(timers.some((t) => t.isRunning));
  if (!timers.length) return null;
  return (
    <div
      role="region"
      aria-label="Open project, note and HDR timers"
      className="border-b backdrop-blur-xl"
    >
      {timers.map((timer) => (
        <WorkTimerRow
          key={timer.id}
          timer={timer}
          receivedAt={query.data!.receivedAt}
        />
      ))}
    </div>
  );
}
