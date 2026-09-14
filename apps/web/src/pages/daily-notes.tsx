import { useEffect, useMemo, useState } from "react";
import { CalendarClock, NotebookPen, Pencil, Plus, Save, Search, Trash2, Unlink, X } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { apiClient } from "@/api/client";
import {
  useCreateNote,
  useCurrentWorkspace,
  useDeleteNote,
  useModules,
  useNotes,
  useProjects,
  useUpdateNote,
  useUserSearch,
  useTrackEvent,
  type ApiNote,
  type ApiUserSearchResult,
} from "@/api/hooks";
import { NoteMembersManager } from "@/components/notes/note-members";
import { BackButton } from "@/components/shared/back-button";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Badge } from "@/components/ui/badge";
import { Heading, PageHeading } from "@/components/typography/heading";
import { Button } from "@/components/ui/button";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { resolveLinkTargetType, type LinkTargetType } from "@/lib/link-target";
import { paperDisplayTitle } from "@/lib/paper-title";
import { cn } from "@/lib/utils";
import { PaginationControls } from "@/components/shared/pagination-controls";

const ALL_NOTES = "All notes";
const LINK_TARGET_OPTIONS: { value: LinkTargetType; label: string }[] = [
  { value: "project", label: "Project" },
  { value: "module", label: "Paper" },
  { value: "none", label: "General" },
];
const VISIBILITY_OPTIONS = ["Private", "Shared"] as const;
const SORT_ORDER_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "az", label: "Title (A–Z)" },
  { value: "za", label: "Title (Z–A)" },
] as const;
type SortOrder = (typeof SORT_ORDER_OPTIONS)[number]["value"];

interface NoteDraft {
  title: string;
  linkTarget: LinkTargetType;
  projectId: string;
  moduleId: string;
  visibility: string;
  content: string;
  collaboratorUserIds: string[];
  followUpDate: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Plain `date` (no time component) — split by hand so the reader's timezone can't shift it to the adjacent day. */
function formatPlainDate(iso: string) {
  const [year, month, day] = iso.split("-");
  return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

const EMPTY_DRAFT: NoteDraft = {
  title: "",
  linkTarget: "none",
  projectId: "",
  moduleId: "",
  visibility: "Private",
  content: "",
  collaboratorUserIds: [],
  followUpDate: "",
};

function draftFromNote(note: ApiNote): NoteDraft {
  return {
    title: note.title,
    linkTarget: resolveLinkTargetType(note),
    projectId: note.projectId ?? "",
    moduleId: note.moduleId ?? "",
    visibility: note.visibility ?? "Private",
    content: note.content ?? "",
    collaboratorUserIds: [],
    followUpDate: note.followUpDate ?? "",
  };
}

function linkTargetPillClass(selected: boolean) {
  return cn(
    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
    selected
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
  );
}

export default function DailyNotesPage() {
  const { noteId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const workspace = useCurrentWorkspace();
  const tenantId = workspace.data?.id ?? "";

  const [page, setPage] = useState(1);

  const notesQuery = useNotes(tenantId, undefined, page);
  const projectsQuery = useProjects(tenantId);
  const projects = projectsQuery.data?.data ?? [];
  const modulesQuery = useModules(tenantId);
  const modules = modulesQuery.data?.data ?? [];

  const createNote = useCreateNote(tenantId);
  const updateNote = useUpdateNote(tenantId);
  const deleteNote = useDeleteNote(tenantId);
  const trackEvent = useTrackEvent(tenantId);

  const [selectedId, setSelectedId] = useState<string | null>(noteId ?? null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [linkFilter, setLinkFilter] = useState(ALL_NOTES);
  useEffect(() => {
    setPage(1);
  }, [tenantId, sortOrder, linkFilter]);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<NoteDraft>(EMPTY_DRAFT);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberPickerOpen, setMemberPickerOpen] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<ApiUserSearchResult[]>([]);
  const userSearchQuery = useUserSearch(memberSearch, memberPickerOpen);

  const notes = notesQuery.data?.data ?? [];
  const paginationMeta = notesQuery.data?.meta;

  useEffect(() => {
    if (!selectedId && notes.length > 0) {
      setSelectedId(notes[0].id);
    }
  }, [notes, selectedId]);

  useEffect(() => {
    if (noteId && notes.some((note) => note.id === noteId)) {
      setSelectedId(noteId);
      setEditingId(null);
    }
  }, [noteId, notes]);

  useEffect(() => {
    if (searchParams.get("new") !== "true") return;
    const linkedProjectId = searchParams.get("projectId") ?? "";
    const linkedModuleId = searchParams.get("moduleId") ?? "";
    setEditingId("new");
    setDraft({
      ...EMPTY_DRAFT,
      linkTarget: linkedModuleId ? "module" : linkedProjectId ? "project" : "none",
      projectId: linkedModuleId ? "" : linkedProjectId,
      moduleId: linkedModuleId,
    });
    setMemberSearch("");
    setMemberPickerOpen(false);
    setSelectedMembers([]);
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

  const filterOptions = useMemo(
    () => Array.from(new Set(notes.map((note) => linkTargetLabel(note)))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [notes, projectById, moduleById],
  );

  const visibleNotes = useMemo(() => {
    const filtered = notes.filter(
      (note) => linkFilter === ALL_NOTES || linkTargetLabel(note) === linkFilter,
    );
    if (sortOrder === "az" || sortOrder === "za") {
      const sorted = [...filtered].sort((a, b) => a.title.localeCompare(b.title));
      return sortOrder === "za" ? sorted.reverse() : sorted;
    }
    
    const sorted = [...filtered].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    return sortOrder === "newest" ? sorted.reverse() : sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, linkFilter, sortOrder, projectById, moduleById]);

  const selectedNote = visibleNotes.find((note) => note.id === selectedId) ?? visibleNotes[0];
  const isEditing = editingId !== null;
  const sameTenant = Boolean(selectedNote && tenantId && selectedNote.tenantId === tenantId);

  const matchingMembers = useMemo(() => {
    const selectedIds = new Set(selectedMembers.map((member) => member.id));
    return (userSearchQuery.data ?? []).filter((member) => !selectedIds.has(member.id));
  }, [userSearchQuery.data, selectedMembers]);

  function resolveLink(input: { linkTarget: LinkTargetType; projectId: string; moduleId: string }) {
    if (input.linkTarget === "project") {
      if (!input.projectId) return null;
      return { projectId: input.projectId, moduleId: undefined as string | undefined };
    }
    if (input.linkTarget === "module") {
      if (!input.moduleId) return null;
      return { projectId: undefined as string | undefined, moduleId: input.moduleId };
    }
    return { projectId: undefined as string | undefined, moduleId: undefined as string | undefined };
  }

  function selectNote(id: string) {
    setSelectedId(id);
    setEditingId(null);
    navigate(`/daily-notes/${id}`, { replace: true });
  }

  function startAdding() {
    setEditingId("new");
    setDraft(EMPTY_DRAFT);
    setMemberSearch("");
    setMemberPickerOpen(false);
    setSelectedMembers([]);
  }

  function startEditing() {
    if (!selectedNote) return;
    setEditingId(selectedNote.id);
    setDraft(draftFromNote(selectedNote));
  }

  function cancelEditing() {
    setEditingId(null);
  }

  async function saveNote() {
    const link = resolveLink(draft);
    if (!link) return;
    const title = draft.title.trim() || "Untitled note";
    const content = draft.content.trim() || undefined;

    if (editingId === "new") {
      const note = await createNote.mutateAsync({
        title,
        content,
        projectId: link.projectId,
        moduleId: link.moduleId,
        visibility: draft.visibility,
        followUpDate: draft.followUpDate || undefined,
      });

      if (draft.visibility === "Shared") {
        await Promise.all(
          selectedMembers.map((member) =>
            apiClient.POST("/api/v1/tenant/{tenantId}/notes/{noteId}/members", {
              params: { path: { tenantId, noteId: note.id } },
              body: { userId: member.id },
            }),
          ),
        );
      }

      trackEvent({ name: "note_created" });
      setLinkFilter(ALL_NOTES);
      setSelectedId(note.id);
      navigate(`/daily-notes/${note.id}`, { replace: true });
    } else if (editingId) {
      await updateNote.mutateAsync({
        noteId: editingId,
        input: {
          title,
          content,
          visibility: draft.visibility,
          projectId: draft.linkTarget === "project" ? link.projectId : null,
          moduleId: draft.linkTarget === "module" ? link.moduleId : null,
          followUpDate: draft.followUpDate || undefined,
        },
      });
    }

    setEditingId(null);
  }

  async function handleUnlinkNote() {
    if (!selectedNote) return;
    if (!window.confirm("Unlink this note from its project or paper? It will become a general note.")) {
      return;
    }
    await updateNote.mutateAsync({
      noteId: selectedNote.id,
      input: { projectId: null, moduleId: null },
    });
  }

  async function deleteSelectedNote() {
    if (!selectedNote) return;
    if (!window.confirm(`Delete "${selectedNote.title}"? This cannot be undone.`)) return;
    await deleteNote.mutateAsync(selectedNote.id);
    setEditingId(null);
    setSelectedId(null);
    navigate("/daily-notes", { replace: true });
  }

  if (workspace.isPending || notesQuery.isPending) {
    return <LoadingState title="Loading notes" className="min-h-[50vh]" />;
  }
  if (notesQuery.isError) {
    return (
      <ErrorState
        title="Notes could not be loaded"
        description={notesQuery.error.message}
        onRetry={() => void notesQuery.refetch()}
      />
    );
  }

  return (
    <div className="page-stack">
      <BackButton fallback="/" label="Back" />

      <PageHeading
        icon={NotebookPen}
        tone="violet"
        eyebrow="Research journal"
        title="Daily Notes"
        description="Capture research updates, decisions and observations, then connect them to projects or papers."
        actions={
          <Button onClick={startAdding}>
            <Plus />
            New note
          </Button>
        }
      />

      <div className="rounded-2xl border border-violet-200/60 bg-gradient-to-br from-violet-50/70 via-muted/25 to-blue-50/40 p-3 shadow-sm sm:p-4 md:p-6 dark:border-violet-900/50 dark:from-violet-950/20 dark:to-blue-950/10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
        <aside className="flex w-full flex-col gap-4 rounded-xl border border-violet-200/60 bg-card/95 p-4 shadow-sm lg:w-80 lg:shrink-0 dark:border-violet-900/50">
          <Heading level="h3">Daily Notes</Heading>

          <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as SortOrder)}>
            <SelectTrigger aria-label="Sort notes by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_ORDER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={linkFilter} onValueChange={setLinkFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_NOTES}>{ALL_NOTES}</SelectItem>
              {filterOptions.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex flex-col gap-1 lg:max-h-[560px] lg:overflow-y-auto">
            {visibleNotes.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                No notes match this filter.
              </p>
            ) : (
              visibleNotes.map((note) => {
                const isSelected = selectedNote?.id === note.id;
                return (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => selectNote(note.id)}
                    className={cn(
                      "flex flex-col gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-all",
                      isSelected ? "border-primary/20 bg-primary/10 shadow-sm" : "border-transparent hover:bg-muted",
                    )}
                  >
                    <span className="text-sm font-semibold leading-snug">{note.title}</span>
                    <span className="text-xs font-medium text-primary">
                      {linkTargetLabel(note)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(note.createdAt)} · {formatTime(note.createdAt)}
                    </span>
                  </button>
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
              isPending={notesQuery.isFetching}
              compact
              onPageChange={setPage}
            />
          ) : null}
        </aside>

        <section className="min-h-[620px] flex-1 rounded-xl border bg-card p-4 shadow-sm sm:p-6">
          <div className="mb-8 flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {editingId === "new" ? "Create note" : "Selected note"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {editingId === "new"
                  ? "Capture a new research update."
                  : "Review or update the selected daily note."}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {isEditing ? (
                <>
                  <Button variant="outline" size="sm" onClick={cancelEditing}>
                    <X />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={() => void saveNote()}>
                    <Save />
                    Save note
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" onClick={startAdding}>
                    <Plus />
                    Add note
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={startEditing}
                    disabled={!selectedNote}
                  >
                    <Pencil />
                    Edit note
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => void deleteSelectedNote()}
                    disabled={!selectedNote}
                  >
                    <Trash2 />
                    Delete note
                  </Button>
                </>
              )}
            </div>
          </div>

          {isEditing ? (
            <div className="flex max-w-4xl flex-col gap-6">
              <div className="grid gap-2">
                <label htmlFor="note-title" className="text-xs font-semibold text-muted-foreground">
                  Note title
                </label>
                <Input
                  id="note-title"
                  value={draft.title}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, title: event.target.value }))
                  }
                  placeholder="Enter a note title"
                  className="h-11 text-lg font-semibold"
                  autoFocus
                />
              </div>

              <div className="grid gap-2">
                <label className="text-xs font-semibold text-muted-foreground">Link to</label>
                <div className="flex flex-wrap gap-2">
                  {LINK_TARGET_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          linkTarget: option.value,
                          projectId: option.value === "project" ? current.projectId : "",
                          moduleId: option.value === "module" ? current.moduleId : "",
                        }))
                      }
                      aria-pressed={draft.linkTarget === option.value}
                      className={linkTargetPillClass(draft.linkTarget === option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {draft.linkTarget === "project" ? (
                <div className="grid gap-2">
                  <label className="text-xs font-semibold text-muted-foreground">Project</label>
                  <Select
                    value={draft.projectId}
                    onValueChange={(projectId) =>
                      setDraft((current) => ({ ...current, projectId }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                ) : null}

                {draft.linkTarget === "module" ? (
                <div className="grid gap-2">
                  <label className="text-xs font-semibold text-muted-foreground">Paper</label>
                  <Select
                    value={draft.moduleId}
                    onValueChange={(moduleId) =>
                      setDraft((current) => ({ ...current, moduleId }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a paper" />
                    </SelectTrigger>
                    <SelectContent>
                      {(modules).map((module) => (
                        <SelectItem key={module.id} value={module.id}>
                          {paperDisplayTitle(module)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                ) : null}

                <div className="grid gap-2">
                  <label className="text-xs font-semibold text-muted-foreground">Visibility</label>
                  <Select
                    value={draft.visibility}
                    onValueChange={(visibility) =>
                      setDraft((current) => ({ ...current, visibility }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VISIBILITY_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <label htmlFor="note-follow-up-date" className="text-xs font-semibold text-muted-foreground">
                    Follow-up date
                  </label>
                  <DatePickerInput
                    id="note-follow-up-date"
                    label="Follow-up date"
                    value={draft.followUpDate}
                    onChange={(value) =>
                      setDraft((current) => ({ ...current, followUpDate: value }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional — shows this note as a reminder on the Calendar page.
                  </p>
                </div>
              </div>

              {draft.visibility === "Shared" && editingId === "new" ? (
                <div className="grid gap-2">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Share with
                  </label>
                  <div
                    className="relative"
                    onBlur={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget)) {
                        setMemberPickerOpen(false);
                      }
                    }}
                  >
                    <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      role="combobox"
                      aria-expanded={memberPickerOpen}
                      aria-controls="note-new-member-options"
                      aria-autocomplete="list"
                      value={memberSearch}
                      onFocus={() => setMemberPickerOpen(true)}
                      onChange={(event) => {
                        setMemberSearch(event.target.value);
                        setMemberPickerOpen(true);
                      }}
                      placeholder="Type a name or email to search all users"
                      className="pl-9"
                      autoComplete="off"
                    />
                    {memberPickerOpen && memberSearch.trim() ? (
                      <div
                        id="note-new-member-options"
                        role="listbox"
                        className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-lg"
                      >
                        {userSearchQuery.isPending ? (
                          <p className="px-3 py-2 text-sm text-muted-foreground">
                            Searching…
                          </p>
                        ) : matchingMembers.length ? (
                          matchingMembers.map((member) => (
                            <button
                              key={member.id}
                              type="button"
                              role="option"
                              aria-selected="false"
                              className="flex w-full items-center justify-between gap-3 rounded-sm px-3 py-2 text-left hover:bg-accent focus:bg-accent focus:outline-none"
                              onClick={() => {
                                setSelectedMembers((current) => [...current, member]);
                                setMemberSearch("");
                              }}
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium">
                                  {member.displayName}
                                </span>
                                <span className="block truncate text-xs text-muted-foreground">
                                  {member.email}
                                </span>
                              </span>
                            </button>
                          ))
                        ) : (
                          <p className="px-3 py-2 text-sm text-muted-foreground">
                            No matching users.
                          </p>
                        )}
                      </div>
                    ) : null}
                  </div>
                  {selectedMembers.length ? (
                    <div className="mt-2 flex flex-wrap gap-2" aria-label="Selected note members">
                      {selectedMembers.map((member) => (
                        <Badge key={member.id} variant="secondary" className="gap-1.5 py-1">
                          {member.displayName}
                          <button
                            type="button"
                            aria-label={`Remove ${member.displayName}`}
                            onClick={() =>
                              setSelectedMembers((current) =>
                                current.filter((item) => item.id !== member.id),
                              )
                            }
                            className="rounded-full hover:text-destructive focus:outline-none focus:ring-1 focus:ring-ring"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Selected users receive access directly when the note is saved. No email invitation is sent.
                  </p>
                </div>
              ) : null}

              {draft.visibility === "Shared" && editingId !== "new" && selectedNote ? (
                <div className="flex flex-col gap-2 border-t border-border pt-4">
                  <span className="text-sm font-medium">Shared with</span>
                  {sameTenant ? (
                    <NoteMembersManager tenantId={tenantId} noteId={selectedNote.id} />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      This note was shared with you from another workspace. Only its creator
                      can manage who has access.
                    </p>
                  )}
                </div>
              ) : null}

              <div className="grid gap-2">
                <label
                  htmlFor="note-content"
                  className="text-xs font-semibold text-muted-foreground"
                >
                  Note
                </label>
                <Textarea
                  id="note-content"
                  value={draft.content}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, content: event.target.value }))
                  }
                  placeholder="Write the note…"
                  className="min-h-[220px] resize-y p-4 text-sm leading-relaxed"
                />
              </div>
            </div>
          ) : selectedNote ? (
            <article className="max-w-4xl">
              <Heading level="h1">{selectedNote.title}</Heading>

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
                <span className="text-muted-foreground">{formatDate(selectedNote.createdAt)}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">{formatTime(selectedNote.createdAt)}</span>
                <span className="text-muted-foreground">·</span>
                <Badge variant="outline">{selectedNote.visibility ?? "Private"}</Badge>
                {selectedNote.followUpDate ? (
                  <Link
                    to="/calendar"
                    className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300 bg-cyan-50 px-2.5 py-1 text-xs font-medium text-cyan-800 transition-colors hover:bg-cyan-100 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-300"
                  >
                    <CalendarClock className="h-3.5 w-3.5" />
                    Follow up {formatPlainDate(selectedNote.followUpDate)}
                  </Link>
                ) : null}
              </div>

              <section className="mt-8" aria-labelledby="note-linked-work">
                <div className="flex items-center justify-between gap-3">
                  <h2 id="note-linked-work" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Linked work</h2>
                  {sameTenant && (selectedNote.projectId || selectedNote.moduleId) ? (
                    <Button variant="ghost" size="sm" onClick={() => void handleUnlinkNote()} disabled={updateNote.isPending}>
                      <Unlink />
                      Unlink
                    </Button>
                  ) : null}
                </div>
                {selectedNote.moduleId ? (
                  <div className="mt-3 flex max-w-md flex-col gap-2">
                    <Link to={`/modules/${selectedNote.moduleId}`} className="block rounded-lg border border-border p-4 transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Paper</span>
                      <span className="mt-1 block font-semibold text-primary">{linkTargetLabel(selectedNote)}</span>
                    </Link>
                    {selectedNote.projectId ? (
                      <Link to={`/projects/${selectedNote.projectId}`} className="block rounded-lg border border-border p-4 transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Parent project</span>
                        <span className="mt-1 block font-semibold text-primary">
                          {projectById.get(selectedNote.projectId) ?? "Unknown project"}
                        </span>
                      </Link>
                    ) : null}
                  </div>
                ) : selectedNote.projectId ? (
                  <Link to={`/projects/${selectedNote.projectId}`} className="mt-3 block max-w-md rounded-lg border border-border p-4 transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Project</span>
                    <span className="mt-1 block font-semibold text-primary">{linkTargetLabel(selectedNote)}</span>
                  </Link>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">This is a general note with no linked project or paper.</p>
                )}
              </section>

              <p className="mt-8 whitespace-pre-wrap text-[15px] leading-7 text-foreground/90">
                {selectedNote.content || "This note does not have any content yet."}
              </p>

              {selectedNote.visibility === "Shared" && tenantId ? (
                <div className="mt-8 border-t border-border pt-5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Shared with
                  </span>
                  <div className="mt-3 max-w-sm">
                    {sameTenant ? (
                      <NoteMembersManager
                        tenantId={tenantId}
                        noteId={selectedNote.id}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        This note was shared with you from another workspace. Only members of
                        that workspace can manage who has access.
                      </p>
                    )}
                  </div>
                </div>
              ) : null}
            </article>
          ) : (
            <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 text-center">
              <Heading level="h3">No note selected</Heading>
              <p className="text-sm text-muted-foreground">
                Add a note to begin capturing research updates.
              </p>
              <Button onClick={startAdding}>
                <Plus />
                Add note
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
    </div>
  );
}
