import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { CalendarClock, ChevronDown, ChevronUp, NotebookPen, Pencil, Save, Unlink } from "lucide-react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";

import {
  useCurrentWorkspace,
  useMembers,
  useModules,
  useMyNote,
  useProject,
  useProjects,
  useUpdateMyNote,
  type ApiModule,
  type ApiNote,
  type ApiProject,
} from "@/api/hooks";
import { NoteMembersManager } from "@/components/notes/note-members";
import { BackButton } from "@/components/shared/back-button";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeading } from "@/components/typography/heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { resolveLinkTargetType, type LinkTargetType } from "@/lib/link-target";
import { paperDisplayTitle } from "@/lib/paper-title";

const VISIBILITY_OPTIONS = ["Private", "Shared"];
const LINK_TARGETS: Array<{ value: LinkTargetType; label: string }> = [
  { value: "project", label: "Project" },
  { value: "module", label: "Paper" },
  { value: "none", label: "General" },
];

interface NoteEditForm {
  title: string;
  content: string;
  linkTarget: LinkTargetType;
  projectId: string;
  moduleId: string;
  visibility: string;
  followUpDate: string;
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatPlainDate(iso: string) {
  const [year, month, day] = iso.split("-");
  return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function DetailItem({ label, children, className = "" }: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 font-medium">{children}</div>
    </div>
  );
}

function formValues(note: ApiNote): NoteEditForm {
  return {
    title: note.title ?? "",
    content: note.content ?? "",
    linkTarget: resolveLinkTargetType(note),
    projectId: note.projectId ?? "",
    moduleId: note.moduleId ?? "",
    visibility: note.visibility ?? "Private",
    followUpDate: note.followUpDate ?? "",
  };
}

function FormField({ label, htmlFor, children, className = "" }: { label: string; htmlFor: string; children: ReactNode; className?: string }) {
  return <div className={`grid gap-1.5 ${className}`}><label htmlFor={htmlFor} className="text-sm font-medium">{label}</label>{children}</div>;
}

function linkTargetPillClass(selected: boolean) {
  return selected
    ? "rounded-full border border-primary bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
    : "rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground";
}

function LinkedWorkCard({
  note,
  projects,
  modules,
  linkedProjectTitle,
  linkedProjectError,
  linkedModuleTitle,
  isSaving,
  onChangeLink,
}: {
  note: ApiNote;
  projects: ApiProject[];
  modules: ApiModule[];
  linkedProjectTitle?: string;
  linkedProjectError: boolean;
  linkedModuleTitle?: string;
  isSaving: boolean;
  onChangeLink: (linkTarget: LinkTargetType, projectId: string, moduleId: string) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [linkTarget, setLinkTarget] = useState<LinkTargetType>(resolveLinkTargetType(note));
  const [projectId, setProjectId] = useState(note.projectId ?? "");
  const [moduleId, setModuleId] = useState(note.moduleId ?? "");

  function startEditing() {
    setLinkTarget(resolveLinkTargetType(note));
    setProjectId(note.projectId ?? "");
    setModuleId(note.moduleId ?? "");
    setIsEditing(true);
  }

  async function handleSave() {
    if (linkTarget === "project" && !projectId) return;
    if (linkTarget === "module" && !moduleId) return;
    await onChangeLink(linkTarget, projectId, moduleId);
    setIsEditing(false);
  }

  async function handleUnlink() {
    if (!window.confirm("Unlink this note from its project or paper? It will become a general note.")) {
      return;
    }
    await onChangeLink("none", "", "");
  }

  const hasLink = Boolean(note.projectId || note.moduleId);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle>Linked work</CardTitle>
        {!isEditing ? (
          <div className="flex items-center gap-2">
            {hasLink ? (
              <Button variant="ghost" size="sm" onClick={() => void handleUnlink()} disabled={isSaving}>
                <Unlink />
                Unlink
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" onClick={startEditing}>
              <Pencil />
              Change link
            </Button>
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {LINK_TARGETS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={linkTarget === option.value}
                  onClick={() => setLinkTarget(option.value)}
                  className={linkTargetPillClass(linkTarget === option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {linkTarget === "project" ? (
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger aria-label="Project"><SelectValue placeholder="Select a project" /></SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>{project.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            {linkTarget === "module" ? (
              <Select value={moduleId} onValueChange={setModuleId}>
                <SelectTrigger aria-label="Paper"><SelectValue placeholder="Select a paper" /></SelectTrigger>
                <SelectContent>
                  {modules.map((module) => (
                    <SelectItem key={module.id} value={module.id}>{paperDisplayTitle(module)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => void handleSave()}
                disabled={isSaving || (linkTarget === "project" && !projectId) || (linkTarget === "module" && !moduleId)}
              >
                {isSaving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        ) : note.moduleId ? (
          <div className="flex flex-col gap-2">
            <Link to={`/modules/${note.moduleId}`} className="block rounded-md border border-border p-4 transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Paper</span>
              <span className="mt-1 block font-semibold text-primary">{linkedModuleTitle ?? "Loading…"}</span>
            </Link>
            {note.projectId ? (
              <Link to={`/projects/${note.projectId}`} className="block rounded-md border border-border p-4 transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Parent project</span>
                <span className="mt-1 block font-semibold text-primary">
                  {linkedProjectTitle ?? (linkedProjectError ? "Unknown project" : "Loading…")}
                </span>
              </Link>
            ) : null}
          </div>
        ) : note.projectId ? (
          <Link to={`/projects/${note.projectId}`} className="block rounded-md border border-border p-4 transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Project</span>
            <span className="mt-1 block font-semibold text-primary">
              {linkedProjectTitle ?? (linkedProjectError ? "Unknown project" : "Loading…")}
            </span>
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">This is a general note with no linked project or paper.</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function DailyNoteDetailPage() {
  const { noteId = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const workspace = useCurrentWorkspace();
  const tenantId = workspace.data?.id ?? "";

  const noteQuery = useMyNote(noteId);
  const projectsQuery = useProjects(tenantId);
  const projects = projectsQuery.data?.data ?? [];
  const modulesQuery = useModules(tenantId);
  const modules = modulesQuery.data?.data ?? [];
  const updateNote = useUpdateMyNote();
  const note = noteQuery.data;
  const linkedProjectQuery = useProject(tenantId, note?.projectId ?? "", Boolean(note?.projectId));
  const sameTenant = Boolean(note && tenantId && note.tenantId === tenantId);
  const membersQuery = useMembers(tenantId, 1, sameTenant);
  const members = membersQuery.data?.data ?? [];
  const [form, setForm] = useState<NoteEditForm | null>(null);
  const [openedRequestedEdit, setOpenedRequestedEdit] = useState(false);
  const [isOverviewVisible, setIsOverviewVisible] = useState(true);
  const [isLinkedWorkVisible, setIsLinkedWorkVisible] = useState(true);
  const [isMembersVisible, setIsMembersVisible] = useState(true);

  useEffect(() => {
    if (!openedRequestedEdit && searchParams.get("edit") === "true" && note) {
      setForm(formValues(note));
      setOpenedRequestedEdit(true);
    }
  }, [openedRequestedEdit, searchParams, note]);

  if (workspace.isPending || noteQuery.isPending) {
    return <LoadingState title="Loading note" className="min-h-[50vh]" />;
  }

  if (noteQuery.isError) {
    return (
      <ErrorState
        title="Note could not be loaded"
        description={noteQuery.error.message}
        onRetry={() => void noteQuery.refetch()}
      />
    );
  }

  if (!note) {
    return (
      <EmptyState
        title="Note not found"
        description="This note doesn't exist, or you don't have access to it."
        action={
          <Button asChild variant="outline">
            <Link to="/daily-notes">Back to Notes</Link>
          </Button>
        }
      />
    );
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    await updateNote.mutateAsync({
      noteId,
      input: {
        title: form.title.trim() || "Untitled note",
        content: form.content.trim() || undefined,
        visibility: form.visibility,
        followUpDate: form.followUpDate || undefined,
      },
    });
    setForm(null);
  }

  async function handleChangeLink(linkTarget: LinkTargetType, newProjectId: string, newModuleId: string) {
    const input =
      linkTarget === "project"
        ? { projectId: newProjectId, moduleId: null }
        : linkTarget === "module"
          ? { moduleId: newModuleId, projectId: null }
          : { projectId: null, moduleId: null };
    await updateNote.mutateAsync({ noteId, input });
  }

  function cancelEditing() {
    setForm(null);
    if (searchParams.get("edit") === "true") {
      if (location.key === "default") {
        navigate(`/daily-notes/${noteId}`, { replace: true });
      } else {
        navigate(-1);
      }
    }
  }

  const linkedModule = note.moduleId
    ? modules.find((module) => module.id === note.moduleId)
    : undefined;

  return (
    <div className="page-stack">
      <BackButton fallback="/daily-notes" label="Back" />

      <PageHeading
        tone="violet"
        icon={NotebookPen}
        eyebrow={note.displayId ?? note.id}
        title={note.title || "Untitled note"}
        description="Review and update this research update, decision or observation."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline">{note.visibility ?? "Private"}</Badge>
            {note.followUpDate ? (
              <Link
                to="/calendar"
                className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300 bg-cyan-50 px-2.5 py-1 text-xs font-medium text-cyan-800 transition-colors hover:bg-cyan-100 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-300"
              >
                <CalendarClock className="h-3.5 w-3.5" />
                Follow up {formatPlainDate(note.followUpDate)}
              </Link>
            ) : null}
            {form ? null : (
               <Button type="button" onClick={() => setForm(formValues(note))}><Pencil /> Edit Note</Button>)}
          </div>
        }
      />

      {form ? (
        <Card>
          <CardHeader><CardTitle>Edit note details</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={(event) => void handleSave(event)} className="grid gap-6">
              <div className="grid gap-5 sm:grid-cols-2">
                <FormField label="Note title" htmlFor="edit-note-title" className="sm:col-span-2">
                  <Input id="edit-note-title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required autoFocus />
                </FormField>
                <FormField label="Note" htmlFor="edit-note-content" className="sm:col-span-2">
                  <Textarea id="edit-note-content" value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} rows={6} />
                </FormField>
                <FormField label="Visibility" htmlFor="edit-note-visibility"><Select value={form.visibility} onValueChange={(value) => setForm({ ...form, visibility: value })}><SelectTrigger id="edit-note-visibility"><SelectValue /></SelectTrigger><SelectContent>{VISIBILITY_OPTIONS.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></FormField>
                <FormField label="Follow-up date" htmlFor="edit-note-follow-up"><DatePickerInput id="edit-note-follow-up" label="Follow-up date" value={form.followUpDate} onChange={(value) => setForm({ ...form, followUpDate: value })} /></FormField>
              </div>
              {updateNote.isError ? (
                <p role="alert" className="text-sm text-destructive">
                  {updateNote.error.message}
                </p>
              ) : null}
              <div className="flex justify-end gap-3 border-t pt-5"><Button type="button" variant="outline" onClick={cancelEditing}>Cancel</Button><Button type="submit" disabled={updateNote.isPending}><Save /> {updateNote.isPending ? "Saving…" : "Save Changes"}</Button></div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-6">
        <section aria-labelledby="note-overview-heading">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="note-overview-heading" className="text-lg font-semibold">Overview</h2>
            <Button variant="outline" size="sm" aria-expanded={isOverviewVisible} aria-controls="note-overview-content" onClick={() => setIsOverviewVisible((visible) => !visible)}>
              {isOverviewVisible ? <ChevronUp /> : <ChevronDown />}
              {isOverviewVisible ? "Hide overview" : "Show overview"}
            </Button>
          </div>
          {isOverviewVisible ? (
            <Card id="note-overview-content">
              <CardHeader>
                <CardTitle>Note overview</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-5 text-sm sm:grid-cols-2">
                <DetailItem label="Created">{formatDate(note.createdAt)}</DetailItem>
                <DetailItem label="Visibility">{note.visibility ?? "Private"}</DetailItem>
                <DetailItem label="Follow-up date">
                  {note.followUpDate ? formatPlainDate(note.followUpDate) : "—"}
                </DetailItem>
                <DetailItem label="Note" className="sm:col-span-2">
                  <span className="whitespace-pre-wrap font-normal leading-relaxed text-muted-foreground">
                    {note.content || "This note does not have any content yet."}
                  </span>
                </DetailItem>
              </CardContent>
            </Card>
          ) : null}
        </section>

        <section aria-labelledby="note-linked-work-heading">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="note-linked-work-heading" className="text-lg font-semibold">Linked work</h2>
            <Button variant="outline" size="sm" aria-expanded={isLinkedWorkVisible} aria-controls="note-linked-work-content" onClick={() => setIsLinkedWorkVisible((visible) => !visible)}>
              {isLinkedWorkVisible ? <ChevronUp /> : <ChevronDown />}
              {isLinkedWorkVisible ? "Hide linked work" : "Show linked work"}
            </Button>
          </div>
          {isLinkedWorkVisible ? (
            <div id="note-linked-work-content">
              <LinkedWorkCard
                note={note}
                projects={projects}
                modules={modules}
                linkedProjectTitle={linkedProjectQuery.data?.title}
                linkedProjectError={linkedProjectQuery.isError}
                linkedModuleTitle={linkedModule ? paperDisplayTitle(linkedModule) : undefined}
                isSaving={updateNote.isPending}
                onChangeLink={handleChangeLink}
              />
            </div>
          ) : null}
        </section>

        <section aria-labelledby="note-members-heading">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="note-members-heading" className="text-lg font-semibold">Shared with</h2>
            <Button variant="outline" size="sm" aria-expanded={isMembersVisible} aria-controls="note-members-content" onClick={() => setIsMembersVisible((visible) => !visible)}>
              {isMembersVisible ? <ChevronUp /> : <ChevronDown />}
              {isMembersVisible ? "Hide shared with" : "Show shared with"}
            </Button>
          </div>
          {isMembersVisible ? (
            <Card id="note-members-content">
              <CardHeader>
                <CardTitle>Manage who has access</CardTitle>
              </CardHeader>
              <CardContent>
                {note.visibility === "Shared" && sameTenant ? (
                  <NoteMembersManager
                    tenantId={tenantId}
                    noteId={note.id}
                    noteTitle={note.title || "Untitled note"}
                    ownerUserId={note.createdBy}
                    members={members}
                  />
                ) : note.visibility === "Shared" ? (
                  <p className="text-sm text-muted-foreground">
                    This note was shared with you from another workspace. Only members of that
                    workspace can manage who has access.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    This note is private — only you can see it. Switch its visibility to Shared to
                    add members.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : null}
        </section>
      </div>
    </div>
  );
}
