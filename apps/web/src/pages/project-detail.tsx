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
  useMyProjectArchiveImpact,
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
import { ArchiveProjectDialog } from "@/components/projects/archive-project-dialog";
import { BackButton } from "@/components/shared/back-button";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  LinkedNotesPanel,
  LinkedTasksPanel,
  PanelToggleButton,
} from "@/components/shared/linked-items-panels";
import { TaskTimeSummary } from "@/components/time-tracking/task-time-summary";
import { TaskTimerButton } from "@/components/time-tracking/task-timer-button";
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

import { InlineFieldSelect } from "@/components/shared/inline-field-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PROJECT_STATUSES = ["Active", "Review", "Stalled", "Complete"] as const;
const PROJECT_HEADER_FIELDS = {
  researchArea: "Research area",
  scheduledFor: "Scheduled date",
  dueDate: "Due date",
  totalBudget: "Budget",
} as const;

type ProjectHeaderField = keyof typeof PROJECT_HEADER_FIELDS;

interface EditableProject {
  title: string;
  description: string;
  researchArea: string;
  status: string;
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

function HeaderStat({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
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
  visible,
  onToggleVisible,
  onAddModule,
  onLinkExisting,
  onUnlinkModule,
}: {
  modules: ApiModule[];
  visible: boolean;
  onToggleVisible: () => void;
  onAddModule: () => void;
  onLinkExisting: () => void;
  onUnlinkModule: (module: ApiModule) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle>Papers ({modules.length})</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={onLinkExisting}>
            <Link2 />
            Link existing
          </Button>
          <Button variant="outline" size="sm" onClick={onAddModule}>
            <Plus />
            Add paper
          </Button>
          <PanelToggleButton
            visible={visible}
            onToggle={onToggleVisible}
            label="papers"
            controls="project-papers-content"
          />
        </div>
      </CardHeader>
      {visible ? (
        <CardContent id="project-papers-content">
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
      ) : null}
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
  // Load every linked task and note: the panels sort them client-side and
  // preview the first three, so a single server page would miss items.
  // Includes the tasks on this project's papers, so the time summary covers
  // the whole project; the Tasks panel lists only the project's own tasks.
  const tasksQuery = useTasks(tenantId, projectId, 1, true, {
    pageSize: "all",
  });
  const allProjectTasks = tasksQuery.data?.data ?? [];
  const tasks = allProjectTasks.filter((task) => !task.moduleId);
  const notesQuery = useNotes(tenantId, projectId, 1, true, {
    projectOnly: true,
    pageSize: "all",
  });
  const notes = (notesQuery.data?.data ?? []).filter((note) => !note.moduleId);
  const membersQuery = useMembers(tenantId);
  const members = membersQuery.data?.data ?? [];
  const me = useMe();
  const updateProject = useUpdateMyProject();
  const archiveProject = useArchiveMyProject();
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const archiveImpact = useMyProjectArchiveImpact(projectId, isArchiveOpen);
  const createTask = useCreateTask(tenantId);
  const createModule = useCreateModule(tenantId);
  const updateModule = useUpdateModule(tenantId);
  const updateTask = useUpdateTask(tenantId);
  const updateNote = useUpdateNote(tenantId);
  const trackEvent = useTrackEvent(tenantId);
  const [isCollaboratorsVisible, setIsCollaboratorsVisible] = useState(true);
  const [isPapersVisible, setIsPapersVisible] = useState(true);
  const [isTasksVisible, setIsTasksVisible] = useState(true);
  const [isNotesVisible, setIsNotesVisible] = useState(true);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [isAddModuleOpen, setIsAddModuleOpen] = useState(false);
  const [isLinkModulesOpen, setIsLinkModulesOpen] = useState(false);
  const [isLinkTasksOpen, setIsLinkTasksOpen] = useState(false);
  const [isLinkNotesOpen, setIsLinkNotesOpen] = useState(false);
  const [headerDateReset, setHeaderDateReset] = useState(0);

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

  const [isHeaderSaving, setIsHeaderSaving] = useState(false);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [headerField, setHeaderField] =
    useState<ProjectHeaderField | null>(null);
  const [headerDraft, setHeaderDraft] = useState("");
  useEffect(() => {
    if (project && isEditing && form === null) {
      setForm(editableValues(project));
    }
  }, [project, isEditing, form]);

  if (workspace.isPending || projectQuery.isPending) {
    return <LoadingState title="Loading project" layout="detail" />;
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

  type ProjectHeaderUpdateInput = Parameters<
  typeof updateProject.mutateAsync
>[0]["input"];

async function saveHeaderField(input: ProjectHeaderUpdateInput) {
  if (isHeaderSaving || updateProject.isPending) return;

  setIsHeaderSaving(true);
  setHeaderError(null);

  try {
    await updateProject.mutateAsync({ projectId, input });
  } catch (error) {
    setHeaderError(
      error instanceof Error
        ? error.message
        : "The project could not be updated.",
    );

    throw error;
  } finally {
    setIsHeaderSaving(false);
  }
}

function openHeaderEditor(field: ProjectHeaderField) {
  if (!project || isHeaderSaving || updateProject.isPending) return;

  setHeaderError(null);
  setHeaderDraft(project[field] ?? "");
  setHeaderField(field);
}

async function saveHeaderText(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();

  if (
    !headerField ||
    isHeaderSaving ||
    updateProject.isPending
  ) {
    return;
  }

  const value = headerDraft.trim() || null;

  try {
    if (headerField === "researchArea") {
      await saveHeaderField({ researchArea: value });
    } else if (headerField === "totalBudget") {
      await saveHeaderField({ totalBudget: value });
    } else {
      return;
    }

    setHeaderField(null);
  } catch {
    // Keep the editor and draft open for retry.
  }
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
      projectId: input.projectId ?? undefined,
      status: input.status,
      pipelineStage: input.pipelineStage,
      dueDate: input.dueDate || undefined,
      assignedToUserId: input.assignedToUserId ?? undefined,
      currentlyWithType: input.currentlyWithType ?? undefined,
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

      {headerError && !headerField ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <span>{headerError}</span>
          <button
            type="button"
            onClick={() => setHeaderError(null)}
            className="font-medium underline"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <Dialog
        open={headerField !== null}
        onOpenChange={(open) => {
          if (!open && !isHeaderSaving) {
            setHeaderField(null);
            setHeaderError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          {headerField ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {PROJECT_HEADER_FIELDS[headerField]}
                </DialogTitle>
                <DialogDescription>
                  {headerField === "scheduledFor" || headerField === "dueDate"
                    ? "Type a date or choose one from the calendar. Changes save automatically."
                    : "Update this project detail, then save your changes."}
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={(event) => void saveHeaderText(event)}>
                <fieldset
                  disabled={isHeaderSaving || updateProject.isPending}
                  className="grid min-w-0 gap-4"
                >
                  <label
                    htmlFor={`header-project-${headerField}`}
                    className="text-sm font-medium"
                  >
                    {PROJECT_HEADER_FIELDS[headerField]}
                  </label>

                  {headerField === "scheduledFor" || headerField === "dueDate" ? (
                    <DatePickerInput
                      key={`${headerField}-${headerDateReset}`}
                      id={`header-project-${headerField}`}
                      label={PROJECT_HEADER_FIELDS[headerField]}
                      value={project[headerField] ?? ""}
                      allowTyped
                      onChange={(value) => {
                        const field = headerField;
                        const date = value || null;

                        if (date === (project[field] ?? null)) return;

                        const input =
                          field === "scheduledFor"
                            ? { scheduledFor: date }
                            : { dueDate: date };

                        void saveHeaderField(input)
                          .then(() => setHeaderField(null))
                          .catch(() => {
                            // Restore the saved date while keeping the error and picker visible.
                            setHeaderDateReset((value) => value + 1);
                          });
                      }}
                    />
                  ) : (
                    <Input
                      id={`header-project-${headerField}`}
                      type={headerField === "totalBudget" ? "number" : "text"}
                      min={headerField === "totalBudget" ? "0" : undefined}
                      step={headerField === "totalBudget" ? "0.01" : undefined}
                      value={headerDraft}
                      onChange={(event) => setHeaderDraft(event.target.value)}
                      autoFocus
                    />
                  )}

                  {headerError ? (
                    <p role="alert" className="text-sm text-destructive">
                      {headerError}
                    </p>
                  ) : null}

                  {isHeaderSaving ? (
                    <p role="status" className="text-sm text-muted-foreground">
                      Saving…
                    </p>
                  ) : null}

                  {headerField === "researchArea" ||
                  headerField === "totalBudget" ? (
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setHeaderField(null);
                          setHeaderError(null);
                        }}
                      >
                        Cancel
                      </Button>

                      <Button type="submit">
                        {isHeaderSaving ? "Saving…" : "Save"}
                      </Button>
                    </div>
                  ) : null}
                </fieldset>
              </form>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
      <ArchiveProjectDialog
        open={isArchiveOpen}
        onOpenChange={setIsArchiveOpen}
        project={project}
        impact={archiveImpact.data}
        impactPending={archiveImpact.isPending}
        onArchive={(input) => archiveProject.mutateAsync(input)}
        isPending={archiveProject.isPending}
        onArchived={() => navigate("/projects")}
      />

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
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsArchiveOpen(true)}
              disabled={archiveProject.isPending}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 />
              Delete Project
            </Button>
            {!form ? (
              <Button
              type="button"
              onClick={beginEditing}
              disabled={isHeaderSaving || updateProject.isPending}
            >
              <Pencil />
              Edit Project
            </Button>
            ) : null}
          </div>
        }
      >
        {!form ? (
          <div className="flex flex-wrap gap-2">
            <HeaderStat label="Role" value={myRole} />
            <HeaderStat
              label="Status"
              value={
                <InlineFieldSelect
                  value={project.status}
                  options={PROJECT_STATUSES}
                  fieldLabel="status"
                  itemLabel={project.title}
                  triggerClassName="h-auto w-auto gap-1 rounded-sm border-0 bg-transparent p-0 shadow-none hover:bg-transparent"
                  disabled={isHeaderSaving || updateProject.isPending}
                  onChange={(status) => saveHeaderField({ status })}
                  onError={setHeaderError}
                />
              }
            />

            <HeaderStat
              label="Research area"
              value={
                <button
                  type="button"
                  aria-label="Change research area"
                  aria-haspopup="dialog"
                  disabled={isHeaderSaving || updateProject.isPending}
                  onClick={() => openHeaderEditor("researchArea")}
                  className="inline-flex items-center gap-2 rounded-sm py-1 text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                >
                  {project.researchArea || "—"}
                  <Pencil className="h-3 w-3 shrink-0" />
                </button>
              }
            />

            <HeaderStat
              label="Scheduled"
              value={
                <button
                  type="button"
                  aria-label="Change scheduled date"
                  aria-haspopup="dialog"
                  disabled={isHeaderSaving || updateProject.isPending}
                  onClick={() => openHeaderEditor("scheduledFor")}
                  className="inline-flex items-center gap-2 rounded-sm py-1 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                >
                  {formatDate(project.scheduledFor)}
                  <Pencil className="h-3 w-3" />
                </button>
              }
            />

            <HeaderStat
              label="Due"
              value={
                <button
                  type="button"
                  aria-label="Change due date"
                  aria-haspopup="dialog"
                  disabled={isHeaderSaving || updateProject.isPending}
                  onClick={() => openHeaderEditor("dueDate")}
                  className="inline-flex items-center gap-2 rounded-sm py-1 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                >
                  {formatDate(project.dueDate)}
                  <Pencil className="h-3 w-3" />
                </button>
              }
            />

            <HeaderStat
              label="Budget"
              value={
                <button
                  type="button"
                  aria-label="Change budget"
                  aria-haspopup="dialog"
                  disabled={isHeaderSaving || updateProject.isPending}
                  onClick={() => openHeaderEditor("totalBudget")}
                  className="inline-flex items-center gap-2 rounded-sm py-1 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                >
                  {formatCurrency(project.totalBudget)}
                  <Pencil className="h-3 w-3" />
                </button>
              }
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
            <div className="mt-6 border-t pt-5">
              <h3 className="mb-1 text-sm font-semibold">
                Collaborators (optional)
              </h3>
              <p className="mb-3 text-xs text-muted-foreground">
                Add, invite or remove project collaborators. You can leave this
                section unchanged.
              </p>
              <ProjectCollaborators
                tenantId={tenantId}
                projectId={project.id}
                ownerUserId={project.userId}
                members={members}
                entityTitle={project.title}
                canManage={me.data?.id === project.userId}
              />
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          <ProjectModulesDetails
            modules={modules}
            visible={isPapersVisible}
            onToggleVisible={() => setIsPapersVisible((visible) => !visible)}
            onAddModule={() => setIsAddModuleOpen(true)}
            onLinkExisting={() => setIsLinkModulesOpen(true)}
            onUnlinkModule={(module) => void handleUnlinkModule(module)}
          />

          <LinkedTasksPanel
            tasks={tasks}
            entityLabel="project"
            contentId="project-tasks-content"
            visible={isTasksVisible}
            onToggleVisible={() => setIsTasksVisible((visible) => !visible)}
            onUnlink={(task) => void handleUnlinkTask(task)}
            summary={
              <TaskTimeSummary
                tasks={allProjectTasks}
                label="Time logged on this project and its papers against the estimates"
              />
            }
            renderTaskAction={(task) => (
              <TaskTimerButton taskId={task.id} taskTitle={task.title} />
            )}
            actions={
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsLinkTasksOpen(true)}
                >
                  <Link2 />
                  Link existing
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddTaskOpen(true)}
                >
                  <Plus />
                  Add task
                </Button>
              </>
            }
          />

          <LinkedNotesPanel
            notes={notes}
            entityLabel="project"
            contentId="project-notes-content"
            visible={isNotesVisible}
            onToggleVisible={() => setIsNotesVisible((visible) => !visible)}
            onUnlink={(note) => void handleUnlinkNote(note)}
            actions={
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsLinkNotesOpen(true)}
                >
                  <Link2 />
                  Link existing
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to={`/daily-notes?projectId=${project.id}&new=true`}>
                    <Plus />
                    Add note
                  </Link>
                </Button>
              </>
            }
          />

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
                      canManage={false}
                      showInvitations={me.data?.id === project.userId}
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
