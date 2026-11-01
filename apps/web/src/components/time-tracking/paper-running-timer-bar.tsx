import { useState } from "react";
import { Pause, Play, Square } from "lucide-react";
import { Link } from "react-router-dom";

import {
  useLivePaperTimer,
  usePausePaperTimer,
  useResumePaperTimer,
  useStopPaperTimer,
} from "@/api/paper-time-tracking";
import { Button } from "@/components/ui/button";
import { formatClock } from "@/lib/time-format";
import { cn } from "@/lib/utils";

/** Paper timer controls, independent of task timers and break reminders. */
export function PaperRunningTimerBar({ className }: { className?: string }) {
  const { timer, elapsedSeconds } = useLivePaperTimer();
  const pause = usePausePaperTimer();
  const resume = useResumePaperTimer();
  const stop = useStopPaperTimer();
  const [error, setError] = useState<string | null>(null);
  if (!timer) return null;
  const status = timer.isRunning ? "Working on paper" : "Paper paused";

  const isPending = pause.isPending || resume.isPending || stop.isPending;

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Couldn't update the timer. Please try again.",
      );
    }
  }

  return (
    <div
      role="region"
      aria-label="Paper timer"
      className={cn(
        "z-20 border-b backdrop-blur-xl",
        timer.isRunning
          ? "border-emerald-200 bg-emerald-50/90 dark:border-emerald-900 dark:bg-emerald-950/70"
          : "border-amber-200 bg-amber-50/90 dark:border-amber-900 dark:bg-amber-950/70",
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-[1480px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 sm:px-6 xl:px-10">
        <span className="flex min-w-0 items-center gap-2 text-sm">
          <span
            aria-hidden="true"
            className={cn(
              "h-2.5 w-2.5 shrink-0 rounded-full",
              timer.isRunning ? "animate-pulse bg-emerald-500" : "bg-amber-500",
            )}
          />
          <span className="shrink-0 text-muted-foreground">{status}</span>
          <Link
            to={`/modules/${timer.paperId}`}
            className="truncate font-semibold text-foreground hover:underline"
          >
            {timer.paperTitle}
          </Link>
        </span>
        <span
          role="timer"
          aria-label="Time on this paper"
          className="font-mono text-sm font-semibold tabular-nums"
        >
          {formatClock(elapsedSeconds)}
        </span>
        <span className="ml-auto flex items-center gap-2">
          {timer.isRunning ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => void run(() => pause.mutateAsync())}
            >
              <Pause /> Pause
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() =>
                void run(async () => {
                  await resume.mutateAsync();
                })
              }
            >
              <Play /> Resume
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() =>
              void run(async () => {
                await stop.mutateAsync();
              })
            }
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
    </div>
  );
}
