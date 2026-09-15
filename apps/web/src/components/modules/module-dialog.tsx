import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";

import {
  useEnumValues,
  useModulePipelineStagePool,
  useNotes,
  useTasks,
  useUpdateNote,
  useUpdateTask,
  type ApiModule,
  type ApiProject,
  type Membership,
  useMe,
} from "@/api/hooks";
import {
  LinkExistingField,
  type LinkExistingOption,
} from "@/components/shared/link-existing-field";
import { TagInput } from "@/components/shared/tag-input";
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
import {
  enteredSubmittedUnderReview,
  PaperStageCelebration,
} from "@/components/modules/paper-stage-celebration";

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
  projectId: string;
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
  generalProject?: ApiProject | null;
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
  projectId: "",
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
  generalProject,
  members,
  module,
  initialProjectId,
  onSave,
}: ModuleDialogProps) {
  const tagValuesQuery = useEnumValues("module_type", open);
  const stagesQuery = useModulePipelineStagePool(tenantId, open);
  const [form, setForm] = useState<ModuleFormInput>(INITIAL_FORM);
  const [selectedProject, setSelectedProject] = useState<LinkExistingOption | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [linkedTasks, setLinkedTasks] = useState<LinkExistingOption[]>([]);
  const [linkedNotes, setLinkedNotes] = useState<LinkExistingOption[]>([]);
  const [isPaperCelebrationOpen, setIsPaperCelebrationOpen] = useState(false);
  const [celebrationPaperTitle, setCelebrationPaperTitle] = useState("");
  const isEditing = Boolean(module);
  const me = useMe();

const generalProjectOption =
  generalProject && generalProject.userId === me.data?.id
    ? {
        id: generalProject.id,
        label: "Independent paper",
        sublabel: "Stored in General",
      }
    : null;

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
  const projectOptions = [
    ...(generalProjectOption ? [generalProjectOption] : []),
    ...projects
      .filter((project) => project.userId === me.data?.id)
      .map((project) => ({
        id: project.id,
        label: project.title,
        sublabel: "Major project",
      })),
  ];

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
        projectId: module.projectId ?? "",
        status: module.status ?? "Active",
        pipelineStage: module.pipelineStage ?? "",
        tag: module.tag ?? "",
        dueDate: module.dueDate ?? "",
        assignedToUserId: module.assignedToUserId,
      });
      setSelectedProject(
        module.projectId
          ? (projects.find((project) => project.id === module.projectId)
            ? { id: module.projectId, label: projects.find((project) => project.id === module.projectId)!.title }
            : { id: module.projectId, label: "Unknown project" })
          : null,
      );
    } else if (initialProjectId) {
      setForm({ ...INITIAL_FORM, projectId: initialProjectId });
      const initialProject = projects.find((project) => project.id === initialProjectId);
      setSelectedProject(
        initialProject
          ? { id: initialProject.id, label: initialProject.title }
          : { id: initialProjectId, label: "Unknown project" },
      );
    } else {
      setForm({
        ...INITIAL_FORM,
        projectId: generalProjectOption?.id ?? "",
      });
      setSelectedProject(generalProjectOption);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, module, initialProjectId]);

  useEffect(() => {
    if (!open || module || form.pipelineStage || !visibleStages.length) return;
    setForm((current) => ({ ...current, pipelineStage: visibleStages[0]!.value }));
  }, [open, module, form.pipelineStage, visibleStages]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProject) {
      setSaveError(
        "Choose a major project or select Independent paper.",
      );
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    const shouldCelebrate = enteredSubmittedUnderReview(
      module?.pipelineStage,
      form.pipelineStage,
    );
    
    const submittedPaperTitle =
      form.shortTitle.trim() || form.title.trim() || "Paper";
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
        projectId: selectedProject.id,
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
        ]);
      }
      if (shouldCelebrate) {
        setCelebrationPaperTitle(submittedPaperTitle);
        setIsPaperCelebrationOpen(true);
      }
      
      onOpenChange(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "The module could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
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

          <p className="text-xs text-muted-foreground">
            Type a name and press comma or Enter to add it — you can add multiple journals or conferences.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Target journals" htmlFor="module-target-journal">
              <TagInput
                id="module-target-journal"
                value={form.targetJournal}
                onChange={(value) =>
                  setForm((current) => ({ ...current, targetJournal: value }))
                }
                placeholder="e.g. Nature Communications, Cell"
              />
            </FormField>

            <FormField label="Backup journals" htmlFor="module-backup-journal">
              <TagInput
                id="module-backup-journal"
                value={form.backupJournal}
                onChange={(value) =>
                  setForm((current) => ({ ...current, backupJournal: value }))
                }
                placeholder="e.g. Scientific Reports, PLOS ONE"
              />
            </FormField>

            <FormField label="Target conferences" htmlFor="module-target-conference">
              <TagInput
                id="module-target-conference"
                value={form.targetConference}
                onChange={(value) =>
                  setForm((current) => ({ ...current, targetConference: value }))
                }
                placeholder="e.g. ICML, NeurIPS"
              />
            </FormField>

            <FormField label="Backup conferences" htmlFor="module-backup-conference">
              <TagInput
                id="module-backup-conference"
                value={form.backupConference}
                onChange={(value) =>
                  setForm((current) => ({ ...current, backupConference: value }))
                }
                placeholder="e.g. NeurIPS Workshop, ICLR Workshop"
              />
            </FormField>
          </div>

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

          {!isEditing ? (
            <div className="grid gap-4 rounded-lg border p-4">
              <p className="text-sm font-medium">Link existing work (optional)</p>
              <FormField label="Project" htmlFor="module-project" required>
                <LinkExistingField
                  id="module-project"
                  placeholder="Search projects by title"
                  options={projectOptions}
                  selected={selectedProject ? [selectedProject] : []}
                  onAdd={(option) => setSelectedProject(option)}
                  onRemove={() => setSelectedProject(null)}
                  emptyMessage="No matching projects."
                />
                <p className="text-xs text-muted-foreground">
                  Select Independent paper to store this paper under General, or choose one of
                  your major projects.
                </p>
              </FormField>
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
            <p className="rounded-lg border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
              After creating the paper, open it to invite collaborators by email using a secure
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
              {isSaving ? "Saving…" : isEditing ? "Save Changes" : "Create Paper"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    <PaperStageCelebration
      open={isPaperCelebrationOpen}
      onOpenChange={setIsPaperCelebrationOpen}
      paperTitle={celebrationPaperTitle}
    />
  </>
  );
}
