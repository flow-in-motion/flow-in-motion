import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, FolderKanban, Pencil, Trash2, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";

import {
  useArchiveProject,
  useCurrentWorkspace,
  useMe,
  useMembers,
  useModules,
  useProjects,
  useNotes,
  useCreateProject,
  useTasks,
  useTrackEvent,
  type ApiProject,
} from "@/api/hooks";
import { ColumnVisibilityMenu } from "@/components/dashboard/column-visibility-menu";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { PageHeading } from "@/components/typography/heading";
import {
  NewProjectDialog,
  type NewProjectInput,
} from "@/components/projects/new-project-dialog";
import { ProjectCollaborators } from "@/components/projects/project-collaborators";
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
import { cn } from "@/lib/utils";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { PaginationControls } from "@/components/shared/pagination-controls";

const STATUS_FILTERS = ["All", "Active", "Review", "Stalled", "Complete"] as const;
const ROLE_FILTERS = ["All roles", "owner", "collaborator", "supervisor", "lead"] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number];
type RoleFilter = (typeof ROLE_FILTERS)[number];

const PROJECT_COLUMNS = [
  { id: "project", label: "Project", width: "220px" },
  { id: "role", label: "My Role", width: "110px" },
  { id: "importance", label: "Importance", width: "110px" },
  { id: "status", label: "Status", width: "110px" },
  { id: "papers", label: "Papers", width: "70px" },
  { id: "notes", label: "Notes", width: "70px" },
  { id: "scheduled", label: "Scheduled For", width: "110px" },
  { id: "due", label: "Due Date", width: "110px" },
] as const;

type SortColumn = (typeof PROJECT_COLUMNS)[number]["id"];
type SortDirection = "asc" | "desc";

const PROJECT_STATUS_ORDER: Record<string, number> = { Active: 0, Review: 1, Stalled: 2, Complete: 3 };
const PROJECT_IMPORTANCE_ORDER: Record<string, number> = { Low: 0, Medium: 1, High: 2, Critical: 3 };

function priorityPillClass(priority: string | null) {
  switch (priority) {
    case "Critical":
      return "border-red-300 text-red-700 dark:border-red-800 dark:text-red-400";
    case "High":
      return "border-orange-300 text-orange-700 dark:border-orange-800 dark:text-orange-400";
    case "Medium":
      return "border-blue-300 text-blue-700 dark:border-blue-800 dark:text-blue-400";
    default:
      return "border-border text-muted-foreground";
  }
}

function statusPillClass(status: string | null) {
  switch (status) {
    case "Active":
    case "Complete":
      return "border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400";
    case "Review":
      return "border-orange-300 text-orange-700 dark:border-orange-800 dark:text-orange-400";
    case "Stalled":
      return "border-red-300 text-red-700 dark:border-red-800 dark:text-red-400";
    default:
      return "border-border text-muted-foreground";
  }
}

function rolePillClass(role: string | null) {
  switch (role) {
    case "owner":
      return "border-blue-300 text-blue-700 dark:border-blue-800 dark:text-blue-400";
    case "lead":
      return "border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400";
    case "collaborator":
      return "border-orange-300 text-orange-700 dark:border-orange-800 dark:text-orange-400";
    default:
      return "border-border text-muted-foreground";
  }
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function formatCurrency(value: string | null) {
  if (!value) return "—";
  const amount = Number(value);
  if (Number.isNaN(amount)) return "—";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function ProjectOverviewDetails({
  project,
  moduleCount,
  taskCount,
  noteCount,
}: {
  project: ApiProject;
  moduleCount: number;
  taskCount: number;
  noteCount: number;
}) {
  const fields = [
    { label: "Research area", value: project.researchArea ?? "—" },
    { label: "Papers", value: String(moduleCount) },
    { label: "Tasks", value: String(taskCount) },
    { label: "Notes", value: String(noteCount) },
    { label: "Budget", value: formatCurrency(project.totalBudget) },
    { label: "Target journal(s)", value: project.targetJournals ?? "—" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Overview
      </span>
      {project.description ? (
        <p className="max-w-2xl text-sm text-muted-foreground">{project.description}</p>
      ) : null}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {fields.map((field) => (
          <div key={field.label} className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{field.label}</span>
            <span className="text-sm font-semibold">{field.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function isOverdue(project: ApiProject) {
  if (!project.dueDate || project.status === "Complete") return false;
  return project.dueDate < new Date().toISOString().slice(0, 10);
}

interface SortableHeaderProps {
  label: string;
  column: SortColumn;
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  onSort: (column: SortColumn) => void;
}

function SortableHeader({ label, column, sortColumn, sortDirection, onSort }: SortableHeaderProps) {
  const active = column === sortColumn;
  const Icon = active ? (sortDirection === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      aria-label={`Sort by ${label}`}
      className={cn(
        "flex items-center gap-1 text-left transition-colors",
        active ? "text-foreground" : "hover:text-foreground",
      )}
    >
      {label}
      <Icon className={cn("h-3 w-3", active ? "text-primary" : "opacity-30")} />
    </button>
  );
}

export default function ProjectsPage() {
  const workspace = useCurrentWorkspace();
  const tenantId = workspace.data?.id ?? "";
  const [page, setPage] = useState(1);

  const projectsQuery = useProjects(tenantId, page);
  const paginationMeta = projectsQuery.data?.meta;
  const modulesQuery = useModules(tenantId);
  const modules = modulesQuery.data?.data ?? [];
  const tasksQuery = useTasks(tenantId);
  const tasks = tasksQuery.data?.data ?? [];
  const notesQuery = useNotes(tenantId);
  const notes = notesQuery.data?.data ?? [];
  const me = useMe();

  const createProject = useCreateProject(tenantId);
  const archiveProject = useArchiveProject(tenantId);
  const trackEvent = useTrackEvent(tenantId);

  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [sharingProject, setSharingProject] = useState<ApiProject | null>(null);
  const membersQuery = useMembers(
    tenantId,
    1,
    sharingProject !== null,
  );
  const members = membersQuery.data?.data ?? [];
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("All");
  const [role, setRole] = useState<RoleFilter>("All roles");
  const [sortColumn, setSortColumn] = useState<SortColumn>("due");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  useEffect(() => {
    setPage(1);
  }, [
    tenantId,
    search,
    status,
    role,
    sortColumn,
    sortDirection,
  ]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const columns = useColumnVisibility(
    PROJECT_COLUMNS.map((column) => column.id),
    "projects",
  );
  const statColumns = PROJECT_COLUMNS.filter((column) => column.id !== "project");

  function toggleExpanded(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  const taskCountByProject = useMemo(() => {
    const counts = new Map<string, { completed: number; total: number }>();
    for (const task of tasks) {
      if (!task.projectId) continue;
      const entry = counts.get(task.projectId) ?? { completed: 0, total: 0 };
      entry.total += 1;
      if (task.status === "Complete") entry.completed += 1;
      counts.set(task.projectId, entry);
    }
    return counts;
  }, [tasks]);

  const noteCountByProject = useMemo(() => {
    const counts = new Map<string, number>();
    for (const note of notes) {
      if (!note.projectId) continue;
      counts.set(note.projectId, (counts.get(note.projectId) ?? 0) + 1);
    }
    return counts;
  }, [notes]);

  const moduleCountByProject = useMemo(() => {
    const counts = new Map<string, number>();
    for (const module of modules) {
      if (!module.projectId) continue;
      counts.set(module.projectId, (counts.get(module.projectId) ?? 0) + 1);
    }
    return counts;
  }, [modules]);

  function handleSort(column: SortColumn) {
    if (column === sortColumn) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  }

  function compareProjects(a: ApiProject, b: ApiProject, column: SortColumn) {
    switch (column) {
      case "project":
        return a.title.localeCompare(b.title);
      case "role":
        return (a.role ?? "").localeCompare(b.role ?? "");
      case "importance":
        return (
          (PROJECT_IMPORTANCE_ORDER[a.importance ?? ""] ?? 99) -
          (PROJECT_IMPORTANCE_ORDER[b.importance ?? ""] ?? 99)
        );
      case "status":
        return (PROJECT_STATUS_ORDER[a.status ?? ""] ?? 99) - (PROJECT_STATUS_ORDER[b.status ?? ""] ?? 99);
      case "papers":
        return (moduleCountByProject.get(a.id) ?? 0) - (moduleCountByProject.get(b.id) ?? 0);
      case "notes":
        return (noteCountByProject.get(a.id) ?? 0) - (noteCountByProject.get(b.id) ?? 0);
      case "scheduled":
        return (a.scheduledFor ?? "").localeCompare(b.scheduledFor ?? "");
      case "due":
        return (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
    }
  }

  const visibleProjects = useMemo(() => {
    const rows = projectsQuery.data?.data ?? [];
    const query = search.trim().toLowerCase();
    const filtered = rows.filter((project) => {
      if (status !== "All" && project.status !== status) return false;
      if (role !== "All roles" && project.role !== role) return false;
      if (
        query &&
        !project.title.toLowerCase().includes(query) &&
        !(project.researchArea?.toLowerCase().includes(query) ?? false)
      ) {
        return false;
      }
      return true;
    });
    return [...filtered].sort(
      (a, b) => compareProjects(a, b, sortColumn) * (sortDirection === "asc" ? 1 : -1),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    projectsQuery.data,
    search,
    status,
    role,
    sortColumn,
    sortDirection,
    moduleCountByProject,
    noteCountByProject,
  ]);

  const hasActiveFilters = search !== "" || status !== "All" || role !== "All roles";

  function clearFilters() {
    setSearch("");
    setStatus("All");
    setRole("All roles");
  }

  async function handleCreateProject(input: NewProjectInput) {
    const project = await createProject.mutateAsync({
      title: input.title,
      description: input.description || undefined,
      researchArea: input.researchArea || undefined,
      status: input.status,
      importance: input.priority,
      scheduledFor: input.scheduledFor || undefined,
      dueDate: input.dueDate || undefined,
      totalBudget: input.totalBudget || undefined,
      targetJournals: input.targetJournals || undefined,
    });
    trackEvent({ name: "project_created" });
    return project;
  }

  async function handleDeleteProject(project: ApiProject) {
    if (
      !window.confirm(
        `Delete "${project.title}"? It will be archived and permanently removed after 14 days.`,
      )
    ) {
      return;
    }
    await archiveProject.mutateAsync(project.id);
    setExpandedId((current) => (current === project.id ? null : current));
  }

  if (workspace.isPending || projectsQuery.isPending) {
    return <LoadingState title="Loading projects" className="min-h-[50vh]" />;
  }
  if (projectsQuery.isError) {
    return (
      <ErrorState
        title="Projects could not be loaded"
        description={projectsQuery.error.message}
        onRetry={() => void projectsQuery.refetch()}
      />
    );
  }

  return (
    <div className="page-stack">
      <PageHeading
        icon={FolderKanban}
        tone="blue"
        eyebrow="Workflows"
        title="Major Projects"
        description="Track research work by stage, dates, collaborators and outstanding tasks."
        actions={<Button onClick={() => setIsNewProjectOpen(true)}>New Project</Button>}
      />

      <NewProjectDialog
        open={isNewProjectOpen}
        onOpenChange={setIsNewProjectOpen}
        tenantId={tenantId}
        onCreate={handleCreateProject}
      />
      <Dialog
        open={sharingProject !== null}
        onOpenChange={(open) => {
          if (!open) setSharingProject(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Project collaborators</DialogTitle>
            <DialogDescription>
              Invite collaborators to {sharingProject?.title ?? "this project"} by email and manage pending access.
            </DialogDescription>
          </DialogHeader>
          {sharingProject ? (
            <ProjectCollaborators
              tenantId={tenantId}
              projectId={sharingProject.id}
              ownerUserId={sharingProject.userId}
              members={members}
              entityTitle={sharingProject.title}
              canManage={me.data?.id === sharingProject.userId}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <div className="surface-toolbar flex flex-col gap-4 border-blue-200/60 bg-blue-50/40 lg:flex-row lg:items-start lg:justify-between dark:border-blue-900/50 dark:bg-blue-950/10">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search projects…"
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
          <Select value={role} onValueChange={(value) => setRole(value as RoleFilter)}>
            <SelectTrigger className="sm:w-40">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              {ROLE_FILTERS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option === "All roles" ? option : option.replace(/^\w/, (c) => c.toUpperCase())}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ColumnVisibilityMenu
            columns={PROJECT_COLUMNS}
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
      </div>

      <div className="rounded-xl border border-border/70 bg-muted/20 p-3 shadow-sm sm:p-4">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-blue-200/60 bg-blue-100/60 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/35 dark:text-blue-200">
            {columns.isColumnVisible("project") ? (
              <div className="min-w-[160px] flex-1">
                <SortableHeader
                  label="Project"
                  column="project"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />
              </div>
            ) : null}
            {statColumns
              .filter((column) => columns.visibleColumns.has(column.id))
              .map((column) => (
                <div key={column.id} className="shrink-0" style={{ width: column.width }}>
                  <SortableHeader
                    label={column.label}
                    column={column.id}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                </div>
              ))}
          </div>

          <div className="flex flex-col gap-3">
            {visibleProjects.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                No projects match the current filters.
              </div>
            ) : (
              visibleProjects.map((project) => {
                const isExpanded = expandedId === project.id;
                const taskCounts = taskCountByProject.get(project.id) ?? {
                  completed: 0,
                  total: 0,
                };

                return (
                  <div key={project.id} className="flex flex-col">
                    <div
                      role="button"
                      tabIndex={0}
                      aria-expanded={isExpanded}
                      onClick={() => toggleExpanded(project.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          toggleExpanded(project.id);
                        }
                      }}
                      className={cn(
                        "flex cursor-pointer flex-wrap items-center gap-x-6 gap-y-3 border border-blue-200/70 bg-gradient-to-r from-blue-50/55 via-card to-card px-4 py-4 shadow-sm transition-all hover:border-blue-300 hover:bg-blue-50/75 hover:shadow-md dark:border-blue-900/50 dark:from-blue-950/15",
                        isExpanded ? "rounded-t-xl border-b-0" : "rounded-xl",
                      )}
                    >
                      {columns.isColumnVisible("project") ? (
                      <div className="flex min-w-[220px] flex-1 items-start gap-2">
                        <ChevronRight
                          className={cn(
                            "mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                            isExpanded && "rotate-90",
                          )}
                        />
                        <div className="flex flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          {project.displayId ? (
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {project.displayId}
                            </span>
                          ) : null}
                          <Link
                            to={`/projects/${project.id}`}
                            onClick={(event) => event.stopPropagation()}
                            className="font-semibold leading-tight transition-colors hover:text-primary hover:underline"
                          >
                            {project.title}
                          </Link>
                          {project.researchArea ? (
                            <span className="text-xs text-muted-foreground">
                              {project.researchArea}
                            </span>
                          ) : null}
                          <span className="flex items-center gap-1">
                            {project.tenantId === tenantId ? (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSharingProject(project);
                                }}
                                aria-label={`Manage collaborators for ${project.title}`}
                                title="Manage collaborators"
                                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <UserPlus className="h-3.5 w-3.5" />
                              </button>
                            ) : null}
                            <Link
                              to={`/projects/${project.id}?edit=true`}
                              onClick={(event) => event.stopPropagation()}
                              aria-label={`Edit ${project.title}`}
                              title="Edit project"
                              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Link>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleDeleteProject(project);
                              }}
                              aria-label={`Delete ${project.title}`}
                              title="Delete project"
                              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-destructive transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        </div>
                      </div>
                      ) : null}

                      {columns.isColumnVisible("role") ? (
                      <div className="shrink-0" style={{ width: "110px" }}>
                        <Badge variant="outline" className={rolePillClass(project.role)}>
                          {project.role ?? "—"}
                        </Badge>
                      </div>
                      ) : null}

                      {columns.isColumnVisible("importance") ? (
                      <div className="shrink-0" style={{ width: "110px" }}>
                        <Badge variant="outline" className={priorityPillClass(project.importance)}>
                          {project.importance ?? "—"}
                        </Badge>
                      </div>
                      ) : null}

                      {columns.isColumnVisible("status") ? (
                      <div className="shrink-0" style={{ width: "110px" }}>
                        <Badge variant="outline" className={statusPillClass(project.status)}>
                          {project.status ?? "—"}
                        </Badge>
                      </div>
                      ) : null}

                      {columns.isColumnVisible("papers") ? (
                      <div className="shrink-0" style={{ width: "70px" }}>
                        <span className="text-sm text-muted-foreground">
                          {moduleCountByProject.get(project.id) ?? 0}
                        </span>
                      </div>
                      ) : null}

                      {columns.isColumnVisible("notes") ? (
                      <div className="shrink-0" style={{ width: "70px" }}>
                        <span className="text-sm text-muted-foreground">
                          {noteCountByProject.get(project.id) ?? 0}
                        </span>
                      </div>
                      ) : null}

                      {columns.isColumnVisible("scheduled") ? (
                      <div className="shrink-0" style={{ width: "110px" }}>
                        <span className="text-sm tabular-nums text-muted-foreground">
                          {formatDate(project.scheduledFor)}
                        </span>
                      </div>
                      ) : null}

                      {columns.isColumnVisible("due") ? (
                      <div className="shrink-0" style={{ width: "110px" }}>
                      <span
                        className={cn(
                          "text-sm",
                          isOverdue(project)
                            ? "font-semibold text-destructive"
                            : "text-muted-foreground",
                        )}
                      >
                        {formatDate(project.dueDate)}
                      </span>
                      </div>
                      ) : null}
                    </div>

                    {isExpanded ? (
                      <div className="flex flex-col gap-5 rounded-b-xl border border-t-0 border-border bg-card/70 px-5 py-5 shadow-sm">
                        <ProjectOverviewDetails
                          project={project}
                          moduleCount={moduleCountByProject.get(project.id) ?? 0}
                          taskCount={taskCounts.total}
                          noteCount={noteCountByProject.get(project.id) ?? 0}
                        />
                        <Button asChild variant="outline" size="sm" className="w-fit">
                          <Link to={`/projects/${project.id}`}>View full project details</Link>
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
          {paginationMeta ? (
            <PaginationControls
              page={paginationMeta.page}
              pageSize={paginationMeta.pageSize}
              totalItems={paginationMeta.totalItems}
              totalPages={paginationMeta.totalPages}
              isPending={projectsQuery.isFetching}
              onPageChange={setPage}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
