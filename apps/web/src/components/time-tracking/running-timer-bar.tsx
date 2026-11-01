import { useState } from "react";
import { Pause, Play, Square } from "lucide-react";
import { Link } from "react-router-dom";

import {
  useLiveTimer,
  usePauseTimer,
  useResumeTimer,
  useStopTimer,
  useTicker,
  type ApiTimer,
} from "@/api/time-tracking";
import { Button } from "@/components/ui/button";
import { setBreakState, useBreakState } from "@/lib/break-state";
import { formatClock } from "@/lib/time-format";
import { cn } from "@/lib/utils";

function TimerRow({ timer }: { timer: ApiTimer }) {
  const pause = usePauseTimer();
  const resume = useResumeTimer();
  const stop = useStopTimer();
  const [error, setError] = useState<string | null>(null);

  const isPaper = Boolean(timer.moduleId);
  const title = isPaper
    ? timer.paperTitle || "Untitled paper"
    : timer.taskTitle || "Untitled task";
  const path = isPaper
    ? `/modules/${timer.moduleId}`
    : `/tasks/${timer.taskId}`;

  const isPending =
    pause.isPending || resume.isPending || stop.isPending;

  async function run(action: () => Promise<unknown>) {
    setError(null);

    try {
      await action();
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : "Couldn't update the timer. Please try again.",
      );
    }
  }

  return (
    <div
      role="region"
      aria-label={`${isPaper ? "Paper" : "Task"} timer: ${title}`}
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
              timer.isRunning
                ? "animate-pulse bg-emerald-500"
                : "bg-amber-500",
            )}
          />
          <span className="shrink-0 text-muted-foreground">
            {timer.isRunning ? "Working on" : "Paused"}
          </span>
          <Link
            to={path}
            className="truncate font-semibold text-foreground hover:underline"
          >
            {title}
          </Link>
        </span>

        <span
          role="timer"
          aria-label={`Time on ${title}`}
          className="font-mono text-sm font-semibold tabular-nums"
        >
          {formatClock(timer.elapsedSeconds)}
        </span>

        <span className="flex items-center gap-2">
          {timer.isRunning ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              aria-label={`Pause timer for ${title}`}
              onClick={() =>
                void run(() => pause.mutateAsync(timer.id))
              }
            >
              <Pause /> Pause
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              aria-label={`Resume timer for ${title}`}
              onClick={() =>
                void run(async () => {
                  await resume.mutateAsync(timer.id);
                  setBreakState({ breakEndsAt: null });
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
            aria-label={`Stop timer for ${title}`}
            onClick={() =>
              void run(() => stop.mutateAsync(timer.id))
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

export function RunningTimerBar({
  className,
}: {
  className?: string;
}) {
  const { timers } = useLiveTimer();
  const breakState = useBreakState();

  const onBreak =
    timers.length > 0 &&
    timers.every((timer) => !timer.isRunning) &&
    breakState.breakEndsAt !== null;

  const now = useTicker(onBreak);

  if (timers.length === 0) return null;

  const secondsLeft = Math.max(
    0,
    ((breakState.breakEndsAt ?? now) - now) / 1000,
  );

  return (
    <div
      role="region"
      aria-label="Open timers"
      className={cn("sticky z-30 border-b backdrop-blur-xl", className)}
    >
      {onBreak ? (
        <div className="border-b bg-sky-50 px-4 py-2 text-center text-sm text-sky-900 dark:bg-sky-950 dark:text-sky-200">
          {secondsLeft > 0 ? (
            <>
              On a break ·{" "}
              <span
                role="timer"
                aria-label="Break time left"
                className="font-mono font-semibold"
              >
                {formatClock(Math.ceil(secondsLeft))}
              </span>{" "}
              left
            </>
          ) : (
            "Break's over. Resume a timer when you're ready."
          )}
        </div>
      ) : null}

      {timers.map((timer) => (
        <TimerRow key={timer.id} timer={timer} />
      ))}
    </div>
  );
}