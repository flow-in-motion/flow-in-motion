import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, ArrowDown, ArrowUp, ArrowUpDown, FileStack, Pencil, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";

import {
  useArchiveModule,
  useCreateModule,
  useCurrentWorkspace,
  useMembers,
  useModules,
  useProjects,
  useTrackEvent,
  type ApiModule,
} from "@/api/hooks";
import { ColumnVisibilityMenu } from "@/components/dashboard/column-visibility-menu";
import { ModuleDialog, type ModuleFormInput } from "@/components/modules/module-dialog";
import { ModuleCollaboratorsManager } from "@/components/modules/module-collaborators";
import { paperDisplayTitle } from "@/lib/paper-title";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeading } from "@/components/typography/heading";
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
import { cn } from "@/lib/utils";
import { PaginationControls } from "@/components/shared/pagination-controls";

const STATUS_FILTERS = ["All", "Active", "Review", "Stalled", "Complete"] as const;
const MODULE_COLUMNS = [
  { id: "module", label: "Paper", width: "minmax(280px,2fr)" },
  { id: "project", label: "Project", width: "180px" },
  { id: "status", label: "Status", width: "110px" },
  { id: "stage", label: "Stage", width: "170px" },
  { id: "type", label: "Type", width: "140px" },
  { id: "due", label: "Due Date", width: "110px" },
  { id: "assignee", label: "Assigned To", width: "150px" },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number];
type SortColumn = (typeof MODULE_COLUMNS)[number]["id"];
type SortDirection = "asc" | "desc";

const MODULE_STATUS_ORDER: Record<string, number> = { Active: 0, Review: 1, Stalled: 2, Complete: 3 };

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

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
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

export default function ModulesPage() {
  const workspace = useCurrentWorkspace();
  const tenantId = workspace.data?.id ?? "";
  const [page, setPage] = useState(1);

  const modulesQuery = useModules(tenantId, undefined, page);
  const modules = modulesQuery.data?.data ?? [];
  const paginationMeta = modulesQuery.data?.meta;
  const projectsQuery = useProjects(tenantId);
  const projects = projectsQuery.data?.data ?? [];
  const [isNewModuleOpen, setIsNewModuleOpen] = useState(false);
  const [sharingModule, setSharingModule] = useState<ApiModule | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const workspaceMembers = useMembers(
    tenantId,
    1,
    isNewModuleOpen || sharingModule !== null,
  );
  const members = workspaceMembers.data?.data ?? [];
  const createModule = useCreateModule(tenantId);
  const archiveModule = useArchiveModule(tenantId);
  const trackEvent = useTrackEvent(tenantId);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("All");
  const [sortColumn, setSortColumn] = useState<SortColumn>("module");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  useEffect(() => {
    setPage(1);
  }, [
    tenantId,
    search,
    status,
    sortColumn,
    sortDirection,
  ]);
  const columns = useColumnVisibility(MODULE_COLUMNS.map((column) => column.id), "modules");
  const gridTemplate = MODULE_COLUMNS.filter((column) =>
    columns.visibleColumns.has(column.id),
  )
    .map((column) => column.width)
    .join(" ");

  const projectById = useMemo(() => {
    const map = new Map<string, string>();
    for (const project of projects) map.set(project.id, project.title);
    return map;
  }, [projects]);

  const memberById = useMemo(() => {
    const map = new Map<string, string>();
    for (const member of members) map.set(member.userId, member.displayName);
    return map;
  }, [members]);

  const projectName = useCallback((projectId: string | null) => {
    if (!projectId) return "Independent paper";
    return projectById.get(projectId) ?? "Unknown project";
  }, [projectById]);

  const assigneeName = useCallback((userId: string | null) => {
    if (!userId) return "Unassigned";
    return memberById.get(userId) ?? "Unknown member";
  }, [memberById]);

  function handleSort(column: SortColumn) {
    if (column === sortColumn) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  }

  function compareModules(a: ApiModule, b: ApiModule, column: SortColumn) {
    switch (column) {
      case "module":
        return paperDisplayTitle(a).localeCompare(paperDisplayTitle(b));
      case "project":
        return projectName(a.projectId).localeCompare(projectName(b.projectId));
      case "status":
        return (MODULE_STATUS_ORDER[a.status ?? ""] ?? 99) - (MODULE_STATUS_ORDER[b.status ?? ""] ?? 99);
      case "stage":
        return (a.pipelineStage ?? "").localeCompare(b.pipelineStage ?? "");
      case "type":
        return (a.tag ?? "").localeCompare(b.tag ?? "");
      case "due":
        return (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
      case "assignee":
        return assigneeName(a.assignedToUserId).localeCompare(assigneeName(b.assignedToUserId));
    }
  }

  const visibleModules = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = modules.filter((module) => {
      if (status !== "All" && module.status !== status) return false;
      const linkedProject = projectName(module.projectId);
      return (
        !query ||
        paperDisplayTitle(module).toLowerCase().includes(query) ||
        (module.title?.toLowerCase().includes(query) ?? false) ||
        (module.description?.toLowerCase().includes(query) ?? false) ||
        linkedProject.toLowerCase().includes(query)
      );
    });
    return [...filtered].sort(
      (a, b) => compareModules(a, b, sortColumn) * (sortDirection === "asc" ? 1 : -1),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modules, search, status, projectName, assigneeName, sortColumn, sortDirection]);

  const hasActiveFilters = search !== "" || status !== "All";

  async function handleCreateModule(input: ModuleFormInput) {
    const module = await createModule.mutateAsync({
      shortTitle: input.shortTitle,
      title: input.title || undefined,
      description: input.description || undefined,
      abstract: input.abstract || undefined,
      projectId: input.projectId ?? undefined,
      status: input.status,
      pipelineStage: input.pipelineStage,
      tag: input.tag || undefined,
      dueDate: input.dueDate || undefined,
      assignedToUserId: input.assignedToUserId ?? undefined,
    });
    trackEvent({ name: "module_created" });
    return module;
  }

  async function archive(module: ApiModule) {
    if (!window.confirm(`Archive "${paperDisplayTitle(module)}"? It will be permanently deleted after 14 days.`)) {
      return;
    }
    setActionError(null);
    try {
      await archiveModule.mutateAsync(module.id);
      setSharingModule((current) => (current?.id === module.id ? null : current));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The paper could not be archived.");
    }
  }

  if (workspace.isPending || modulesQuery.isPending) {
    return <LoadingState title="Loading papers" className="min-h-[50vh]" />;
  }
  if (modulesQuery.isError) {
    return (
      <ErrorState
        title="Papers could not be loaded"
        description={modulesQuery.error.message}
        onRetry={() => void modulesQuery.refetch()}
      />
    );
  }

  return (
    <div className="page-stack">
      <PageHeading
        tone="violet"
        icon={FileStack}
        eyebrow="Workflows"
        title="Papers"
        description="Organise project-related or independent areas of work by status, type and assignee."
        actions={<Button onClick={() => setIsNewModuleOpen(true)}>New Paper</Button>}
      />

      <ModuleDialog
        open={isNewModuleOpen}
        onOpenChange={setIsNewModuleOpen}
        tenantId={tenantId}
        projects={projects}
        members={members}
        onSave={handleCreateModule}
      />
      <Dialog
        open={sharingModule !== null}
        onOpenChange={(open) => {
          if (!open) setSharingModule(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Paper collaborators</DialogTitle>
            <DialogDescription>
              Invite collaborators to {sharingModule ? paperDisplayTitle(sharingModule) : "this paper"} by email and manage pending access.
            </DialogDescription>
          </DialogHeader>
          {sharingModule ? (
            sharingModule.tenantId === tenantId ? (
              <ModuleCollaboratorsManager
                tenantId={tenantId}
                moduleId={sharingModule.id}
                moduleTitle={paperDisplayTitle(sharingModule)}
                members={members}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                This paper belongs to another workspace. Only its owner can manage collaborators.
              </p>
            )
          ) : null}
        </DialogContent>
      </Dialog>

      {actionError ? (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span>{actionError}</span>
          <button type="button" className="font-medium underline" onClick={() => setActionError(null)}>Dismiss</button>
        </div>
      ) : null}

      <div className="surface-toolbar flex flex-wrap items-center gap-3 border-violet-200/70 bg-violet-50/40 dark:border-violet-900/50 dark:bg-violet-950/10">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search papers…"
          className="sm:max-w-xs"
        />
        <Select value={status} onValueChange={(value) => setStatus(value as StatusFilter)}>
          <SelectTrigger className="sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((option) => (
              <SelectItem key={option} value={option}>
                {option === "All" ? "All statuses" : option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ColumnVisibilityMenu
          columns={MODULE_COLUMNS}
          visibleColumns={columns.visibleColumns}
          onToggle={columns.toggleColumn}
        />
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setStatus("All");
            }}
            className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/70 bg-muted/20 p-3 shadow-sm sm:p-4">
        <div className="min-w-[970px]">
          <div
            className="mb-3 grid gap-4 rounded-lg border border-violet-200/70 bg-violet-100/65 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-violet-950 dark:border-violet-900/50 dark:bg-violet-950/35 dark:text-violet-200"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            {MODULE_COLUMNS.filter((column) =>
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

          <div className="flex flex-col gap-3">
            {visibleModules.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                No papers match the current filters.
              </div>
            ) : (
              visibleModules.map((module) => (
                <div
                  key={module.id}
                  className="grid items-center gap-4 rounded-xl border border-violet-200/70 bg-gradient-to-r from-violet-50/55 via-card to-card px-4 py-4 shadow-sm transition-all hover:border-violet-300 hover:shadow-md dark:border-violet-900/50 dark:from-violet-950/15"
                  style={{ gridTemplateColumns: gridTemplate }}
                >
                  {columns.isColumnVisible("module") ? (
                    <div className="flex items-start gap-2">
                      <div className="flex flex-col gap-0.5">
                        {module.displayId ? (
                          <span className="font-mono text-[11px] text-muted-foreground">{module.displayId}</span>
                        ) : null}
                        <div className="flex items-start gap-2">
                          <Link
                            to={`/modules/${module.id}`}
                            className="font-semibold leading-tight text-foreground transition-colors hover:text-primary hover:underline"
                          >
                            {paperDisplayTitle(module)}
                          </Link>
                          {module.tenantId === tenantId ? (
                            <button
                              type="button"
                              aria-label={`Manage collaborators for ${paperDisplayTitle(module)}`}
                              title="Manage collaborators"
                              onClick={() => setSharingModule(module)}
                              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <UserPlus className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                          <Link
                            to={`/modules/${module.id}?edit=true`}
                            aria-label={`Edit ${paperDisplayTitle(module)}`}
                            title="Edit paper"
                            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Link>
                          <button
                            type="button"
                            aria-label={`Archive ${paperDisplayTitle(module)}`}
                            title="Archive paper"
                            onClick={() => void archive(module)}
                            disabled={archiveModule.isPending}
                            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-destructive transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <span className="max-w-md text-xs text-muted-foreground">
                          {module.description || "No description"}
                        </span>
                      </div>
                    </div>
                  ) : null}
                  {columns.isColumnVisible("project") ? (
                    module.projectId ? (
                      <Link to={`/projects/${module.projectId}`} className="max-w-56 text-sm font-medium text-primary hover:underline">
                        {projectName(module.projectId)}
                      </Link>
                    ) : (
                      <span className="max-w-56 text-sm text-muted-foreground">Independent paper</span>
                    )
                  ) : null}
                  {columns.isColumnVisible("status") ? (
                    <Badge variant="outline" className={statusPillClass(module.status)}>
                      {module.status ?? "—"}
                    </Badge>
                  ) : null}
                  {columns.isColumnVisible("stage") ? (
                    <span className="text-sm text-muted-foreground">
                      {module.pipelineStage ?? "Unassigned"}
                    </span>
                  ) : null}
                  {columns.isColumnVisible("type") ? (
                    <span className="text-sm text-muted-foreground">
                      {module.tag ?? "—"}
                    </span>
                  ) : null}
                  {columns.isColumnVisible("due") ? (
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {formatDate(module.dueDate)}
                    </span>
                  ) : null}
                  {columns.isColumnVisible("assignee") ? (
                    <span className="text-sm text-muted-foreground">
                      {module.assignedToUserId
                        ? (memberById.get(module.assignedToUserId) ?? "Unknown member")
                        : "Unassigned"}
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
              isPending={modulesQuery.isFetching}
              onPageChange={setPage}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
