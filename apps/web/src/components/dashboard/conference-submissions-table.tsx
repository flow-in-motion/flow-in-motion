import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Presentation, Trash2 } from "lucide-react";
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
import { ConferenceSubmissionDialog, type ConferenceSubmissionInput } from "@/components/dashboard/conference-submission-dialog";
import { ColumnVisibilityMenu } from "@/components/dashboard/column-visibility-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import {
  CONFERENCE_DEADLINE_FILTERS as DEADLINE_FILTERS,
  CONFERENCE_TYPE_FILTERS as TYPE_FILTERS,
  conferenceTypeBadgeClass as typeBadgeClass,
  conferenceUrgencyClass as urgencyClass,
  conferenceUrgencyLabel as urgencyLabel,
  formatConferenceDate as formatDate,
  formatConferenceDateRange as formatConferenceDates,
  matchesConferenceDeadline as matchesDeadline,
  type ConferenceDeadlineFilter as DeadlineFilter,
  type ConferenceTypeFilter as TypeFilter,
} from "@/lib/conference-format";
import { cn } from "@/lib/utils";
import { PaginationControls } from "@/components/shared/pagination-controls";

const CONFERENCE_COLUMNS = [
  { id: "conference", label: "Conference" },
  { id: "submissionDue", label: "Submission Due" },
  { id: "conferenceDates", label: "Conference Dates" },
  { id: "type", label: "Type" },
  { id: "linkedProjects", label: "Linked Projects or Papers" },
  { id: "actions", label: "Actions" },
] as const;

export function ConferenceSubmissionsTable({
  showPast = false,
  dashboardView = false,
  hideCreateButton = false,
}: {
  showPast?: boolean;
  dashboardView?: boolean;
  hideCreateButton?: boolean;
}) {
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
  const [type, setType] = useState<TypeFilter>("All");
  const [deadline, setDeadline] = useState<DeadlineFilter>("All");
  useEffect(() => {
    setPage(1);
  }, [
    tenantId,
    search,
    type,
    deadline,
    showPast,
  ]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingConference, setEditingConference] = useState<ApiConference | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const availableColumns = dashboardView
    ? CONFERENCE_COLUMNS.filter((column) => column.id !== "actions")
    : CONFERENCE_COLUMNS;
  const columns = useColumnVisibility(
    availableColumns.map((column) => column.id),
    "conferences",
  );

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

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...(conferences)]
      .filter((row) => {
        if (!showPast && row.daysRemaining < 0) return false;
        if (type !== "All" && row.submissionType !== type) return false;
        if (!matchesDeadline(row.daysRemaining, deadline)) return false;
        return !query || row.name.toLowerCase().includes(query) ||
          row.acronym.toLowerCase().includes(query) || row.location.toLowerCase().includes(query) ||
          row.projects.some((project) => project.title.toLowerCase().includes(query));
      })
      .sort((a, b) => a.submissionDue.localeCompare(b.submissionDue));
  }, [conferences, deadline, search, showPast, type]);

  const hasActiveFilters = search !== "" || type !== "All" || deadline !== "All";

  async function create(input: ConferenceSubmissionInput) {
    await createConference.mutateAsync(input);
    trackEvent({ name: "conference_created" });
  }

  async function update(input: ConferenceSubmissionInput) {
    if (!editingConference) return;
    await updateConference.mutateAsync({ conferenceId: editingConference.id, input });
    setEditingConference(null);
  }

  async function remove(conference: ApiConference) {
    if (!window.confirm(`Delete "${conference.name}"? This action cannot be undone.`)) return;
    setActionError(null);
    try {
      await deleteConference.mutateAsync(conference.id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The conference could not be deleted.");
    }
  }

  const isLoading = workspace.isPending || conferencesQuery.isPending || projectsQuery.isPending || meQuery.isPending;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-4 border-b border-primary/10 bg-gradient-to-r from-accent/60 via-card/80 to-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Presentation className="h-4 w-4 text-cyan-600" />
              {showPast ? "Conference Submissions" : "Upcoming Conference Submissions"}
            </CardTitle>
            <CardDescription>Submission deadlines, event dates, and linked projects or papers.</CardDescription>
          </div>
          {dashboardView || hideCreateButton ? null : (
            <Button onClick={() => setIsCreateOpen(true)} disabled={ownedProjects.length === 0 || isLoading}>
              <Plus /> New Conference
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Input value={search} onChange={(event) => setSearch(event.target.value)}
            placeholder="Search conference, project, or location…" className="sm:max-w-xs" />
          <Select value={type} onValueChange={(value) => setType(value as TypeFilter)}>
            <SelectTrigger className="sm:w-40"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>{TYPE_FILTERS.map((option) => <SelectItem key={option} value={option}>{option === "All" ? "All types" : option}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={deadline} onValueChange={(value) => setDeadline(value as DeadlineFilter)}>
            <SelectTrigger className="sm:w-40"><SelectValue placeholder="Deadline" /></SelectTrigger>
            <SelectContent>{DEADLINE_FILTERS.filter((option) => showPast || option !== "Past").map((option) => <SelectItem key={option} value={option}>{option === "All" ? "All deadlines" : option}</SelectItem>)}</SelectContent>
          </Select>
          <ColumnVisibilityMenu columns={availableColumns} visibleColumns={columns.visibleColumns} onToggle={columns.toggleColumn} />
          {hasActiveFilters ? <button type="button" onClick={() => { setSearch(""); setType("All"); setDeadline("All"); }}
            className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Clear filters</button> : null}
        </div>
        {!dashboardView && !hideCreateButton && ownedProjects.length === 0 && !isLoading ? <p className="text-sm text-muted-foreground">Create or own a project before adding a conference.</p> : null}
        {actionError ? <p role="alert" className="text-sm text-destructive">{actionError}</p> : null}
      </CardHeader>
      <CardContent className="pt-[var(--card-padding)]">
        <Table>
          <TableHeader><TableRow>
            {columns.isColumnVisible("conference") ? <TableHead>Conference</TableHead> : null}
            {columns.isColumnVisible("submissionDue") ? <TableHead>Submission Due</TableHead> : null}
            {columns.isColumnVisible("conferenceDates") ? <TableHead>Conference Dates</TableHead> : null}
            {columns.isColumnVisible("type") ? <TableHead>Type</TableHead> : null}
            {columns.isColumnVisible("linkedProjects") ? <TableHead>Linked Projects or Papers</TableHead> : null}
            {columns.isColumnVisible("actions") ? <TableHead className="text-right">Actions</TableHead> : null}
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={columns.visibleColumns.size} className="h-24 text-center text-muted-foreground">Loading conferences…</TableCell></TableRow>
              : conferencesQuery.isError ? <TableRow><TableCell colSpan={columns.visibleColumns.size} className="h-24 text-center text-destructive">{conferencesQuery.error.message}</TableCell></TableRow>
              : filtered.length === 0 ? <TableRow><TableCell colSpan={columns.visibleColumns.size} className="h-24 text-center text-muted-foreground">No conferences match the current filters.</TableCell></TableRow>
              : filtered.map((row) => {
                const canManage = row.ownerUserId === meQuery.data?.id;
                return <TableRow key={row.id}>
                  {columns.isColumnVisible("conference") ? <TableCell><div className="flex items-center gap-3">
                    <span className="flex h-9 min-w-9 items-center justify-center rounded-md bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">{row.acronym}</span>
                    <div className="flex flex-col"><Link to={`/conferences/${row.id}`} className="font-semibold hover:text-primary hover:underline">{row.name}</Link><span className="text-xs text-muted-foreground">{row.location}</span></div>
                  </div></TableCell> : null}
                  {columns.isColumnVisible("submissionDue") ? <TableCell><div className="flex flex-col"><span className="font-medium">{formatDate(row.submissionDue)}</span>
                    <span className={cn("text-xs", urgencyClass(row.daysRemaining))}>{urgencyLabel(row.daysRemaining)}</span></div></TableCell> : null}
                  {columns.isColumnVisible("conferenceDates") ? <TableCell className="text-muted-foreground">{formatConferenceDates(row.startDate, row.endDate)}</TableCell> : null}
                  {columns.isColumnVisible("type") ? <TableCell><Badge variant="outline" className={typeBadgeClass(row.submissionType)}>{row.submissionType ?? "—"}</Badge></TableCell> : null}
                  {columns.isColumnVisible("linkedProjects") ? <TableCell><div className="flex flex-wrap gap-1">{row.projects.length === 0 ? <span className="text-xs text-muted-foreground">—</span> : row.projects.map((project) => <Link key={project.id}
                    to={`/projects/${project.id}`}
                    className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary ring-1 ring-inset ring-primary/15 hover:bg-primary/15 hover:underline">{project.displayId ?? project.title}</Link>)}</div></TableCell> : null}
                  {columns.isColumnVisible("actions") ? <TableCell><div className="flex justify-end gap-1">
                    {canManage ? <><Button type="button" variant="ghost" size="icon" aria-label={`Edit ${row.name}`} onClick={() => setEditingConference(row)}><Pencil /></Button>
                      <Button type="button" variant="ghost" size="icon" className="text-destructive hover:text-destructive" aria-label={`Delete ${row.name}`} onClick={() => void remove(row)}><Trash2 /></Button></>
                      : <span className="text-xs text-muted-foreground">View only</span>}
                  </div></TableCell> : null}
                </TableRow>;
              })}
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
      <ConferenceSubmissionDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} projects={ownedProjects} modules={ownedModules} onSave={create} />
      <ConferenceSubmissionDialog open={editingConference !== null} onOpenChange={(open) => { if (!open) setEditingConference(null); }}
        projects={ownedProjects} modules={ownedModules} conference={editingConference} onSave={update} />
    </Card>
  );
}
