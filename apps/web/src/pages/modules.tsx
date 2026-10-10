import { useListSearch } from "@/hooks/use-list-search";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { ChevronDown, FileStack, Pencil, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";

import {
  useArchiveModule,
  useCreateModule,
  useCurrentWorkspace,
  useMe,
  useMembers,
  useModuleCollaborators,
  useModulePipelineStagePool,
  useModules,
  usePaperCurrentlyWithCollaborators,
  useProjects,
  useTrackEvent,
  useUpdateModule,
  type ApiModule,
  type PaperCurrentlyWithCollaborator,
  type PaperCurrentlyWithType,
} from "@/api/hooks";
import { ColumnVisibilityMenu } from "@/components/dashboard/column-visibility-menu";
import {
  ModuleDialog,
  type ModuleFormInput,
} from "@/components/modules/module-dialog";
import { PaperCurrentlyWithSelect } from "@/components/modules/paper-currently-with-select";
import { paperDisplayTitle } from "@/lib/paper-title";
import { paperCurrentlyWithLabel } from "@/lib/paper-currently-with";
import { buildPaperProgressByStage } from "@/lib/paper-progress";
import { ErrorState } from "@/components/shared/error-state";
import { InlineFieldSelect } from "@/components/shared/inline-field-select";
import { LoadingState } from "@/components/shared/loading-state";
import { SearchInput } from "@/components/shared/search-input";
import { PageHeading } from "@/components/typography/heading";
import { SortableHeader } from "@/components/shared/sortable-header";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { formatListDate, isOverdue } from "@/lib/list-format";
import { cn } from "@/lib/utils";
import { PaginationControls } from "@/components/shared/pagination-controls";

const STATUS_OPTIONS = ["Active", "Review", "Stalled", "Complete"] as const;
const PRIORITY_OPTIONS = ["Low", "Medium", "High", "Critical"] as const;
const CURRENTLY_WITH_FILTER_LABELS: Record<PaperCurrentlyWithType, string> = {
  me: "Me",
  collaborator: "Collaborators/Coauthors",
  journal: "Journal",
  friendly_reviewer: "Friendly reviewer",
};
const MODULE_COLUMNS = [
  { id: "module", label: "Paper", width: "minmax(280px,2fr)" },
  { id: "project", label: "Project", width: "180px" },
  { id: "status", label: "Status", width: "110px" },
  { id: "priority", label: "Priority", width: "110px" },
  { id: "progress", label: "Progress", width: "130px" },
  { id: "stage", label: "Stage", width: "170px" },
  { id: "due", label: "Follow up or Due Date", width: "170px" },
  { id: "assignee", label: "Currently With", width: "150px" },
] as const;

type SortColumn = (typeof MODULE_COLUMNS)[number]["id"];
type SortDirection = "asc" | "desc";

interface MultiSelectFilterProps {
  options: readonly string[];
  selected: ReadonlySet<string>;
  pluralLabel: string;
  triggerClassName: string;
  optionLabel?: (value: string) => string;
  onToggle: (value: string) => void;
  onClear: () => void;
}

function MultiSelectFilter({
  options,
  selected,
  pluralLabel,
  triggerClassName,
  optionLabel = (value) => value,
  onToggle,
  onClear,
}: MultiSelectFilterProps) {
  const triggerLabel =
    selected.size === 0
      ? `All ${pluralLabel}`
      : selected.size === 1
        ? optionLabel([...selected][0])
        : `${selected.size} ${pluralLabel}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("justify-between gap-2", triggerClassName)}
          aria-label={`Filter by ${pluralLabel}`}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronDown
            className="h-4 w-4 shrink-0 opacity-50"
            aria-hidden="true"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-72 min-w-64 overflow-y-auto"
      >
        <DropdownMenuCheckboxItem
          checked={selected.size === 0}
          onSelect={(event) => event.preventDefault()}
          onCheckedChange={onClear}
        >
          All {pluralLabel}
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option}
            checked={selected.has(option)}
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={() => onToggle(option)}
          >
            {optionLabel(option)}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface CurrentlyWithFilterProps {
  selectedTypes: ReadonlySet<string>;
  selectedUserIds: ReadonlySet<string>;
  collaborators: readonly PaperCurrentlyWithCollaborator[];
  isLoading: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleType: (value: PaperCurrentlyWithType) => void;
  onToggleCollaborator: (userId: string) => void;
  onClear: () => void;
}

function CurrentlyWithFilter({
  selectedTypes,
  selectedUserIds,
  collaborators,
  isLoading,
  onOpenChange,
  onToggleType,
  onToggleCollaborator,
  onClear,
}: CurrentlyWithFilterProps) {
  const selectionCount = selectedTypes.size + selectedUserIds.size;
  const selectedCollaborator =
    selectedUserIds.size === 1
      ? collaborators.find((item) => selectedUserIds.has(item.userId))
      : undefined;
  const onlySelectedType =
    selectedTypes.size === 1 && selectedUserIds.size === 0
      ? ([...selectedTypes][0] as PaperCurrentlyWithType)
      : undefined;
  const triggerLabel =
    selectionCount === 0
      ? "All current holders"
      : selectedCollaborator
        ? selectedCollaborator.displayName ??
          selectedCollaborator.affiliation ??
          "Unnamed collaborator"
        : onlySelectedType
          ? CURRENTLY_WITH_FILTER_LABELS[onlySelectedType]
          : `${selectionCount} current holders`;

  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="justify-between gap-2 sm:w-52"
          aria-label="Filter by current holders"
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronDown
            className="h-4 w-4 shrink-0 opacity-50"
            aria-hidden="true"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-64">
        <DropdownMenuCheckboxItem
          checked={selectionCount === 0}
          onSelect={(event) => event.preventDefault()}
          onCheckedChange={onClear}
        >
          All current holders
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={selectedTypes.has("me")}
          onSelect={(event) => event.preventDefault()}
          onCheckedChange={() => onToggleType("me")}
        >
          Me
        </DropdownMenuCheckboxItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <span>Collaborators/Coauthors</span>
            {selectedTypes.has("collaborator") || selectedUserIds.size > 0 ? (
              <span className="ml-auto text-xs text-muted-foreground">
                {selectedTypes.has("collaborator")
                  ? "All"
                  : selectedUserIds.size}
              </span>
            ) : null}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-72 min-w-64 overflow-y-auto">
            <DropdownMenuCheckboxItem
              checked={selectedTypes.has("collaborator")}
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={() => onToggleType("collaborator")}
            >
              All collaborators/coauthors
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            {isLoading ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                Loading collaborators…
              </div>
            ) : collaborators.length ? (
              collaborators.map((collaborator) => (
                <DropdownMenuCheckboxItem
                  key={collaborator.userId}
                  checked={selectedUserIds.has(collaborator.userId)}
                  onSelect={(event) => event.preventDefault()}
                  onCheckedChange={() =>
                    onToggleCollaborator(collaborator.userId)
                  }
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">
                      {collaborator.displayName ?? "Unnamed collaborator"}
                    </span>
                    {collaborator.affiliation ? (
                      <span className="truncate text-xs text-muted-foreground">
                        {collaborator.affiliation}
                      </span>
                    ) : null}
                  </span>
                </DropdownMenuCheckboxItem>
              ))
            ) : (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                No collaborators found.
              </div>
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {(["journal", "friendly_reviewer"] as const).map((option) => (
          <DropdownMenuCheckboxItem
            key={option}
            checked={selectedTypes.has(option)}
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={() => onToggleType(option)}
          >
            {CURRENTLY_WITH_FILTER_LABELS[option]}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const MODULE_STATUS_ORDER: Record<string, number> = {
  Active: 0,
  Review: 1,
  Stalled: 2,
  Complete: 3,
};
const PAPER_PRIORITY_ORDER: Record<string, number> = {
  Low: 0,
  Medium: 1,
  High: 2,
  Critical: 3,
};

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

function ProgressCell({ percent }: { percent: number }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground">{percent}%</span>
    </div>
  );
}

function InlinePaperCurrentlyWith({
  tenantId,
  paper,
  currentUserId,
  disabled,
  onChange,
}: {
  tenantId: string;
  paper: ApiModule;
  currentUserId?: string;
  disabled: boolean;
  onChange: (
    currentlyWithType: PaperCurrentlyWithType,
    assignedToUserId: string | null,
  ) => void;
}) {
  const [open, setOpen] = useState(false);
  const collaboratorsQuery = useModuleCollaborators(
    tenantId,
    paper.id,
    open,
  );

  return (
    <PaperCurrentlyWithSelect
      id={`currently-with-${paper.id}`}
      currentlyWithType={paper.currentlyWithType ?? null}
      assignedToUserId={paper.assignedToUserId}
      currentUserId={currentUserId}
      collaborators={collaboratorsQuery.data ?? []}
      collaboratorsPending={collaboratorsQuery.isPending}
      onOpenChange={setOpen}
      triggerClassName="h-8 px-2 text-sm"
      ariaLabel={`Change Currently With for ${paperDisplayTitle(paper)}`}
      disabled={disabled}
      onChange={onChange}
    />
  );
}

export default function ModulesPage() {
  const workspace = useCurrentWorkspace();
  const tenantId = workspace.data?.id ?? "";
  const { page, setPage, search, setSearch, requestSearch } = useListSearch();
  const [pageSize, setPageSize] = useState<number | "all">(20);

  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedStages, setSelectedStages] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedCurrentlyWith, setSelectedCurrentlyWith] = useState<
    Set<string>
  >(() => new Set());
  const [selectedCurrentlyWithUsers, setSelectedCurrentlyWithUsers] = useState<
    Set<string>
  >(() => new Set());
  const [currentlyWithFilterOpen, setCurrentlyWithFilterOpen] = useState(false);

  const modulesQuery = useModules(tenantId, undefined, page, true, {
    pageSize,
    search: requestSearch,
    statuses: [...selectedStatuses],
    stages: [...selectedStages],
    currentlyWithTypes: [
      ...selectedCurrentlyWith,
    ] as PaperCurrentlyWithType[],
    currentlyWithUserIds: [...selectedCurrentlyWithUsers],
  });
  const modules = modulesQuery.data?.data ?? [];
  const paginationMeta = modulesQuery.data?.meta;
  const projectsQuery = useProjects(tenantId);
  const projects = projectsQuery.data?.data ?? [];
  const generalProject = projectsQuery.data?.generalProject ?? null;
  const stagesQuery = useModulePipelineStagePool(tenantId);
  const currentlyWithCollaboratorsQuery =
    usePaperCurrentlyWithCollaborators(tenantId, currentlyWithFilterOpen);
  const currentlyWithCollaborators =
    currentlyWithCollaboratorsQuery.data ?? [];
  const me = useMe();
  const visibleStages = useMemo(
    () =>
      [...(stagesQuery.data ?? [])]
        .filter((stageValue) => !stageValue.hidden)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [stagesQuery.data],
  );
  const [isNewModuleOpen, setIsNewModuleOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const workspaceMembers = useMembers(tenantId, 1, isNewModuleOpen);
  const members = workspaceMembers.data?.data ?? [];
  const createModule = useCreateModule(tenantId);
  const updateModule = useUpdateModule(tenantId);
  const archiveModule = useArchiveModule(tenantId);
  const trackEvent = useTrackEvent(tenantId);

  const [sortColumn, setSortColumn] = useState<SortColumn>("module");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  useEffect(() => {
    setPage(1);
  }, [
    setPage,
    tenantId,
    selectedStatuses,
    selectedStages,
    selectedCurrentlyWith,
    selectedCurrentlyWithUsers,
    sortColumn,
    sortDirection,
  ]);
  const columns = useColumnVisibility(
    MODULE_COLUMNS.map((column) => column.id),
    "modules",
  );
  const gridTemplate = MODULE_COLUMNS.filter((column) =>
    columns.visibleColumns.has(column.id),
  )
    .map((column) => column.width)
    .join(" ");

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

  const memberById = useMemo(() => {
    const map = new Map<string, string>();
    for (const member of members) map.set(member.userId, member.displayName);
    return map;
  }, [members]);

  const progressByStage = useMemo(
    () => buildPaperProgressByStage(visibleStages),
    [visibleStages],
  );

  const projectName = useCallback(
    (projectId: string | null) => {
      if (!projectId) return "Independent paper";
      return projectById.get(projectId) ?? "Unknown project";
    },
    [projectById],
  );

  const currentlyWithName = useCallback(
    (module: ApiModule) =>
      paperCurrentlyWithLabel(module, undefined, memberById),
    [memberById],
  );

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
        return (
          (MODULE_STATUS_ORDER[a.status ?? ""] ?? 99) -
          (MODULE_STATUS_ORDER[b.status ?? ""] ?? 99)
        );
      case "priority":
        return (
          (PAPER_PRIORITY_ORDER[a.priority ?? ""] ?? 99) -
          (PAPER_PRIORITY_ORDER[b.priority ?? ""] ?? 99)
        );
      case "progress": {
        const aPercent = progressByStage.get(a.pipelineStage ?? "") ?? 0;
        const bPercent = progressByStage.get(b.pipelineStage ?? "") ?? 0;
        return aPercent - bPercent;
      }
      case "stage":
        return (a.pipelineStage ?? "").localeCompare(b.pipelineStage ?? "");
      case "due":
        return (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
      case "assignee":
        return currentlyWithName(a).localeCompare(currentlyWithName(b));
    }
  }

  const visibleModules = useMemo(() => {
    const filtered = modules.filter((module) => {
      if (
        selectedStatuses.size > 0 &&
        !selectedStatuses.has(module.status ?? "")
      ) {
        return false;
      }
      if (
        selectedStages.size > 0 &&
        !selectedStages.has(module.pipelineStage ?? "")
      ) {
        return false;
      }
      if (
        (selectedCurrentlyWith.size > 0 ||
          selectedCurrentlyWithUsers.size > 0) &&
        !selectedCurrentlyWith.has(module.currentlyWithType ?? "") &&
        !(
          module.currentlyWithType === "collaborator" &&
          module.assignedToUserId &&
          selectedCurrentlyWithUsers.has(module.assignedToUserId)
        )
      ) {
        return false;
      }
      return true;
    });
    return [...filtered].sort(
      (a, b) =>
        compareModules(a, b, sortColumn) * (sortDirection === "asc" ? 1 : -1),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    modules,
    search,
    selectedStatuses,
    selectedStages,
    selectedCurrentlyWith,
    selectedCurrentlyWithUsers,
    projectName,
    currentlyWithName,
    progressByStage,
    sortColumn,
    sortDirection,
  ]);

  const hasActiveFilters =
    search !== "" ||
    selectedStatuses.size > 0 ||
    selectedStages.size > 0 ||
    selectedCurrentlyWith.size > 0 ||
    selectedCurrentlyWithUsers.size > 0;

  function toggleSelected(
    setter: Dispatch<SetStateAction<Set<string>>>,
    value: string,
  ) {
    setter((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  async function handleCreateModule(input: ModuleFormInput) {
    const module = await createModule.mutateAsync({
      shortTitle: input.shortTitle,
      title: input.title || undefined,
      description: input.description || undefined,
      abstract: input.abstract || undefined,
      targetJournal: input.targetJournal || undefined,
      backupJournal: input.backupJournal || undefined,
      targetConference: input.targetConference || undefined,
      backupConference: input.backupConference || undefined,
      projectId: input.projectId ?? undefined,
      status: input.status,
      priority: input.priority || undefined,
      pipelineStage: input.pipelineStage,
      dueDate: input.dueDate || undefined,
      assignedToUserId: input.assignedToUserId ?? undefined,
      currentlyWithType: input.currentlyWithType ?? undefined,
    });
    trackEvent({ name: "module_created" });
    return module;
  }

  async function archive(module: ApiModule) {
    if (
      !window.confirm(
        `Delete "${paperDisplayTitle(module)}"? It will be permanently deleted after 14 days.`,
      )
    ) {
      return;
    }
    setActionError(null);
    try {
      await archiveModule.mutateAsync(module.id);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "The paper could not be deleted.",
      );
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
        onRetry={() =>
          pageSize === "all" ? setPageSize(20) : void modulesQuery.refetch()
        }
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
        description="Organise project-related or independent areas of work by status and assignee."
        actions={
          <Button onClick={() => setIsNewModuleOpen(true)}>New Paper</Button>
        }
      />

      <ModuleDialog
        open={isNewModuleOpen}
        onOpenChange={setIsNewModuleOpen}
        tenantId={tenantId}
        projects={projects}
        generalProject={generalProject}
        members={members}
        onSave={handleCreateModule}
      />
      {actionError ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <span>{actionError}</span>
          <button
            type="button"
            className="font-medium underline"
            onClick={() => setActionError(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="surface-toolbar flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onClear={() => setSearch("")}
          clearLabel="Clear paper search"
          placeholder="Search papers…"
          className="sm:max-w-xs"
        />
        <MultiSelectFilter
          options={STATUS_OPTIONS}
          selected={selectedStatuses}
          pluralLabel="statuses"
          triggerClassName="sm:w-40"
          onToggle={(value) => toggleSelected(setSelectedStatuses, value)}
          onClear={() => setSelectedStatuses(new Set())}
        />
        <MultiSelectFilter
          options={visibleStages.map((stageValue) => stageValue.value)}
          selected={selectedStages}
          pluralLabel="stages"
          triggerClassName="sm:w-48"
          onToggle={(value) => toggleSelected(setSelectedStages, value)}
          onClear={() => setSelectedStages(new Set())}
        />
        <CurrentlyWithFilter
          selectedTypes={selectedCurrentlyWith}
          selectedUserIds={selectedCurrentlyWithUsers}
          collaborators={currentlyWithCollaborators}
          isLoading={currentlyWithCollaboratorsQuery.isLoading}
          onOpenChange={setCurrentlyWithFilterOpen}
          onToggleType={(value) => {
            if (value === "collaborator") {
              setSelectedCurrentlyWithUsers(new Set());
            }
            toggleSelected(setSelectedCurrentlyWith, value);
          }}
          onToggleCollaborator={(userId) => {
            setSelectedCurrentlyWith((current) => {
              const next = new Set(current);
              next.delete("collaborator");
              return next;
            });
            toggleSelected(setSelectedCurrentlyWithUsers, userId);
          }}
          onClear={() => {
            setSelectedCurrentlyWith(new Set());
            setSelectedCurrentlyWithUsers(new Set());
          }}
        />
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
              setSelectedStatuses(new Set());
              setSelectedStages(new Set());
              setSelectedCurrentlyWith(new Set());
              setSelectedCurrentlyWithUsers(new Set());
            }}
            className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card p-2 sm:p-3">
        <div className="min-w-[1080px]">
          <div
            className="mb-1 grid gap-4 rounded-md bg-muted/65 px-4 py-3 text-[0.6875rem] font-semibold uppercase tracking-[0.07em] text-muted-foreground"
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

          <div className="flex flex-col gap-1">
            {visibleModules.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                No papers match the current filters.
              </div>
            ) : (
              visibleModules.map((module) => (
                <div
                  key={module.id}
                  className="grid items-center gap-4 rounded-md border border-transparent bg-card px-4 py-3.5 transition-colors hover:bg-muted/45"
                  style={{ gridTemplateColumns: gridTemplate }}
                >
                  {columns.isColumnVisible("module") ? (
                    <div className="flex items-start gap-2">
                      <div className="flex flex-col gap-0.5">
                        {module.displayId ? (
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {module.displayId}
                          </span>
                        ) : null}
                        <div className="flex items-start gap-2">
                          <Link
                            to={`/modules/${module.id}`}
                            className="font-semibold leading-tight text-foreground transition-colors hover:text-primary hover:underline"
                          >
                            {paperDisplayTitle(module)}
                          </Link>
                          <Link
                            to={`/modules/${module.id}?edit=true`}
                            aria-label={`Edit ${paperDisplayTitle(module)}`}
                            title="Edit paper"
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Link>
                          <button
                            type="button"
                            aria-label={`Delete ${paperDisplayTitle(module)}`}
                            title="Delete paper"
                            onClick={() => void archive(module)}
                            disabled={archiveModule.isPending}
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-destructive transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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
                      <Link
                        to={`/projects/${module.projectId}`}
                        className="max-w-56 text-sm font-medium text-primary hover:underline"
                      >
                        {projectName(module.projectId)}
                      </Link>
                    ) : (
                      <span className="max-w-56 text-sm text-muted-foreground">
                        Independent paper
                      </span>
                    )
                  ) : null}
                  {columns.isColumnVisible("status") ? (
                    <InlineFieldSelect
                      value={module.status}
                      options={STATUS_OPTIONS}
                      fieldLabel="status"
                      itemLabel={paperDisplayTitle(module)}
                      valueClassName={statusPillClass}
                      onChange={async (nextStatus) => {
                        setActionError(null);
                        await updateModule.mutateAsync({
                          moduleId: module.id,
                          input: { status: nextStatus },
                        });
                      }}
                      onError={(message) =>
                        setActionError(
                          `Could not update the status for “${paperDisplayTitle(module)}”. ${message}`,
                        )
                      }
                    />
                  ) : null}
                  {columns.isColumnVisible("priority") ? (
                    <InlineFieldSelect
                      value={module.priority}
                      options={PRIORITY_OPTIONS}
                      fieldLabel="priority"
                      itemLabel={paperDisplayTitle(module)}
                      valueClassName={priorityPillClass}
                      onChange={async (nextPriority) => {
                        setActionError(null);
                        await updateModule.mutateAsync({
                          moduleId: module.id,
                          input: { priority: nextPriority },
                        });
                      }}
                      onError={(message) =>
                        setActionError(
                          `Could not update the priority for “${paperDisplayTitle(module)}”. ${message}`,
                        )
                      }
                    />
                  ) : null}
                  {columns.isColumnVisible("progress") ? (
                    <ProgressCell
                      percent={
                        progressByStage.get(module.pipelineStage ?? "") ?? 0
                      }
                    />
                  ) : null}
                  {columns.isColumnVisible("stage") ? (
                    <span className="text-sm text-muted-foreground">
                      {module.pipelineStage ?? "Unassigned"}
                    </span>
                  ) : null}

                  {columns.isColumnVisible("due") ? (
                    <span
                      className={cn(
                        "text-sm tabular-nums",
                        isOverdue(module.dueDate, module.status === "Complete")
                          ? "font-semibold text-destructive"
                          : "text-muted-foreground",
                      )}
                    >
                      {formatListDate(module.dueDate)}
                    </span>
                  ) : null}
                  {columns.isColumnVisible("assignee") ? (
                    <InlinePaperCurrentlyWith
                      tenantId={tenantId}
                      paper={module}
                      currentUserId={me.data?.id}
                      disabled={updateModule.isPending}
                      onChange={(currentlyWithType, assignedToUserId) => {
                        setActionError(null);
                        void updateModule
                          .mutateAsync({
                            moduleId: module.id,
                            input: {
                              currentlyWithType,
                              ...(assignedToUserId
                                ? { assignedToUserId }
                                : {}),
                            },
                          })
                          .catch((error: unknown) => {
                            setActionError(
                              `Could not update who “${paperDisplayTitle(module)}” is currently with. ${
                                error instanceof Error
                                  ? error.message
                                  : "Please try again."
                              }`,
                            );
                          });
                      }}
                    />
                  ) : null}
                </div>
              ))
            )}
          </div>
          {paginationMeta ? (
            <PaginationControls
              page={paginationMeta.page}
              pageSize={paginationMeta.pageSize}
              selectedPageSize={pageSize}
              totalItems={paginationMeta.totalItems}
              totalPages={paginationMeta.totalPages}
              isPending={modulesQuery.isFetching}
              onPageChange={setPage}
              onPageSizeChange={(nextPageSize) => {
                setPageSize(nextPageSize);
                setPage(1);
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
