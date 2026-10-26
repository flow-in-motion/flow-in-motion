import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Hourglass,
} from "lucide-react";
import { Link } from "react-router-dom";

import {
  useCurrentWorkspace,
  useModules,
  useTasks,
} from "@/api/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { paperDisplayTitle } from "@/lib/paper-title";
import { cn } from "@/lib/utils";
import { TONE_BADGE_CLASSES, TONE_DOT_CLASSES } from "@/lib/tones";

export type DashboardInsightId =
  | "stalled-papers"
  | "task-health"
  | "priority-workload";

const PRIORITY_ROWS = [
  // Only the priorities that need attention get colour (see lib/tones).
  { label: "Critical", tone: TONE_DOT_CLASSES.danger },
  { label: "High", tone: TONE_DOT_CLASSES.attention },
  { label: "Medium", tone: "bg-muted-foreground/60" },
  { label: "Low", tone: "bg-muted-foreground/35" },
  { label: "Unassigned", tone: "bg-muted-foreground/20" },
] as const;

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

const STALLED_PAPER_LIMIT = 6;
/** Papers at or beyond this many days in their current stage are flagged as at-risk. */
const STALLED_WARNING_DAYS = 14;

function daysSince(iso: string) {
  const changedAt = new Date(iso).getTime();
  if (Number.isNaN(changedAt)) return 0;
  return Math.max(0, Math.floor((Date.now() - changedAt) / (1000 * 60 * 60 * 24)));
}

export function StalledPapersCard() {
  const workspace = useCurrentWorkspace();
  const tenantId = workspace.data?.id ?? "";
  const modulesQuery = useModules(tenantId);
  const papers = modulesQuery.data?.data ?? [];

  const stalled = papers
    .filter((paper) => paper.pipelineStage && paper.pipelineStageChangedAt)
    .map((paper) => ({
      id: paper.id,
      title: paperDisplayTitle(paper),
      stage: paper.pipelineStage as string,
      days: daysSince(paper.pipelineStageChangedAt as string),
    }))
    .sort((a, b) => b.days - a.days)
    .slice(0, STALLED_PAPER_LIMIT);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-primary/10 bg-gradient-to-r from-accent/60 via-card/80 to-card sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <Hourglass className="h-4 w-4 text-primary" />
            Longest in current stage
          </CardTitle>
          <CardDescription>Papers that haven&rsquo;t moved stage in the longest time.</CardDescription>
        </div>
        <Button asChild variant="ghost" size="sm" className="mt-3 sm:mt-0">
          <Link to="/pipeline">View pipeline</Link>
        </Button>
      </CardHeader>
      <CardContent className="pt-6">
        {stalled.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/40 px-6 text-center">
            <Hourglass className="mb-3 h-7 w-7 text-muted-foreground/60" />
            <p className="font-medium">No pipeline data yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Papers will appear here once they are assigned to stages.
            </p>
          </div>
        ) : (
          <div className="space-y-1" aria-label="Papers by time in current stage">
            {stalled.map((paper) => (
              <Link
                key={paper.id}
                to={`/modules/${paper.id}`}
                aria-label={`${paper.title} — ${paper.days} ${paper.days === 1 ? "day" : "days"} in ${paper.stage}`}
                className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg p-2 -m-2 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{paper.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{paper.stage}</span>
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    "shrink-0 tabular-nums",
                    paper.days >= STALLED_WARNING_DAYS &&
                      TONE_BADGE_CLASSES.attention,
                  )}
                >
                  {paper.days} {paper.days === 1 ? "day" : "days"}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function TaskHealthCard() {
  const workspace = useCurrentWorkspace();
  const tenantId = workspace.data?.id ?? "";
  const tasksQuery = useTasks(tenantId);
  const tasks = tasksQuery.data?.data ?? [];

  const today = new Date().toISOString().slice(0, 10);
  const nextWeek = addDays(new Date(), 7);
  const completed = tasks.filter((task) => task.status === "Complete").length;
  const activeTasks = tasks.filter((task) => task.status !== "Complete");
  const overdue = activeTasks.filter((task) => task.dueDate && task.dueDate < today).length;
  const dueSoon = activeTasks.filter(
    (task) => task.dueDate && task.dueDate >= today && task.dueDate <= nextWeek,
  ).length;
  const open = Math.max(0, activeTasks.length - overdue - dueSoon);
  const totalTasks = tasks.length;
  const completedPercent = totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0;
  const overduePercent = totalTasks > 0 ? Math.round((overdue / totalTasks) * 100) : 0;
  const dueSoonPercent = totalTasks > 0 ? Math.round((dueSoon / totalTasks) * 100) : 0;
  const completedStop = completedPercent;
  const overdueStop = completedStop + overduePercent;
  const dueSoonStop = overdueStop + dueSoonPercent;
  const chartBackground = totalTasks > 0
    ? `conic-gradient(#10b981 0% ${completedStop}%, #ef4444 ${completedStop}% ${overdueStop}%, #f59e0b ${overdueStop}% ${dueSoonStop}%, hsl(var(--muted-foreground) / 0.35) ${dueSoonStop}% 100%)`
    : "conic-gradient(hsl(var(--muted)) 0% 100%)";

  const healthItems = [
    { label: "Completed", value: completed, icon: CheckCircle2, tone: "text-emerald-600", dot: "bg-emerald-500" },
    { label: "Overdue", value: overdue, icon: AlertTriangle, tone: "text-red-600", dot: "bg-red-500" },
    { label: "Due next 7 days", value: dueSoon, icon: Clock3, tone: "text-amber-600", dot: "bg-amber-500" },
    { label: "Open", value: open, icon: CircleDashed, tone: "text-muted-foreground", dot: TONE_DOT_CLASSES.neutral },
  ];

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-primary/10 bg-gradient-to-r from-accent/60 via-card/80 to-card sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Task health
          </CardTitle>
          <CardDescription>A quick view of delivery progress and deadline risk.</CardDescription>
        </div>
        <Button asChild variant="ghost" size="sm" className="mt-3 sm:mt-0">
          <Link to="/tasks">View tasks</Link>
        </Button>
      </CardHeader>
      <CardContent className="grid gap-6 pt-6 sm:grid-cols-[auto_1fr] sm:items-center xl:grid-cols-1 2xl:grid-cols-[auto_1fr]">
        <div
          className="relative mx-auto h-40 w-40 shrink-0 rounded-full shadow-inner"
          style={{ background: chartBackground }}
          role="img"
          aria-label={`${completedPercent}% of tasks completed; ${overdue} overdue; ${dueSoon} due in the next 7 days`}
        >
          <div className="absolute inset-5 flex flex-col items-center justify-center rounded-full bg-card shadow-sm">
            <span className="text-3xl font-semibold tabular-nums">{completedPercent}%</span>
            <span className="text-xs font-medium text-muted-foreground">complete</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-1">
          {healthItems.map((item) => (
            <div key={item.label} className="flex items-center gap-3 rounded-xl border bg-background/80 p-3">
              <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg bg-muted", item.tone)}>
                <item.icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={cn("h-1.5 w-1.5 rounded-full", item.dot)} />
                  <span className="truncate">{item.label}</span>
                </div>
                <p className="text-lg font-semibold tabular-nums">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function PriorityWorkloadCard() {
  const workspace = useCurrentWorkspace();
  const tenantId = workspace.data?.id ?? "";
  const tasksQuery = useTasks(tenantId);
  const activeTasks = (tasksQuery.data?.data ?? []).filter((task) => task.status !== "Complete");

  const priorityCounts = PRIORITY_ROWS.map((priority) => ({
    ...priority,
    count: activeTasks.filter((task) => (task.priority ?? "Unassigned") === priority.label).length,
  }));
  const largestPriority = Math.max(1, ...priorityCounts.map((priority) => priority.count));

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-primary/10 bg-gradient-to-r from-accent/60 via-card/80 to-card sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Priority workload
          </CardTitle>
          <CardDescription>Open tasks grouped by urgency to expose workload risk.</CardDescription>
        </div>
        <Button asChild variant="ghost" size="sm" className="mt-3 sm:mt-0">
          <Link to="/tasks">View tasks</Link>
        </Button>
      </CardHeader>
      <CardContent className="pt-6">
        {activeTasks.length === 0 ? (
          <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/40 text-center">
            <CheckCircle2 className="mb-3 h-7 w-7 text-emerald-500" />
            <p className="font-medium">No open workload</p>
            <p className="mt-1 text-sm text-muted-foreground">All tasks are complete.</p>
          </div>
        ) : (
          <div className="space-y-4" role="img" aria-label="Open task count by priority">
            {priorityCounts.map((priority) => (
              <div key={priority.label} className="grid grid-cols-[5rem_1fr_2rem] items-center gap-3">
                <span className="text-sm font-medium">{priority.label}</span>
                <div className="h-3 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full transition-[width] duration-500", priority.tone)}
                    style={{ width: `${priority.count === 0 ? 0 : Math.max(8, (priority.count / largestPriority) * 100)}%` }}
                  />
                </div>
                <span className="text-right text-sm font-semibold tabular-nums">{priority.count}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
