import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Pencil, Presentation, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";

import {
  useConferences,
  useCreateConference,
  useCurrentWorkspace,
  useDeleteConference,
  useMe,
  useModules,
  useProjects,
  useUpdateConference,
  useTrackEvent,
  type ApiConference,
} from "@/api/hooks";
import { ColumnVisibilityMenu } from "@/components/dashboard/column-visibility-menu";
import { ConferenceSubmissionDialog, type ConferenceSubmissionInput } from "@/components/dashboard/conference-submission-dialog";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { PageHeading } from "@/components/typography/heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import {
  CONFERENCE_DEADLINE_FILTERS,
  CONFERENCE_TYPE_FILTERS,
  conferenceTypeBadgeClass,
  conferenceUrgencyClass,
  conferenceUrgencyLabel,
  formatConferenceDate,
  formatConferenceDateRange,
  matchesConferenceDeadline,
  type ConferenceDeadlineFilter,
  type ConferenceTypeFilter,
} from "@/lib/conference-format";
import { cn } from "@/lib/utils";

const CONFERENCE_COLUMNS = [
  { id: "conference", label: "Conference", width: "minmax(260px,2fr)" },
  { id: "submissionDue", label: "Submission Due", width: "150px" },
  { id: "conferenceDates", label: "Conference Dates", width: "180px" },
  { id: "type", label: "Type", width: "120px" },
  { id: "linkedProjects", label: "Linked Projects/Papers", width: "minmax(200px,1.3fr)" },
] as const;

type SortColumn = (typeof CONFERENCE_COLUMNS)[number]["id"];
type SortDirection = "asc" | "desc";

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

export default function ConferencesPage() {
  const workspace = useCurrentWorkspace();
  const tenantId = workspace.data?.id ?? "";
  const [page, setPage] = useState(1);

  const conferencesQuery = useConferences(tenantId, page);
  const conferences = conferencesQuery.data?.data ?? [];
  const paginationMeta = conferencesQuery.data?.meta;
  const projectsQuery = useProjects(tenantId);
  const projects = projectsQuery.data?.data ?? [];
  const modulesQuery = useModules(tenantId);
  const modules = modulesQuery.data?.data ?? [];
  const meQuery = useMe();
  const createConference = useCreateConference(tenantId);
  const updateConference = useUpdateConference(tenantId);
  const deleteConference = useDeleteConference(tenantId);
  const trackEvent = useTrackEvent(tenantId);

  const [search, setSearch] = useState("");
  const [type, setType] = useState<ConferenceTypeFilter>("All");
  const [deadline, setDeadline] = useState<ConferenceDeadlineFilter>("All");
  const [sortColumn, setSortColumn] = useState<SortColumn>("submissionDue");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  useEffect(() => {
    setPage(1);
  }, [tenantId, search, type, deadline, sortColumn, sortDirection]);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingConference, setEditingConference] = useState<ApiConference | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const columns = useColumnVisibility(
    CONFERENCE_COLUMNS.map((column) => column.id),
    "conferences",
  );
  const gridTemplate = CONFERENCE_COLUMNS.filter((column) =>
    columns.visibleColumns.has(column.id),
  )
    .map((column) => column.width)
    .join(" ");

  const ownedProjects = useMemo(
    () => projects.filter((project) =>
      project.userId === meQuery.data?.id || project.role?.toLowerCase() === "owner",
    ),
    [meQuery.data?.id, projects],
  );

  const ownedModules = useMemo(() => {
    const ownedProjectIds = new Set(ownedProjects.map((project) => project.id));
    return modules.filter((module) => module.projectId && ownedProjectIds.has(module.projectId));
  }, [modules, ownedProjects]);

  function handleSort(column: SortColumn) {
    if (column === sortColumn) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  }

  function compareConferences(a: ApiConference, b: ApiConference, column: SortColumn) {
    switch (column) {
      case "conference":
        return a.name.localeCompare(b.name);
      case "submissionDue":
        return a.submissionDue.localeCompare(b.submissionDue);
      case "conferenceDates":
        return a.startDate.localeCompare(b.startDate);
      case "type":
        return (a.submissionType ?? "").localeCompare(b.submissionType ?? "");
      case "linkedProjects":
        return a.projects.length - b.projects.length;
    }
  }

  const visibleConferences = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = conferences.filter((conference) => {
      if (type !== "All" && conference.submissionType !== type) return false;
      if (!matchesConferenceDeadline(conference.daysRemaining, deadline)) return false;
      return (
        !query ||
        conference.name.toLowerCase().includes(query) ||
        conference.acronym.toLowerCase().includes(query) ||
        conference.location.toLowerCase().includes(query) ||
        conference.projects.some((project) => project.title.toLowerCase().includes(query))
      );
    });
    return [...filtered].sort(
      (a, b) => compareConferences(a, b, sortColumn) * (sortDirection === "asc" ? 1 : -1),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conferences, search, type, deadline, sortColumn, sortDirection]);

  const hasActiveFilters = search !== "" || type !== "All" || deadline !== "All";

  function clearFilters() {
    setSearch("");
    setType("All");
    setDeadline("All");
  }

  async function handleCreateConference(input: ConferenceSubmissionInput) {
    await createConference.mutateAsync(input);
    trackEvent({ name: "conference_created" });
  }

  async function handleUpdateConference(input: ConferenceSubmissionInput) {
    if (!editingConference) return;
    await updateConference.mutateAsync({ conferenceId: editingConference.id, input });
    setEditingConference(null);
  }

  async function handleDeleteConference(conference: ApiConference) {
    if (!window.confirm(`Delete "${conference.name}"? This action cannot be undone.`)) return;
    setActionError(null);
    try {
      await deleteConference.mutateAsync(conference.id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The conference could not be deleted.");
    }
  }

  const isLoading = workspace.isPending || conferencesQuery.isPending || projectsQuery.isPending || meQuery.isPending;

  if (isLoading) {
    return <LoadingState title="Loading conferences" className="min-h-[50vh]" />;
  }
  if (conferencesQuery.isError) {
    return (
      <ErrorState
        title="Conferences could not be loaded"
        description={conferencesQuery.error.message}
        onRetry={() => void conferencesQuery.refetch()}
      />
    );
  }

  return (
    <div className="page-stack">
      <PageHeading
        icon={Presentation}
        tone="rose"
        eyebrow="Dissemination"
        title="Conferences"
        description="Manage conference deadlines, event dates, submission types, and linked research projects."
        actions={
          <Button onClick={() => setIsCreateOpen(true)} disabled={ownedProjects.length === 0}>
            New Conference
          </Button>
        }
      />

      <ConferenceSubmissionDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        projects={ownedProjects}
        modules={ownedModules}
        onSave={handleCreateConference}
      />
      <ConferenceSubmissionDialog
        open={editingConference !== null}
        onOpenChange={(open) => {
          if (!open) setEditingConference(null);
        }}
        projects={ownedProjects}
        modules={ownedModules}
        conference={editingConference}
        onSave={handleUpdateConference}
      />

      {ownedProjects.length === 0 ? (
        <p className="text-sm text-muted-foreground">Create or own a project before adding a conference.</p>
      ) : null}

      {actionError ? (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span>{actionError}</span>
          <button type="button" className="font-medium underline" onClick={() => setActionError(null)}>Dismiss</button>
        </div>
      ) : null}

      <div className="surface-toolbar flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search conference, project, or location…"
          className="sm:max-w-xs"
        />
        <Select value={type} onValueChange={(value) => setType(value as ConferenceTypeFilter)}>
          <SelectTrigger className="sm:w-40"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            {CONFERENCE_TYPE_FILTERS.map((option) => (
              <SelectItem key={option} value={option}>
                {option === "All" ? "All types" : option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={deadline} onValueChange={(value) => setDeadline(value as ConferenceDeadlineFilter)}>
          <SelectTrigger className="sm:w-40"><SelectValue placeholder="Deadline" /></SelectTrigger>
          <SelectContent>
            {CONFERENCE_DEADLINE_FILTERS.map((option) => (
              <SelectItem key={option} value={option}>
                {option === "All" ? "All deadlines" : option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ColumnVisibilityMenu
          columns={CONFERENCE_COLUMNS}
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
        <div className="min-w-[900px]">
          <div
            className="mb-1 grid gap-4 rounded-md bg-muted/65 px-4 py-3 text-[0.6875rem] font-semibold uppercase tracking-[0.07em] text-muted-foreground"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            {CONFERENCE_COLUMNS.filter((column) =>
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
            {visibleConferences.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                No conferences match the current filters.
              </div>
            ) : (
              visibleConferences.map((conference) => {
                const canManage = conference.ownerUserId === meQuery.data?.id;
                return (
                  <div
                    key={conference.id}
                    className="grid items-center gap-4 rounded-md border border-transparent bg-card px-4 py-3.5 transition-colors hover:bg-muted/45"
                    style={{ gridTemplateColumns: gridTemplate }}
                  >
                    {columns.isColumnVisible("conference") ? (
                      <div className="flex items-start gap-3">
                        <span className="flex h-9 min-w-9 items-center justify-center rounded-md bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                          {conference.acronym}
                        </span>
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-start gap-2">
                            <Link
                              to={`/conferences/${conference.id}`}
                              className="font-semibold leading-tight text-foreground transition-colors hover:text-primary hover:underline"
                            >
                              {conference.name}
                            </Link>
                            {canManage ? (
                              <>
                                <button
                                  type="button"
                                  aria-label={`Edit ${conference.name}`}
                                  title="Edit conference"
                                  onClick={() => setEditingConference(conference)}
                                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  aria-label={`Delete ${conference.name}`}
                                  title="Delete conference"
                                  onClick={() => void handleDeleteConference(conference)}
                                  disabled={deleteConference.isPending}
                                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-destructive transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </>
                            ) : null}
                          </div>
                          <span className="text-xs text-muted-foreground">{conference.location}</span>
                        </div>
                      </div>
                    ) : null}
                    {columns.isColumnVisible("submissionDue") ? (
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{formatConferenceDate(conference.submissionDue)}</span>
                        <span className={cn("text-xs", conferenceUrgencyClass(conference.daysRemaining))}>
                          {conferenceUrgencyLabel(conference.daysRemaining)}
                        </span>
                      </div>
                    ) : null}
                    {columns.isColumnVisible("conferenceDates") ? (
                      <span className="text-sm text-muted-foreground">
                        {formatConferenceDateRange(conference.startDate, conference.endDate)}
                      </span>
                    ) : null}
                    {columns.isColumnVisible("type") ? (
                      <Badge variant="outline" className={conferenceTypeBadgeClass(conference.submissionType)}>
                        {conference.submissionType ?? "—"}
                      </Badge>
                    ) : null}
                    {columns.isColumnVisible("linkedProjects") ? (
                      <div className="flex flex-wrap gap-1">
                        {conference.projects.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          conference.projects.map((project) => (
                            <Link
                              key={project.id}
                              to={`/projects/${project.id}`}
                              className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary ring-1 ring-inset ring-primary/15 hover:bg-primary/15 hover:underline"
                            >
                              {project.displayId ?? project.title}
                            </Link>
                          ))
                        )}
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
              isPending={conferencesQuery.isFetching}
              onPageChange={setPage}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
