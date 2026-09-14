import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { X } from "lucide-react";

import {
  inviteCollaboratorByEmail,
  useEnumValues,
  useModulePipelineStagePool,
  useNotes,
  useTasks,
  useUpdateNote,
  useUpdateTask,
  type ApiModule,
  type ApiProject,
  type Membership,
} from "@/api/hooks";
import { ModuleCollaboratorsManager } from "@/components/modules/module-collaborators";
import {
  LinkExistingField,
  type LinkExistingOption,
} from "@/components/shared/link-existing-field";
import { paperDisplayTitle } from "@/lib/paper-title";
import { Badge } from "@/components/ui/badge";
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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MODULE_STATUSES = ["Active", "Review", "Stalled", "Complete"] as const;
const UNASSIGNED = "__unassigned__";

export interface ModuleFormInput {
  shortTitle: string;
  title: string;
  description: string;
  abstract: string;
  targetJournal: string;
  backupJournal: string;
  targetConference: string;
  backupConference: string;
  projectId: string | null;
  status: string;
  pipelineStage: string;
  tag: string;
  dueDate: string;
  assignedToUserId: string | null;
}

interface ModuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  projects: ApiProject[];
  members: Membership[];
  module?: ApiModule | null;
  /** Pre-links a new module to this project when the dialog is opened for creation. */
  initialProjectId?: string;
  /** Returns the saved module so newly-created papers can link existing tasks/notes to it. */
  onSave: (input: ModuleFormInput) => Promise<ApiModule | void>;
}

const INITIAL_FORM: ModuleFormInput = {
  shortTitle: "",
  title: "",
  description: "",
  abstract: "",
  targetJournal: "",
  backupJournal: "",
  targetConference: "",
  backupConference: "",
  projectId: null,
  status: "Active",
  pipelineStage: "",
  tag: "",
  dueDate: "",
  assignedToUserId: null,
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

export function ModuleDialog({
  open,
  onOpenChange,
  tenantId,
  projects,
  members,
  module,
  initialProjectId,
  onSave,
}: ModuleDialogProps) {
  const tagValuesQuery = useEnumValues("module_type", open);
  const stagesQuery = useModulePipelineStagePool(tenantId, open);
  const [form, setForm] = useState<ModuleFormInput>(INITIAL_FORM);
  const [isIndependent, setIsIndependent] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [linkedTasks, setLinkedTasks] = useState<LinkExistingOption[]>([]);
  const [linkedNotes, setLinkedNotes] = useState<LinkExistingOption[]>([]);
  const [collaboratorEmails, setCollaboratorEmails] = useState<string[]>([]);
  const [collaboratorEmailInput, setCollaboratorEmailInput] = useState("");
  const [collaboratorEmailError, setCollaboratorEmailError] = useState<string | null>(null);
  const isEditing = Boolean(module);

  const tasksQuery = useTasks(tenantId, undefined, 1, open && !isEditing);
  const notesQuery = useNotes(tenantId, undefined, 1, open && !isEditing);
  const updateTask = useUpdateTask(tenantId);
  const updateNote = useUpdateNote(tenantId);

  const taskOptions = (tasksQuery.data?.data ?? []).map((task) => ({
    id: task.id,
    label: task.title,
    sublabel: task.moduleId ? "Linked to another paper" : "Unlinked",
  }));
  const noteOptions = (notesQuery.data?.data ?? []).map((note) => ({
    id: note.id,
    label: note.title,
    sublabel: note.moduleId ? "Linked to another paper" : "Unlinked",
  }));

  const visibleStages = useMemo(
    () =>
      [...(stagesQuery.data ?? [])]
        .filter((stage) => !stage.hidden)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [stagesQuery.data],
  );

  useEffect(() => {
    if (!open) return;
    setSaveError(null);
    setLinkedTasks([]);
    setLinkedNotes([]);
    setCollaboratorEmails([]);
    setCollaboratorEmailInput("");
    setCollaboratorEmailError(null);
    if (module) {
      setForm({
        shortTitle: module.shortTitle ?? "",
        title: module.title ?? "",
        description: module.description ?? "",
        abstract: module.abstract ?? "",
        targetJournal: module.targetJournal ?? "",
        backupJournal: module.backupJournal ?? "",
        targetConference: module.targetConference ?? "",
        backupConference: module.backupConference ?? "",
        projectId: module.projectId,
        status: module.status ?? "Active",
        pipelineStage: module.pipelineStage ?? "",
        tag: module.tag ?? "",
        dueDate: module.dueDate ?? "",
        assignedToUserId: module.assignedToUserId,
      });
      setIsIndependent(module.projectId === null);
    } else if (initialProjectId) {
      setForm({ ...INITIAL_FORM, projectId: initialProjectId });
      setIsIndependent(false);
    } else {
      setForm(INITIAL_FORM);
      setIsIndependent(true);
    }
  }, [open, module, initialProjectId]);

  useEffect(() => {
    if (!open || module || form.pipelineStage || !visibleStages.length) return;
    setForm((current) => ({ ...current, pipelineStage: visibleStages[0]!.value }));
  }, [open, module, form.pipelineStage, visibleStages]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isIndependent && !form.projectId) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const savedModule = await onSave({
        ...form,
        shortTitle: form.shortTitle.trim(),
        title: form.title.trim(),
        description: form.description.trim(),
        abstract: form.abstract.trim(),
        targetJournal: form.targetJournal.trim(),
        backupJournal: form.backupJournal.trim(),
        targetConference: form.targetConference.trim(),
        backupConference: form.backupConference.trim(),
        projectId: isIndependent ? null : form.projectId,
      });
      if (!isEditing && savedModule) {
        await Promise.all([
          ...linkedTasks.map((task) =>
            updateTask.mutateAsync({
              taskId: task.id,
              input: { moduleId: savedModule.id },
            }),
          ),
          ...linkedNotes.map((note) =>
            updateNote.mutateAsync({
              noteId: note.id,
              input: { moduleId: savedModule.id },
            }),
          ),
          ...collaboratorEmails.map((email) =>
            inviteCollaboratorByEmail("module", tenantId, savedModule.id, email),
          ),
        ]);
      }
      onOpenChange(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "The module could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }

  function addCollaboratorEmail() {
    const email = collaboratorEmailInput.trim().toLowerCase();
    if (!email) return;
    if (!EMAIL_PATTERN.test(email)) {
      setCollaboratorEmailError("Enter a valid email address.");
      return;
    }
    if (collaboratorEmails.includes(email)) {
      setCollaboratorEmailError("That email has already been added.");
      return;
    }
    setCollaboratorEmails((current) => [...current, email]);
    setCollaboratorEmailInput("");
    setCollaboratorEmailError(null);
  }

  function handleCollaboratorEmailKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addCollaboratorEmail();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit paper" : "Create a new paper"}</DialogTitle>
          <DialogDescription>
            Add an independent paper or connect it to an existing project.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void handleSubmit(event)} className="grid gap-5">
          <FormField label="Short title" htmlFor="module-short-title" required>
            <Input
              id="module-short-title"
              value={form.shortTitle}
              onChange={(event) => setForm((current) => ({ ...current, shortTitle: event.target.value }))}
              placeholder="The working name you'll refer to this paper by"
              autoFocus
              required
            />
          </FormField>

          <FormField label="Formal title" htmlFor="module-title">
            <Input
              id="module-title"
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Add once the paper has a formal title"
            />
          </FormField>

          <FormField label="Description" htmlFor="module-description">
            <Textarea
              id="module-description"
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
              placeholder="Add an optional description"
              rows={3}
            />
          </FormField>

          <FormField label="Abstract" htmlFor="module-abstract">
            <Textarea
              id="module-abstract"
              value={form.abstract}
              onChange={(event) =>
                setForm((current) => ({ ...current, abstract: event.target.value }))
              }
              placeholder="Add the paper's academic abstract"
              rows={5}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Target journal" htmlFor="module-target-journal">
              <Input
                id="module-target-journal"
                value={form.targetJournal}
                onChange={(event) =>
                  setForm((current) => ({ ...current, targetJournal: event.target.value }))
                }
                placeholder="e.g. Nature Communications"
              />
            </FormField>

            <FormField label="Backup journal" htmlFor="module-backup-journal">
              <Input
                id="module-backup-journal"
                value={form.backupJournal}
                onChange={(event) =>
                  setForm((current) => ({ ...current, backupJournal: event.target.value }))
                }
                placeholder="e.g. Scientific Reports"
              />
            </FormField>

            <FormField label="Target conference" htmlFor="module-target-conference">
              <Input
                id="module-target-conference"
                value={form.targetConference}
                onChange={(event) =>
                  setForm((current) => ({ ...current, targetConference: event.target.value }))
                }
                placeholder="e.g. ICML"
              />
            </FormField>

            <FormField label="Backup conference" htmlFor="module-backup-conference">
              <Input
                id="module-backup-conference"
                value={form.backupConference}
                onChange={(event) =>
                  setForm((current) => ({ ...current, backupConference: event.target.value }))
                }
                placeholder="e.g. NeurIPS Workshop"
              />
            </FormField>
          </div>

          <label className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-3">
            <input
              type="checkbox"
              checked={isIndependent}
              onChange={(event) => {
                setIsIndependent(event.target.checked);
                if (event.target.checked) {
                  setForm((current) => ({ ...current, projectId: null }));
                }
              }}
              className="mt-0.5 h-4 w-4 accent-primary"
            />
            <span>
              <span className="block text-sm font-medium">Independent paper</span>
              <span className="block text-xs text-muted-foreground">
                Only explicitly added collaborators can see an independent paper. Project-linked
                papers are visible to anyone who can see the project.
              </span>
            </span>
          </label>

          {!isIndependent ? (
            <FormField label="Project" htmlFor="module-project" required>
              <Select
                value={form.projectId ?? ""}
                onValueChange={(value) => setForm((current) => ({ ...current, projectId: value }))}
                required
              >
                <SelectTrigger id="module-project"><SelectValue placeholder="Select a project" /></SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>{project.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Status" htmlFor="module-status">
              <Select
                value={form.status}
                onValueChange={(value) => setForm((current) => ({ ...current, status: value }))}
              >
                <SelectTrigger id="module-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODULE_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Type" htmlFor="module-tag">
              <Select
                value={form.tag}
                onValueChange={(value) => setForm((current) => ({ ...current, tag: value }))}
              >
                <SelectTrigger id="module-tag"><SelectValue placeholder="Select a type" /></SelectTrigger>
                <SelectContent>
                  {(tagValuesQuery.data ?? []).map((tagValue) => (
                    <SelectItem key={tagValue.id} value={tagValue.value}>{tagValue.value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Due date" htmlFor="module-due-date">
              <DatePickerInput
                id="module-due-date"
                label="Due date"
                value={form.dueDate}
                onChange={(value) =>
                  setForm((current) => ({ ...current, dueDate: value }))
                }
              />
            </FormField>

            <FormField label="Pipeline stage" htmlFor="module-pipeline-stage" required>
              <Select
                value={form.pipelineStage}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, pipelineStage: value }))
                }
                required
              >
                <SelectTrigger id="module-pipeline-stage">
                  <SelectValue placeholder="Select a stage" />
                </SelectTrigger>
                <SelectContent>
                  {visibleStages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.value}>
                      {stage.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Assigned to" htmlFor="module-assignee">
              <Select
                value={form.assignedToUserId ?? UNASSIGNED}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    assignedToUserId: value === UNASSIGNED ? null : value,
                  }))
                }
              >
                <SelectTrigger id="module-assignee"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {members.map((member) => (
                    <SelectItem key={member.userId} value={member.userId}>
                      {member.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          {isEditing && module && module.tenantId === tenantId ? (
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <span className="text-sm font-medium">Collaborators</span>
              <ModuleCollaboratorsManager
                tenantId={tenantId}
                moduleId={module.id}
                moduleTitle={paperDisplayTitle(module)}
                members={members}
              />
            </div>
          ) : isEditing && module ? (
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <span className="text-sm font-medium">Collaborators</span>
              <p className="text-sm text-muted-foreground">
                This paper was shared with you from another workspace. Only members of that
                workspace can manage who has access.
              </p>
            </div>
          ) : null}

          {!isEditing ? (
            <div className="grid gap-4 rounded-lg border p-4">
              <p className="text-sm font-medium">Link existing work (optional)</p>
              <FormField label="Tasks" htmlFor="new-module-link-tasks">
                <LinkExistingField
                  id="new-module-link-tasks"
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
              <FormField label="Notes" htmlFor="new-module-link-notes">
                <LinkExistingField
                  id="new-module-link-notes"
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
          ) : null}

          {!isEditing ? (
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <span className="text-sm font-medium">Invite collaborators (optional)</span>
              <p className="text-xs text-muted-foreground">
                Amazon SES emails a secure one-time link once the paper is created. Press Enter
                or comma to add each email.
              </p>
              <FormField label="Collaborator email" htmlFor="module-collaborator-email">
                <div className="flex gap-2">
                  <Input
                    id="module-collaborator-email"
                    type="email"
                    value={collaboratorEmailInput}
                    onChange={(event) => {
                      setCollaboratorEmailInput(event.target.value);
                      setCollaboratorEmailError(null);
                    }}
                    onKeyDown={handleCollaboratorEmailKeyDown}
                    placeholder="name@example.com"
                  />
                  <Button type="button" variant="outline" onClick={addCollaboratorEmail}>
                    Add
                  </Button>
                </div>
              </FormField>
              {collaboratorEmailError ? (
                <p className="text-xs text-destructive">{collaboratorEmailError}</p>
              ) : null}
              {collaboratorEmails.length ? (
                <div className="flex flex-wrap gap-2">
                  {collaboratorEmails.map((email) => (
                    <Badge key={email} variant="secondary" className="gap-1.5 py-1">
                      {email}
                      <button
                        type="button"
                        aria-label={`Remove ${email}`}
                        onClick={() =>
                          setCollaboratorEmails((current) => current.filter((item) => item !== email))
                        }
                        className="rounded-full hover:text-destructive focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {saveError ? (
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {saveError}
            </p>
          ) : null}

          <DialogFooter className="border-t pt-4">
            <DialogClose asChild><Button type="button" variant="outline" disabled={isSaving}>Cancel</Button></DialogClose>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving…" : isEditing ? "Save Changes" : "Create Paper"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
