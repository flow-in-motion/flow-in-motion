import { useEffect, useMemo, useState } from "react";
import { FolderKanban, Pencil, Trash2, UserPlus } from "lucide-react";
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
import { SortableHeader } from "@/components/shared/sortable-header";
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
import { formatListDate, isOverdue } from "@/lib/list-format";
import { cn } from "@/lib/utils";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { PaginationControls } from "@/components/shared/pagination-controls";

const STATUS_FILTERS = ["All", "Active", "Review", "Stalled", "Complete"] as const;
const ROLE_FILTERS = ["All roles", "owner", "collaborator", "supervisor", "lead"] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number];
type RoleFilter = (typeof ROLE_FILTERS)[number];

const PROJECT_COLUMNS = [
  { id: "project", label: "Project", width: "minmax(240px,2fr)" },
  { id: "role", label: "My Role", width: "110px" },
  { id: "importance", label: "Importance", width: "110px" },
  { id: "status", label: "Status", width: "110px" },
  { id: "papers", label: "Papers", width: "80px" },
  { id: "notes", label: "Notes", width: "80px" },
  { id: "scheduled", label: "Scheduled For", width: "130px" },
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


export default function ProjectsPage() {
  const workspace = useCurrentWorkspace();
  const tenantId = workspace.data?.id ?? "";
  const [page, setPage] = useState(1);

  const projectsQuery = useProjects(tenantId, page);
  const paginationMeta = projectsQuery.data?.meta;
  const modulesQuery = useModules(tenantId);
  const modules = modulesQuery.data?.data ?? [];
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
  const columns = useColumnVisibility(
    PROJECT_COLUMNS.map((column) => column.id),
    "projects",
  );
  const gridTemplate = PROJECT_COLUMNS.filter((column) =>
    columns.visibleColumns.has(column.id),
  )
    .map((column) => column.width)
    .join(" ");

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
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
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

      <div className="surface-toolbar flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
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

      <div className="overflow-x-auto rounded-lg border bg-card p-2 sm:p-3">
        <div className="min-w-[900px]">
          <div
            className="mb-1 grid gap-4 rounded-md bg-muted/65 px-4 py-3 text-[0.6875rem] font-semibold uppercase tracking-[0.07em] text-muted-foreground"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            {PROJECT_COLUMNS.filter((column) =>
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
            {visibleProjects.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                No projects match the current filters.
              </div>
            ) : (
              visibleProjects.map((project) => (
                <div
                  key={project.id}
                  className="grid items-center gap-4 rounded-md border border-transparent bg-card px-4 py-3.5 transition-colors hover:bg-muted/45"
                  style={{ gridTemplateColumns: gridTemplate }}
                >
                  {columns.isColumnVisible("project") ? (
                    <div className="flex flex-col gap-0.5">
                      {project.displayId ? (
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {project.displayId}
                        </span>
                      ) : null}
                      <div className="flex items-start gap-2">
                        <Link
                          to={`/projects/${project.id}`}
                          className="font-semibold leading-tight text-foreground transition-colors hover:text-primary hover:underline"
                        >
                          {project.title}
                        </Link>
                        {project.tenantId === tenantId ? (
                          <button
                            type="button"
                            onClick={() => setSharingProject(project)}
                            aria-label={`Manage collaborators for ${project.title}`}
                            title="Manage collaborators"
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                        <Link
                          to={`/projects/${project.id}?edit=true`}
                          aria-label={`Edit ${project.title}`}
                          title="Edit project"
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => void handleDeleteProject(project)}
                          aria-label={`Delete ${project.title}`}
                          title="Delete project"
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-destructive transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <span className="max-w-md text-xs text-muted-foreground">
                        {project.description || project.researchArea || "No description"}
                      </span>
                    </div>
                  ) : null}

                  {columns.isColumnVisible("role") ? (
                    <Badge variant="outline" className={rolePillClass(project.role)}>
                      {project.role ?? "—"}
                    </Badge>
                  ) : null}

                  {columns.isColumnVisible("importance") ? (
                    <Badge variant="outline" className={priorityPillClass(project.importance)}>
                      {project.importance ?? "—"}
                    </Badge>
                  ) : null}

                  {columns.isColumnVisible("status") ? (
                    <Badge variant="outline" className={statusPillClass(project.status)}>
                      {project.status ?? "—"}
                    </Badge>
                  ) : null}

                  {columns.isColumnVisible("papers") ? (
                    <span className="text-sm text-muted-foreground">
                      {moduleCountByProject.get(project.id) ?? 0}
                    </span>
                  ) : null}

                  {columns.isColumnVisible("notes") ? (
                    <span className="text-sm text-muted-foreground">
                      {noteCountByProject.get(project.id) ?? 0}
                    </span>
                  ) : null}

                  {columns.isColumnVisible("scheduled") ? (
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {formatListDate(project.scheduledFor)}
                    </span>
                  ) : null}

                  {columns.isColumnVisible("due") ? (
                    <span
                      className={cn(
                        "text-sm tabular-nums",
                        isOverdue(project.dueDate, project.status === "Complete")
                          ? "font-semibold text-destructive"
                          : "text-muted-foreground",
                      )}
                    >
                      {formatListDate(project.dueDate)}
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
              isPending={projectsQuery.isFetching}
              onPageChange={setPage}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
