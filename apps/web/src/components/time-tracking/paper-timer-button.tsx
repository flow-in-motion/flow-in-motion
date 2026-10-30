import { useState } from "react";
import { Pause, Play } from "lucide-react";

import {
  useCurrentTimer,
  usePauseTimer,
  useResumeTimer,
  useStartPaperTimer,
} from "@/api/time-tracking";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TimerState = "idle" | "running" | "paused";

/**
 * Start, pause or resume the timer for one task. Starting a task stops the
 * timer on any other task first (its time is kept).
 */
export function PaperTimerButton({
  moduleId,
  paperTitle,
  variant = "icon",
  className,
}: {
  moduleId: string;
  paperTitle: string;
  /** "icon" for lists; "button" for the task page. */
  variant?: "icon" | "button";
  className?: string;
}) {
  const current = useCurrentTimer();
  const start = useStartPaperTimer();
  const pause = usePauseTimer();
  const resume = useResumeTimer();
  const [error, setError] = useState<string | null>(null);

  const timer = current.data?.timers.find(
    (item) => item.moduleId === moduleId,
  );
  const state: TimerState =
    timer?.moduleId !== moduleId ? "idle" : timer.isRunning ? "running" : "paused";
  const isPending = start.isPending || pause.isPending || resume.isPending;
  const action =
    state === "running" ? "Pause" : state === "paused" ? "Resume" : "Start";
  const label = `${action} timer for ${paperTitle}`;

  async function handleClick() {
    setError(null);
    try {
      if (timer && state === "running") {
        await pause.mutateAsync(timer.id);
      } else if (timer && state === "paused") {
        await resume.mutateAsync(timer.id);
      } else {
        await start.mutateAsync(moduleId);
      }
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Couldn't update the timer. Please try again.",
      );
    }
  }

  const Icon = state === "running" ? Pause : Play;

  if (variant === "button") {
    return (
      <span className={cn("inline-flex flex-col items-start gap-1", className)}>
        <Button
          type="button"
          variant={state === "idle" ? "default" : "outline"}
          onClick={() => void handleClick()}
          disabled={isPending}
          aria-label={label}
        >
          <Icon />
          {state === "idle" ? "Start timer" : action}
        </Button>
        {error ? (
          <span role="alert" className="text-xs text-destructive">
            {error}
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={isPending}
      aria-label={label}
      title={error ?? `${action} timer`}
      aria-invalid={error ? true : undefined}
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
        state === "running" &&
          "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 hover:text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
        state === "paused" &&
          "bg-amber-100 text-amber-700 hover:bg-amber-200 hover:text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
        error && "text-destructive",
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
