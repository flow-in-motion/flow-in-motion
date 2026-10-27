import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Presentation, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useSessionListState } from "@/hooks/use-session-list-state";

import {
  useConferences,
  useCreateConference,
  useCurrentWorkspace,
  useDeleteConference,
  useMe,
  useUpdateConference,
  useTrackEvent,
  type ApiConference,
} from "@/api/hooks";
import {
  ConferenceSubmissionDialog,
  type ConferenceSubmissionInput,
} from "@/components/dashboard/conference-submission-dialog";
import { ColumnVisibilityMenu } from "@/components/dashboard/column-visibility-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import {
  CONFERENCE_DEADLINE_FILTERS as DEADLINE_FILTERS,
  CONFERENCE_EVENT_FILTERS as EVENT_FILTERS,
  CONFERENCE_TYPE_FILTERS as TYPE_FILTERS,
  conferenceTypeBadgeClass as typeBadgeClass,
  conferenceUrgencyClass as urgencyClass,
  conferenceUrgencyLabel as urgencyLabel,
  formatConferenceDate as formatDate,
  formatConferenceDateRange as formatConferenceDates,
  matchesConferenceDeadline as matchesDeadline,
  matchesEventFilter,
  type ConferenceDeadlineFilter as DeadlineFilter,
  type ConferenceEventFilter as EventFilter,
  type ConferenceTypeFilter as TypeFilter,
} from "@/lib/conference-format";
import { cn } from "@/lib/utils";
import { paperDisplayTitle } from "@/lib/paper-title";
import { PaginationControls } from "@/components/shared/pagination-controls";

const CONFERENCE_COLUMNS = [
  { id: "conference", label: "Event" },
  { id: "submissionDue", label: "Submission Due" },
  { id: "conferenceDates", label: "Event Dates" },
  { id: "type", label: "Type" },
  { id: "intent", label: "Intent" },
  { id: "linkedProjects", label: "Linked Projects or Papers" },
  { id: "actions", label: "Actions" },
] as const;

type UpcomingSubmission = NonNullable<ApiConference["upcomingSubmissions"]>[number];

/**
 * One deadline: an event's own submission deadline, or the deadline of one
 * submission to it that has its own (such as a PDW due later than papers).
 */
interface DeadlineRow {
  key: string;
  conference: ApiConference;
  submission: UpcomingSubmission | null;
  due: string | null;
  daysRemaining: number | null;
  submissionType: string | null;
}

function deadlineRows(conference: ApiConference): DeadlineRow[] {
  const submissions = conference.upcomingSubmissions ?? [];
  const submissionRows = submissions.map((submission) => ({
    key: `submission:${submission.id}`,
    conference,
    submission,
    due: submission.submissionDue,
    daysRemaining: submission.daysRemaining,
    submissionType: submission.submissionType,
  }));
  // An event with no deadline of its own is still listed, unless its
  // submissions already give it deadlines.
  const eventRow =
    conference.submissionDue || submissionRows.length === 0
      ? [
          {
            key: `event:${conference.id}`,
            conference,
            submission: null,
            due: conference.submissionDue,
            daysRemaining: conference.daysRemaining,
            submissionType: conference.submissionType,
          },
        ]
      : [];
  return [...eventRow, ...submissionRows];
}

function submissionHref(submission: UpcomingSubmission) {
  if (submission.moduleId) return `/modules/${submission.moduleId}`;
  if (submission.projectId) return `/projects/${submission.projectId}`;
  return null;
}

export function ConferenceSubmissionsTable({
  showPast = false,
  dashboardView = false,
  hideCreateButton = false,
}: {
  showPast?: boolean;
  dashboardView?: boolean;
  hideCreateButton?: boolean;
}) {
  const preferenceKey = `${
    dashboardView ? "dashboard-conferences" : "conference-table"
  }:${showPast ? "past" : "upcoming"}`;
  const workspace = useCurrentWorkspace();
  const tenantId = workspace.data?.id ?? "";
  const [page, setPage] = useState(1);
  const conferencesQuery = useConferences(tenantId, page);
  const conferences = conferencesQuery.data?.data ?? [];
  const paginationMeta = conferencesQuery.data?.meta;
  const meQuery = useMe();
  const createConference = useCreateConference(tenantId);
  const updateConference = useUpdateConference(tenantId);
  const deleteConference = useDeleteConference(tenantId);
  const trackEvent = useTrackEvent(tenantId);
  const [search, setSearch] = useSessionListState<string>(
    meQuery.data?.id,
    tenantId,
    `${preferenceKey}:search`,
    "",
  );

  const [type, setType] = useSessionListState<TypeFilter>(
    meQuery.data?.id,
    tenantId,
    `${preferenceKey}:type`,
    "All",
  );

  const [eventFilter, setEventFilter] = useSessionListState<EventFilter>(
    meQuery.data?.id,
    tenantId,
    `${preferenceKey}:event-type`,
    "All",
  );

  const [deadline, setDeadline] = useSessionListState<DeadlineFilter>(
    meQuery.data?.id,
    tenantId,
    `${preferenceKey}:deadline`,
    "All",
  );
  useEffect(() => {
    setPage(1);
  }, [meQuery.data?.id, tenantId, preferenceKey, search, type, eventFilter, deadline]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingConference, setEditingConference] =
    useState<ApiConference | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const availableColumns = dashboardView
    ? CONFERENCE_COLUMNS.filter((column) => column.id !== "actions")
    : CONFERENCE_COLUMNS;
  const columns = useColumnVisibility(
    availableColumns.map((column) => column.id),
    "conferences",
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return conferences
      .flatMap(deadlineRows)
      .filter((row) => {
        const conference = row.conference;
        if (!showPast && row.daysRemaining !== null && row.daysRemaining < 0)
          return false;
        if (type !== "All" && row.submissionType !== type) return false;
        if (!matchesEventFilter(conference.eventType, eventFilter)) return false;
        if (!matchesDeadline(row.daysRemaining, deadline)) return false;
        return (
          !query ||
          conference.name.toLowerCase().includes(query) ||
          conference.acronym?.toLowerCase().includes(query) ||
          conference.location?.toLowerCase().includes(query) ||
          row.submission?.name.toLowerCase().includes(query) ||
          conference.projects.some((project) =>
            project.title.toLowerCase().includes(query),
          ) ||
          (conference.papers ?? []).some((paper) =>
            paperDisplayTitle(paper).toLowerCase().includes(query),
          )
        );
      })
      .sort((a, b) => {
        if (a.due === null && b.due !== null) return 1;
        if (a.due !== null && b.due === null) return -1;
        return (a.due ?? "").localeCompare(b.due ?? "");
      });
  }, [conferences, deadline, eventFilter, search, showPast, type]);

  const hasActiveFilters =
    search !== "" || type !== "All" || eventFilter !== "All" || deadline !== "All";

  async function create(input: ConferenceSubmissionInput) {
    await createConference.mutateAsync(input);
    trackEvent({ name: "conference_created" });
  }

  async function update(input: ConferenceSubmissionInput) {
    if (!editingConference) return;
    await updateConference.mutateAsync({
      conferenceId: editingConference.id,
      input,
    });
    setEditingConference(null);
  }

  async function remove(conference: ApiConference) {
    if (
      !window.confirm(
        `Delete "${conference.name}"? This action cannot be undone.`,
      )
    )
      return;
    setActionError(null);
    try {
      await deleteConference.mutateAsync(conference.id);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "The conference could not be deleted.",
      );
    }
  }

  const isLoading =
    workspace.isPending || conferencesQuery.isPending || meQuery.isPending;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-4 border-b border-primary/10 bg-gradient-to-r from-accent/60 via-card/80 to-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Presentation className="h-4 w-4 text-cyan-600" />
              {showPast
                ? "Submission Deadlines"
                : "Upcoming Submission Deadlines"}
            </CardTitle>
            <CardDescription>
              Deadlines for conferences, workshops, seminars, special issue
              calls and more, including each submission&apos;s own deadline.
            </CardDescription>
          </div>
          {dashboardView || hideCreateButton ? null : (
            <Button onClick={() => setIsCreateOpen(true)} disabled={isLoading}>
              <Plus /> New Conference
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search conference, project, or location…"
            className="sm:max-w-xs"
          />
          <Select
            value={eventFilter}
            onValueChange={(value) => setEventFilter(value as EventFilter)}
          >
            <SelectTrigger className="sm:w-48" aria-label="Filter by event type">
              <SelectValue placeholder="Event" />
            </SelectTrigger>
            <SelectContent>
              {EVENT_FILTERS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option === "All" ? "All events" : option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={type}
            onValueChange={(value) => setType(value as TypeFilter)}
          >
            <SelectTrigger className="sm:w-40">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              {TYPE_FILTERS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option === "All" ? "All types" : option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={deadline}
            onValueChange={(value) => setDeadline(value as DeadlineFilter)}
          >
            <SelectTrigger className="sm:w-40">
              <SelectValue placeholder="Deadline" />
            </SelectTrigger>
            <SelectContent>
              {DEADLINE_FILTERS.filter(
                (option) => showPast || option !== "Past",
              ).map((option) => (
                <SelectItem key={option} value={option}>
                  {option === "All" ? "All deadlines" : option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ColumnVisibilityMenu
            columns={availableColumns}
            visibleColumns={columns.visibleColumns}
            onToggle={columns.toggleColumn}
          />
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setType("All");
                setEventFilter("All");
                setDeadline("All");
              }}
              className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Clear filters
            </button>
          ) : null}
        </div>
        {actionError ? (
          <p role="alert" className="text-sm text-destructive">
            {actionError}
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="pt-[var(--card-padding)]">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.isColumnVisible("conference") ? (
                <TableHead>Event</TableHead>
              ) : null}
              {columns.isColumnVisible("submissionDue") ? (
                <TableHead>Submission Due</TableHead>
              ) : null}
              {columns.isColumnVisible("conferenceDates") ? (
                <TableHead>Event Dates</TableHead>
              ) : null}
              {columns.isColumnVisible("type") ? (
                <TableHead>Type</TableHead>
              ) : null}
              {columns.isColumnVisible("intent") ? (
                <TableHead>Intent</TableHead>
              ) : null}
              {columns.isColumnVisible("linkedProjects") ? (
                <TableHead>Linked Projects or Papers</TableHead>
              ) : null}
              {columns.isColumnVisible("actions") ? (
                <TableHead className="text-right">Actions</TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.visibleColumns.size}
                  className="h-24 text-center text-muted-foreground"
                >
                  Loading deadlines…
                </TableCell>
              </TableRow>
            ) : conferencesQuery.isError ? (
              <TableRow>
                <TableCell
                  colSpan={columns.visibleColumns.size}
                  className="h-24 text-center text-destructive"
                >
                  {conferencesQuery.error.message}
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.visibleColumns.size}
                  className="h-24 text-center text-muted-foreground"
                >
                  No deadlines match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((deadlineRow) => {
                const row = deadlineRow.conference;
                const submission = deadlineRow.submission;
                const canManage = row.ownerUserId === meQuery.data?.id;
                const eventType = row.eventType ?? "Conference";
                const href = submission ? submissionHref(submission) : null;
                return (
                  <TableRow key={deadlineRow.key}>
                    {columns.isColumnVisible("conference") ? (
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {row.acronym ? (
                            <span className="flex h-9 min-w-9 items-center justify-center rounded-md bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                              {row.acronym}
                            </span>
                          ) : null}
                          <div className="flex flex-col">
                            <Link
                              to={`/conferences/${row.id}`}
                              className="font-semibold hover:text-primary hover:underline"
                            >
                              {row.name}
                            </Link>
                            {submission ? (
                              <span className="text-xs font-medium text-foreground">
                                <span aria-hidden="true">↳ </span>
                                <span className="sr-only">Submission: </span>
                                {submission.name}
                              </span>
                            ) : null}
                            <span className="text-xs text-muted-foreground">
                              {[
                                eventType === "Conference" ? null : eventType,
                                row.location,
                              ]
                                .filter(Boolean)
                                .join(" · ") || "—"}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                    ) : null}
                    {columns.isColumnVisible("submissionDue") ? (
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {formatDate(deadlineRow.due)}
                          </span>
                          <span
                            className={cn(
                              "text-xs",
                              urgencyClass(deadlineRow.daysRemaining),
                            )}
                          >
                            {urgencyLabel(deadlineRow.daysRemaining)}
                          </span>
                        </div>
                      </TableCell>
                    ) : null}
                    {columns.isColumnVisible("conferenceDates") ? (
                      <TableCell className="text-muted-foreground">
                        {formatConferenceDates(row.startDate, row.endDate)}
                      </TableCell>
                    ) : null}
                    {columns.isColumnVisible("type") ? (
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={typeBadgeClass(deadlineRow.submissionType)}
                        >
                          {deadlineRow.submissionType ?? "—"}
                        </Badge>
                      </TableCell>
                    ) : null}
                    {columns.isColumnVisible("intent") ? (
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {row.intents.length > 0 ? (
                            row.intents.map((intent) => (
                              <Badge key={intent} variant="secondary">
                                {intent}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </div>
                      </TableCell>
                    ) : null}
                    {columns.isColumnVisible("linkedProjects") ? (
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {submission ? (
                            href ? (
                              <Link
                                to={href}
                                className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary ring-1 ring-inset ring-primary/15 hover:bg-primary/15 hover:underline"
                              >
                                {submission.displayId ?? submission.name}
                              </Link>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            )
                          ) : row.projects.length === 0 &&
                          (row.papers ?? []).length === 0 ? (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          ) : (
                            <>
                              {row.projects.map((project) => (
                                <Link
                                  key={`project:${project.id}`}
                                  to={`/projects/${project.id}`}
                                  className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary ring-1 ring-inset ring-primary/15 hover:bg-primary/15 hover:underline"
                                >
                                  {project.displayId ?? project.title}
                                </Link>
                              ))}
                              {(row.papers ?? []).map((paper) => (
                                <Link
                                  key={`paper:${paper.id}`}
                                  to={`/modules/${paper.id}`}
                                  className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary ring-1 ring-inset ring-primary/15 hover:bg-primary/15 hover:underline"
                                >
                                  {paper.displayId ?? paperDisplayTitle(paper)}
                                </Link>
                              ))}
                            </>
                          )}
                        </div>
                      </TableCell>
                    ) : null}
                    {columns.isColumnVisible("actions") ? (
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {submission ? null : canManage ? (
                            <>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={`Edit ${row.name}`}
                                onClick={() => setEditingConference(row)}
                              >
                                <Pencil />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                aria-label={`Delete ${row.name}`}
                                onClick={() => void remove(row)}
                              >
                                <Trash2 />
                              </Button>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              View only
                            </span>
                          )}
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        {!dashboardView && paginationMeta ? (
          <div className="mt-4">
            <PaginationControls
              page={paginationMeta.page}
              pageSize={paginationMeta.pageSize}
              totalItems={paginationMeta.totalItems}
              totalPages={paginationMeta.totalPages}
              isPending={conferencesQuery.isFetching}
              onPageChange={setPage}
            />
          </div>
        ) : null}
      </CardContent>
      <ConferenceSubmissionDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        tenantId={tenantId}
        onSave={create}
      />
      <ConferenceSubmissionDialog
        open={editingConference !== null}
        onOpenChange={(open) => {
          if (!open) setEditingConference(null);
        }}
        tenantId={tenantId}
        conference={editingConference}
        onSave={update}
      />
    </Card>
  );
}
