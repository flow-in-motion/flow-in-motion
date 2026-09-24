import { useListSearch } from "@/hooks/use-list-search";
import { useEffect, useMemo, useState } from "react";
import { NotebookPen, Pencil, Trash2, UserPlus } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import {
  useCreateNote,
  useCurrentWorkspace,
  useDeleteNote,
  useMe,
  useMembers,
  useModules,
  useNotes,
  useProjects,
  useTrackEvent,
  type ApiNote,
} from "@/api/hooks";
import { ColumnVisibilityMenu } from "@/components/dashboard/column-visibility-menu";
import { NoteDialog, type NoteFormInput } from "@/components/notes/note-dialog";
import { NoteMembersManager } from "@/components/notes/note-members";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeading } from "@/components/typography/heading";
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
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { formatListDate, isOverdue } from "@/lib/list-format";
import { paperDisplayTitle } from "@/lib/paper-title";
import { cn } from "@/lib/utils";
import { PaginationControls } from "@/components/shared/pagination-controls";

const VISIBILITY_FILTERS = ["All", "Private", "Shared"] as const;
type VisibilityFilter = (typeof VISIBILITY_FILTERS)[number];

type SortColumn = "note" | "content" | "linkedTo" | "visibility" | "followUp" | "created";
type SortDirection = "asc" | "desc";

const NOTE_COLUMNS = [
  { id: "note", label: "Note", width: "minmax(220px,1.5fr)" },
  { id: "content", label: "Content", width: "minmax(260px,2fr)" },
  { id: "linkedTo", label: "Linked to", width: "170px" },
  { id: "visibility", label: "Visibility", width: "110px" },
  { id: "followUp", label: "Follow-up", width: "120px" },
  { id: "created", label: "Created", width: "150px" },
] as const;

function noteTitle(note: ApiNote) {
  return note.title || "Untitled note";
}

function notePreview(content: string | null) {
  const words = content?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (words.length === 0) return "—";
  return words.slice(0, 10).join(" ") + (words.length > 10 ? "…" : "");
}

function visibilityPillClass(visibility: string | null) {
  return visibility === "Shared"
    ? "border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400"
    : "border-border text-muted-foreground";
}

export default function DailyNotesPage() {
  const workspace = useCurrentWorkspace();
  const tenantId = workspace.data?.id ?? "";
  const [searchParams, setSearchParams] = useSearchParams();

  const { page, setPage, search, setSearch, requestSearch } = useListSearch();
  const [pageSize, setPageSize] = useState<number | "all">(20);

  const notesQuery = useNotes(tenantId, undefined, page, true, { pageSize, search: requestSearch });
  const notes = notesQuery.data?.data ?? [];
  const paginationMeta = notesQuery.data?.meta;
  const projectsQuery = useProjects(tenantId);
  const projects = projectsQuery.data?.data ?? [];
  const modulesQuery = useModules(tenantId);
  const modules = modulesQuery.data?.data ?? [];

  const [isNewNoteOpen, setIsNewNoteOpen] = useState(false);
  const [newNoteInitialProjectId, setNewNoteInitialProjectId] = useState<string | undefined>();
  const [newNoteInitialModuleId, setNewNoteInitialModuleId] = useState<string | undefined>();
  const [sharingNote, setSharingNote] = useState<ApiNote | null>(null);
  const me = useMe();
  const membersQuery = useMembers(tenantId, 1, sharingNote !== null);
  const members = membersQuery.data?.data ?? [];

  const createNote = useCreateNote(tenantId);
  const deleteNote = useDeleteNote(tenantId);
  const trackEvent = useTrackEvent(tenantId);

  const [visibility, setVisibility] = useState<VisibilityFilter>("All");
  const [sortColumn, setSortColumn] = useState<SortColumn>("created");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  useEffect(() => {
    setPage(1);
  }, [setPage, tenantId, visibility, sortColumn, sortDirection]);

  useEffect(() => {
    if (searchParams.get("new") !== "true") return;
    const linkedProjectId = searchParams.get("projectId") ?? "";
    const linkedModuleId = searchParams.get("moduleId") ?? "";
    setNewNoteInitialModuleId(linkedModuleId || undefined);
    setNewNoteInitialProjectId(linkedModuleId ? undefined : linkedProjectId || undefined);
    setIsNewNoteOpen(true);
    setSearchParams(
      (params) => {
        params.delete("new");
        params.delete("projectId");
        params.delete("moduleId");
        return params;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams]);

  const columns = useColumnVisibility(NOTE_COLUMNS.map((column) => column.id), "daily-notes");
  const gridTemplate = NOTE_COLUMNS.filter((column) =>
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

  function linkTargetLabel(note: ApiNote) {
    if (note.moduleId) return moduleById.get(note.moduleId) ?? "Unknown paper";
    if (note.projectId) return projectById.get(note.projectId) ?? "Unknown project";
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

  function compareNotes(a: ApiNote, b: ApiNote, column: SortColumn) {
    switch (column) {
      case "note":
        return (a.title ?? "").localeCompare(b.title ?? "");
      case "content":
        return (a.content ?? "").localeCompare(b.content ?? "");
      case "linkedTo":
        return linkTargetLabel(a).localeCompare(linkTargetLabel(b));
      case "visibility":
        return (a.visibility ?? "").localeCompare(b.visibility ?? "");
      case "followUp":
        return (a.followUpDate ?? "").localeCompare(b.followUpDate ?? "");
      case "created":
        return (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
    }
  }

  const visibleNotes = useMemo(() => {
    const filtered = notes.filter((note) => {
      if (visibility !== "All" && (note.visibility ?? "Private") !== visibility) return false;
      return true;
    });
    return [...filtered].sort(
      (a, b) => compareNotes(a, b, sortColumn) * (sortDirection === "asc" ? 1 : -1),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, search, visibility, sortColumn, sortDirection, projectById, moduleById]);

  const hasActiveFilters = search !== "" || visibility !== "All";

  function clearFilters() {
    setSearch("");
    setVisibility("All");
  }

  function startAdding() {
    setNewNoteInitialProjectId(undefined);
    setNewNoteInitialModuleId(undefined);
    setIsNewNoteOpen(true);
  }

  async function handleCreateNote(input: NoteFormInput) {
    await createNote.mutateAsync({
      title: input.title || "Untitled note",
      content: input.content || undefined,
      projectId: input.linkTarget === "project" ? input.projectId : undefined,
      moduleId: input.linkTarget === "module" ? input.moduleId : undefined,
      visibility: input.visibility,
      followUpDate: input.followUpDate || undefined,
    });
    trackEvent({ name: "note_created" });
  }

  async function handleDeleteNote(note: ApiNote) {
    if (!window.confirm(`Delete "${noteTitle(note)}"? This cannot be undone.`)) return;
    await deleteNote.mutateAsync(note.id);
  }

  if (workspace.isPending || notesQuery.isPending) {
    return <LoadingState title="Loading notes" className="min-h-[50vh]" />;
  }
  if (notesQuery.isError) {
    return (
      <ErrorState
        title="Notes could not be loaded"
        description={notesQuery.error.message}
        onRetry={() => pageSize === "all" ? setPageSize(20) : void notesQuery.refetch()}
      />
    );
  }

  return (
    <div className="page-stack">
      <PageHeading
        icon={NotebookPen}
        tone="violet"
        eyebrow="Research journal"
        title="Notes"
        description="Capture research updates, decisions and observations, then connect them to projects or papers."
        actions={<Button onClick={startAdding}>New Note</Button>}
      />

      <NoteDialog
        open={isNewNoteOpen}
        onOpenChange={setIsNewNoteOpen}
        projects={projects}
        modules={modules}
        initialProjectId={newNoteInitialProjectId}
        initialModuleId={newNoteInitialModuleId}
        onSave={handleCreateNote}
      />
      <Dialog
        open={sharingNote !== null}
        onOpenChange={(open) => {
          if (!open) setSharingNote(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Note collaborators</DialogTitle>
            <DialogDescription>
              Invite collaborators to {sharingNote ? noteTitle(sharingNote) : "this note"} by email and manage pending access.
            </DialogDescription>
          </DialogHeader>
          {sharingNote ? (
            <NoteMembersManager
              tenantId={tenantId}
              noteId={sharingNote.id}
              noteTitle={noteTitle(sharingNote)}
              ownerUserId={sharingNote.createdBy}
              members={members}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <div className="surface-toolbar flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search notes…"
          className="sm:max-w-xs"
        />
        <Select value={visibility} onValueChange={(value) => setVisibility(value as VisibilityFilter)}>
          <SelectTrigger className="sm:w-40">
            <SelectValue placeholder="Visibility" />
          </SelectTrigger>
          <SelectContent>
            {VISIBILITY_FILTERS.map((option) => (
              <SelectItem key={option} value={option}>
                {option === "All" ? "All visibilities" : option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ColumnVisibilityMenu
          columns={NOTE_COLUMNS}
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
        <div className="min-w-[1050px]">
          <div
            className="mb-1 grid gap-4 rounded-md bg-muted/65 px-4 py-3 text-[0.6875rem] font-semibold uppercase tracking-[0.07em] text-muted-foreground"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            {NOTE_COLUMNS.filter((column) =>
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
            {visibleNotes.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                No notes match the current filters.
              </div>
            ) : (
              visibleNotes.map((note) => (
                <div
                  key={note.id}
                  className="grid items-center gap-4 rounded-md border border-transparent bg-card px-4 py-3.5 transition-colors hover:bg-muted/45"
                  style={{ gridTemplateColumns: gridTemplate }}
                >
                  {columns.isColumnVisible("note") ? (
                    <div className="flex flex-col gap-0.5">
                      {note.displayId ? (
                        <span className="font-mono text-[11px] text-muted-foreground">{note.displayId}</span>
                      ) : null}
                      <div className="flex items-start gap-2">
                        <Link
                          to={`/daily-notes/${note.id}`}
                          className="font-semibold leading-tight text-foreground transition-colors hover:text-primary hover:underline"
                        >
                          {noteTitle(note)}
                        </Link>
                        {note.visibility === "Shared" && note.createdBy === me.data?.id ? (
                          <button
                            type="button"
                            onClick={() => setSharingNote(note)}
                            aria-label={`Manage collaborators for ${noteTitle(note)}`}
                            title="Manage collaborators"
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                        <Link
                          to={`/daily-notes/${note.id}?edit=true`}
                          aria-label={`Edit ${noteTitle(note)}`}
                          title="Edit note"
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => void handleDeleteNote(note)}
                          aria-label={`Delete ${noteTitle(note)}`}
                          title="Delete note"
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-destructive transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {columns.isColumnVisible("content") ? (
                    <span className="min-w-0 truncate text-sm leading-5 text-muted-foreground">
                      {notePreview(note.content)}
                    </span>
                  ) : null}
                  {columns.isColumnVisible("linkedTo") ? (
                    note.projectId || note.moduleId ? (
                      <Link
                        to={note.moduleId ? `/modules/${note.moduleId}` : `/projects/${note.projectId}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {linkTargetLabel(note)}
                      </Link>
                    ) : (
                      <span className="text-sm text-muted-foreground">General</span>
                    )
                  ) : null}
                  {columns.isColumnVisible("visibility") ? (
                    <Badge variant="outline" className={visibilityPillClass(note.visibility)}>
                      {note.visibility ?? "Private"}
                    </Badge>
                  ) : null}
                  {columns.isColumnVisible("followUp") ? (
                    <span
                      className={cn(
                        "text-sm tabular-nums",
                        isOverdue(note.followUpDate, false)
                          ? "font-semibold text-destructive"
                          : "text-muted-foreground",
                      )}
                    >
                      {formatListDate(note.followUpDate)}
                    </span>
                  ) : null}
                  {columns.isColumnVisible("created") ? (
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {formatListDate(note.createdAt)}
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
              selectedPageSize={pageSize}
              totalItems={paginationMeta.totalItems}
              totalPages={paginationMeta.totalPages}
              isPending={notesQuery.isFetching}
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
