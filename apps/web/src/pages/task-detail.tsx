import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { ChevronDown, ChevronUp, ListTodo, Pencil, Save, Trash2, Unlink, Users } from "lucide-react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { TASK_NOTE_SHARING_ENABLED } from "@/lib/feature-flags";

import {
  useCurrentWorkspace,
  useDeleteMyTask,
  useMembers,
  useModules,
  useMyTask,
  useProject,
  useProjects,
  useUpdateMyTask,
  useTrackEvent,
  type ApiModule,
  type ApiProject,
  type ApiTask,
  useAddMyTaskDescriptionEntry,
  type ApiTaskDescriptionEntry,
  useUpdateMyTaskDescriptionEntry,
  useDeleteMyTaskDescriptionEntry,
  type ApiTaskDetail,
} from "@/api/hooks";

import type { TaskFormInput } from "@/components/tasks/task-dialog";
import { TaskMembersManager } from "@/components/tasks/task-members";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const TASK_STATUSES = ["To do", "Underway", "Waiting", "Complete"];
const TASK_PRIORITIES = ["Low", "Medium", "High", "Critical"];
const VISIBILITY_OPTIONS = ["Private", "Shared"];
const LINK_TARGETS: Array<{ value: LinkTargetType; label: string }> = [
  { value: "project", label: "Project" },
  { value: "module", label: "Paper" },
  { value: "none", label: "General" },
];

function statusPillClass(status: string | null) {
  switch (status) {
    case "To do":
      return "border-border text-muted-foreground";
    case "Underway":
      return "border-orange-300 text-orange-700 dark:border-orange-800 dark:text-orange-400";
    case "Complete":
      return "border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400";
    case "Waiting":
      return "border-blue-300 text-blue-700 dark:border-blue-800 dark:text-blue-400";
    default:
      return "border-border text-muted-foreground";
  }
}

function priorityPillClass(priority: string | null) {
  switch (priority) {
    case "Low":
      return "border-border text-muted-foreground";
    case "Medium":
      return "border-blue-300 text-blue-700 dark:border-blue-800 dark:text-blue-400";
    case "High":
      return "border-orange-300 text-orange-700 dark:border-orange-800 dark:text-orange-400";
    case "Critical":
      return "border-red-300 text-red-700 dark:border-red-800 dark:text-red-400";
    default:
      return "border-border text-muted-foreground";
  }
}

function formatDueDate(iso: string | null) {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function HeaderStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/70 px-2.5 py-1 text-xs">
      <span className="font-medium text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </span>
  );
}

interface EditableDescriptionEntry {
  id: string;
  createdAt: string;
  originalContent: string;
  content: string;
}

type TaskEditForm = Omit<TaskFormInput, "description"> & {
  newEntryDate: string;
  newContent: string;
  entries: EditableDescriptionEntry[];
};

function formValues(task: ApiTaskDetail): TaskEditForm {
  return {
    title: task.title,
    linkTarget: resolveLinkTargetType(task),
    projectId: task.projectId ?? "",
    moduleId: task.moduleId ?? "",
    status: task.status ?? "To do",
    priority: task.priority ?? "Medium",
    dueDate: task.dueDate ?? "",
    estimatedHours: task.estimatedHours ?? "",
    visibility: task.visibility ?? "Private",
    newEntryDate: new Date().toISOString(),
    newContent: "",
    entries: [...(task.descriptionEntries ?? [])]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
            new Date(a.createdAt).getTime() ||
          b.id.localeCompare(a.id),
      )
      .map((entry) => ({
        id: entry.id,
        createdAt: entry.createdAt,
        originalContent: entry.content,
        content: entry.content,
      })),
  };
}
function formatEntryDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

function groupEditableDescriptionEntries(
  entries: EditableDescriptionEntry[],
) {
  const groups = new Map<
    string,
    { date: string; entries: EditableDescriptionEntry[] }
  >();

  for (const entry of entries) {
    const date = formatEntryDate(entry.createdAt);
    const group = groups.get(date);

    if (group) {
      group.entries.push(entry);
    } else {
      groups.set(date, { date, entries: [entry] });
    }
  }

  return [...groups.values()];
}

function DescriptionSectionInput({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    function resize() {
      if (!element) return;

      element.style.height = "0px";
      element.style.height = `${element.scrollHeight}px`;
    }

    resize();

    let previousWidth = element.getBoundingClientRect().width;

    const observer = new ResizeObserver(() => {
      const width = element.getBoundingClientRect().width;

      if (width !== previousWidth) {
        previousWidth = width;
        resize();
      }
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [value]);

  return (
    <Textarea
      ref={ref}
      id={id}
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      rows={1}
      className="min-h-0 resize-none overflow-hidden rounded-none border-0 bg-transparent px-0 py-1 leading-7 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
    />
  );
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
  task,
  projects,
  modules,
  linkedProjectTitle,
  linkedProjectError,
  linkedModuleTitle,
  isSaving,
  onChangeLink,
}: {
  task: ApiTask;
  projects: ApiProject[];
  modules: ApiModule[];
  linkedProjectTitle?: string;
  linkedProjectError: boolean;
  linkedModuleTitle?: string;
  isSaving: boolean;
  onChangeLink: (linkTarget: LinkTargetType, projectId: string, moduleId: string) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [linkTarget, setLinkTarget] = useState<LinkTargetType>(resolveLinkTargetType(task));
  const [projectId, setProjectId] = useState(task.projectId ?? "");
  const [moduleId, setModuleId] = useState(task.moduleId ?? "");

  function startEditing() {
    setLinkTarget(resolveLinkTargetType(task));
    setProjectId(task.projectId ?? "");
    setModuleId(task.moduleId ?? "");
    setIsEditing(true);
  }

  async function handleSave() {
    if (linkTarget === "project" && !projectId) return;
    if (linkTarget === "module" && !moduleId) return;
    await onChangeLink(linkTarget, projectId, moduleId);
    setIsEditing(false);
  }

  async function handleUnlink() {
    if (!window.confirm("Unlink this task from its project or paper? It will become a general task.")) {
      return;
    }
    await onChangeLink("none", "", "");
  }

  const hasLink = Boolean(task.projectId || task.moduleId);

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
        ) : task.moduleId ? (
          <div className="flex flex-col gap-2">
            <Link to={`/modules/${task.moduleId}`} className="block rounded-md border border-border p-4 transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Paper</span>
              <span className="mt-1 block font-semibold text-primary">{linkedModuleTitle ?? "Loading…"}</span>
            </Link>
            {task.projectId ? (
              <Link to={`/projects/${task.projectId}`} className="block rounded-md border border-border p-4 transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Parent project</span>
                <span className="mt-1 block font-semibold text-primary">
                  {linkedProjectTitle ?? (linkedProjectError ? "Unknown project" : "Loading…")}
                </span>
              </Link>
            ) : null}
          </div>
        ) : task.projectId ? (
          <Link to={`/projects/${task.projectId}`} className="block rounded-md border border-border p-4 transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Project</span>
            <span className="mt-1 block font-semibold text-primary">
              {linkedProjectTitle ?? (linkedProjectError ? "Unknown project" : "Loading…")}
            </span>
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">This is a general task with no linked project or paper.</p>
        )}
      </CardContent>
    </Card>
  );
}

function groupDescriptionEntries(entries: ApiTaskDescriptionEntry[]) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const groups = new Map<
    string,
    { date: string; entries: ApiTaskDescriptionEntry[] }
  >();

  const sorted = [...entries].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime() ||
      b.id.localeCompare(a.id),
  );

  for (const entry of sorted) {
    const date = formatter.format(new Date(entry.createdAt));
    const group = groups.get(date);

    if (group) {
      group.entries.push(entry);
    } else {
      groups.set(date, { date, entries: [entry] });
    }
  }

  return [...groups.values()];
}

export default function TaskDetailPage() {
  const { taskId = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const workspace = useCurrentWorkspace();
  const tenantId = workspace.data?.id ?? "";

  const taskQuery = useMyTask(taskId);
  const projectsQuery = useProjects(tenantId);
  const projects = projectsQuery.data?.data ?? [];
  const modulesQuery = useModules(tenantId);
  const modules = modulesQuery.data?.data ?? [];
  const updateTask = useUpdateMyTask();
  const addDescriptionEntry = useAddMyTaskDescriptionEntry();
  const updateDescriptionEntry = useUpdateMyTaskDescriptionEntry();
  const deleteDescriptionEntry = useDeleteMyTaskDescriptionEntry();
  const [isSavingChanges, setIsSavingChanges] = useState(false);
  const deleteTask = useDeleteMyTask();
  const task = taskQuery.data;
  const trackEvent = useTrackEvent(task?.tenantId ?? "");
  const linkedProjectQuery = useProject(tenantId, task?.projectId ?? "", Boolean(task?.projectId));
  const sameTenant = Boolean(task && tenantId && task.tenantId === tenantId);
  const membersQuery = useMembers(tenantId, 1, sameTenant);
  const members = membersQuery.data?.data ?? [];
  const [form, setForm] = useState<TaskEditForm | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [headerField, setHeaderField] =
  useState<"dueDate" | "estimatedHours" | null>(null);
  const [isHeaderSaving, setIsHeaderSaving] = useState(false);
  const [hoursDraft, setHoursDraft] = useState("");
  const [headerDateReset, setHeaderDateReset] = useState(0);
  const [openedRequestedEdit, setOpenedRequestedEdit] = useState(false);
  const [isLinkedWorkVisible, setIsLinkedWorkVisible] = useState(true);
  const [isCollaboratorsVisible, setIsCollaboratorsVisible] = useState(true);

  useEffect(() => {
    if (!openedRequestedEdit && searchParams.get("edit") === "true" && task) {
      setForm(formValues(task));
      setOpenedRequestedEdit(true);
    }
  }, [openedRequestedEdit, searchParams, task]);

  if (workspace.isPending || taskQuery.isPending) {
    return <LoadingState title="Loading task" className="min-h-[50vh]" />;
  }

  if (taskQuery.isError) {
    return (
      <ErrorState
        title="Task could not be loaded"
        description={taskQuery.error.message}
        onRetry={() => void taskQuery.refetch()}
      />
    );
  }

  if (!task) {
    return (
      <EmptyState
        title="Task not found"
        description="This task doesn't exist, or you don't have access to it."
        action={
          <Button asChild variant="outline">
            <Link to="/tasks">Back to Tasks</Link>
          </Button>
        }
      />
    );
  }

  async function saveTaskHeader(
    input: {
      dueDate?: string | null;
      estimatedHours?: string | null;
    },
  ) {
    if (isSaving) return;

    setIsHeaderSaving(true);
    setActionError(null);

    try {
      await updateTask.mutateAsync({ taskId, input });
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "The task could not be updated.",
      );

      throw error;
    } finally {
      setIsHeaderSaving(false);
    }
  }

  async function saveHeaderHours(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSaving || headerField !== "estimatedHours") return;

    try {
      await saveTaskHeader({
        estimatedHours: hoursDraft.trim() || null,
      });

      setHeaderField(null);
    } catch {
      // Keep the draft and error visible for retry.
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form || isSavingChanges) return;

    const updates = form.entries.filter(
      (entry) =>
        entry.content.trim() !== "" &&
        entry.content.trim() !== entry.originalContent.trim(),
    );

    const deletions = form.entries.filter(
      (entry) => entry.content.trim() === "",
    );

    const addition = form.newContent.trim();

    setIsSavingChanges(true);
    setActionError(null);

    try {
      await updateTask.mutateAsync({
        taskId,
        input: {
          title: form.title.trim(),
          status: form.status,
          priority: form.priority,
          visibility: form.visibility,
          estimatedHours: form.estimatedHours || undefined,
          dueDate: form.dueDate || undefined,
        },
      });

      if (form.status === "Complete" && task?.status !== "Complete") {
        trackEvent({ name: "task_completed" });
      }

      for (const entry of updates) {
        const content = entry.content.trim();

        await updateDescriptionEntry.mutateAsync({
          taskId,
          entryId: entry.id,
          content,
        });

        // Remember completed writes if a later request fails.
        setForm((current) =>
          current
            ? {
                ...current,
                entries: current.entries.map((item) =>
                  item.id === entry.id
                    ? {
                        ...item,
                        content,
                        originalContent: content,
                      }
                    : item,
                ),
              }
            : current,
        );
      }

      for (const entry of deletions) {
        await deleteDescriptionEntry.mutateAsync({
          taskId,
          entryId: entry.id,
        });

        setForm((current) =>
          current
            ? {
                ...current,
                entries: current.entries.filter(
                  (item) => item.id !== entry.id,
                ),
              }
            : current,
        );
      }

      if (addition) {
        await addDescriptionEntry.mutateAsync({
          taskId,
          content: addition,
        });
      }

      setForm(null);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "The task could not be saved.",
      );
    } finally {
      setIsSavingChanges(false);
    }
  }

  async function handleChangeLink(linkTarget: LinkTargetType, newProjectId: string, newModuleId: string) {
    const input =
      linkTarget === "project"
        ? { projectId: newProjectId, moduleId: null }
        : linkTarget === "module"
          ? { moduleId: newModuleId, projectId: null }
          : { projectId: null, moduleId: null };
    await updateTask.mutateAsync({ taskId, input });
  }

  async function handleDeleteTask() {
    if (!task) return;
    if (!window.confirm(`Delete "${task.title}"? This action cannot be undone.`)) {
      return;
    }
    setActionError(null);
    try {
      await deleteTask.mutateAsync(taskId);
      navigate("/tasks");
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "The task could not be deleted.",
      );
    }
  }

  function cancelEditing() {
    setForm(null);
    if (searchParams.get("edit") === "true") {
      if (location.key === "default") {
        navigate(`/tasks/${taskId}`, { replace: true });
      } else {
        navigate(-1);
      }
    }
  }

  const linkedModule = task.moduleId
    ? (modules).find((module) => module.id === task.moduleId)
    : undefined;

  const descriptionGroups = groupDescriptionEntries(
      task.descriptionEntries ?? [],
    );
    const isSaving =
      isHeaderSaving ||
      isSavingChanges ||
      updateTask.isPending ||
      addDescriptionEntry.isPending ||
      updateDescriptionEntry.isPending ||
      deleteDescriptionEntry.isPending;

  const modifiedAt = (task.descriptionEntries ?? []).reduce(
    (latest: string | null, entry) => {
      const timestamp = entry.updatedAt ?? entry.createdAt;

      return !latest ||
        new Date(timestamp).getTime() > new Date(latest).getTime()
        ? timestamp
        : latest;
    },
    null,
  );

  const editorGroups = groupEditableDescriptionEntries(
    form?.entries ?? [],
  );

  const hasTodayEntry = Boolean(
    form &&
      editorGroups.some(
        (group) => group.date === formatEntryDate(form.newEntryDate),
      ),
  );

  return (
    <div className="page-stack">
      <BackButton fallback="/tasks" label="Back" />
      <Dialog
        open={headerField !== null}
        onOpenChange={(open) => {
          if (!open && !isSaving) {
            setHeaderField(null);
            setActionError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {headerField === "dueDate" ? "Due date" : "Estimated hours"}
            </DialogTitle>
            <DialogDescription>
              {headerField === "dueDate"
                ? "Type a date or choose one from the calendar. Changes save automatically."
                : "Update the estimated hours, then save your changes."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(event) => void saveHeaderHours(event)}>
            <fieldset
              disabled={isSaving}
              className="grid min-w-0 gap-4"
            >
              {headerField === "dueDate" ? (
                <>
                  <label
                    htmlFor="header-task-due"
                    className="text-sm font-medium"
                  >
                    Due date
                  </label>

                  <DatePickerInput
                    key={headerDateReset}
                    id="header-task-due"
                    label="Due date"
                    value={task.dueDate ?? ""}
                    allowTyped
                    onChange={(value) => {
                      const dueDate = value || null;

                      if (dueDate === (task.dueDate ?? null)) return;

                      void saveTaskHeader({ dueDate })
                        .then(() => setHeaderField(null))
                        .catch(() => {
                          setHeaderDateReset((value) => value + 1);
                        });
                    }}
                  />
                </>
              ) : headerField === "estimatedHours" ? (
                <>
                  <label
                    htmlFor="header-task-hours"
                    className="text-sm font-medium"
                  >
                    Estimated hours
                  </label>

                  <Input
                    id="header-task-hours"
                    type="number"
                    min="0"
                    step="0.5"
                    value={hoursDraft}
                    onChange={(event) => setHoursDraft(event.target.value)}
                    autoFocus
                  />
                </>
              ) : null}

              {actionError ? (
                <p role="alert" className="text-sm text-destructive">
                  {actionError}
                </p>
              ) : null}

              {isHeaderSaving ? (
                <p role="status" className="text-sm text-muted-foreground">
                  Saving…
                </p>
              ) : null}

              {headerField === "estimatedHours" ? (
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setHeaderField(null);
                      setActionError(null);
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
        </DialogContent>
      </Dialog>

      {actionError && !headerField ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <span>{actionError}</span>
          <button
            type="button"
            className="font-medium underline"
            onClick={() => setActionError(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <PageHeading
        tone="amber"
        icon={ListTodo}
        eyebrow={task.displayId ?? task.id}
        title={task.title}
        description="Review and update the task's status, priority and progress."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" className={statusPillClass(task.status)}>
              {task.status ?? "—"}
            </Badge>
            <Badge variant="outline" className={priorityPillClass(task.priority)}>
              {task.priority ?? "—"}
            </Badge>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleDeleteTask()}
              disabled={deleteTask.isPending}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 /> Delete Task
            </Button>
            {!form ? (
              <Button
                type="button"
                onClick={() => setForm(formValues(task))}
                disabled={isSaving}
              >
                <Pencil />
                Edit Task
              </Button>
            ) : null}
          </div>
        }
      >
        {!form ? (
          <div className="flex flex-wrap gap-2">
            <HeaderStat
              label="Modified"
              value={
                modifiedAt
                  ? new Date(modifiedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "—"
              }
            />
            <HeaderStat
              label="Due date"
              value={
                <button
                  type="button"
                  aria-label="Change task due date"
                  aria-haspopup="dialog"
                  disabled={isSaving}
                  onClick={() => {
                    setActionError(null);
                    setHeaderField("dueDate");
                  }}
                  className="inline-flex items-center gap-2 rounded-sm py-1 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                >
                  {formatDueDate(task.dueDate)}
                  <Pencil className="h-3 w-3" />
                </button>
              }
            />

            <HeaderStat
              label="Estimated hours"
              value={
                <button
                  type="button"
                  aria-label="Change estimated hours"
                  aria-haspopup="dialog"
                  disabled={isSaving}
                  onClick={() => {
                    setActionError(null);
                    setHoursDraft(task.estimatedHours ?? "");
                    setHeaderField("estimatedHours");
                  }}
                  className="inline-flex items-center gap-2 rounded-sm py-1 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                >
                  {task.estimatedHours ? `${task.estimatedHours}h` : "—"}
                  <Pencil className="h-3 w-3" />
                </button>
              }
            />
            {TASK_NOTE_SHARING_ENABLED ? (
              <HeaderStat label="Visibility" value={task.visibility ?? "Private"} />
            ) : null}
            {task.workingWith ? (
              <HeaderStat label="Working with" value={task.workingWith} />
            ) : null}
          </div>
        ) : null}
      </PageHeading>
      {!form ? (
      <section aria-labelledby="task-description-heading">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/60 bg-muted/20">
            <CardTitle
              id="task-description-heading"
              className="text-base"
            >
              Description
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 sm:p-6">
            {descriptionGroups.length > 0 ? (
              <div className="space-y-6">
                {descriptionGroups.map((group) => (
                  <div key={group.date} className="space-y-2">
                    <time
                      dateTime={group.date.split("/").reverse().join("-")}
                      className="block text-xs font-medium text-muted-foreground"
                    >
                      {group.date}
                    </time>
                    <div className="space-y-3">
                      {group.entries.map((entry) => (
                        <p
                          key={entry.id}
                          className="whitespace-pre-wrap text-sm leading-7 text-foreground [overflow-wrap:anywhere]"
                        >
                          {entry.content}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No description added yet.
              </p>
            )}
          </CardContent>
        </Card>
      </section>
      ) : null}

      {form ? (
        <Card>
          <CardHeader><CardTitle>Edit task details</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={(event) => void handleSave(event)} className="grid gap-6">
            <fieldset disabled={isSaving} className="grid min-w-0 gap-6">
              <div className="grid gap-5 sm:grid-cols-2">
                <FormField label="Task title" htmlFor="edit-task-title" className="sm:col-span-2">
                  <Input id="edit-task-title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required autoFocus />
                </FormField>
                <FormField
                  label="Description"
                  htmlFor="edit-task-description"
                  className="sm:col-span-2"
                >
                  <div
                    role="group"
                    aria-label="Dated task description"
                    className="h-[400px] min-h-[240px] resize-y overflow-auto rounded-md border border-input bg-card px-4 py-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/15"
                  >
                    {!hasTodayEntry ? (
                      <section aria-label="New description content">
                        <time
                          dateTime={form.newEntryDate}
                          className="block select-none text-xs font-medium text-muted-foreground"
                        >
                          {formatEntryDate(form.newEntryDate)}
                        </time>

                        <DescriptionSectionInput
                          id="edit-task-description"
                          label="New description content"
                          value={form.newContent}
                          placeholder="Write the task description…"
                          onChange={(newContent) =>
                            setForm((current) =>
                              current ? { ...current, newContent } : current,
                            )
                          }
                        />
                      </section>
                    ) : null}

                    {editorGroups.map((group, groupIndex) => (
                      <section
                        key={group.date}
                        aria-label={`Entry dated ${group.date}`}
                        className={
                          !hasTodayEntry || groupIndex > 0
                            ? "mt-2 border-t border-dashed border-border pt-2"
                            : ""
                        }
                      >
                        <time
                          dateTime={group.entries[0].createdAt}
                          className="block select-none text-xs font-medium text-muted-foreground"
                        >
                          {group.date}
                        </time>

                        {group.entries.map((entry, entryIndex) => (
                          <DescriptionSectionInput
                            key={entry.id}
                            id={
                              hasTodayEntry && groupIndex === 0 && entryIndex === 0
                                ? "edit-task-description"
                                : undefined
                            }
                            label={`Description content from ${group.date}`}
                            value={entry.content}
                            onChange={(content) =>
                              setForm((current) =>
                                current
                                  ? {
                                      ...current,
                                      entries: current.entries.map((item) =>
                                        item.id === entry.id
                                          ? { ...item, content }
                                          : item,
                                      ),
                                    }
                                  : current,
                              )
                            }
                          />
                        ))}
                      </section>
                    ))}
                  </div>
                </FormField>
                <FormField label="Link to" htmlFor="edit-task-link" className="sm:col-span-2">
                  <div id="edit-task-link" className="flex flex-wrap gap-2">{LINK_TARGETS.map((option) => <button key={option.value} type="button" aria-pressed={form.linkTarget === option.value}
                    onClick={() => setForm({ ...form, linkTarget: option.value, projectId: option.value === "project" ? form.projectId : "", moduleId: option.value === "module" ? form.moduleId : "" })}
                    className={form.linkTarget === option.value ? "rounded-full border border-primary bg-primary px-3 py-1 text-xs font-medium text-primary-foreground" : "rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground"}>{option.label}</button>)}</div>
                </FormField>
                {form.linkTarget === "project" ? <FormField label="Project" htmlFor="edit-task-project"><Select value={form.projectId} onValueChange={(value) => setForm({ ...form, projectId: value })}><SelectTrigger id="edit-task-project"><SelectValue placeholder="Select a project" /></SelectTrigger><SelectContent>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.title}</SelectItem>)}</SelectContent></Select></FormField> : null}
                {form.linkTarget === "module" ? <FormField label="Paper" htmlFor="edit-task-module"><Select value={form.moduleId} onValueChange={(value) => setForm({ ...form, moduleId: value })}><SelectTrigger id="edit-task-module"><SelectValue placeholder="Select a paper" /></SelectTrigger><SelectContent>{(modules).map((module) => <SelectItem key={module.id} value={module.id}>{paperDisplayTitle(module)}</SelectItem>)}</SelectContent></Select></FormField> : null}
                <FormField label="Status" htmlFor="edit-task-status"><Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}><SelectTrigger id="edit-task-status"><SelectValue /></SelectTrigger><SelectContent>{TASK_STATUSES.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></FormField>
                <FormField label="Priority" htmlFor="edit-task-priority"><Select value={form.priority} onValueChange={(value) => setForm({ ...form, priority: value })}><SelectTrigger id="edit-task-priority"><SelectValue /></SelectTrigger><SelectContent>{TASK_PRIORITIES.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></FormField>
                <FormField label="Due date" htmlFor="edit-task-due"><DatePickerInput id="edit-task-due" label="Due date" value={form.dueDate} onChange={(value) => setForm({ ...form, dueDate: value })} /></FormField>
                <FormField label="Estimated hours" htmlFor="edit-task-hours"><Input id="edit-task-hours" type="number" min="0" step="0.5" value={form.estimatedHours} onChange={(event) => setForm({ ...form, estimatedHours: event.target.value })} /></FormField>
                {TASK_NOTE_SHARING_ENABLED ? (
                  <FormField label="Visibility" htmlFor="edit-task-visibility">
                    <Select
                      value={form.visibility}
                      onValueChange={(value) => setForm({ ...form, visibility: value })}
                    >
                      <SelectTrigger id="edit-task-visibility">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VISIBILITY_OPTIONS.map((value) => (
                          <SelectItem key={value} value={value}>
                            {value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                ) : null}
              </div>
              {updateTask.isError ? (
                <p role="alert" className="text-sm text-destructive">
                  {updateTask.error.message}
                </p>
              ) : null}
              {addDescriptionEntry.isError ? (
                <p role="alert" className="text-sm text-destructive">
                  {addDescriptionEntry.error.message}
                </p>
              ) : null}
              <div className="flex justify-end gap-3 border-t pt-5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={cancelEditing}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  <Save />
                  {isSaving ? "Saving…" : "Save Changes"}
                </Button>
              </div>
              </fieldset>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-6">
        <section aria-labelledby="task-linked-work-heading">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="task-linked-work-heading" className="text-lg font-semibold">Linked work</h2>
            <Button variant="outline" size="sm" aria-expanded={isLinkedWorkVisible} aria-controls="task-linked-work-content" onClick={() => setIsLinkedWorkVisible((visible) => !visible)}>
              {isLinkedWorkVisible ? <ChevronUp /> : <ChevronDown />}
              {isLinkedWorkVisible ? "Hide linked work" : "Show linked work"}
            </Button>
          </div>
          {isLinkedWorkVisible ? (
            <div id="task-linked-work-content">
              <LinkedWorkCard
                task={task}
                projects={projects}
                modules={modules}
                linkedProjectTitle={linkedProjectQuery.data?.title}
                linkedProjectError={linkedProjectQuery.isError}
                linkedModuleTitle={linkedModule ? paperDisplayTitle(linkedModule) : undefined}
                onChangeLink={handleChangeLink}
                isSaving={isSaving}
              />
            </div>
          ) : null}
        </section>
        {TASK_NOTE_SHARING_ENABLED ? (
        <section aria-labelledby="task-collaborators-heading">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="task-collaborators-heading" className="text-lg font-semibold">Collaborators</h2>
            <Button variant="outline" size="sm" aria-expanded={isCollaboratorsVisible} aria-controls="task-collaborators-content" onClick={() => setIsCollaboratorsVisible((visible) => !visible)}>
              {isCollaboratorsVisible ? <ChevronUp /> : <ChevronDown />}
              {isCollaboratorsVisible ? "Hide collaborators" : "Show collaborators"}
            </Button>
          </div>
          {isCollaboratorsVisible ? (
            <Card id="task-collaborators-content">
              <CardHeader>
                <CardTitle>Task collaborators</CardTitle>
              </CardHeader>
              <CardContent>
                {!tenantId ? (
                  <EmptyState
                    icon={Users}
                    title="No workspace selected"
                    description="Select a workspace to manage collaborators."
                    className="min-h-40 border-0 bg-muted/30"
                  />
                ) : task.visibility === "Shared" && sameTenant ? (
                  <TaskMembersManager
                    tenantId={tenantId}
                    taskId={task.id}
                    taskTitle={task.title}
                    ownerUserId={task.createdBy}
                    members={members}
                  />
                ) : task.visibility === "Shared" ? (
                  <p className="text-sm text-muted-foreground">
                    This task was shared with you from another workspace. Only members of that
                    workspace can manage who has access.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    This task is private — only you can see it. Switch its visibility to Shared to
                    add collaborators.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : null}
        </section>
        ) : null}
      </div>
    </div>
  );
}
