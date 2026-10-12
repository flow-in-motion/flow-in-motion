import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ACTIVITY_Y_MAX,
  ACTIVITY_Y_TICKS,
  weeklyActivity,
} from "@/data/weekly-activity";
import { cn } from "@/lib/utils";
import { useCurrentWorkspace, useMe } from "@/api/hooks";
import { useSessionListState } from "@/hooks/use-session-list-state";

const TIME_RANGES = ["Today", "Week", "Month", "Year", "All time"] as const;
type TimeRange = (typeof TIME_RANGES)[number];

const CHART_WIDTH = 700;
const CHART_HEIGHT = 240;
const PLOT_LEFT = 34;
const PLOT_RIGHT = CHART_WIDTH - 12;
const PLOT_TOP = 12;
const PLOT_BOTTOM = 196;
const PLOT_WIDTH = PLOT_RIGHT - PLOT_LEFT;
const PLOT_HEIGHT = PLOT_BOTTOM - PLOT_TOP;

const BAR_WIDTH = 16;
const BAR_GAP = 4;

function yFor(value: number) {
  return PLOT_BOTTOM - (value / ACTIVITY_Y_MAX) * PLOT_HEIGHT;
}

export function ActivityOverviewChart() {
  const workspace = useCurrentWorkspace();
  const tenantId = workspace.data?.id ?? "";
  const me = useMe();

  const [range, setRange] = useSessionListState<TimeRange>(
    me.data?.id,
    tenantId,
    "dashboard-activity:range",
    "Week",
  );

  const bandWidth = PLOT_WIDTH / weeklyActivity.length;
  const pairWidth = BAR_WIDTH * 2 + BAR_GAP;

  return (
    <Card>
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Activity Overview</CardTitle>
            <CardDescription>This Week — Tasks / Notes.</CardDescription>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-blue-600" />
              Tasks Completed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
              Notes Written
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {TIME_RANGES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setRange(option)}
              aria-pressed={option === range}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                option === range
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="w-full"
          role="img"
          aria-label="Weekly activity: tasks completed and notes written per day, Monday through Sunday"
        >
          {ACTIVITY_Y_TICKS.map((tick) => {
            const y = yFor(tick);
            return (
              <g key={tick}>
                <line
                  x1={PLOT_LEFT}
                  x2={PLOT_RIGHT}
                  y1={y}
                  y2={y}
                  strokeDasharray="4 4"
                  strokeWidth={1}
                  className="stroke-border"
                />
                <text
                  x={PLOT_LEFT - 10}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-muted-foreground text-[10px]"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {weeklyActivity.map((entry, index) => {
            const bandX = PLOT_LEFT + index * bandWidth;
            const startX = bandX + (bandWidth - pairWidth) / 2;
            const taskHeight =
              (entry.tasksCompleted / ACTIVITY_Y_MAX) * PLOT_HEIGHT;
            const noteHeight =
              (entry.notesWritten / ACTIVITY_Y_MAX) * PLOT_HEIGHT;

            return (
              <g key={entry.day}>
                <rect
                  x={startX}
                  y={PLOT_BOTTOM - taskHeight}
                  width={BAR_WIDTH}
                  height={taskHeight}
                  rx={3}
                  className="fill-blue-600"
                />
                <rect
                  x={startX + BAR_WIDTH + BAR_GAP}
                  y={PLOT_BOTTOM - noteHeight}
                  width={BAR_WIDTH}
                  height={noteHeight}
                  rx={3}
                  className="fill-emerald-500"
                />
                <text
                  x={bandX + bandWidth / 2}
                  y={PLOT_BOTTOM + 18}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[11px] font-medium"
                >
                  {entry.day}
                </text>
              </g>
            );
          })}
        </svg>
      </CardContent>
    </Card>
  );
}
