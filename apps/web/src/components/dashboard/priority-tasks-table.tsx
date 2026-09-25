import { useMemo, useState } from "react";
import { ListTodo } from "lucide-react";
import { Link } from "react-router-dom";

import { useCurrentWorkspace, useModules, useProjects, useTasks } from "@/api/hooks";
import { ColumnVisibilityMenu } from "@/components/dashboard/column-visibility-menu";
import { priorityBadgeClass } from "@/components/dashboard/priority-badge-styles";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const PRIORITY_FILTERS = ["All", "Critical", "High", "Medium", "Low"] as const;
const TASK_COLUMNS = [
  { id: "task", label: "Task" },
  { id: "project", label: "Project" },
  { id: "due", label: "Due" },
  { id: "priority", label: "Priority" },
] as const;
const PRIORITY_ORDER: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };

type PriorityFilter = (typeof PRIORITY_FILTERS)[number];

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
  const tasksQuery = useTasks(tenantId);
  const tasks = tasksQuery.data?.data ?? [];
  const projectsQuery = useProjects(tenantId);
  const projects = projectsQuery.data?.data ?? [];
  const modulesQuery = useModules(tenantId);
  const modules = modulesQuery.data?.data ?? [];

  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState<PriorityFilter>("All");
  const columns = useColumnVisibility(
    TASK_COLUMNS.map((column) => column.id),
    "dashboard-priority-tasks",
  );

  const projectById = useMemo(() => {
    const map = new Map<string, string>();
    for (const project of projects) map.set(project.id, project.title);
    return map;
  }, [projects]);
  const moduleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const module of modules) map.set(module.id, paperDisplayTitle(module));
    return map;
  }, [modules]);

  const today = new Date().toISOString().slice(0, 10);

  const rows = useMemo(() => {
    return tasks
      .filter((task) => task.status !== "Complete")
      .map((task) => ({
        id: task.id,
        projectId: task.projectId,
        moduleId: task.moduleId,
        project: task.moduleId
          ? (moduleById.get(task.moduleId) ?? "Unknown paper")
          : task.projectId
            ? (projectById.get(task.projectId) ?? "Unknown project")
            : "General",
        task: task.title,
        due: formatDueDate(task.dueDate),
        overdue: Boolean(task.dueDate && task.dueDate < today),
        priority: task.priority,
      }))
      .sort((a, b) => {
        const priorityDiff =
          (PRIORITY_ORDER[a.priority ?? ""] ?? 99) - (PRIORITY_ORDER[b.priority ?? ""] ?? 99);
        if (priorityDiff !== 0) return priorityDiff;
        return a.due.localeCompare(b.due);
      });
  }, [tasks, projectById, moduleById, today]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (priority !== "All" && row.priority !== priority) return false;
      if (
        query &&
        !row.project.toLowerCase().includes(query) &&
        !row.task.toLowerCase().includes(query)
      ) {
        return false;
      }
      return true;
    });
  }, [rows, search, priority]);

  const hasActiveFilters = search !== "" || priority !== "All";

  function clearFilters() {
    setSearch("");
    setPriority("All");
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-4 border-b border-primary/10 bg-gradient-to-r from-accent/60 via-card/80 to-card">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-blue-600" />
            Tasks to be done
          </CardTitle>
          <CardDescription>
            Tasks across all projects that need attention first.
          </CardDescription>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search project or task…"
            className="sm:max-w-xs"
          />
          <Select
            value={priority}
            onValueChange={(value) => setPriority(value as PriorityFilter)}
          >
            <SelectTrigger className="sm:w-40">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_FILTERS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option === "All" ? "All priorities" : option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
              {columns.isColumnVisible("task") ? <TableHead>Task</TableHead> : null}
              {columns.isColumnVisible("project") ? <TableHead>Project</TableHead> : null}
              {columns.isColumnVisible("due") ? <TableHead>Due</TableHead> : null}
              {columns.isColumnVisible("priority") ? <TableHead>Priority</TableHead> : null}
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
                      <Link
                        to={`/tasks/${row.id}`}
                        className="text-foreground hover:text-primary hover:underline"
                      >
                        {row.task}
                      </Link>
                    </TableCell>
                  ) : null}
                  {columns.isColumnVisible("project") ? (
                    <TableCell className="text-muted-foreground">
                      {row.moduleId ? (
                        <Link
                          to={`/papers/${row.moduleId}`}
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
                  {columns.isColumnVisible("due") ? (
                    <TableCell
                      className={cn(row.overdue && "font-medium text-destructive")}
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
