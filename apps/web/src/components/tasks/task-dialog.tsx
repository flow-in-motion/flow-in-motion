import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Search, X } from "lucide-react";

import {
  useModule,
  useModules,
  type ApiModule,
  type ApiProject,
  type ApiTask,
} from "@/api/hooks";
import { Button } from "@/components/ui/button";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Textarea } from "@/components/ui/textarea";
import { resolveLinkTargetType, type LinkTargetType } from "@/lib/link-target";
import { paperDisplayTitle } from "@/lib/paper-title";
import { cn } from "@/lib/utils";

const TASK_STATUSES = ["To do", "Underway", "Waiting", "Complete"] as const;
const TASK_PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;
const VISIBILITY_OPTIONS = ["Private", "Shared"] as const;
const LINK_TARGET_OPTIONS: { value: LinkTargetType; label: string }[] = [
  { value: "project", label: "Project" },
  { value: "module", label: "Paper" },
  { value: "none", label: "General" },
];

export interface TaskFormInput {
  title: string;
  description: string;
  linkTarget: LinkTargetType;
  projectId: string;
  moduleId: string;
  status: string;
  priority: string;
  dueDate: string;
  estimatedHours: string;
  visibility: string;
}

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  projects: ApiProject[];
  modules: ApiModule[];
  task?: ApiTask | null;
  /** Pre-links a new task to this project when the dialog is opened for creation. */
  initialProjectId?: string;
  /** Pre-links a new task to this module when the dialog is opened for creation. */
  initialModuleId?: string;
  onSave: (input: TaskFormInput) => Promise<void> | void;
}

const INITIAL_FORM: TaskFormInput = {
  title: "",
  description: "",
  linkTarget: "none",
  projectId: "",
  moduleId: "",
  status: "To do",
  priority: "Medium",
  dueDate: "",
  estimatedHours: "",
  visibility: "Private",
};

function formFromTask(task: ApiTask): TaskFormInput {
  return {
    title: task.title,
    description: task.description ?? "",
    linkTarget: resolveLinkTargetType(task),
    projectId: task.projectId ?? "",
    moduleId: task.moduleId ?? "",
    status: task.status ?? "To do",
    priority: task.priority ?? "Medium",
    dueDate: task.dueDate ?? "",
    estimatedHours: task.estimatedHours ?? "",
    visibility: task.visibility ?? "Private",
  };
}

function FormField({ label, htmlFor, required, children }: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {required ? <span className="ml-1 text-destructive">*</span> : null}
      </label>
      {children}
    </div>
  );
}

function linkTargetPillClass(selected: boolean) {
  return cn(
    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
    selected
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
  );
}

function TaskPaperSearch({
  tenantId,
  modules,
  moduleId,
  onChange,
}: {
  tenantId: string;
  modules: ApiModule[];
  moduleId: string;
  onChange: (moduleId: string) => void;
}) {
  const [paperSearch, setPaperSearch] = useState("");
  const [paperRequestSearch, setPaperRequestSearch] = useState("");
  const [paperPickerOpen, setPaperPickerOpen] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState<ApiModule | null>(null);
  const suppliedLinkedPaper = modules.find((module) => module.id === moduleId);
  const selectedLinkedPaper = selectedPaper?.id === moduleId ? selectedPaper : undefined;
  const linkedPaperQuery = useModule(
    tenantId,
    moduleId,
    Boolean(moduleId) && !suppliedLinkedPaper && !selectedLinkedPaper,
  );
  const linkedPaper = selectedLinkedPaper ?? suppliedLinkedPaper ?? linkedPaperQuery.data;
  const selectedPaperLabel = linkedPaper ? paperDisplayTitle(linkedPaper) : "";
  const normalizedPaperSearch = paperSearch.trim();
  const paperSearchQuery = useModules(
    tenantId,
    undefined,
    1,
    paperPickerOpen && paperRequestSearch.length > 0,
    { pageSize: "all", search: paperRequestSearch },
  );
  const paperResults = paperSearchQuery.data?.data ?? [];
  const isWaitingForPaperSearch =
    normalizedPaperSearch !== paperRequestSearch || paperSearchQuery.isFetching;

  useEffect(() => {
    if (!paperPickerOpen || !normalizedPaperSearch) {
      setPaperRequestSearch("");
      return;
    }
    const timer = window.setTimeout(
      () => setPaperRequestSearch(normalizedPaperSearch),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [normalizedPaperSearch, paperPickerOpen]);

  function selectPaper(module: ApiModule) {
    setSelectedPaper(module);
    onChange(module.id);
    setPaperSearch("");
    setPaperPickerOpen(false);
  }

  return (
    <FormField label="Paper" htmlFor="task-module" required>
      <div
        className="relative"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setPaperPickerOpen(false);
          }
        }}
      >
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          id="task-module"
          role="combobox"
          aria-expanded={paperPickerOpen}
          aria-controls="task-paper-results"
          aria-autocomplete="list"
          value={paperPickerOpen ? paperSearch : selectedPaperLabel}
          onFocus={() => {
            setPaperSearch("");
            setPaperPickerOpen(true);
          }}
          onChange={(event) => {
            setPaperSearch(event.target.value);
            setSelectedPaper(null);
            onChange("");
          }}
          placeholder="Search all papers…"
          autoComplete="off"
          className="pl-9 pr-8"
        />
        {!paperPickerOpen && moduleId ? (
          <button
            type="button"
            onClick={() => {
              onChange("");
              setSelectedPaper(null);
              setPaperSearch("");
            }}
            aria-label="Clear selected paper"
            className="absolute right-1 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
        {paperPickerOpen ? (
          <div
            id="task-paper-results"
            role="listbox"
            aria-label="Paper search results"
            className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg"
          >
            {!normalizedPaperSearch ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                Type to search all papers.
              </p>
            ) : isWaitingForPaperSearch ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                Searching all papers…
              </p>
            ) : paperResults.length ? (
              paperResults.map((module) => (
                <button
                  key={module.id}
                  type="button"
                  role="option"
                  aria-selected={moduleId === module.id}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectPaper(module)}
                  className="flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left hover:bg-accent focus:bg-accent focus:outline-none"
                >
                  <span className="text-sm font-medium">
                    {paperDisplayTitle(module)}
                  </span>
                  {module.displayId ? (
                    <span className="text-xs text-muted-foreground">
                      {module.displayId}
                    </span>
                  ) : null}
                </button>
              ))
            ) : (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                No papers found.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </FormField>
  );
}

export function TaskDialog({
  open,
  onOpenChange,
  tenantId,
  projects,
  modules,
  task,
  initialProjectId,
  initialModuleId,
  onSave,
}: TaskDialogProps) {
  const [form, setForm] = useState<TaskFormInput>(INITIAL_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const isEditing = Boolean(task);

  useEffect(() => {
    if (!open) return;
    if (task) {
      setForm(formFromTask(task));
    } else if (initialModuleId) {
      setForm({ ...INITIAL_FORM, linkTarget: "module", moduleId: initialModuleId });
    } else if (initialProjectId) {
      setForm({ ...INITIAL_FORM, linkTarget: "project", projectId: initialProjectId });
    } else {
      setForm(INITIAL_FORM);
    }
    setSaveError(null);
  }, [open, task, initialProjectId, initialModuleId]);

  function setLinkTarget(linkTarget: LinkTargetType) {
    setForm((prev) => ({
      ...prev,
      linkTarget,
      projectId: linkTarget === "project" ? prev.projectId : "",
      moduleId: linkTarget === "module" ? prev.moduleId : "",
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (form.linkTarget === "project" && !form.projectId) return;
    if (form.linkTarget === "module" && !form.moduleId) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave({
        ...form,
        title: form.title.trim(),
        description: form.description.trim(),
      });
      onOpenChange(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "The task could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit task" : "Create a new task"}</DialogTitle>
          <DialogDescription>
            Link this task to a project or paper, or keep it general, then set its priority and
            visibility.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void handleSubmit(event)} className="grid gap-5">
          <FormField label="Task title" htmlFor="task-title" required>
            <Input
              id="task-title"
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="What needs to be done?"
              autoFocus
              required
            />
          </FormField>

          <FormField label="Description" htmlFor="task-description">
            <Textarea
              id="task-description"
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, description: event.target.value }))
              }
              placeholder="Add a short description of the work"
              rows={3}
            />
          </FormField>

          <FormField label="Link to" htmlFor="task-link-target">
            <div className="flex flex-wrap gap-2" id="task-link-target">
              {LINK_TARGET_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setLinkTarget(option.value)}
                  aria-pressed={form.linkTarget === option.value}
                  className={linkTargetPillClass(form.linkTarget === option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </FormField>

          {form.linkTarget === "project" ? (
            <FormField label="Project" htmlFor="task-project" required>
              <Select
                value={form.projectId}
                onValueChange={(value) => setForm((prev) => ({ ...prev, projectId: value }))}
                required
              >
                <SelectTrigger id="task-project"><SelectValue placeholder="Select a project" /></SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>{project.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          ) : null}

          {form.linkTarget === "module" ? (
            <TaskPaperSearch
              tenantId={tenantId}
              modules={modules}
              moduleId={form.moduleId}
              onChange={(moduleId) => setForm((prev) => ({ ...prev, moduleId }))}
            />
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Status" htmlFor="task-status">
              <Select
                value={form.status}
                onValueChange={(value) => setForm((prev) => ({ ...prev, status: value }))}
              >
                <SelectTrigger id="task-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Priority" htmlFor="task-priority">
              <Select
                value={form.priority}
                onValueChange={(value) => setForm((prev) => ({ ...prev, priority: value }))}
              >
                <SelectTrigger id="task-priority"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((priority) => (
                    <SelectItem key={priority} value={priority}>{priority}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Due date" htmlFor="task-due-date">
              <DatePickerInput
                id="task-due-date"
                label="Due date"
                value={form.dueDate}
                onChange={(value) => setForm((prev) => ({ ...prev, dueDate: value }))}
              />
            </FormField>

            <FormField label="Estimated hours" htmlFor="task-hours">
              <Input
                id="task-hours"
                type="number"
                min="0"
                step="0.5"
                value={form.estimatedHours}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, estimatedHours: event.target.value }))
                }
              />
            </FormField>

            <FormField label="Visibility" htmlFor="task-visibility">
              <Select
                value={form.visibility}
                onValueChange={(value) => setForm((prev) => ({ ...prev, visibility: value }))}
              >
                <SelectTrigger id="task-visibility"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VISIBILITY_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          {form.visibility === "Shared" && !isEditing ? (
            <p className="rounded-lg border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
              After creating the task, open it to invite collaborators by email using a secure
              acceptance link.
            </p>
          ) : null}

          {saveError ? (
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {saveError}
            </p>
          ) : null}

          <DialogFooter className="border-t pt-4">
            <DialogClose asChild><Button type="button" variant="outline" disabled={isSaving}>Cancel</Button></DialogClose>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving…" : isEditing ? "Save Changes" : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
