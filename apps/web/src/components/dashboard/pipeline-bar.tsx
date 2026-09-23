import { cn } from "@/lib/utils";

const PIPELINE_GRADIENT =
  "linear-gradient(to right, hsl(var(--pipeline-start)) 0%, hsl(var(--pipeline-middle)) 50%, hsl(var(--pipeline-end)) 100%)";

function stagePosition(stageIndex: number, stageCount: number) {
  return stageCount <= 1 ? 0 : (stageIndex / (stageCount - 1)) * 100;
}

interface PipelineBarProps {
  stageIndex: number;
  stageCount: number;
}

/**
 * Horizontal stage bar for one project row. Its endpoint is derived from the
 * project's stage position, while the full-width gradient keeps the colour at
 * that endpoint aligned with the stage ruler.
 */
export function PipelineBar({ stageIndex, stageCount }: PipelineBarProps) {
  const clampedIndex = Math.max(0, Math.min(stageCount - 1, stageIndex));
  const progress = stageCount <= 1 ? 100 : stagePosition(clampedIndex, stageCount);

  return (
    <div
      role="progressbar"
      aria-label={`Pipeline stage ${clampedIndex + 1} of ${Math.max(stageCount, 1)}`}
      aria-valuemin={1}
      aria-valuemax={Math.max(stageCount, 1)}
      aria-valuenow={clampedIndex + 1}
      className="relative flex h-6 w-full items-center"
    >
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          data-testid="pipeline-stage-fill"
          className="absolute inset-y-0 left-0 w-full rounded-full"
          style={{
            background: PIPELINE_GRADIENT,
            clipPath: `inset(0 ${100 - progress}% 0 0)`,
          }}
        />
      </div>
      <div
        aria-hidden="true"
        data-testid="pipeline-stage-marker"
        className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card shadow-sm ring-1 ring-black/10"
        style={{
          left: `${progress}%`,
          backgroundColor: "hsl(var(--pipeline-end))",
        }}
      />
    </div>
  );
}

/** Stage labels positioned above the bars at their corresponding progress points. */
export function PipelineStageRuler({
  stages,
  compact = false,
}: {
  stages: readonly string[];
  compact?: boolean;
}) {
  const lastIndex = stages.length - 1;

  return (
    <div className={cn("relative h-9 w-full font-medium uppercase text-primary/70", compact ? "text-[8px] tracking-tight" : "text-[9px] tracking-wide")}>
      {stages.map((stage, index) => (
        <span
          key={stage}
          className={cn(
            "absolute top-0 text-center leading-tight",
            compact ? "truncate" : "w-28 whitespace-normal",
            index === 0 && "left-0 text-left",
            index === lastIndex && "right-0 text-right",
            index > 0 && index < lastIndex && "-translate-x-1/2",
          )}
          title={stage}
          style={{ ...(compact ? { width: `${100 / Math.max(stages.length, 1)}%` } : {}), ...(index > 0 && index < lastIndex ? { left: `${stagePosition(index, stages.length)}%` } : {}) }}
        >
          {stage}
        </span>
      ))}
    </div>
  );
}
