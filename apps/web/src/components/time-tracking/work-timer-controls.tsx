import { lazy, Suspense, useState } from "react";
import { Clock3, Pause, Play, Square } from "lucide-react";
import {
  useCurrentWorkTimers,
  useWorkTimeAction,
  type WorkTimeTarget,
} from "@/api/work-time-tracking";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
const WorkTimeDialog = lazy(async () => ({
  default: (await import("./work-time-dialog")).WorkTimeDialog,
}));

export function WorkTimerControls({
  kind,
  targetId,
  title,
  variant = "icon",
}: WorkTimeTarget & { title: string; variant?: "icon" | "button" }) {
  const current = useCurrentWorkTimers();
  const action = useWorkTimeAction();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = current.data?.timers.find(
    (t) => t.kind === kind && t.targetId === targetId,
  );
  const verb = timer ? (timer.isRunning ? "Pause" : "Resume") : "Start";
  const Icon = timer?.isRunning ? Pause : Play;
  async function toggle() {
    setError(null);
    try {
      await action.mutateAsync(
        timer
          ? { action: timer.isRunning ? "pause" : "resume", entryId: timer.id }
          : { action: "start", kind, targetId },
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the timer.");
    }
  }
  return (
    <span
      className="inline-flex items-center gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      <Button
        type="button"
        size={variant === "icon" ? "icon" : "default"}
        variant="ghost"
        className={cn(
          variant === "icon" && "h-8 w-8 shrink-0",
          timer?.isRunning &&
            "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
          timer &&
            !timer.isRunning &&
            "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
        )}
        aria-label={`${verb} timer for ${title}`}
        title={error ?? `${verb} timer`}
        disabled={action.isPending || current.isPending || current.isError}
        onClick={() => void toggle()}
      >
        <Icon className="h-3.5 w-3.5" />
        {variant === "button" ? `${verb} timer` : null}
      </Button>
      {timer ? (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          aria-label={`Stop timer for ${title}`}
          title="Stop timer"
          disabled={action.isPending}
          onClick={() => {
            setError(null);
            void action
              .mutateAsync({ action: "stop", entryId: timer.id })
              .catch((e: unknown) =>
                setError(
                  e instanceof Error ? e.message : "Could not stop the timer.",
                ),
              );
          }}
        >
          <Square className="h-3.5 w-3.5" />
        </Button>
      ) : null}
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        aria-label={`View time for ${title}`}
        title="Time logged"
        onClick={() => setOpen(true)}
      >
        <Clock3 className="h-3.5 w-3.5" />
      </Button>
      {current.isError ? (
        <span role="alert" className="text-xs text-destructive">
          Timer unavailable.{" "}
          <button
            type="button"
            className="underline"
            onClick={() => void current.refetch()}
          >
            Retry
          </button>
        </span>
      ) : null}
      {error ? (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      ) : null}
      {open ? (
        <Suspense fallback={null}>
          <WorkTimeDialog
            kind={kind}
            targetId={targetId}
            title={title}
            onClose={() => setOpen(false)}
          />
        </Suspense>
      ) : null}
    </span>
  );
}
