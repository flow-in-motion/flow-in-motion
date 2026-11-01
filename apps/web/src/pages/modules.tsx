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
import { useSessionListState } from "@/hooks/use-session-list-state";

import {
  useCreateModule,
  useCurrentWorkspace,
  useMe,
  useMembers,
  useModuleCollaboratorContacts,
  useModulePipelineStagePool,
  useModules,
  usePaperCurrentlyWithCollaborators,
  useProjects,
  useTrackEvent,
  useUpdateModule,
  type ApiModule,
  type PaperCurrentlyWithType,
} from "@/api/hooks";
import { ColumnVisibilityMenu } from "@/components/dashboard/column-visibility-menu";
import {
  ModuleDialog,
  type ModuleFormInput,
} from "@/components/modules/module-dialog";
import {
  enteredSubmittedUnderReview,
  PaperStageCelebration,
} from "@/components/modules/paper-stage-celebration";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { formatListDate, isOverdue } from "@/lib/list-format";
import { cn } from "@/lib/utils";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { CurrentlyWithFilter } from "@/components/modules/currently-with-filter";
import { ArchiveModuleDialog } from "@/components/modules/archive-module-dialog";
import { priorityPillClass, statusPillClass } from "@/lib/tones";

const STATUS_OPTIONS = ["Active", "Stalled", "Complete"] as const;
const PRIORITY_OPTIONS = ["Low", "Medium", "High", "Critical"] as const;

const MODULE_COLUMNS = [
  { id: "module", label: "Paper", width: "minmax(280px,2fr)" },
  { id: "project", label: "Project", width: "180px" },
  { id: "status", label: "Status", width: "110px" },
  { id: "priority", label: "Priority", width: "110px" },
  { id: "progress", label: "Progress", width: "130px" },
  { id: "stage", label: "Stage", width: "170px" },
  { id: "submittedTo", label: "Submitted to", width: "200px" },
  { id: "due", label: "Next Action Date", width: "170px" },
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
    assignedToInvitationId: string | null,
  ) => void;
}) {
  const [open, setOpen] = useState(false);
  const collaboratorsQuery = useModuleCollaboratorContacts(
    tenantId,
    paper.id,
    open,
  );

  return (
    <PaperCurrentlyWithSelect
      id={`currently-with-${paper.id}`}
      currentlyWithType={paper.currentlyWithType ?? null}
      assignedToUserId={paper.assignedToUserId}
      assignedToInvitationId={paper.assignedToInvitationId ?? null}
      assignedToDisplayName={paper.assignedToDisplayName}
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

function submittedJournal(module: ApiModule) {
  return module.pipelineStage === "Submitted, Under Review"
    ? module.submittedToJournal?.trim() ?? ""
    : "";
}

export default function ModulesPage() {
  const workspace = useCurrentWorkspace();
  const tenantId = workspace.data?.id ?? "";
  const me = useMe();

  const { page, setPage, search, setSearch, requestSearch } = useListSearch({
    userId: me.data?.id,
    workspaceId: tenantId,
    preferenceKey: "papers",
  });

  const [pageSize, setPageSize] = useSessionListState<number | "all">(
    me.data?.id,
    tenantId,
    "papers:page-size",
    20,
  );

  const [selectedStatuses, setSelectedStatuses] = useSessionListState<
    Set<string>
  >(me.data?.id, tenantId, "papers:statuses", () => new Set());

  const [selectedStages, setSelectedStages] = useSessionListState<Set<string>>(
    me.data?.id,
    tenantId,
    "papers:stages",
    () => new Set(),
  );

  const [selectedCurrentlyWith, setSelectedCurrentlyWith] = useSessionListState<
    Set<string>
  >(me.data?.id, tenantId, "papers:currently-with", () => new Set());

  const [selectedCurrentlyWithContacts, setSelectedCurrentlyWithContacts] =
    useSessionListState<Set<string>>(
      me.data?.id,
      tenantId,
      "papers:currently-with-contacts",
      () => new Set(),
    );

  const [currentlyWithFilterOpen, setCurrentlyWithFilterOpen] = useState(false);
  const currentlyWithCollaboratorsQuery = usePaperCurrentlyWithCollaborators(
    tenantId,
    currentlyWithFilterOpen || selectedCurrentlyWithContacts.size > 0,
  );
  const currentlyWithCollaborators = currentlyWithCollaboratorsQuery.data ?? [];
  const selectedCollaborators = currentlyWithCollaborators.filter((contact) =>
    selectedCurrentlyWithContacts.has(contact.id),
  );
  const selectedCurrentlyWithUserIds = selectedCollaborators.flatMap(
    (contact) => contact.userIds,
  );
  const selectedCurrentlyWithInvitationIds = selectedCollaborators.flatMap(
    (contact) => contact.invitationIds,
  );

  const modulesQuery = useModules(tenantId, undefined, page, true, {
    pageSize,
    search: requestSearch,
    statuses: [...selectedStatuses],
    stages: [...selectedStages],
    currentlyWithTypes: [...selectedCurrentlyWith] as PaperCurrentlyWithType[],
    currentlyWithUserIds: selectedCurrentlyWithUserIds,
    currentlyWithInvitationIds: selectedCurrentlyWithInvitationIds,
  });
  const modules = modulesQuery.data?.data ?? [];
  const paginationMeta = modulesQuery.data?.meta;
  const projectsQuery = useProjects(tenantId);
  const projects = projectsQuery.data?.data ?? [];
  const generalProject = projectsQuery.data?.generalProject ?? null;
  const stagesQuery = useModulePipelineStagePool(tenantId);
  const visibleStages = useMemo(
    () =>
      [...(stagesQuery.data ?? [])]
        .filter((stageValue) => !stageValue.hidden)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [stagesQuery.data],
  );
  const visibleStageNames = useMemo(
    () => visibleStages.map((stageValue) => stageValue.value),
    [visibleStages],
  );
  // A paper may sit on a stage that has since been hidden; keep it selectable
  // so the dropdown still shows the paper's current stage.
  function stageOptionsFor(currentStage: string | null) {
    return currentStage && !visibleStageNames.includes(currentStage)
      ? [currentStage, ...visibleStageNames]
      : visibleStageNames;
  }
  const [isNewModuleOpen, setIsNewModuleOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPaperCelebrationOpen, setIsPaperCelebrationOpen] = useState(false);
  const [celebrationPaperTitle, setCelebrationPaperTitle] = useState("");
  const workspaceMembers = useMembers(tenantId, 1, isNewModuleOpen);
  const members = workspaceMembers.data?.data ?? [];
  const createModule = useCreateModule(tenantId);
  const updateModule = useUpdateModule(tenantId);
  const trackEvent = useTrackEvent(tenantId);
  const [archiveTarget, setArchiveTarget] = useState<ApiModule | null>(null);

  const [sortColumn, setSortColumn] = useSessionListState<SortColumn>(
    me.data?.id,
    tenantId,
    "papers:sort-column",
    "module",
  );

  const [sortDirection, setSortDirection] = useSessionListState<SortDirection>(
    me.data?.id,
    tenantId,
    "papers:sort-direction",
    "asc",
  );
  useEffect(() => {
    setPage(1);
  }, [
    setPage,
    tenantId,
    selectedStatuses,
    selectedStages,
    selectedCurrentlyWith,
    selectedCurrentlyWithContacts,
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
      case "submittedTo":
        return submittedJournal(a).localeCompare(submittedJournal(b));
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
          selectedCurrentlyWithContacts.size > 0) &&
        !selectedCurrentlyWith.has(module.currentlyWithType ?? "") &&
        !(
          module.currentlyWithType === "collaborator" &&
          ((module.assignedToUserId &&
            selectedCurrentlyWithUserIds.includes(module.assignedToUserId)) ||
            (module.assignedToInvitationId &&
              selectedCurrentlyWithInvitationIds.includes(
                module.assignedToInvitationId,
              )))
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
    selectedCurrentlyWithContacts,
    selectedCurrentlyWithUserIds,
    selectedCurrentlyWithInvitationIds,
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
    selectedCurrentlyWithContacts.size > 0;

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

  function archive(module: ApiModule) {
    setArchiveTarget(module);
  }

  if (workspace.isPending || modulesQuery.isPending) {
    return <LoadingState title="Loading papers" layout="list" />;
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
            {archiveTarget ? (
        <ArchiveModuleDialog
          key={archiveTarget.id}
          open
          paper={archiveTarget}
          onOpenChange={(open) => {
            if (!open) setArchiveTarget(null);
          }}
        />
      ) : null}

      <PaperStageCelebration
        open={isPaperCelebrationOpen}
        onOpenChange={setIsPaperCelebrationOpen}
        paperTitle={celebrationPaperTitle}
      />
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
          selectedContactIds={selectedCurrentlyWithContacts}
          collaborators={currentlyWithCollaborators}
          isLoading={currentlyWithCollaboratorsQuery.isLoading}
          onOpenChange={setCurrentlyWithFilterOpen}
          onToggleType={(value) => {
            if (value === "collaborator") {
              setSelectedCurrentlyWithContacts(new Set());
            }
            toggleSelected(setSelectedCurrentlyWith, value);
          }}
          onToggleCollaborator={(contactId) => {
            setSelectedCurrentlyWith((current) => {
              const next = new Set(current);
              next.delete("collaborator");
              return next;
            });
            toggleSelected(setSelectedCurrentlyWithContacts, contactId);
          }}
          onClear={() => {
            setSelectedCurrentlyWith(new Set());
            setSelectedCurrentlyWithContacts(new Set());
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
              setSelectedCurrentlyWithContacts(new Set());
            }}
            className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Clear filters
          </button>
        ) : null}
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
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-destructive transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <span className="line-clamp-3 max-w-md break-words text-xs leading-4 text-muted-foreground">
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
                    <InlineFieldSelect
                      value={module.pipelineStage}
                      options={stageOptionsFor(module.pipelineStage)}
                      fieldLabel="stage"
                      itemLabel={paperDisplayTitle(module)}
                      placeholder="Unassigned"
                      valueClassName={() => "text-left text-muted-foreground"}
                      onChange={async (nextStage) => {
                        setActionError(null);
                        const previousStage = module.pipelineStage;
                        await updateModule.mutateAsync({
                          moduleId: module.id,
                          input: { pipelineStage: nextStage },
                        });
                        if (
                          enteredSubmittedUnderReview(previousStage, nextStage)
                        ) {
                          setCelebrationPaperTitle(paperDisplayTitle(module));
                          setIsPaperCelebrationOpen(true);
                        }
                      }}
                      onError={(message) =>
                        setActionError(
                          `Could not update the stage for “${paperDisplayTitle(module)}”. ${message}`,
                        )
                      }
                    />
                  ) : null}

                  {columns.isColumnVisible("submittedTo") ? (
                    <span
                      className="line-clamp-2 break-words text-sm text-muted-foreground"
                      title={submittedJournal(module) || undefined}
                    >
                      {submittedJournal(module) ||
                        (module.pipelineStage === "Submitted, Under Review"
                          ? "No active submission logged"
                          : "—")}
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
                      onChange={(
                        currentlyWithType,
                        assignedToUserId,
                        assignedToInvitationId,
                      ) => {
                        setActionError(null);
                        void updateModule
                          .mutateAsync({
                            moduleId: module.id,
                            input: {
                              currentlyWithType,
                              assignedToUserId,
                              assignedToInvitationId,
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
        </div>
      </div>
    </div>
  );
}
