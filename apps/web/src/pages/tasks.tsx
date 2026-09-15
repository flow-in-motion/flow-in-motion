import { useEffect, useMemo, useState } from "react";
import { ListTodo, Pencil, Trash2, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";

import {
  useCreateTask,
  useCurrentWorkspace,
  useDeleteTask,
  useMe,
  useMembers,
  useModules,
  useTasks,
  useProjects,
  useTrackEvent,
  type ApiTask,
} from "@/api/hooks";
import { ColumnVisibilityMenu } from "@/components/dashboard/column-visibility-menu";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeading } from "@/components/typography/heading";
import { SortableHeader } from "@/components/shared/sortable-header";
import { TaskDialog, type TaskFormInput } from "@/components/tasks/task-dialog";
import { TaskMembersManager } from "@/components/tasks/task-members";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { formatListDate, isOverdue } from "@/lib/list-format";
import { paperDisplayTitle } from "@/lib/paper-title";
import { cn } from "@/lib/utils";
import { PaginationControls } from "@/components/shared/pagination-controls";

const STATUS_FILTERS = ["All", "To do", "Underway", "Waiting", "Complete"] as const;
const PRIORITY_FILTERS = ["All", "Low", "Medium", "High", "Critical"] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number];
type PriorityFilter = (typeof PRIORITY_FILTERS)[number];

type SortColumn = "task" | "description" | "project" | "status" | "priority" | "due" | "est";
type SortDirection = "asc" | "desc";

const TASK_COLUMNS = [
  { id: "task", label: "Task", width: "minmax(240px,1.5fr)" },
  { id: "description", label: "Description", width: "minmax(260px,2fr)" },
  { id: "project", label: "Linked to", width: "170px" },
  { id: "status", label: "Status", width: "110px" },
  { id: "priority", label: "Priority", width: "110px" },
  { id: "due", label: "Due", width: "110px" },
  { id: "est", label: "Est.", width: "80px" },
] as const;

const STATUS_ORDER: Record<string, number> = { "To do": 0, Underway: 1, Waiting: 2, Complete: 3 };
const PRIORITY_ORDER: Record<string, number> = { Low: 0, Medium: 1, High: 2, Critical: 3 };

function statusPillClass(status: string | null) {
  switch (status) {
    case "To do":
      return "border-border text-muted-foreground";
    case "Underway":
      return "border-orange-300 text-orange-700 dark:border-orange-800 dark:text-orange-400";
    case "Complete":
      return "border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400";
    case "Waiting":
      return "border-blue-300 text-blue-700 dark:border-blue-800 dark:text-blue-400";
    default:
      return "border-border text-muted-foreground";
  }
}

function priorityPillClass(priority: string | null) {
  switch (priority) {
    case "Low":
      return "border-border text-muted-foreground";
    case "Medium":
      return "border-blue-300 text-blue-700 dark:border-blue-800 dark:text-blue-400";
    case "High":
      return "border-orange-300 text-orange-700 dark:border-orange-800 dark:text-orange-400";
    case "Critical":
      return "border-red-300 text-red-700 dark:border-red-800 dark:text-red-400";
    default:
      return "border-border text-muted-foreground";
  }
}

export default function TasksPage() {
  const workspace = useCurrentWorkspace();
  const tenantId = workspace.data?.id ?? "";

  const [page, setPage] = useState(1);

  const tasksQuery = useTasks(tenantId, undefined, page);
  const tasks = tasksQuery.data?.data ?? [];
  const paginationMeta = tasksQuery.data?.meta;
  const projectsQuery = useProjects(tenantId);
  const projects = projectsQuery.data?.data ?? [];
  const modulesQuery = useModules(tenantId);
  const modules = modulesQuery.data?.data ?? [];

  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [sharingTask, setSharingTask] = useState<ApiTask | null>(null);
  const me = useMe();
  const membersQuery = useMembers(tenantId, 1, sharingTask !== null);
  const members = membersQuery.data?.data ?? [];

  const createTask = useCreateTask(tenantId);
  const deleteTask = useDeleteTask(tenantId);
  const trackEvent = useTrackEvent(tenantId);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("All");
  const [priority, setPriority] = useState<PriorityFilter>("All");
  const [sortColumn, setSortColumn] = useState<SortColumn>("due");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  useEffect(() => {
    setPage(1);
  }, [
    tenantId,
    search,
    status,
    priority,
    sortColumn,
    sortDirection,
  ]);
  const columns = useColumnVisibility(TASK_COLUMNS.map((column) => column.id), "tasks");
  const gridTemplate = TASK_COLUMNS.filter((column) =>
    columns.visibleColumns.has(column.id),
  )
    .map((column) => column.width)
    .join(" ");

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

  function linkTargetLabel(task: ApiTask) {
    if (task.moduleId) return moduleById.get(task.moduleId) ?? "Unknown module";
    if (task.projectId) return projectById.get(task.projectId) ?? "Unknown project";
    return "General";
  }

  function handleSort(column: SortColumn) {
    if (column === sortColumn) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  }

  function compareTasks(a: ApiTask, b: ApiTask, column: SortColumn) {
    switch (column) {
      case "task":
        return a.title.localeCompare(b.title);
      case "description":
        return (a.description ?? "").localeCompare(b.description ?? "");
      case "project":
        return linkTargetLabel(a).localeCompare(linkTargetLabel(b));
      case "status":
        return (STATUS_ORDER[a.status ?? ""] ?? 99) - (STATUS_ORDER[b.status ?? ""] ?? 99);
      case "priority":
        return (PRIORITY_ORDER[a.priority ?? ""] ?? 99) - (PRIORITY_ORDER[b.priority ?? ""] ?? 99);
      case "due":
        return (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
      case "est":
        return Number(a.estimatedHours ?? 0) - Number(b.estimatedHours ?? 0);
    }
  }

  const visibleTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = tasks.filter((task) => {
      if (status !== "All" && task.status !== status) return false;
      if (priority !== "All" && task.priority !== priority) return false;
      if (
        query &&
        !(task.displayId?.toLowerCase().includes(query) ?? false) &&
        !task.title.toLowerCase().includes(query) &&
        !(task.description?.toLowerCase().includes(query) ?? false) &&
        !linkTargetLabel(task).toLowerCase().includes(query) &&
        !(task.workingWith?.toLowerCase().includes(query) ?? false)
      ) {
        return false;
      }
      return true;
    });
    return [...filtered].sort(
      (a, b) => compareTasks(a, b, sortColumn) * (sortDirection === "asc" ? 1 : -1),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, search, status, priority, sortColumn, sortDirection, projectById, moduleById]);

  const hasActiveFilters = search !== "" || status !== "All" || priority !== "All";

  function clearFilters() {
    setSearch("");
    setStatus("All");
    setPriority("All");
  }

  async function handleCreateTask(input: TaskFormInput) {
    await createTask.mutateAsync({
      title: input.title,
      description: input.description || undefined,
      projectId: input.linkTarget === "project" ? input.projectId : undefined,
      moduleId: input.linkTarget === "module" ? input.moduleId : undefined,
      status: input.status,
      priority: input.priority,
      visibility: input.visibility,
      workingWith: input.workingWith || undefined,
      estimatedHours: input.estimatedHours || undefined,
      dueDate: input.dueDate || undefined,
    });
    trackEvent({ name: "task_created" });
  }

  async function handleDeleteTask(task: ApiTask) {
    if (!window.confirm(`Delete "${task.title}"? This action cannot be undone.`)) {
      return;
    }
    await deleteTask.mutateAsync(task.id);
  }

  if (workspace.isPending || tasksQuery.isPending) {
    return <LoadingState title="Loading tasks" className="min-h-[50vh]" />;
  }
  if (tasksQuery.isError) {
    return (
      <ErrorState
        title="Tasks could not be loaded"
        description={tasksQuery.error.message}
        onRetry={() => void tasksQuery.refetch()}
      />
    );
  }

  return (
    <div className="page-stack">
      <PageHeading
        icon={ListTodo}
        tone="amber"
        eyebrow="Workflows"
        title="Tasks and To Do"
        description="Everything outstanding across your projects — filter by status or priority, then sort any column."
        actions={<Button onClick={() => setIsNewTaskOpen(true)}>New Task</Button>}
      />

      <TaskDialog
        open={isNewTaskOpen}
        onOpenChange={setIsNewTaskOpen}
        tenantId={tenantId}
        projects={projects}
        modules={modules}
        onSave={handleCreateTask}
      />
      <Dialog
        open={sharingTask !== null}
        onOpenChange={(open) => {
          if (!open) setSharingTask(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Task collaborators</DialogTitle>
            <DialogDescription>
              Invite collaborators to {sharingTask?.title ?? "this task"} by email and manage pending access.
            </DialogDescription>
          </DialogHeader>
          {sharingTask ? (
            <TaskMembersManager
              tenantId={tenantId}
              taskId={sharingTask.id}
              taskTitle={sharingTask.title}
              ownerUserId={sharingTask.createdBy}
              members={members}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <div className="surface-toolbar flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search tasks…"
          className="sm:max-w-xs"
        />
        <Select value={status} onValueChange={(value) => setStatus(value as StatusFilter)}>
          <SelectTrigger className="sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((option) => (
              <SelectItem key={option} value={option}>
                {option === "All" ? "All statuses" : option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={(value) => setPriority(value as PriorityFilter)}>
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

      <div className="overflow-x-auto rounded-lg border bg-card p-2 sm:p-3">
        <div className="min-w-[720px]">
          <div
            className="mb-1 grid gap-4 rounded-md bg-muted/65 px-4 py-3 text-[0.6875rem] font-semibold uppercase tracking-[0.07em] text-muted-foreground"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            {TASK_COLUMNS.filter((column) =>
              columns.visibleColumns.has(column.id),
            ).map((column) => (
              <SortableHeader
                key={column.id}
                label={column.label}
                column={column.id}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSort={handleSort}
              />
            ))}
          </div>

          <div className="flex flex-col gap-1">
            {visibleTasks.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                No tasks match the current filters.
              </div>
            ) : (
              visibleTasks.map((task) => (
                <div
                  key={task.id}
                  className="grid items-center gap-4 rounded-md border border-transparent bg-card px-4 py-3.5 transition-colors hover:bg-muted/45"
                  style={{ gridTemplateColumns: gridTemplate }}
                >
                  {columns.isColumnVisible("task") ? (
                  <div className="flex flex-col gap-0.5">
                    {task.displayId ? (
                      <span className="font-mono text-[11px] text-muted-foreground">{task.displayId}</span>
                    ) : null}
                    <div className="flex items-start gap-2">
                      <Link
                        to={`/tasks/${task.id}`}
                        className="font-semibold leading-tight text-foreground transition-colors hover:text-primary hover:underline"
                      >
                        {task.title}
                      </Link>
                      {task.visibility === "Shared" && task.createdBy === me.data?.id ? (
                        <button
                          type="button"
                          onClick={() => setSharingTask(task)}
                          aria-label={`Manage collaborators for ${task.title}`}
                          title="Manage collaborators"
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                      <Link
                        to={`/tasks/${task.id}?edit=true`}
                        aria-label={`Edit ${task.title}`}
                        title="Edit task"
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => void handleDeleteTask(task)}
                        aria-label={`Delete ${task.title}`}
                        title="Delete task"
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-destructive transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {task.workingWith ? (
                      <span className="text-xs text-muted-foreground">
                        Working with: {task.workingWith}
                      </span>
                    ) : null}
                  </div>
                  ) : null}

                  {columns.isColumnVisible("description") ? (
                  <span className="text-sm leading-5 text-muted-foreground">
                    {task.description || "—"}
                  </span>
                  ) : null}

                  {columns.isColumnVisible("project") ? (
                  task.projectId || task.moduleId ? (
                    <Link
                      to={task.moduleId ? `/modules/${task.moduleId}` : `/projects/${task.projectId}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {linkTargetLabel(task)}
                    </Link>
                  ) : (
                    <span className="text-sm text-muted-foreground">General</span>
                  )
                  ) : null}

                  {columns.isColumnVisible("status") ? (
                  <Badge variant="outline" className={statusPillClass(task.status)}>
                    {task.status ?? "—"}
                  </Badge>
                  ) : null}

                  {columns.isColumnVisible("priority") ? (
                  <Badge variant="outline" className={priorityPillClass(task.priority)}>
                    {task.priority ?? "—"}
                  </Badge>
                  ) : null}

                  {columns.isColumnVisible("due") ? (
                  <span
                    className={cn(
                      "text-sm tabular-nums",
                      isOverdue(task.dueDate, task.status === "Complete")
                        ? "font-semibold text-destructive"
                        : "text-muted-foreground",
                    )}
                  >
                    {formatListDate(task.dueDate)}
                  </span>
                  ) : null}

                  {columns.isColumnVisible("est") ? (
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {task.estimatedHours ? `${task.estimatedHours}h` : "—"}
                  </span>
                  ) : null}
                </div>
              ))
            )}
          </div>
          {paginationMeta ? (
            <PaginationControls
              page={paginationMeta.page}
              pageSize={paginationMeta.pageSize}
              totalItems={paginationMeta.totalItems}
              totalPages={paginationMeta.totalPages}
              isPending={tasksQuery.isFetching}
              onPageChange={setPage}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
