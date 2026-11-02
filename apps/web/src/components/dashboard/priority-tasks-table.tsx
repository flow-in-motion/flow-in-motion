import { useMemo } from "react";
import { ListTodo } from "lucide-react";
import { Link } from "react-router-dom";

import {
  useCurrentWorkspace,
  useMe,
  useModules,
  useProjects,
  useTasks,
} from "@/api/hooks";
import { ColumnVisibilityMenu } from "@/components/dashboard/column-visibility-menu";
import { MultiSelectFilter } from "@/components/dashboard/multi-select-filter";
import { priorityBadgeClass } from "@/components/dashboard/priority-badge-styles";
import { SortableHeader } from "@/components/shared/sortable-header";
import { LoggedTime } from "@/components/time-tracking/logged-time";
import { formatEstimate } from "@/lib/time-format";
import { TaskTimerButton } from "@/components/time-tracking/task-timer-button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { paperDisplayTitle } from "@/lib/paper-title";
import { cn } from "@/lib/utils";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { useSessionListState } from "@/hooks/use-session-list-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Several can be ticked at once; none ticked shows every priority. */
const PRIORITY_OPTIONS = ["Critical", "High", "Medium", "Low"] as const;
const DUE_HORIZON_OPTIONS = [
  { value: "all", label: "All open tasks" },
  { value: "overdue", label: "Overdue" },
  { value: "7", label: "Next 7 days" },
  { value: "14", label: "Next 14 days" },
  { value: "30", label: "Next 30 days" },
  { value: "no-date", label: "No due date" },
] as const;

type DueHorizon = (typeof DUE_HORIZON_OPTIONS)[number]["value"];

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
const TASK_COLUMNS = [
  { id: "task", label: "Task" },
  { id: "project", label: "Project/paper" },
  { id: "est", label: "Est. hours" },
  { id: "logged", label: "Logged" },
  { id: "due", label: "Due" },
  { id: "priority", label: "Priority" },
] as const;
const PRIORITY_ORDER: Record<string, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

type SortColumn = (typeof TASK_COLUMNS)[number]["id"];
type SortDirection = "asc" | "desc";

function formatDueDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function PriorityTasksTable() {
  const workspace = useCurrentWorkspace();
  const tenantId = workspace.data?.id ?? "";
  const me = useMe();
  const tasksQuery = useTasks(tenantId, undefined, 1, true, {
    pageSize: "all",
  });
  const tasks = tasksQuery.data?.data ?? [];
  const projectsQuery = useProjects(tenantId);
  const projects = projectsQuery.data?.data ?? [];
  const generalProject = projectsQuery.data?.generalProject ?? null;
  const modulesQuery = useModules(tenantId);
  const modules = modulesQuery.data?.data ?? [];

  const [search, setSearch] = useSessionListState<string>(
    me.data?.id,
    tenantId,
    "dashboard-tasks:search",
    "",
  );

  const [priorities, setPriorities] = useSessionListState<Set<string>>(
    me.data?.id,
    tenantId,
    "dashboard-tasks:priorities",
    () => new Set(),
  );

  const [dueHorizon, setDueHorizon] = useSessionListState<DueHorizon>(
    me.data?.id,
    tenantId,
    "dashboard-tasks:due-horizon",
    "all",
  );

  const [sortColumn, setSortColumn] = useSessionListState<SortColumn>(
    me.data?.id,
    tenantId,
    "dashboard-tasks:sort-column",
    "due",
  );

  const [sortDirection, setSortDirection] = useSessionListState<SortDirection>(
    me.data?.id,
    tenantId,
    "dashboard-tasks:sort-direction",
    "asc",
  );
  const columns = useColumnVisibility(
    TASK_COLUMNS.map((column) => column.id),
    "dashboard-priority-tasks",
  );

  const projectById = useMemo(() => {
    const map = new Map<string, string>();

    for (const project of projects) {
      map.set(project.id, project.title);
    }

    if (generalProject) {
      map.set(generalProject.id, generalProject.title);
    }

    return map;
  }, [projects, generalProject]);

  const paperById = useMemo(() => {
    const map = new Map<string, { displayTitle: string; title: string | null }>();
    for (const module of modules) {
      map.set(module.id, {
        displayTitle: paperDisplayTitle(module),
        title: module.title,
      });
    }
    return map;
  }, [modules]);

  const now = new Date();
  const today = localDateKey(now);
  const horizonEnd =
    dueHorizon === "7" || dueHorizon === "14" || dueHorizon === "30"
      ? localDateKey(
          new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() + Number(dueHorizon) - 1,
          ),
        )
      : null;

  const rows = useMemo(() => {
    return tasks
      .filter((task) => task.status !== "Complete")
      .map((task) => {
        const paper = task.moduleId ? paperById.get(task.moduleId) : null;
        return {
          id: task.id,
          projectId: task.projectId ?? generalProject?.id ?? null,
          moduleId: task.moduleId,
          project: task.moduleId
            ? (paper?.displayTitle ?? "Unknown module")
            : task.projectId
              ? (projectById.get(task.projectId) ?? "Unknown project")
              : "General",
          task: task.title,
          searchText: [
            task.title,
            task.projectId ? projectById.get(task.projectId) : null,
            paper?.displayTitle,
            paper?.title,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase(),
          estimatedHours: task.estimatedHours
            ? Number(task.estimatedHours)
            : null,
          loggedSeconds: task.loggedSeconds ?? 0,
          dueDate: task.dueDate,
          due: formatDueDate(task.dueDate),
          overdue: Boolean(task.dueDate && task.dueDate < today),
          priority: task.priority,
        };
      });
  }, [tasks, projectById, paperById, generalProject, today]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matchingRows = rows.filter((row) => {
      if (
        dueHorizon === "overdue" &&
        (!row.dueDate || row.dueDate >= today)
      ) {
        return false;
      }

      if (dueHorizon === "no-date" && row.dueDate) {
        return false;
      }

      if (
        horizonEnd &&
        (!row.dueDate || row.dueDate < today || row.dueDate > horizonEnd)
      ) {
        return false;
      }

      if (priorities.size > 0 && !priorities.has(row.priority ?? "")) {
        return false;
      }
      if (
        query &&
        !row.searchText.includes(query)
      ) {
        return false;
      }
      return true;
    });

    return [...matchingRows].sort((a, b) => {
      let comparison = 0;
      switch (sortColumn) {
        case "task":
          comparison = a.task.localeCompare(b.task);
          break;
        case "project":
          comparison = a.project.localeCompare(b.project);
          break;
        case "est":
          // Tasks without an estimate always sink to the bottom.
          if (a.estimatedHours === null && b.estimatedHours === null) {
            comparison = 0;
          } else if (a.estimatedHours === null) {
            return 1;
          } else if (b.estimatedHours === null) {
            return -1;
          } else {
            comparison = a.estimatedHours - b.estimatedHours;
          }
          break;
        case "logged":
          comparison = a.loggedSeconds - b.loggedSeconds;
          break;
        case "due":
          if (!a.dueDate && !b.dueDate) {
            comparison = 0;
          } else if (!a.dueDate) {
            return 1;
          } else if (!b.dueDate) {
            return -1;
          } else {
            comparison = a.dueDate.localeCompare(b.dueDate);
          }

          if (comparison === 0) {
            const priorityComparison =
              (PRIORITY_ORDER[a.priority ?? ""] ?? 99) -
              (PRIORITY_ORDER[b.priority ?? ""] ?? 99);

            return priorityComparison || a.task.localeCompare(b.task);
          }
          break;
        case "priority":
          if (!a.priority && !b.priority) comparison = 0;
          else if (!a.priority) return 1;
          else if (!b.priority) return -1;
          else
            comparison =
              (PRIORITY_ORDER[a.priority] ?? 99) -
              (PRIORITY_ORDER[b.priority] ?? 99);
          break;
      }

      const directed = comparison * (sortDirection === "asc" ? 1 : -1);
      return directed || a.task.localeCompare(b.task);
    });
  }, [rows, search, priorities, dueHorizon, today, horizonEnd, sortColumn, sortDirection]);

  const hasActiveFilters =
  search.trim() !== "" || priorities.size > 0 || dueHorizon !== "all";

function clearFilters() {
  setSearch("");
  setPriorities(new Set());
  setDueHorizon("all");
}

  function togglePriority(value: string) {
    setPriorities((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  function handleSort(column: SortColumn) {
    if (column === sortColumn) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortColumn(column);
    setSortDirection("asc");
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-4 border-b border-primary/10 bg-gradient-to-r from-accent/60 via-card/80 to-card">
      <div>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <ListTodo className="h-4 w-4 text-primary" />
          Tasks and To Do
          <Badge variant="secondary">
            {hasActiveFilters
              ? `${filtered.length} of ${rows.length} to do`
              : `${rows.length} to do`}
          </Badge>
        </CardTitle>
        <CardDescription>
          Tasks across your projects and papers that need attention first.
        </CardDescription>
      </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search project, paper or task…"
            className="sm:max-w-xs"
          />
          <Select
            value={dueHorizon}
            onValueChange={(value) => setDueHorizon(value as DueHorizon)}
          >
            <SelectTrigger
              className="sm:w-44"
              aria-label="Filter tasks by due date"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DUE_HORIZON_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <MultiSelectFilter
            options={PRIORITY_OPTIONS}
            selected={priorities}
            pluralLabel="priorities"
            triggerClassName="sm:w-40"
            onToggle={togglePriority}
            onClear={() => setPriorities(new Set())}
          />
          <ColumnVisibilityMenu
            columns={TASK_COLUMNS}
            visibleColumns={columns.visibleColumns}
            onToggle={columns.toggleColumn}
          />
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="pt-[var(--card-padding)]">
        <Table>
          <TableHeader>
            <TableRow>
              {TASK_COLUMNS.filter((column) =>
                columns.isColumnVisible(column.id),
              ).map((column) => (
                <TableHead key={column.id}>
                  <SortableHeader
                    label={column.label}
                    column={column.id}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.visibleColumns.size}
                  className="h-24 text-center text-muted-foreground"
                >
                  No tasks match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow key={row.id}>
                  {columns.isColumnVisible("task") ? (
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-1.5">
                        <TaskTimerButton taskId={row.id} taskTitle={row.task} />
                        <Link
                          to={`/tasks/${row.id}`}
                          className="text-foreground hover:text-primary hover:underline"
                        >
                          {row.task}
                        </Link>
                      </span>
                    </TableCell>
                  ) : null}
                  {columns.isColumnVisible("project") ? (
                    <TableCell className="text-muted-foreground">
                      {row.moduleId ? (
                        <Link
                          to={`/modules/${row.moduleId}`}
                          className="text-primary hover:underline"
                        >
                          {row.project}
                        </Link>
                      ) : row.projectId ? (
                        <Link
                          to={`/projects/${row.projectId}`}
                          className="text-primary hover:underline"
                        >
                          {row.project}
                        </Link>
                      ) : (
                        row.project
                      )}
                    </TableCell>
                  ) : null}
                  {columns.isColumnVisible("est") ? (
                    <TableCell className="tabular-nums text-muted-foreground">
                      {formatEstimate(row.estimatedHours)}
                    </TableCell>
                  ) : null}
                  {columns.isColumnVisible("logged") ? (
                    <TableCell className="tabular-nums text-muted-foreground">
                      <LoggedTime
                        task={{ id: row.id, loggedSeconds: row.loggedSeconds }}
                      />
                    </TableCell>
                  ) : null}
                  {columns.isColumnVisible("due") ? (
                    <TableCell
                      className={cn(
                        "whitespace-nowrap",
                        row.overdue && "font-medium text-destructive",
                      )}
                    >
                      {row.due}
                    </TableCell>
                  ) : null}
                  {columns.isColumnVisible("priority") ? (
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={priorityBadgeClass(row.priority)}
                      >
                        {row.priority ?? "—"}
                      </Badge>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
