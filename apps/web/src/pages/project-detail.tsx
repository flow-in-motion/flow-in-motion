import {
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ChevronDown,
  ChevronUp,
  FolderKanban,
  Link2,
  Pencil,
  Plus,
  Save,
  Trash2,
  Unlink,
  Users,
  X,
} from "lucide-react";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

import {
  useArchiveMyProject,
  useCreateModule,
  useCreateTask,
  useCurrentWorkspace,
  useMe,
  useMembers,
  useModules,
  useMyProject,
  useNotes,
  useTasks,
  useTrackEvent,
  useUpdateModule,
  useUpdateMyProject,
  useUpdateNote,
  useUpdateTask,
  type ApiModule,
  type ApiNote,
  type ApiProject,
  type ApiTask,
  useProjects,
} from "@/api/hooks";
import { ModuleDialog, type ModuleFormInput } from "@/components/modules/module-dialog";
import { paperDisplayTitle } from "@/lib/paper-title";
import { LinkExistingDialog } from "@/components/shared/link-existing-dialog";
import { ProjectCollaborators } from "@/components/projects/project-collaborators";
import { BackButton } from "@/components/shared/back-button";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { TaskDialog, type TaskFormInput } from "@/components/tasks/task-dialog";
import { PageHeading } from "@/components/typography/heading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PROJECT_PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;
const PROJECT_STATUSES = ["Active", "Review", "Stalled", "Complete"] as const;

interface EditableProject {
  title: string;
  description: string;
  researchArea: string;
  status: string;
  importance: string;
  scheduledFor: string;
  dueDate: string;
  totalBudget: string;
  targetJournals: string;
}

function editableValues(project: ApiProject): EditableProject {
  return {
    title: project.title,
    description: project.description ?? "",
    researchArea: project.researchArea ?? "",
    status: project.status ?? "Active",
    importance: project.importance ?? "Medium",
    scheduledFor: project.scheduledFor ?? "",
    dueDate: project.dueDate ?? "",
    totalBudget: project.totalBudget ?? "",
    targetJournals: project.targetJournals ?? "",
  };
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function formatCurrency(value: string | null) {
  if (!value) return "—";
  const amount = Number(value);
  if (Number.isNaN(amount)) return "—";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function HeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/70 px-2.5 py-1 text-xs">
      <span className="font-medium text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </span>
  );
}

function FormField({
  label,
  htmlFor,
  required,
  children,
  className = "",
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`grid gap-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {required ? <span className="ml-1 text-destructive">*</span> : null}
      </label>
      {children}
    </div>
  );
}

function ProjectModulesDetails({
  modules,
  onAddModule,
  onLinkExisting,
  onUnlinkModule,
}: {
  modules: ApiModule[];
  onAddModule: () => void;
  onLinkExisting: () => void;
  onUnlinkModule: (module: ApiModule) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle>Papers ({modules.length})</CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onLinkExisting}>
            <Link2 />
            Link existing
          </Button>
          <Button variant="outline" size="sm" onClick={onAddModule}>
            <Plus />
            Add paper
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/modules">View all</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {modules.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No papers are linked to this project.
          </p>
        ) : (
          <div className="grid gap-2">
            {modules.map((module) => (
              <div
                key={module.id}
                className="flex items-start gap-1 rounded-md border border-border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-muted/40"
              >
                <Link
                  to={`/modules/${module.id}`}
                  className="min-w-0 flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      {module.displayId ? (
                        <span className="block font-mono text-[10px] text-muted-foreground">
                          {module.displayId}
                        </span>
                      ) : null}
                      <span className="block text-sm font-semibold">
                        {paperDisplayTitle(module)}
                      </span>
                    </div>
                    <StatusBadge status={module.status ?? "—"} />
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => onUnlinkModule(module)}
                  aria-label={`Unlink ${paperDisplayTitle(module)} from this project`}
                  title="Unlink"
                  className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Unlink className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProjectTasksDetails({
  tasks,
  onAddTask,
  onLinkExisting,
  onUnlinkTask,
}: {
  tasks: ApiTask[];
  onAddTask: () => void;
  onLinkExisting: () => void;
  onUnlinkTask: (task: ApiTask) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle>Tasks ({tasks.length})</CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onLinkExisting}>
            <Link2 />
            Link existing
          </Button>
          <Button variant="outline" size="sm" onClick={onAddTask}>
            <Plus />
            Add task
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/tasks">View all</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tasks are linked to this project.
          </p>
        ) : (
          <div className="grid gap-2">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-start gap-1 rounded-md border border-border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-muted/40"
              >
                <Link
                  to={`/tasks/${task.id}`}
                  className="min-w-0 flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      {task.displayId ? (
                        <span className="block font-mono text-[10px] text-muted-foreground">
                          {task.displayId}
                        </span>
                      ) : null}
                      <span className="block text-sm font-semibold">
                        {task.title}
                      </span>
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
                <button
                  type="button"
                  onClick={() => onUnlinkTask(task)}
                  aria-label={`Unlink ${task.title} from this project`}
                  title="Unlink"
                  className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Unlink className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProjectNotesDetails({
  notes,
  projectId,
  onLinkExisting,
  onUnlinkNote,
}: {
  notes: ApiNote[];
  projectId: string;
  onLinkExisting: () => void;
  onUnlinkNote: (note: ApiNote) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle>Notes ({notes.length})</CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onLinkExisting}>
            <Link2 />
            Link existing
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to={`/daily-notes?projectId=${projectId}&new=true`}>
              <Plus />
              Add note
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/daily-notes">View all</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No notes are linked to this project.
          </p>
        ) : (
          <div className="grid gap-2">
            {notes.map((note) => (
              <div
                key={note.id}
                className="flex items-start gap-1 rounded-md border border-border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-muted/40"
              >
                <Link
                  to={`/daily-notes/${note.id}`}
                  className="min-w-0 flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="text-sm font-semibold">{note.title}</span>
                  {note.content ? (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {note.content}
                    </p>
                  ) : null}
                </Link>
                <button
                  type="button"
                  onClick={() => onUnlinkNote(note)}
                  aria-label={`Unlink ${note.title} from this project`}
                  title="Unlink"
                  className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Unlink className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ProjectDetailPage() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const workspace = useCurrentWorkspace();
  const tenantId = workspace.data?.id ?? "";

  // Projects are tenant-agnostic — a project shared with the caller from
  // another workspace must still open here (see MyProjectsController on the
  // backend).
  const projectQuery = useMyProject(projectId);
  const projectsQuery = useProjects(tenantId);
  const generalProject = projectsQuery.data?.generalProject ?? null;
  const modulesQuery = useModules(tenantId, projectId);
  const modules = modulesQuery.data?.data ?? [];
  const tasksQuery = useTasks(tenantId, projectId);
  const tasks = tasksQuery.data?.data ?? [];
  const notesQuery = useNotes(tenantId, projectId);
  const notes = notesQuery.data?.data ?? [];
  const membersQuery = useMembers(tenantId);
  const members = membersQuery.data?.data ?? [];
  const me = useMe();
  const updateProject = useUpdateMyProject();
  const archiveProject = useArchiveMyProject();
  const createTask = useCreateTask(tenantId);
  const createModule = useCreateModule(tenantId);
  const updateModule = useUpdateModule(tenantId);
  const updateTask = useUpdateTask(tenantId);
  const updateNote = useUpdateNote(tenantId);
  const trackEvent = useTrackEvent(tenantId);
  const [isCollaboratorsVisible, setIsCollaboratorsVisible] = useState(true);
  const [isLinkedWorkVisible, setIsLinkedWorkVisible] = useState(true);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [isAddModuleOpen, setIsAddModuleOpen] = useState(false);
  const [isLinkModulesOpen, setIsLinkModulesOpen] = useState(false);
  const [isLinkTasksOpen, setIsLinkTasksOpen] = useState(false);
  const [isLinkNotesOpen, setIsLinkNotesOpen] = useState(false);

  // Unfiltered lists are only fetched once their "link existing" dialog is
  // open, since they're just candidate pools for that picker.
  const allModulesQuery = useModules(tenantId, undefined, 1, isLinkModulesOpen);
  const allTasksQuery = useTasks(tenantId, undefined, 1, isLinkTasksOpen);
  const allNotesQuery = useNotes(tenantId, undefined, 1, isLinkNotesOpen);

  const project = projectQuery.data;
  const sameTenant = Boolean(
    project && tenantId && project.tenantId === tenantId,
  );
  const [isEditing, setIsEditing] = useState(
    () => searchParams.get("edit") === "true",
  );
  const [form, setForm] = useState<EditableProject | null>(null);

  useEffect(() => {
    if (project && isEditing && form === null) {
      setForm(editableValues(project));
    }
  }, [project, isEditing, form]);

  if (workspace.isPending || projectQuery.isPending) {
    return <LoadingState title="Loading project" className="min-h-[50vh]" />;
  }

  if (projectQuery.isError) {
    return (
      <ErrorState
        title="Project could not be loaded"
        description={projectQuery.error.message}
        onRetry={() => void projectQuery.refetch()}
      />
    );
  }

  if (!project) {
    return (
      <EmptyState
        title="Project not found"
        description="This project doesn't exist, or you don't have access to it."
        action={
          <Button asChild variant="outline">
            <Link to="/projects">Back to Projects</Link>
          </Button>
        }
      />
    );
  }

  const projectPath = `/projects/${project.id}`;

  function beginEditing() {
    setForm(editableValues(project!));
    setIsEditing(true);
  }

  function cancelEditing() {
    setForm(null);
    setIsEditing(false);
    if (searchParams.get("edit") === "true") {
      if (location.key === "default") {
        navigate(projectPath, { replace: true });
      } else {
        navigate(-1);
      }
    }
  }

  async function handleDeleteProject() {
    if (
      !window.confirm(
        `Delete "${project!.title}"? It will be archived and permanently removed after 14 days.`,
      )
    ) {
      return;
    }
    await archiveProject.mutateAsync(project!.id);
    navigate("/projects");
  }

  async function saveProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;

    await updateProject.mutateAsync({
      projectId,
      input: {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        researchArea: form.researchArea.trim() || undefined,
        status: form.status,
        importance: form.importance,
        scheduledFor: form.scheduledFor || undefined,
        dueDate: form.dueDate || undefined,
        totalBudget: form.totalBudget || undefined,
        targetJournals: form.targetJournals.trim() || undefined,
      },
    });
    setForm(null);
    setIsEditing(false);
    if (searchParams.get("edit") === "true") {
      navigate(projectPath, { replace: true });
    }
  }

  async function handleCreateTask(input: TaskFormInput) {
    await createTask.mutateAsync({
      title: input.title,
      description: input.description || undefined,
      projectId: input.linkTarget === "project" ? input.projectId : undefined,
      moduleId: input.linkTarget === "module" ? input.moduleId : undefined,
      status: input.status,
      priority: input.priority,
      visibility: input.visibility,
      estimatedHours: input.estimatedHours || undefined,
      dueDate: input.dueDate || undefined,
    });
    trackEvent({ name: "task_created" });
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
      projectId: input.projectId,
      status: input.status,
      pipelineStage: input.pipelineStage,
      dueDate: input.dueDate || undefined,
      assignedToUserId: input.assignedToUserId ?? undefined,
    });
    trackEvent({ name: "module_created" });
    return module;
  }

  async function handleUnlinkModule(module: ApiModule) {
    if (!generalProject) {
      return;
    }
  
    if (
      !window.confirm(
        `Move "${paperDisplayTitle(module)}" to General? It will become an independent paper.`,
      )
    ) {
      return;
    }
  
    await updateModule.mutateAsync({
      moduleId: module.id,
      input: {
        projectId: generalProject.id,
      },
    });
  }

  async function handleUnlinkTask(task: ApiTask) {
    if (!window.confirm(`Unlink "${task.title}" from this project? The task itself won't be deleted.`)) {
      return;
    }
    await updateTask.mutateAsync({
      taskId: task.id,
      input: { projectId: null },
    });
  }

  async function handleUnlinkNote(note: ApiNote) {
    if (!window.confirm(`Unlink "${note.title}" from this project? The note itself won't be deleted.`)) {
      return;
    }
    await updateNote.mutateAsync({
      noteId: note.id,
      input: { projectId: null },
    });
  }

  async function handleLinkModules(moduleIds: string[]) {
    await Promise.all(
      moduleIds.map((moduleId) =>
        updateModule.mutateAsync({ moduleId, input: { projectId: project!.id } }),
      ),
    );
  }

  async function handleLinkTasks(taskIds: string[]) {
    await Promise.all(
      taskIds.map((taskId) =>
        updateTask.mutateAsync({ taskId, input: { projectId: project!.id } }),
      ),
    );
  }

  async function handleLinkNotes(noteIds: string[]) {
    await Promise.all(
      noteIds.map((noteId) =>
        updateNote.mutateAsync({ noteId, input: { projectId: project!.id } }),
      ),
    );
  }

  const linkableModuleOptions = (allModulesQuery.data?.data ?? [])
    .filter((module) => module.projectId !== project.id)
    .map((module) => ({
      id: module.id,
      label: paperDisplayTitle(module),
      sublabel: module.projectId ? "Linked to another project" : "Unlinked",
    }));

  const linkableTaskOptions = (allTasksQuery.data?.data ?? [])
    .filter((task) => task.projectId !== project.id)
    .map((task) => ({
      id: task.id,
      label: task.title,
      sublabel: task.moduleId
        ? "Linked to a paper"
        : task.projectId
          ? "Linked to another project"
          : "Unlinked",
    }));

  const linkableNoteOptions = (allNotesQuery.data?.data ?? [])
    .filter((note) => note.projectId !== project.id)
    .map((note) => ({
      id: note.id,
      label: note.title,
      sublabel: note.moduleId
        ? "Linked to a paper"
        : note.projectId
          ? "Linked to another project"
          : "Unlinked",
    }));

  const myRole =
    project.userId === me.data?.id ? "Owner" : (project.role ?? "—");

  return (
    <div className="page-stack">
      <BackButton fallback="/projects" label="Back" />

      <TaskDialog
        open={isAddTaskOpen}
        onOpenChange={setIsAddTaskOpen}
        tenantId={tenantId}
        projects={[project]}
        modules={modules}
        initialProjectId={project.id}
        onSave={handleCreateTask}
      />

      <ModuleDialog
        open={isAddModuleOpen}
        onOpenChange={setIsAddModuleOpen}
        tenantId={tenantId}
        projects={[project]}
        members={members}
        initialProjectId={project.id}
        onSave={handleCreateModule}
      />

      <LinkExistingDialog
        open={isLinkModulesOpen}
        onOpenChange={setIsLinkModulesOpen}
        title="Link existing papers"
        description="Search for papers that already exist and link them to this project."
        fieldId="link-existing-papers"
        placeholder="Search papers by title"
        options={linkableModuleOptions}
        emptyMessage={
          allModulesQuery.isPending ? "Loading papers…" : "No matching papers."
        }
        confirmLabel="Link papers"
        onConfirm={handleLinkModules}
      />

      <LinkExistingDialog
        open={isLinkTasksOpen}
        onOpenChange={setIsLinkTasksOpen}
        title="Link existing tasks"
        description="Search for tasks that already exist and link them to this project."
        fieldId="link-existing-tasks"
        placeholder="Search tasks by title"
        options={linkableTaskOptions}
        emptyMessage={
          allTasksQuery.isPending ? "Loading tasks…" : "No matching tasks."
        }
        confirmLabel="Link tasks"
        onConfirm={handleLinkTasks}
      />

      <LinkExistingDialog
        open={isLinkNotesOpen}
        onOpenChange={setIsLinkNotesOpen}
        title="Link existing notes"
        description="Search for notes that already exist and link them to this project."
        fieldId="link-existing-notes"
        placeholder="Search notes by title"
        options={linkableNoteOptions}
        emptyMessage={
          allNotesQuery.isPending ? "Loading notes…" : "No matching notes."
        }
        confirmLabel="Link notes"
        onConfirm={handleLinkNotes}
      />

      <PageHeading
        tone="blue"
        icon={FolderKanban}
        eyebrow={project.displayId ?? project.id}
        title={project.title}
        description={
          project.description ||
          "Review and update the project’s core details, planning information and progress."
        }
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={project.status ?? "—"} />
            {form ? (
              <Button type="button" variant="outline" onClick={cancelEditing}>
                <X />
                Cancel Editing
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleDeleteProject()}
                  disabled={archiveProject.isPending}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 />
                  Delete Project
                </Button>
                <Button type="button" onClick={beginEditing}>
                  <Pencil />
                  Edit Project
                </Button>
              </>
            )}
          </div>
        }
      >
        {!form ? (
          <div className="flex flex-wrap gap-2">
            <HeaderStat label="Role" value={myRole} />
            <HeaderStat label="Importance" value={project.importance ?? "—"} />
            <HeaderStat
              label="Status"
              value={project.status ?? "Unknown status"}
            />
            <HeaderStat
              label="Research area"
              value={project.researchArea ?? "—"}
            />
            <HeaderStat
              label="Scheduled"
              value={formatDate(project.scheduledFor)}
            />
            <HeaderStat label="Due" value={formatDate(project.dueDate)} />
            <HeaderStat
              label="Budget"
              value={formatCurrency(project.totalBudget)}
            />
            {project.targetJournals ? (
              <HeaderStat
                label="Target journal"
                value={project.targetJournals}
              />
            ) : null}
          </div>
        ) : null}
      </PageHeading>

      {form ? (
        <Card>
          <CardHeader>
            <CardTitle>Edit project details</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(event) => void saveProject(event)}
              className="grid gap-6"
            >
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <FormField
                  label="Project title"
                  htmlFor="edit-project-title"
                  required
                  className="sm:col-span-2 lg:col-span-3"
                >
                  <Input
                    id="edit-project-title"
                    value={form.title}
                    onChange={(event) =>
                      setForm({ ...form, title: event.target.value })
                    }
                    required
                    autoFocus
                  />
                </FormField>

                <FormField
                  label="Description"
                  htmlFor="edit-project-description"
                  className="sm:col-span-2 lg:col-span-3"
                >
                  <Textarea
                    id="edit-project-description"
                    value={form.description}
                    onChange={(event) =>
                      setForm({ ...form, description: event.target.value })
                    }
                    rows={3}
                  />
                </FormField>

                <FormField
                  label="Research area"
                  htmlFor="edit-project-research-area"
                >
                  <Input
                    id="edit-project-research-area"
                    value={form.researchArea}
                    onChange={(event) =>
                      setForm({ ...form, researchArea: event.target.value })
                    }
                  />
                </FormField>

                <FormField label="Importance" htmlFor="edit-project-priority">
                  <Select
                    value={form.importance}
                    onValueChange={(value) =>
                      setForm({ ...form, importance: value })
                    }
                  >
                    <SelectTrigger id="edit-project-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_PRIORITIES.map((priority) => (
                        <SelectItem key={priority} value={priority}>
                          {priority}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField label="Status" htmlFor="edit-project-status">
                  <Select
                    value={form.status}
                    onValueChange={(value) =>
                      setForm({ ...form, status: value })
                    }
                  >
                    <SelectTrigger id="edit-project-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField
                  label="Scheduled for"
                  htmlFor="edit-project-scheduled-for"
                >
                  <DatePickerInput
                    id="edit-project-scheduled-for"
                    label="Scheduled for date"
                    value={form.scheduledFor}
                    onChange={(value) =>
                      setForm({ ...form, scheduledFor: value })
                    }
                  />
                </FormField>

                <FormField label="Due date" htmlFor="edit-project-due-date">
                  <DatePickerInput
                    id="edit-project-due-date"
                    label="Due date"
                    value={form.dueDate}
                    onChange={(value) => setForm({ ...form, dueDate: value })}
                  />
                </FormField>

                <FormField
                  label="Budget"
                  htmlFor="edit-project-budget-total"
                >
                  <Input
                    id="edit-project-budget-total"
                    type="number"
                    min="0"
                    step="100"
                    value={form.totalBudget}
                    onChange={(event) =>
                      setForm({ ...form, totalBudget: event.target.value })
                    }
                  />
                </FormField>

                <FormField
                  label="Target journal(s) or output"
                  htmlFor="edit-project-journal"
                  className="sm:col-span-2 lg:col-span-3"
                >
                  <Input
                    id="edit-project-journal"
                    value={form.targetJournals}
                    onChange={(event) =>
                      setForm({ ...form, targetJournals: event.target.value })
                    }
                  />
                </FormField>
              </div>

              {updateProject.isError ? (
                <p role="alert" className="text-sm text-destructive">
                  {updateProject.error.message}
                </p>
              ) : null}

              <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={cancelEditing}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateProject.isPending}>
                  <Save />
                  {updateProject.isPending ? "Saving…" : "Save Changes"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          <section aria-labelledby="project-linked-work-heading">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2
                id="project-linked-work-heading"
                className="text-lg font-semibold"
              >
                Linked work
              </h2>
              <Button
                variant="outline"
                size="sm"
                aria-expanded={isLinkedWorkVisible}
                aria-controls="project-linked-work-content"
                onClick={() => setIsLinkedWorkVisible((visible) => !visible)}
              >
                {isLinkedWorkVisible ? <ChevronUp /> : <ChevronDown />}
                {isLinkedWorkVisible ? "Hide linked work" : "Show linked work"}
              </Button>
            </div>
            {isLinkedWorkVisible ? (
              <div
                id="project-linked-work-content"
                className="grid gap-6 lg:grid-cols-3"
              >
                <ProjectModulesDetails
                  modules={modules}
                  onAddModule={() => setIsAddModuleOpen(true)}
                  onLinkExisting={() => setIsLinkModulesOpen(true)}
                  onUnlinkModule={(module) => void handleUnlinkModule(module)}
                />
                <ProjectTasksDetails
                  tasks={tasks}
                  onAddTask={() => setIsAddTaskOpen(true)}
                  onLinkExisting={() => setIsLinkTasksOpen(true)}
                  onUnlinkTask={(task) => void handleUnlinkTask(task)}
                />
                <ProjectNotesDetails
                  notes={notes}
                  projectId={project.id}
                  onLinkExisting={() => setIsLinkNotesOpen(true)}
                  onUnlinkNote={(note) => void handleUnlinkNote(note)}
                />
              </div>
            ) : null}
          </section>

          <section aria-labelledby="project-collaborators-heading">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2
                id="project-collaborators-heading"
                className="text-lg font-semibold"
              >
                Collaborators
              </h2>
              <Button
                variant="outline"
                size="sm"
                aria-expanded={isCollaboratorsVisible}
                aria-controls="project-collaborators-content"
                onClick={() => setIsCollaboratorsVisible((visible) => !visible)}
              >
                {isCollaboratorsVisible ? <ChevronUp /> : <ChevronDown />}
                {isCollaboratorsVisible
                  ? "Hide collaborators"
                  : "Show collaborators"}
              </Button>
            </div>
            {isCollaboratorsVisible ? (
              <Card id="project-collaborators-content">
                <CardHeader>
                  <CardTitle>Project collaborators</CardTitle>
                </CardHeader>
                <CardContent>
                  {!tenantId ? (
                    <EmptyState
                      icon={Users}
                      title="No workspace selected"
                      description="Select a workspace to manage collaborators."
                      className="min-h-40 border-0 bg-muted/30"
                    />
                  ) : sameTenant ? (
                    <ProjectCollaborators
                      tenantId={tenantId}
                      projectId={project.id}
                      ownerUserId={project.userId}
                      members={members}
                      entityTitle={project.title}
                      canManage={me.data?.id === project.userId}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      This project was shared with you from another workspace.
                      Only members of that workspace can manage collaborators.
                    </p>
                  )}
                </CardContent>
              </Card>
            ) : null}
          </section>
        </div>
      )}
    </div>
  );
}
