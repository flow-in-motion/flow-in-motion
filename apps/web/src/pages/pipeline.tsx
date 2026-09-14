import { useMemo, useState, type DragEvent } from "react";
import { GripVertical, Pencil, Workflow } from "lucide-react";
import { Link } from "react-router-dom";

import {
  useCreateModule,
  useCurrentWorkspace,
  useMe,
  useMembers,
  useModulePipelineStagePool,
  useModules,
  useProjects,
  useTasks,
  useTrackEvent,
  useUpdateModule,
  type ApiPipelineStage,
} from "@/api/hooks";
import { ModuleDialog, type ModuleFormInput } from "@/components/modules/module-dialog";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeading } from "@/components/typography/heading";
import { paperDisplayTitle } from "@/lib/paper-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const VIEW_OPTIONS = ["List", "Columns"] as const;
type ViewOption = (typeof VIEW_OPTIONS)[number];

const STATUS_FILTERS = ["All", "Active", "Review", "Stalled", "Complete"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const ALL_ENTITIES = "All";

const STAGE_TITLE_CLASS = "text-sm font-bold text-foreground";
const ITEM_ID_CLASS = "font-mono text-[11px] text-muted-foreground";
const ITEM_TITLE_CLASS = "text-sm font-medium text-foreground";
const COMPLETION_CLASS = "text-sm font-semibold text-primary";
const OUTSTANDING_CLASS = "text-xs font-medium";

interface PipelineRow {
  id: string;
  displayId: string | null;
  title: string;
  status: string | null;
  assignee: string | null;
  projectId: string | null;
  completion: number;
  outstanding: number;
  stageIndex: number | undefined;
}

function statusPillClass(status: string | null) {
  switch (status) {
    case "Active":
    case "Complete":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400";
    case "Review":
      return "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-400";
    case "Stalled":
      return "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400";
    default:
      return "border-border bg-muted/50 text-muted-foreground";
  }
}

/** Selected = solid blue. Inactive = white pill, light-grey border. */
function controlPillClass(selected: boolean) {
  return cn(
    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
    selected
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
  );
}

function groupByStage(rows: PipelineRow[], stageCount: number) {
  const groups: PipelineRow[][] = Array.from({ length: stageCount }, () => []);
  for (const row of rows) {
    if (row.stageIndex === undefined) continue;
    groups[row.stageIndex]?.push(row);
  }
  return groups;
}

interface PipelineItemRowProps {
  row: PipelineRow;
  compact?: boolean;
  isDragging: boolean;
  onDragStart: (event: DragEvent<HTMLDivElement>, row: PipelineRow) => void;
  onDragEnd: () => void;
  onStageChange: (id: string, stageIndex: number) => void;
  stages: readonly ApiPipelineStage[];
}

function ItemEditLink({ row }: { row: PipelineRow }) {
  return (
    <Link
      to={`/modules/${row.id}?edit=true&from=pipeline`}
      aria-label={`Edit ${row.title}`}
      title="Edit paper"
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Pencil className="h-3.5 w-3.5" />
    </Link>
  );
}

function StageSelect({ row, stages, onStageChange }: {
  row: PipelineRow;
  stages: readonly ApiPipelineStage[];
  onStageChange: (id: string, stageIndex: number) => void;
}) {
  return (
    <select
      value={row.stageIndex ?? ""}
      onChange={(event) => onStageChange(row.id, Number(event.target.value))}
      onMouseDown={(event) => event.stopPropagation()}
      aria-label={`Move ${row.title} to stage`}
      title="Change pipeline stage"
      className="h-7 max-w-44 rounded-md border border-input bg-background px-2 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
    >
      <option value="" disabled>Select a stage</option>
      {stages.map((stage, index) => (
        <option key={stage.id} value={index}>{stage.value}</option>
      ))}
    </select>
  );
}

function PipelineItemRow({
  row,
  compact,
  isDragging,
  onDragStart,
  onDragEnd,
  onStageChange,
  stages,
}: PipelineItemRowProps) {
  const outstandingClass =
    row.outstanding === 0
      ? "text-muted-foreground"
      : "text-orange-600 dark:text-orange-400";
  const cardTone = "border-border bg-card";
  const cardToneRow = "border-border bg-card";

  if (compact) {
    return (
      <div
        draggable
        onDragStart={(event) => onDragStart(event, row)}
        onDragEnd={onDragEnd}
        className={cn(
          "flex cursor-grab flex-col gap-1.5 rounded-lg border px-3 py-2.5 transition-colors hover:border-primary/30 hover:bg-muted/25 active:cursor-grabbing",
          cardTone,
          isDragging && "opacity-45",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="flex items-center gap-1">
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <span className={ITEM_ID_CLASS}>{row.displayId ?? row.id}</span>
          </span>
          <div className="flex items-center gap-1">
            <ItemEditLink row={row} />
          </div>
        </div>
        <span className={cn(ITEM_TITLE_CLASS, "leading-snug")}>{row.title}</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {row.assignee ? (
            <Badge variant="outline">{row.assignee}</Badge>
          ) : null}
          <Badge variant="outline" className={statusPillClass(row.status)}>
            {row.status ?? "—"}
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className={COMPLETION_CLASS}>{row.completion}%</span>
          <span className={cn(OUTSTANDING_CLASS, outstandingClass)}>
            {row.outstanding} outstanding
          </span>
        </div>
        <StageSelect row={row} stages={stages} onStageChange={onStageChange} />
      </div>
    );
  }

  return (
    <div
      draggable
      onDragStart={(event) => onDragStart(event, row)}
      onDragEnd={onDragEnd}
      className={cn(
        "flex cursor-grab flex-wrap items-center gap-3 rounded-lg border px-4 py-2.5 transition-colors hover:border-primary/30 hover:bg-muted/25 active:cursor-grabbing",
        cardToneRow,
        isDragging && "opacity-45",
      )}
    >
      <span className="flex items-center gap-1">
        <GripVertical className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <span className={ITEM_ID_CLASS}>{row.displayId ?? row.id}</span>
      </span>
      <span className={ITEM_TITLE_CLASS}>{row.title}</span>
      <ItemEditLink row={row} />
      <div className="ml-auto flex flex-wrap items-center gap-3">
        {row.assignee ? (
          <Badge variant="outline">{row.assignee}</Badge>
        ) : null}
        <Badge variant="outline" className={statusPillClass(row.status)}>
          {row.status ?? "—"}
        </Badge>
        <span className={COMPLETION_CLASS}>{row.completion}%</span>
        <span className={cn(OUTSTANDING_CLASS, outstandingClass)}>
          {row.outstanding} outstanding
        </span>
        <StageSelect row={row} stages={stages} onStageChange={onStageChange} />
      </div>
    </div>
  );
}

export default function PipelinePage() {
  const workspace = useCurrentWorkspace();
  const tenantId = workspace.data?.id ?? "";

  const projectsQuery = useProjects(tenantId);
  const projects = projectsQuery.data?.data ?? [];
  const modulesQuery = useModules(tenantId);
  const modules = modulesQuery.data?.data ?? [];
  const tasksQuery = useTasks(tenantId);
  const tasks = tasksQuery.data?.data ?? [];
  const membersQuery = useMembers(tenantId);
  const members = membersQuery.data?.data ?? [];
  const me = useMe();

  const stagesQuery = useModulePipelineStagePool(tenantId);
  const updateModule = useUpdateModule(tenantId);
  const createModule = useCreateModule(tenantId);
  const trackEvent = useTrackEvent(tenantId);

  const [view, setView] = useState<ViewOption>("List");
  const [moduleStatus, setModuleStatus] = useState<StatusFilter>("All");
  const [assignee, setAssignee] = useState<string>("All");
  const [moduleProjectFilter, setModuleProjectFilter] = useState<string>(ALL_ENTITIES);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverStageIndex, setDragOverStageIndex] = useState<number | null>(null);
  const [isNewPaperOpen, setIsNewPaperOpen] = useState(false);

  const stages = useMemo(
    () =>
      [...(stagesQuery.data ?? [])]
        .filter((stage) => !stage.hidden)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [stagesQuery.data],
  );
  const stageIndexByValue = useMemo(() => {
    const map = new Map<string, number>();
    stages.forEach((stage, index) => map.set(stage.value, index));
    return map;
  }, [stages]);

  const taskCountByModule = useMemo(() => {
    const counts = new Map<string, { completed: number; total: number }>();
    for (const task of tasks) {
      if (!task.moduleId) continue;
      const entry = counts.get(task.moduleId) ?? { completed: 0, total: 0 };
      entry.total += 1;
      if (task.status === "Complete") entry.completed += 1;
      counts.set(task.moduleId, entry);
    }
    return counts;
  }, [tasks]);

  const memberNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const member of members) {
      if (member.displayName) map.set(member.userId, member.displayName);
    }
    return map;
  }, [members]);

  const assigneeOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const module of modules) {
      if (module.assignedToUserId) ids.add(module.assignedToUserId);
    }
    const labeled = Array.from(ids).map((id) => ({
      id,
      label: id === me.data?.id ? "Me" : (memberNameById.get(id) ?? "Other member"),
    }));
    labeled.sort((a, b) => a.label.localeCompare(b.label));
    return [{ id: "All", label: "All assignees" }, { id: "Unassigned", label: "Unassigned" }, ...labeled];
  }, [modules, memberNameById, me.data?.id]);

  const moduleProjectFilterOptions = useMemo(() => {
    const projectsForMap = projects.map((project) => ({
      id: project.id,
      label: project.title,
    }));
    projectsForMap.sort((a, b) => a.label.localeCompare(b.label));
    return [
      { id: ALL_ENTITIES, label: "All projects" },
      { id: "None", label: "No project" },
      ...projectsForMap,
    ];
  }, [projects]);

  const moduleRows: PipelineRow[] = useMemo(
    () =>
      modules.map((module) => {
        const counts = taskCountByModule.get(module.id) ?? { completed: 0, total: 0 };
        const assigneeLabel = module.assignedToUserId
          ? module.assignedToUserId === me.data?.id
            ? "Me"
            : (memberNameById.get(module.assignedToUserId) ?? "Other member")
          : null;
        return {
          id: module.id,
          displayId: module.displayId,
          title: paperDisplayTitle(module),
          status: module.status,
          assignee: assigneeLabel,
          projectId: module.projectId,
          completion: counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0,
          outstanding: counts.total - counts.completed,
          stageIndex: module.pipelineStage ? stageIndexByValue.get(module.pipelineStage) : undefined,
        };
      }),
    [modules, taskCountByModule, stageIndexByValue, memberNameById, me.data?.id],
  );

  const unassignedCount = moduleRows.filter((row) => row.stageIndex === undefined).length;

  const filteredRows = useMemo(() => {
    return moduleRows.filter((row) => {
      if (moduleStatus !== "All" && row.status !== moduleStatus) return false;
      if (assignee === "Unassigned" && row.assignee !== null) return false;
      if (assignee !== "All" && assignee !== "Unassigned" && row.assignee !== assignee) return false;
      if (moduleProjectFilter === "None" && row.projectId !== null) return false;
      if (
        moduleProjectFilter !== ALL_ENTITIES &&
        moduleProjectFilter !== "None" &&
        row.projectId !== moduleProjectFilter
      ) {
        return false;
      }
      return true;
    });
  }, [moduleRows, moduleStatus, assignee, moduleProjectFilter]);

  const grouped = useMemo(
    () => groupByStage(filteredRows, stages.length),
    [filteredRows, stages.length],
  );
  const unassignedRows = filteredRows.filter((row) => row.stageIndex === undefined);

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
      pipelineStage: input.pipelineStage,
      tag: input.tag || undefined,
      dueDate: input.dueDate || undefined,
      assignedToUserId: input.assignedToUserId ?? undefined,
    });
    trackEvent({ name: "module_created" });
    return module;
  }

  function moveItem(id: string, stageIndex: number) {
    const stageValue = stages[stageIndex]?.value;
    if (!stageValue) return;
    void updateModule.mutateAsync({ moduleId: id, input: { pipelineStage: stageValue } });
  }

  function handleDragStart(event: DragEvent<HTMLDivElement>, row: PipelineRow) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", row.id);
    setDraggedId(row.id);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>, stageIndex: number) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverStageIndex(stageIndex);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>, stageIndex: number) {
    event.preventDefault();
    const id = draggedId ?? event.dataTransfer.getData("text/plain");
    if (id) moveItem(id, stageIndex);
    setDraggedId(null);
    setDragOverStageIndex(null);
  }

  function handleDragEnd() {
    setDraggedId(null);
    setDragOverStageIndex(null);
  }

  if (workspace.isPending || projectsQuery.isPending || modulesQuery.isPending || stagesQuery.isPending) {
    return <LoadingState title="Loading pipeline" className="min-h-[50vh]" />;
  }
  if (modulesQuery.isError) {
    return (
      <ErrorState
        title="Pipeline could not be loaded"
        description={modulesQuery.error.message}
        onRetry={() => void modulesQuery.refetch()}
      />
    );
  }

  return (
    <div className="page-stack">
      <PageHeading
        icon={Workflow}
        tone="emerald"
        eyebrow="Workflows"
        title="Paper pipeline"
        description="Papers grouped by their current stage in the shared workspace pipeline."
        actions={<Button onClick={() => setIsNewPaperOpen(true)}>New Paper</Button>}
      />

      <ModuleDialog
        open={isNewPaperOpen}
        onOpenChange={setIsNewPaperOpen}
        tenantId={tenantId}
        projects={projects}
        members={members}
        onSave={handleCreateModule}
      />

      <div className="surface-toolbar flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            View
          </span>
          {VIEW_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setView(option)}
              aria-pressed={option === view}
              className={controlPillClass(option === view)}
            >
              {option}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Select value={moduleProjectFilter} onValueChange={setModuleProjectFilter}>
            <SelectTrigger className="sm:w-48" aria-label="Filter by project">
              <SelectValue placeholder="Project" />
            </SelectTrigger>
            <SelectContent>
              {moduleProjectFilterOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={moduleStatus} onValueChange={(value) => setModuleStatus(value as StatusFilter)}>
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
          <Select value={assignee} onValueChange={setAssignee}>
            <SelectTrigger className="sm:w-44">
              <SelectValue placeholder="Assignee" />
            </SelectTrigger>
            <SelectContent>
              {assigneeOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button asChild variant="outline">
            <Link to="/settings#paper-pipeline-stages">Manage stages</Link>
          </Button>
        </div>
        {unassignedCount > 0 ? (
          <p className="text-xs text-muted-foreground">
            {unassignedCount} paper{unassignedCount === 1 ? "" : "s"} without a
            pipeline stage {unassignedCount === 1 ? "is" : "are"} shown in Unassigned.
          </p>
        ) : null}
      </div>

      {view === "List" ? (
        <div className="flex flex-col">
          {unassignedRows.length > 0 ? (
            <div className="mb-6 flex gap-4">
              <div className="flex w-4 shrink-0 flex-col items-center">
                <span className="mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-amber-400 bg-amber-100 dark:bg-amber-950" />
                <span className="w-px flex-1 bg-border" />
              </div>
              <div className="min-h-24 flex-1 rounded-xl border border-amber-200 bg-amber-50/45 p-3 dark:border-amber-900/50 dark:bg-amber-950/15">
                <div className="flex items-center gap-2">
                  <h3 className={STAGE_TITLE_CLASS}>Unassigned</h3>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    {unassignedRows.length}
                  </span>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  {unassignedRows.map((row) => (
                    <PipelineItemRow
                      key={row.id}
                      row={row}
                      isDragging={draggedId === row.id}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onStageChange={moveItem}
                      stages={stages}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : null}
          {stages.map((stage, index) => {
            const rows = grouped[index] ?? [];
            const hasItems = rows.length > 0;
            const isLast = index === stages.length - 1;

            return (
              <div key={stage.id} className="flex gap-4">
                <div className="flex w-4 shrink-0 flex-col items-center">
                  <span
                    className={cn(
                      "mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full border-2",
                      hasItems ? "border-primary bg-primary" : "border-border bg-background",
                    )}
                  />
                  {!isLast ? <span className="w-px flex-1 bg-border" /> : null}
                </div>

                <div
                  role="group"
                  aria-label={`${stage.value} stage drop zone`}
                  onDragOver={(event) => handleDragOver(event, index)}
                  onDrop={(event) => handleDrop(event, index)}
                  className={cn(
                    "min-h-24 flex-1 rounded-lg border border-transparent bg-card/35 p-3 transition-colors",
                    !isLast && "mb-6",
                    draggedId && "border border-dashed border-primary/30",
                    dragOverStageIndex === index && "border-primary bg-primary/5 ring-2 ring-primary/30",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h3
                      className={cn(STAGE_TITLE_CLASS, !hasItems && "text-muted-foreground")}
                    >
                      {stage.value}
                    </h3>
                    {hasItems ? (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                        {rows.length}
                      </span>
                    ) : null}
                  </div>

                  {hasItems ? (
                    <div className="mt-3 flex flex-col gap-2">
                      {rows.map((row) => (
                        <PipelineItemRow
                          key={row.id}
                          row={row}
                          isDragging={draggedId === row.id}
                          onDragStart={handleDragStart}
                          onDragEnd={handleDragEnd}
                          onStageChange={moveItem}
                          stages={stages}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div
            className="flex gap-4"
            style={{ minWidth: `${(stages.length + (unassignedRows.length ? 1 : 0)) * 260}px` }}
          >
            {unassignedRows.length > 0 ? (
              <div className="flex min-h-48 w-64 shrink-0 flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50/30 p-3 dark:border-amber-900/50 dark:bg-amber-950/15">
                <div className="flex items-center gap-2">
                  <h3 className={STAGE_TITLE_CLASS}>Unassigned</h3>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    {unassignedRows.length}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {unassignedRows.map((row) => (
                    <PipelineItemRow
                      key={row.id}
                      row={row}
                      compact
                      isDragging={draggedId === row.id}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onStageChange={moveItem}
                      stages={stages}
                    />
                  ))}
                </div>
              </div>
            ) : null}
            {stages.map((stage, index) => {
              const rows = grouped[index] ?? [];
              const hasItems = rows.length > 0;

              return (
                <div
                  key={stage.id}
                  role="group"
                  aria-label={`${stage.value} stage drop zone`}
                  onDragOver={(event) => handleDragOver(event, index)}
                  onDrop={(event) => handleDrop(event, index)}
                  className={cn(
                    "flex min-h-48 w-64 shrink-0 flex-col gap-3 rounded-lg border bg-card p-3 transition-colors",
                    draggedId && "border-dashed border-primary/30",
                    dragOverStageIndex === index && "border-primary bg-primary/5 ring-2 ring-primary/30",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <h3
                      className={cn(
                        STAGE_TITLE_CLASS,
                        !hasItems && "text-muted-foreground",
                      )}
                    >
                      {stage.value}
                    </h3>
                    {hasItems ? (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                        {rows.length}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-2">
                    {hasItems ? (
                      rows.map((row) => (
                        <PipelineItemRow
                          key={row.id}
                          row={row}
                          compact
                          isDragging={draggedId === row.id}
                          onDragStart={handleDragStart}
                          onDragEnd={handleDragEnd}
                          onStageChange={moveItem}
                          stages={stages}
                        />
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No papers</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
