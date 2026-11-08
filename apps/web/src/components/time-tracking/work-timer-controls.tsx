import { useState } from "react";
import { Pause, Play } from "lucide-react";

import {
  useCurrentWorkTimers,
  useWorkTimeAction,
  type WorkTimeTarget,
} from "@/api/work-time-tracking";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TimerState = "idle" | "running" | "paused";

/** Same list/detail controls as Paper/Task timers; history lives in the Time panel. */
export function WorkTimerControls({
  kind,
  targetId,
  title,
  variant = "icon",
  className,
}: WorkTimeTarget & {
  title: string;
  /** "icon" for lists; "button" for the detail page. */
  variant?: "icon" | "button";
  className?: string;
}) {
  const current = useCurrentWorkTimers();
  const action = useWorkTimeAction();
  const [error, setError] = useState<string | null>(null);

  const timer = current.data?.timers.find(
    (item) => item.kind === kind && item.targetId === targetId,
  );
  const state: TimerState = !timer
    ? "idle"
    : timer.isRunning
      ? "running"
      : "paused";
  const isPending = action.isPending;
  const verb =
    state === "running" ? "Pause" : state === "paused" ? "Resume" : "Start";
  const label = `${verb} timer for ${title}`;

  async function handleClick() {
    setError(null);
    try {
      if (timer && state === "running") {
        await action.mutateAsync({ action: "pause", entryId: timer.id });
      } else if (timer && state === "paused") {
        await action.mutateAsync({ action: "resume", entryId: timer.id });
      } else {
        await action.mutateAsync({ action: "start", kind, targetId });
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
          {state === "idle" ? "Start timer" : verb}
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
      title={error ?? `${verb} timer`}
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
