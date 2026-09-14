import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ChevronDown, ChevronUp, FileStack, Link2, Pencil, Plus, Save, Unlink, X } from "lucide-react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { apiClient } from "@/api/client";
import {
  useCreateTask,
  useCurrentWorkspace,
  useMembers,
  useEnumValues,
  useModulePipelineStagePool,
  useMyModule,
  useNotes,
  useProject,
  useProjects,
  useTasks,
  useTrackEvent,
  useUpdateMyModule,
  useUpdateNote,
  useUpdateTask,
  type ApiNote,
  type ApiModule,
  type ApiProject,
  type ApiTask,
} from "@/api/hooks";
import { ModuleCollaboratorsManager } from "@/components/modules/module-collaborators";
import { EntityDetailPipeline } from "@/components/pipeline/entity-detail-pipeline";
import { BackButton } from "@/components/shared/back-button";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LinkExistingDialog } from "@/components/shared/link-existing-dialog";
import { LoadingState } from "@/components/shared/loading-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { paperDisplayTitle } from "@/lib/paper-title";
import { TaskDialog, type TaskFormInput } from "@/components/tasks/task-dialog";
import { PageHeading } from "@/components/typography/heading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const MODULE_STATUSES = ["Active", "Review", "Stalled", "Complete"];

interface EditableModule {
  shortTitle: string;
  title: string;
  description: string;
  abstract: string;
  status: string;
  pipelineStage: string;
  tag: string;
  dueDate: string;
  assignedToUserId: string;
}

function editableValues(module: ApiModule): EditableModule {
  return {
    shortTitle: module.shortTitle ?? "",
    title: module.title ?? "",
    description: module.description ?? "",
    abstract: module.abstract ?? "",
    status: module.status ?? "Active",
    pipelineStage: module.pipelineStage ?? "",
    tag: module.tag ?? "",
    dueDate: module.dueDate ?? "",
    assignedToUserId: module.assignedToUserId ?? "",
  };
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function HeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/70 px-2.5 py-1 text-xs">
      <span className="font-medium text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </span>
  );
}

function FormField({ label, htmlFor, children, className = "" }: { label: string; htmlFor: string; children: ReactNode; className?: string }) {
  return <div className={`grid gap-1.5 ${className}`}><label htmlFor={htmlFor} className="text-sm font-medium">{label}</label>{children}</div>;
}

function ModuleTasksDetails({
  tasks,
  onAddTask,
  onLinkExisting,
  onUnlinkTask,
}: {
  tasks: ApiTask[];
  onAddTask?: () => void;
  onLinkExisting?: () => void;
  onUnlinkTask?: (task: ApiTask) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle>Tasks ({tasks.length})</CardTitle>
        <div className="flex items-center gap-2">
          {onLinkExisting ? (
            <Button variant="outline" size="sm" onClick={onLinkExisting}>
              <Link2 />
              Link existing
            </Button>
          ) : null}
          {onAddTask ? (
            <Button variant="outline" size="sm" onClick={onAddTask}>
              <Plus />
              Add task
            </Button>
          ) : null}
          <Button asChild variant="ghost" size="sm"><Link to="/tasks">View all</Link></Button>
        </div>
      </CardHeader>
      <CardContent>{tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tasks are linked to this module.</p>
      ) : (
        <div className="grid gap-2">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-start gap-1 rounded-md border border-border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-muted/40">
              <Link to={`/tasks/${task.id}`} className="min-w-0 flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    {task.displayId ? (
                      <span className="block font-mono text-[10px] text-muted-foreground">
                        {task.displayId}
                      </span>
                    ) : null}
                    <span className="block text-sm font-semibold">{task.title}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <StatusBadge status={task.status ?? "—"} />
                    <StatusBadge status={task.priority ?? "—"} />
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>Due {formatDate(task.dueDate)}</span>
                </div>
              </Link>
              {onUnlinkTask ? (
                <button
                  type="button"
                  onClick={() => onUnlinkTask(task)}
                  aria-label={`Unlink ${task.title} from this module`}
                  title="Unlink"
                  className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Unlink className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}</CardContent>
    </Card>
  );
}

function ModuleNotesDetails({
  notes,
  addNoteHref,
  onLinkExisting,
  onUnlinkNote,
}: {
  notes: ApiNote[];
  addNoteHref?: string;
  onLinkExisting?: () => void;
  onUnlinkNote?: (note: ApiNote) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle>Notes ({notes.length})</CardTitle>
        <div className="flex items-center gap-2">
          {onLinkExisting ? (
            <Button variant="outline" size="sm" onClick={onLinkExisting}>
              <Link2 />
              Link existing
            </Button>
          ) : null}
          {addNoteHref ? (
            <Button asChild variant="outline" size="sm">
              <Link to={addNoteHref}>
                <Plus />
                Add note
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="ghost" size="sm"><Link to="/daily-notes">View all</Link></Button>
        </div>
      </CardHeader>
      <CardContent>{notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notes are linked to this module.</p>
      ) : (
        <div className="grid gap-2">
          {notes.map((note) => (
            <div key={note.id} className="flex items-start gap-1 rounded-md border border-border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-muted/40">
              <Link to={`/daily-notes/${note.id}`} className="min-w-0 flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="text-sm font-semibold">{note.title}</span>
                {note.content ? (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{note.content}</p>
                ) : null}
              </Link>
              {onUnlinkNote ? (
                <button
                  type="button"
                  onClick={() => onUnlinkNote(note)}
                  aria-label={`Unlink ${note.title} from this module`}
                  title="Unlink"
                  className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Unlink className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}</CardContent>
    </Card>
  );
}

function LinkedProjectCard({
  module,
  canChangeProject,
  availableProjects,
  linkedProject,
  isSaving,
  onChangeProject,
}: {
  module: ApiModule;
  canChangeProject: boolean;
  availableProjects: ApiProject[];
  linkedProject: { title?: string; isError: boolean };
  isSaving: boolean;
  onChangeProject: (projectId: string | null) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isIndependent, setIsIndependent] = useState(module.projectId === null);
  const [projectId, setProjectId] = useState(module.projectId ?? "");

  function startEditing() {
    setIsIndependent(module.projectId === null);
    setProjectId(module.projectId ?? "");
    setIsEditing(true);
  }

  async function handleSave() {
    if (!isIndependent && !projectId) return;
    await onChangeProject(isIndependent ? null : projectId);
    setIsEditing(false);
  }

  async function handleUnlink() {
    if (!window.confirm("Unlink this module from its project? It will become an independent module.")) {
      return;
    }
    await onChangeProject(null);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle>Linked project</CardTitle>
        {canChangeProject && !isEditing ? (
          <div className="flex items-center gap-2">
            {module.projectId ? (
              <Button variant="ghost" size="sm" onClick={() => void handleUnlink()} disabled={isSaving}>
                <Unlink />
                Unlink
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" onClick={startEditing}>
              <Pencil />
              Change project
            </Button>
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="flex flex-col gap-3">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={isIndependent}
                onChange={(event) => {
                  setIsIndependent(event.target.checked);
                  if (event.target.checked) setProjectId("");
                }}
                className="mt-0.5 h-4 w-4 accent-primary"
              />
              <span>
                <span className="block text-sm font-medium">Independent module</span>
                <span className="block text-xs text-muted-foreground">
                  Only explicitly added collaborators can see an independent module.
                  Project-linked modules are visible to anyone who can see the project.
                </span>
              </span>
            </label>
            {!isIndependent ? (
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger aria-label="Project"><SelectValue placeholder="Select a project" /></SelectTrigger>
                <SelectContent>
                  {availableProjects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>{project.title}</SelectItem>
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
                disabled={isSaving || (!isIndependent && !projectId)}
              >
                {isSaving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        ) : module.projectId ? (
          <Link to={`/projects/${module.projectId}`} className="block rounded-md border border-border p-4 transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Project</span>
            <span className="mt-1 block font-semibold text-primary">
              {linkedProject.title ?? (linkedProject.isError ? "Unknown project" : "Loading…")}
            </span>
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">This is an independent module.</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function ModuleDetailPage() {
  const { moduleId = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const workspace = useCurrentWorkspace();
  const tenantId = workspace.data?.id ?? "";

  // Modules are tenant-agnostic — a module the caller collaborates on
  // (directly, or via its linked project) must still open here (see
  // MyModulesController on the backend).
  const moduleQuery = useMyModule(moduleId);
  const tasksQuery = useTasks(tenantId);
  const tasks = tasksQuery.data?.data ?? [];
  const notesQuery = useNotes(tenantId);
  const notes = notesQuery.data?.data ?? [];
  const membersQuery = useMembers(tenantId);
  const members = membersQuery.data?.data ?? [];
  const updateModule = useUpdateMyModule();
  const createTask = useCreateTask(tenantId);
  const updateTask = useUpdateTask(tenantId);
  const updateNote = useUpdateNote(tenantId);
  const trackEvent = useTrackEvent(tenantId);
  const tagValuesQuery = useEnumValues("module_type");

  const module = moduleQuery.data;
  const sameTenant = Boolean(module && tenantId && module.tenantId === tenantId);
  const linkedProjectQuery = useProject(tenantId, module?.projectId ?? "", Boolean(module?.projectId));
  // Relinking is only offered when the module lives in the caller's active
  // workspace — a module shared from another tenant can't list that
  // tenant's projects without full membership there (same boundary as the
  // collaborators section below).
  const projectsQuery = useProjects(tenantId, 1, sameTenant);
  const availableProjects = projectsQuery.data?.data ?? [];
  const stagesQuery = useModulePipelineStagePool(module?.tenantId ?? tenantId, Boolean(module));
  const [form, setForm] = useState<EditableModule | null>(null);
  const [openedRequestedEdit, setOpenedRequestedEdit] = useState(false);
  const [isCollaboratorsVisible, setIsCollaboratorsVisible] = useState(false);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [isLinkTasksOpen, setIsLinkTasksOpen] = useState(false);
  const [isLinkNotesOpen, setIsLinkNotesOpen] = useState(false);

  useEffect(() => {
    if (!openedRequestedEdit && searchParams.get("edit") === "true" && module) {
      setForm(editableValues(module));
      setOpenedRequestedEdit(true);
    }
  }, [module, openedRequestedEdit, searchParams]);

  if (workspace.isPending || moduleQuery.isPending) {
    return <LoadingState title="Loading module" className="min-h-[50vh]" />;
  }

  if (moduleQuery.isError) {
    return (
      <ErrorState
        title="Module could not be loaded"
        description={moduleQuery.error.message}
        onRetry={() => void moduleQuery.refetch()}
      />
    );
  }

  if (!module) {
    return (
      <EmptyState
        title="Module not found"
        description="This module doesn't exist, or you don't have access to it."
        action={
          <Button asChild variant="outline">
            <Link to="/modules">Back to Modules</Link>
          </Button>
        }
      />
    );
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    await updateModule.mutateAsync({
      moduleId,
      input: {
        shortTitle: form.shortTitle.trim(),
        title: form.title.trim() || undefined,
        description: form.description.trim() || undefined,
        abstract: form.abstract.trim() || undefined,
        status: form.status,
        pipelineStage: form.pipelineStage,
        tag: form.tag || undefined,
        dueDate: form.dueDate || undefined,
        assignedToUserId: form.assignedToUserId || undefined,
      },
    });
    setForm(null);
  }

  async function handleChangeProject(projectId: string | null) {
    await updateModule.mutateAsync({
      moduleId,
      input: { projectId },
    });
  }

  async function handleUnlinkTask(task: ApiTask) {
    if (!window.confirm(`Unlink "${task.title}" from this module? The task itself won't be deleted.`)) {
      return;
    }
    await updateTask.mutateAsync({
      taskId: task.id,
      input: { moduleId: null },
    });
  }

  async function handleUnlinkNote(note: ApiNote) {
    if (!window.confirm(`Unlink "${note.title}" from this module? The note itself won't be deleted.`)) {
      return;
    }
    await updateNote.mutateAsync({
      noteId: note.id,
      input: { moduleId: null },
    });
  }

  async function handleLinkTasks(taskIds: string[]) {
    await Promise.all(
      taskIds.map((taskId) =>
        updateTask.mutateAsync({ taskId, input: { moduleId: module!.id } }),
      ),
    );
  }

  async function handleLinkNotes(noteIds: string[]) {
    await Promise.all(
      noteIds.map((noteId) =>
        updateNote.mutateAsync({ noteId, input: { moduleId: module!.id } }),
      ),
    );
  }

  function cancelEditing() {
    setForm(null);
    if (searchParams.get("edit") === "true") {
      if (location.key === "default") {
        navigate(`/modules/${moduleId}`, { replace: true });
      } else {
        navigate(-1);
      }
    }
  }

  function changePipelineStage(stage: string) {
    void updateModule.mutateAsync({
      moduleId,
      input: { pipelineStage: stage },
    });
  }

  async function handleCreateTask(input: TaskFormInput) {
    const task = await createTask.mutateAsync({
      title: input.title,
      description: input.description || undefined,
      projectId: input.linkTarget === "project" ? input.projectId : undefined,
      moduleId: input.linkTarget === "module" ? input.moduleId : undefined,
      status: input.status,
      priority: input.priority,
      visibility: input.visibility,
      workingWith: input.workingWith || undefined,
      estimatedHours: input.estimatedHours || undefined,
      dueDate: input.dueDate || undefined,
    });

    await Promise.all(
      input.collaboratorUserIds.map((userId) =>
        apiClient.POST("/api/v1/tenant/{tenantId}/tasks/{taskId}/members", {
          params: { path: { tenantId, taskId: task.id } },
          body: { userId },
        }),
      ),
    );
    trackEvent({ name: "task_created" });
  }

  const assignee = module.assignedToUserId
    ? (members).find((member) => member.userId === module.assignedToUserId)
    : undefined;
    const moduleTasks = tasks.filter(
      (task) => task.moduleId === module.id,
    );
  const moduleNotes = (notes).filter((note) => note.moduleId === module.id);

  const linkableTaskOptions = tasks
    .filter((task) => task.moduleId !== module.id)
    .map((task) => ({
      id: task.id,
      label: task.title,
      sublabel: task.moduleId ? "Linked to another paper" : "Unlinked",
    }));

  const linkableNoteOptions = notes
    .filter((note) => note.moduleId !== module.id)
    .map((note) => ({
      id: note.id,
      label: note.title,
      sublabel: note.moduleId ? "Linked to another paper" : "Unlinked",
    }));

  return (
    <div className="page-stack">
      <BackButton fallback="/modules" label="Back" />

      <PageHeading
        tone="violet"
        icon={FileStack}
        eyebrow={module.displayId ?? module.id}
        title={paperDisplayTitle(module)}
        description={module.description || "Review and update the module's status, type and planning details."}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={module.status ?? "—"} />
            {form ? <Button type="button" variant="outline" onClick={cancelEditing}><X /> Cancel Editing</Button>
              : <Button type="button" onClick={() => setForm(editableValues(module))}><Pencil /> Edit Module</Button>}
          </div>
        }
      >
        {!form ? (
          <div className="flex flex-wrap gap-2">
            {module.title ? <HeaderStat label="Formal title" value={module.title} /> : null}
            <HeaderStat label="Type" value={module.tag ?? "—"} />
            <HeaderStat label="Status" value={module.status ?? "—"} />
            <HeaderStat label="Pipeline stage" value={module.pipelineStage ?? "Unassigned"} />
            <HeaderStat label="Due" value={formatDate(module.dueDate)} />
            <HeaderStat label="Assigned to" value={assignee?.displayName ?? "Unassigned"} />
          </div>
        ) : null}
      </PageHeading>

      {form ? <Card>
        <CardHeader><CardTitle>Edit module details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={(event) => void handleSave(event)} className="grid gap-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="Short title" htmlFor="edit-module-short-title"><Input id="edit-module-short-title" value={form.shortTitle} onChange={(event) => setForm({ ...form, shortTitle: event.target.value })} placeholder="The working name you'll refer to this paper by" required autoFocus /></FormField>
              <FormField label="Formal title" htmlFor="edit-module-title"><Input id="edit-module-title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Add once the paper has a formal title" /></FormField>
              <FormField label="Description" htmlFor="edit-module-description" className="sm:col-span-2"><Textarea id="edit-module-description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} /></FormField>
              <FormField label="Abstract" htmlFor="edit-module-abstract" className="sm:col-span-2"><Textarea id="edit-module-abstract" value={form.abstract} onChange={(event) => setForm({ ...form, abstract: event.target.value })} placeholder="Add the paper's academic abstract" rows={6} /></FormField>
              <FormField label="Status" htmlFor="edit-module-status"><Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}><SelectTrigger id="edit-module-status"><SelectValue /></SelectTrigger><SelectContent>{MODULE_STATUSES.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></FormField>
              <FormField label="Type" htmlFor="edit-module-type"><Select value={form.tag} onValueChange={(value) => setForm({ ...form, tag: value })}><SelectTrigger id="edit-module-type"><SelectValue placeholder="Select a type" /></SelectTrigger><SelectContent>{(tagValuesQuery.data ?? []).map((value) => <SelectItem key={value.id} value={value.value}>{value.value}</SelectItem>)}</SelectContent></Select></FormField>
              <FormField label="Pipeline stage" htmlFor="edit-module-stage"><Select value={form.pipelineStage} onValueChange={(value) => setForm({ ...form, pipelineStage: value })}><SelectTrigger id="edit-module-stage"><SelectValue placeholder="Select a stage" /></SelectTrigger><SelectContent>{(stagesQuery.data ?? []).filter((stage) => !stage.hidden).map((stage: { id: string; value: string }) => <SelectItem key={stage.id} value={stage.value}>{stage.value}</SelectItem>)}</SelectContent></Select></FormField>
              <FormField label="Due date" htmlFor="edit-module-due"><DatePickerInput id="edit-module-due" label="Due date" value={form.dueDate} onChange={(value) => setForm({ ...form, dueDate: value })} /></FormField>
              <FormField label="Assigned to" htmlFor="edit-module-assignee"><Select value={form.assignedToUserId || "__unassigned__"} onValueChange={(value) => setForm({ ...form, assignedToUserId: value === "__unassigned__" ? "" : value })}><SelectTrigger id="edit-module-assignee"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__unassigned__">Unassigned</SelectItem>{(members).map((member) => <SelectItem key={member.userId} value={member.userId}>{member.displayName}</SelectItem>)}</SelectContent></Select></FormField>
            </div>
            {updateModule.isError ? (
              <p role="alert" className="text-sm text-destructive">
                {updateModule.error.message}
              </p>
            ) : null}
            <div className="flex justify-end gap-3 border-t pt-5"><Button type="button" variant="outline" onClick={cancelEditing}>Cancel</Button><Button type="submit" disabled={updateModule.isPending}><Save /> {updateModule.isPending ? "Saving…" : "Save Changes"}</Button></div>
          </form>
        </CardContent>
      </Card> : null}

      {!form && module.abstract ? (
        <Card>
          <CardHeader><CardTitle>Abstract</CardTitle></CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {module.abstract}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-6">
        <section aria-labelledby="module-collaborators-heading">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="module-collaborators-heading" className="text-lg font-semibold">Collaborators</h2>
            <Button variant="outline" size="sm" aria-expanded={isCollaboratorsVisible} aria-controls="module-collaborators-content" onClick={() => setIsCollaboratorsVisible((visible) => !visible)}>
              {isCollaboratorsVisible ? <ChevronUp /> : <ChevronDown />}
              {isCollaboratorsVisible ? "Hide collaborators" : "Show collaborators"}
            </Button>
          </div>
          {isCollaboratorsVisible ? (
            <Card id="module-collaborators-content">
              <CardHeader>
                <CardTitle>Module collaborators</CardTitle>
              </CardHeader>
              <CardContent>
                {sameTenant ? (
                  <div className="grid gap-4">
                    {module.projectId ? (
                      <p className="text-sm text-muted-foreground">
                        Project collaborators already inherit access. You can also invite someone directly to this module by email.
                      </p>
                    ) : null}
                    <ModuleCollaboratorsManager
                      tenantId={tenantId}
                      moduleId={module.id}
                      moduleTitle={paperDisplayTitle(module)}
                      members={members}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    This module was shared with you from another workspace. Only members of that
                    workspace can manage who has access.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : null}
        </section>

        <section className="grid gap-6 lg:grid-cols-3" aria-label="Linked work">
          <LinkedProjectCard
            module={module}
            canChangeProject={sameTenant}
            availableProjects={availableProjects}
            linkedProject={{ title: linkedProjectQuery.data?.title, isError: linkedProjectQuery.isError }}
            isSaving={updateModule.isPending}
            onChangeProject={handleChangeProject}
          />
          <ModuleTasksDetails
            tasks={moduleTasks}
            onAddTask={sameTenant ? () => setIsAddTaskOpen(true) : undefined}
            onLinkExisting={sameTenant ? () => setIsLinkTasksOpen(true) : undefined}
            onUnlinkTask={sameTenant ? (task) => void handleUnlinkTask(task) : undefined}
          />
          <ModuleNotesDetails
            notes={moduleNotes}
            addNoteHref={sameTenant ? `/daily-notes?moduleId=${module.id}&new=true` : undefined}
            onLinkExisting={sameTenant ? () => setIsLinkNotesOpen(true) : undefined}
            onUnlinkNote={sameTenant ? (note) => void handleUnlinkNote(note) : undefined}
          />
        </section>

        <TaskDialog
          open={isAddTaskOpen}
          onOpenChange={setIsAddTaskOpen}
          tenantId={tenantId}
          projects={availableProjects}
          modules={[module]}
          initialModuleId={module.id}
          onSave={handleCreateTask}
        />

        <LinkExistingDialog
          open={isLinkTasksOpen}
          onOpenChange={setIsLinkTasksOpen}
          title="Link existing tasks"
          description="Search for tasks that already exist and link them to this paper."
          fieldId="link-existing-module-tasks"
          placeholder="Search tasks by title"
          options={linkableTaskOptions}
          emptyMessage={tasksQuery.isPending ? "Loading tasks…" : "No matching tasks."}
          confirmLabel="Link tasks"
          onConfirm={handleLinkTasks}
        />

        <LinkExistingDialog
          open={isLinkNotesOpen}
          onOpenChange={setIsLinkNotesOpen}
          title="Link existing notes"
          description="Search for notes that already exist and link them to this paper."
          fieldId="link-existing-module-notes"
          placeholder="Search notes by title"
          options={linkableNoteOptions}
          emptyMessage={notesQuery.isPending ? "Loading notes…" : "No matching notes."}
          confirmLabel="Link notes"
          onConfirm={handleLinkNotes}
        />

        <EntityDetailPipeline
          entityLabel="module"
          entity={{ ...module, title: paperDisplayTitle(module), secondaryStatus: module.tag }}
          stages={(stagesQuery.data ?? []).filter((stage) => !stage.hidden)}
          isPending={stagesQuery.isPending}
          isError={stagesQuery.isError}
          isUpdating={updateModule.isPending}
          updateError={updateModule.isError ? updateModule.error.message : null}
          onStageChange={changePipelineStage}
        />
      </div>
    </div>
  );
}
