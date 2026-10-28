import { useState } from "react";
import { Pause, Play, Square } from "lucide-react";
import { Link } from "react-router-dom";

import {
  useLiveTimer,
  usePauseTimer,
  useResumeTimer,
  useStopTimer,
  useTicker,
} from "@/api/time-tracking";
import { Button } from "@/components/ui/button";
import { setBreakState, useBreakState } from "@/lib/break-state";
import { formatClock } from "@/lib/time-format";
import { cn } from "@/lib/utils";

/**
 * Shown at the top of every page while a task timer is running or paused,
 * so it can be paused or stopped from anywhere. During a break it counts
 * the break down instead.
 */
export function RunningTimerBar({ className }: { className?: string }) {
  const { timer, elapsedSeconds } = useLiveTimer();
  const pause = usePauseTimer();
  const resume = useResumeTimer();
  const stop = useStopTimer();
  const breakState = useBreakState();
  const [error, setError] = useState<string | null>(null);
  const onBreak = Boolean(
    timer && !timer.isRunning && breakState.breakEndsAt !== null,
  );
  const now = useTicker(onBreak);

  if (!timer) return null;

  const breakLeftSeconds = onBreak
    ? Math.max(0, ((breakState.breakEndsAt ?? now) - now) / 1000)
    : 0;
  const breakOver = onBreak && breakLeftSeconds <= 0;
  const status = timer.isRunning
    ? "Working on"
    : breakOver
      ? "Break's over"
      : onBreak
        ? "On a break"
        : "Paused";

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
      aria-label="Task timer"
      className={cn(
        "sticky z-30 border-b backdrop-blur-xl",
        timer.isRunning
          ? "border-emerald-200 bg-emerald-50/90 dark:border-emerald-900 dark:bg-emerald-950/70"
          : onBreak && !breakOver
            ? "border-sky-200 bg-sky-50/90 dark:border-sky-900 dark:bg-sky-950/70"
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
              timer.isRunning
                ? "animate-pulse bg-emerald-500"
                : onBreak && !breakOver
                  ? "bg-sky-500"
                  : "bg-amber-500",
            )}
          />
          <span className="shrink-0 text-muted-foreground">{status}</span>
          <Link
            to={`/tasks/${timer.taskId}`}
            className="truncate font-semibold text-foreground hover:underline"
          >
            {timer.taskTitle}
          </Link>
        </span>
        <span
          role="timer"
          aria-label="Time on this task"
          className="font-mono text-sm font-semibold tabular-nums"
        >
          {formatClock(elapsedSeconds)}
        </span>
        {onBreak && !breakOver ? (
          <span className="text-sm text-sky-800 dark:text-sky-300">
            Break:{" "}
            <span
              role="timer"
              aria-label="Break time left"
              className="font-mono font-semibold tabular-nums"
            >
              {formatClock(Math.ceil(breakLeftSeconds))}
            </span>{" "}
            left
          </span>
        ) : null}
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
              variant={breakOver ? "default" : "outline"}
              disabled={isPending}
              onClick={() =>
                void run(async () => {
                  await resume.mutateAsync();
                  setBreakState({ breakEndsAt: null });
                })
              }
            >
              <Play /> {onBreak && !breakOver ? "End break" : "Resume"}
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
                setBreakState({ breakEndsAt: null });
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
