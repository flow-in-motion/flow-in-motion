import { formatDuration } from "@/lib/time-format";
import { cn } from "@/lib/utils";

/** "4h 20m logged of 6h estimated", with a bar that turns amber when over. */
export function TimeProgress({
  loggedSeconds,
  estimateSeconds,
  label = "Time logged against the estimate",
  className,
}: {
  loggedSeconds: number;
  estimateSeconds: number | null;
  label?: string;
  className?: string;
}) {
  const over = estimateSeconds !== null && loggedSeconds > estimateSeconds;
  const percent = estimateSeconds
    ? Math.min(100, (loggedSeconds / estimateSeconds) * 100)
    : 0;

  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-sm text-muted-foreground">
        <span className="font-semibold tabular-nums text-foreground">
          {formatDuration(loggedSeconds)}
        </span>{" "}
        logged
        {estimateSeconds !== null ? (
          <>
            {" "}
            of{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {formatDuration(estimateSeconds)}
            </span>{" "}
            estimated
          </>
        ) : (
          " · no estimate yet"
        )}
        {over ? (
          <span className="font-medium text-amber-700 dark:text-amber-400">
            {" "}
            · {formatDuration(loggedSeconds - estimateSeconds)} over
          </span>
        ) : null}
      </p>
      {estimateSeconds !== null ? (
        <div
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(
            Math.min(999, (loggedSeconds / estimateSeconds) * 100),
          )}
          className="h-2 overflow-hidden rounded-full bg-muted"
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500",
              over ? "bg-amber-500" : "bg-primary",
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
