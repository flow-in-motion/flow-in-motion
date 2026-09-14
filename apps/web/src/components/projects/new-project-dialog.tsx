import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import {
  useModules,
  useNotes,
  useTasks,
  useUpdateModule,
  useUpdateNote,
  useUpdateTask,
  type ApiProject,
} from "@/api/hooks";
import {
  LinkExistingField,
  type LinkExistingOption,
} from "@/components/shared/link-existing-field";
import { paperDisplayTitle } from "@/lib/paper-title";
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

export interface NewProjectInput {
  title: string;
  description: string;
  researchArea: string;
  status: string;
  priority: string;
  scheduledFor: string;
  dueDate: string;
  totalBudget: string;
  targetJournals: string;
}

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  onCreate: (project: NewProjectInput) => Promise<ApiProject>;
}

const INITIAL_FORM: NewProjectInput = {
  title: "",
  description: "",
  researchArea: "",
  status: "Active",
  priority: "Medium",
  scheduledFor: "",
  dueDate: "",
  totalBudget: "",
  targetJournals: "",
};

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

export function NewProjectDialog({
  open,
  onOpenChange,
  tenantId,
  onCreate,
}: NewProjectDialogProps) {
  const [form, setForm] = useState<NewProjectInput>(INITIAL_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [linkedModules, setLinkedModules] = useState<LinkExistingOption[]>([]);
  const [linkedTasks, setLinkedTasks] = useState<LinkExistingOption[]>([]);
  const [linkedNotes, setLinkedNotes] = useState<LinkExistingOption[]>([]);

  const modulesQuery = useModules(tenantId, undefined, 1, open);
  const tasksQuery = useTasks(tenantId, undefined, 1, open);
  const notesQuery = useNotes(tenantId, undefined, 1, open);
  const updateModule = useUpdateModule(tenantId);
  const updateTask = useUpdateTask(tenantId);
  const updateNote = useUpdateNote(tenantId);

  useEffect(() => {
    if (!open) return;
    setLinkedModules([]);
    setLinkedTasks([]);
    setLinkedNotes([]);
  }, [open]);

  const moduleOptions = (modulesQuery.data?.data ?? []).map((module) => ({
    id: module.id,
    label: paperDisplayTitle(module),
    sublabel: module.projectId ? "Linked to another project" : "Unlinked",
  }));
  const taskOptions = (tasksQuery.data?.data ?? []).map((task) => ({
    id: task.id,
    label: task.title,
    sublabel: task.moduleId
      ? "Linked to a paper"
      : task.projectId
        ? "Linked to another project"
        : "Unlinked",
  }));
  const noteOptions = (notesQuery.data?.data ?? []).map((note) => ({
    id: note.id,
    label: note.title,
    sublabel: note.moduleId
      ? "Linked to a paper"
      : note.projectId
        ? "Linked to another project"
        : "Unlinked",
  }));

  function resetForm() {
    setForm(INITIAL_FORM);
    setSaveError(null);
    setLinkedModules([]);
    setLinkedTasks([]);
    setLinkedNotes([]);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setSaveError(null);
    try {
      const project = await onCreate({
        ...form,
        title: form.title.trim(),
        description: form.description.trim(),
        researchArea: form.researchArea.trim(),
        targetJournals: form.targetJournals.trim(),
      });
      await Promise.all([
        ...linkedModules.map((module) =>
          updateModule.mutateAsync({
            moduleId: module.id,
            input: { projectId: project.id },
          }),
        ),
        ...linkedTasks.map((task) =>
          updateTask.mutateAsync({
            taskId: task.id,
            input: { projectId: project.id },
          }),
        ),
        ...linkedNotes.map((note) =>
          updateNote.mutateAsync({
            noteId: note.id,
            input: { projectId: project.id },
          }),
        ),
      ]);
      resetForm();
      onOpenChange(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "The project could not be created.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Create a new project</DialogTitle>
          <DialogDescription>
            Add the core project details now. You'll automatically be the owner.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void handleSubmit(event)} className="grid gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormField label="Project title" htmlFor="project-title" required>
                <Input
                  id="project-title"
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="e.g. Genome sequencing validation"
                  autoFocus
                  required
                />
              </FormField>
            </div>

            <div className="sm:col-span-2">
              <FormField label="Description" htmlFor="project-description">
                <Textarea
                  id="project-description"
                  value={form.description}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  placeholder="Add a short description of the project"
                  rows={3}
                />
              </FormField>
            </div>

            <FormField label="Research area" htmlFor="project-research-area">
              <Input
                id="project-research-area"
                value={form.researchArea}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, researchArea: event.target.value }))
                }
                placeholder="e.g. Structural biology"
              />
            </FormField>

            <FormField label="Importance" htmlFor="project-priority">
              <Select
                value={form.priority}
                onValueChange={(value) => setForm((prev) => ({ ...prev, priority: value }))}
              >
                <SelectTrigger id="project-priority"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROJECT_PRIORITIES.map((priority) => (
                    <SelectItem key={priority} value={priority}>{priority}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Status" htmlFor="project-status">
              <Select
                value={form.status}
                onValueChange={(value) => setForm((prev) => ({ ...prev, status: value }))}
              >
                <SelectTrigger id="project-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Scheduled for" htmlFor="project-scheduled-for">
              <DatePickerInput
                id="project-scheduled-for"
                label="Scheduled for date"
                value={form.scheduledFor}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, scheduledFor: value }))
                }
              />
            </FormField>

            <FormField label="Due date" htmlFor="project-due-date">
              <DatePickerInput
                id="project-due-date"
                label="Due date"
                value={form.dueDate}
                onChange={(value) => setForm((prev) => ({ ...prev, dueDate: value }))}
              />
            </FormField>

            <FormField label="Budget" htmlFor="project-budget">
              <Input
                id="project-budget"
                type="number"
                min="0"
                step="100"
                value={form.totalBudget}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, totalBudget: event.target.value }))
                }
              />
            </FormField>

            <div className="sm:col-span-2">
              <FormField label="Target journal(s) or output" htmlFor="project-journal">
                <Input
                  id="project-journal"
                  value={form.targetJournals}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, targetJournals: event.target.value }))
                  }
                  placeholder="e.g. Nature Communications"
                />
              </FormField>
            </div>
          </div>

          <div className="grid gap-4 rounded-lg border p-4">
            <p className="text-sm font-medium">Link existing work (optional)</p>
            <FormField label="Papers" htmlFor="new-project-link-papers">
              <LinkExistingField
                id="new-project-link-papers"
                placeholder="Search papers by title"
                options={moduleOptions}
                selected={linkedModules}
                onAdd={(option) => setLinkedModules((current) => [...current, option])}
                onRemove={(id) =>
                  setLinkedModules((current) => current.filter((item) => item.id !== id))
                }
                emptyMessage={modulesQuery.isPending ? "Loading papers…" : "No matching papers."}
              />
            </FormField>
            <FormField label="Tasks" htmlFor="new-project-link-tasks">
              <LinkExistingField
                id="new-project-link-tasks"
                placeholder="Search tasks by title"
                options={taskOptions}
                selected={linkedTasks}
                onAdd={(option) => setLinkedTasks((current) => [...current, option])}
                onRemove={(id) =>
                  setLinkedTasks((current) => current.filter((item) => item.id !== id))
                }
                emptyMessage={tasksQuery.isPending ? "Loading tasks…" : "No matching tasks."}
              />
            </FormField>
            <FormField label="Notes" htmlFor="new-project-link-notes">
              <LinkExistingField
                id="new-project-link-notes"
                placeholder="Search notes by title"
                options={noteOptions}
                selected={linkedNotes}
                onAdd={(option) => setLinkedNotes((current) => [...current, option])}
                onRemove={(id) =>
                  setLinkedNotes((current) => current.filter((item) => item.id !== id))
                }
                emptyMessage={notesQuery.isPending ? "Loading notes…" : "No matching notes."}
              />
            </FormField>
          </div>

          <p className="rounded-lg border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
            After creating the project, open it to invite collaborators by email using a secure acceptance link.
          </p>

          {saveError ? (
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {saveError}
            </p>
          ) : null}

          <DialogFooter className="border-t pt-4">
            <DialogClose asChild><Button type="button" variant="outline" disabled={isSaving}>Cancel</Button></DialogClose>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Creating…" : "Create Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
