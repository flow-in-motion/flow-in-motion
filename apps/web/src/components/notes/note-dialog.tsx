import { Search, X } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { type ApiModule, type ApiProject, useModules, useProjects } from "@/api/hooks";
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
import type { LinkTargetType } from "@/lib/link-target";
import { paperDisplayTitle } from "@/lib/paper-title";
import { cn } from "@/lib/utils";

const VISIBILITY_OPTIONS = ["Private", "Shared"] as const;
const LINK_TARGET_OPTIONS: { value: LinkTargetType; label: string }[] = [
  { value: "project", label: "Project" },
  { value: "module", label: "Paper" },
  { value: "none", label: "General" },
];

export interface NoteFormInput {
  title: string;
  content: string;
  linkTarget: LinkTargetType;
  projectId: string;
  moduleId: string;
  visibility: string;
  followUpDate: string;
}

interface NoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  projects: ApiProject[];
  modules: ApiModule[];
  /** Pre-links a new note to this project when the dialog is opened. */
  initialProjectId?: string;
  /** Pre-links a new note to this module when the dialog is opened. */
  initialModuleId?: string;
  onSave: (input: NoteFormInput) => Promise<void> | void;
}

const INITIAL_FORM: NoteFormInput = {
  title: "",
  content: "",
  linkTarget: "none",
  projectId: "",
  moduleId: "",
  visibility: "Private",
  followUpDate: "",
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

function linkTargetPillClass(selected: boolean) {
  return cn(
    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
    selected
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
  );
}

export function NoteDialog({
  open,
  onOpenChange,
  tenantId,
  projects,
  modules,
  initialProjectId,
  initialModuleId,
  onSave,
}: NoteDialogProps) {
  const [form, setForm] = useState<NoteFormInput>(INITIAL_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [projectSearch, setProjectSearch] = useState("");
  const [projectRequestSearch, setProjectRequestSearch] = useState("");
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [selectedProjectLabel, setSelectedProjectLabel] = useState("");
  const [paperSearch, setPaperSearch] = useState("");
  const [paperRequestSearch, setPaperRequestSearch] = useState("");
  const [paperPickerOpen, setPaperPickerOpen] = useState(false);
  const [selectedPaperLabel, setSelectedPaperLabel] = useState("");
  const initialPaper = modules.find((module) => module.id === initialModuleId);
  const initialPaperLabel = initialPaper ? paperDisplayTitle(initialPaper) : "";
  const initialProject = projects.find((project) => project.id === initialProjectId);
  const initialProjectLabel = initialProject?.title ?? "";

  const projectSearchQuery = useProjects(
    tenantId,
    1,
    open && form.linkTarget === "project" && projectPickerOpen && projectRequestSearch.length > 0,
    { pageSize: "all", search: projectRequestSearch },
  );
  const projectResults = [
    ...(projectSearchQuery.data?.generalProject &&
    projectSearchQuery.data.generalProject.title
      .toLowerCase()
      .includes(projectRequestSearch.toLowerCase())
      ? [projectSearchQuery.data.generalProject]
      : []),
    ...(projectSearchQuery.data?.data ?? []),
  ];
  const normalizedProjectSearch = projectSearch.trim();
  const isWaitingForProjectSearch =
    normalizedProjectSearch !== projectRequestSearch || projectSearchQuery.isFetching;

  const paperSearchQuery = useModules(
    tenantId,
    undefined,
    1,
    open && form.linkTarget === "module" && paperPickerOpen && paperRequestSearch.length > 0,
    { pageSize: "all", search: paperRequestSearch },
  );
  const paperResults = paperSearchQuery.data?.data ?? [];
  const normalizedPaperSearch = paperSearch.trim();
  const isWaitingForPaperSearch =
    normalizedPaperSearch !== paperRequestSearch || paperSearchQuery.isFetching;

  useEffect(() => {
    if (!open) return;
    if (initialModuleId) {
      setForm({ ...INITIAL_FORM, linkTarget: "module", moduleId: initialModuleId });
      setSelectedPaperLabel(initialPaperLabel);
    } else if (initialProjectId) {
      setForm({ ...INITIAL_FORM, linkTarget: "project", projectId: initialProjectId });
      setSelectedProjectLabel(initialProjectLabel);
      setSelectedPaperLabel("");
    } else {
      setForm(INITIAL_FORM);
      setSelectedProjectLabel("");
      setSelectedPaperLabel("");
    }
    setProjectSearch("");
    setProjectRequestSearch("");
    setProjectPickerOpen(false);
    setPaperSearch("");
    setPaperRequestSearch("");
    setPaperPickerOpen(false);
    setSaveError(null);
  }, [open, initialProjectId, initialModuleId, initialPaperLabel, initialProjectLabel]);

  useEffect(() => {
    if (!open || form.linkTarget !== "project" || !projectPickerOpen) {
      setProjectRequestSearch("");
      return;
    }
    if (!normalizedProjectSearch) {
      setProjectRequestSearch("");
      return;
    }
    const timer = window.setTimeout(() => setProjectRequestSearch(normalizedProjectSearch), 300);
    return () => window.clearTimeout(timer);
  }, [form.linkTarget, normalizedProjectSearch, open, projectPickerOpen]);

  useEffect(() => {
    if (!open || form.linkTarget !== "module" || !paperPickerOpen) {
      setPaperRequestSearch("");
      return;
    }
    if (!normalizedPaperSearch) {
      setPaperRequestSearch("");
      return;
    }
    const timer = window.setTimeout(() => setPaperRequestSearch(normalizedPaperSearch), 300);
    return () => window.clearTimeout(timer);
  }, [form.linkTarget, normalizedPaperSearch, open, paperPickerOpen]);

  function setLinkTarget(linkTarget: LinkTargetType) {
    setForm((prev) => ({
      ...prev,
      linkTarget,
      projectId: linkTarget === "project" ? prev.projectId : "",
      moduleId: linkTarget === "module" ? prev.moduleId : "",
    }));
    if (linkTarget !== "module") {
      setPaperSearch("");
      setPaperRequestSearch("");
      setPaperPickerOpen(false);
      setSelectedPaperLabel("");
    }
    if (linkTarget !== "project") {
      setProjectSearch("");
      setProjectRequestSearch("");
      setProjectPickerOpen(false);
      setSelectedProjectLabel("");
    }
  }

  function selectProject(project: ApiProject) {
    setForm((prev) => ({ ...prev, projectId: project.id }));
    setSelectedProjectLabel(project.title);
    setProjectSearch("");
    setProjectPickerOpen(false);
  }

  function selectPaper(module: ApiModule) {
    setForm((prev) => ({ ...prev, moduleId: module.id }));
    setSelectedPaperLabel(paperDisplayTitle(module));
    setPaperSearch("");
    setPaperPickerOpen(false);
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
        content: form.content.trim(),
      });
      onOpenChange(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "The note could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Create a new note</DialogTitle>
          <DialogDescription>
            Capture a research update, then link it to a project or paper, or keep it general.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void handleSubmit(event)} className="grid gap-5">
          <FormField label="Note title" htmlFor="note-title" required>
            <Input
              id="note-title"
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Enter a note title"
              autoFocus
              required
            />
          </FormField>

          <FormField label="Link to" htmlFor="note-link-target">
            <div className="flex flex-wrap gap-2" id="note-link-target">
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
            <FormField label="Project" htmlFor="note-project" required>
              <div
                className="relative"
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) setProjectPickerOpen(false);
                }}
              >
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="note-project"
                  role="combobox"
                  aria-expanded={projectPickerOpen}
                  aria-controls="note-project-results"
                  aria-autocomplete="list"
                  value={projectPickerOpen ? projectSearch : selectedProjectLabel}
                  onFocus={() => {
                    setProjectSearch("");
                    setProjectPickerOpen(true);
                  }}
                  onChange={(event) => {
                    setProjectSearch(event.target.value);
                    setForm((prev) => ({ ...prev, projectId: "" }));
                    setSelectedProjectLabel("");
                  }}
                  placeholder="Search all projects…"
                  autoComplete="off"
                  className="pl-9 pr-8"
                />
                {!projectPickerOpen && form.projectId ? (
                  <button
                    type="button"
                    onClick={() => {
                      setForm((prev) => ({ ...prev, projectId: "" }));
                      setSelectedProjectLabel("");
                      setProjectSearch("");
                    }}
                    aria-label="Clear selected project"
                    className="absolute right-1 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
                {projectPickerOpen ? (
                  <div
                    id="note-project-results"
                    role="listbox"
                    aria-label="Project search results"
                    className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg"
                  >
                    {!normalizedProjectSearch ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">
                        Type to search all projects.
                      </p>
                    ) : isWaitingForProjectSearch ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">
                        Searching all projects…
                      </p>
                    ) : projectResults.length ? (
                      projectResults.map((project) => (
                        <button
                          key={project.id}
                          type="button"
                          role="option"
                          aria-selected={form.projectId === project.id}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => selectProject(project)}
                          className="flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left hover:bg-accent focus:bg-accent focus:outline-none"
                        >
                          <span className="text-sm font-medium">{project.title}</span>
                          {project.displayId ? (
                            <span className="text-xs text-muted-foreground">{project.displayId}</span>
                          ) : null}
                        </button>
                      ))
                    ) : (
                      <p className="px-3 py-2 text-sm text-muted-foreground">No projects found.</p>
                    )}
                  </div>
                ) : null}
              </div>
            </FormField>
          ) : null}

          {form.linkTarget === "module" ? (
            <FormField label="Paper" htmlFor="note-module" required>
              <div
                className="relative"
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) setPaperPickerOpen(false);
                }}
              >
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="note-module"
                  role="combobox"
                  aria-expanded={paperPickerOpen}
                  aria-controls="note-paper-results"
                  aria-autocomplete="list"
                  value={paperPickerOpen ? paperSearch : selectedPaperLabel}
                  onFocus={() => {
                    setPaperSearch("");
                    setPaperPickerOpen(true);
                  }}
                  onChange={(event) => {
                    setPaperSearch(event.target.value);
                    setForm((prev) => ({ ...prev, moduleId: "" }));
                    setSelectedPaperLabel("");
                  }}
                  placeholder="Search all papers…"
                  autoComplete="off"
                  className="pl-9 pr-8"
                />
                {!paperPickerOpen && form.moduleId ? (
                  <button
                    type="button"
                    onClick={() => {
                      setForm((prev) => ({ ...prev, moduleId: "" }));
                      setSelectedPaperLabel("");
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
                    id="note-paper-results"
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
                          aria-selected={form.moduleId === module.id}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => selectPaper(module)}
                          className="flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left hover:bg-accent focus:bg-accent focus:outline-none"
                        >
                          <span className="text-sm font-medium">{paperDisplayTitle(module)}</span>
                          {module.displayId ? (
                            <span className="text-xs text-muted-foreground">{module.displayId}</span>
                          ) : null}
                        </button>
                      ))
                    ) : (
                      <p className="px-3 py-2 text-sm text-muted-foreground">No papers found.</p>
                    )}
                  </div>
                ) : null}
              </div>
            </FormField>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Visibility" htmlFor="note-visibility">
              <Select
                value={form.visibility}
                onValueChange={(value) => setForm((prev) => ({ ...prev, visibility: value }))}
              >
                <SelectTrigger id="note-visibility"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VISIBILITY_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Follow-up date" htmlFor="note-follow-up-date">
              <DatePickerInput
                id="note-follow-up-date"
                label="Follow-up date"
                value={form.followUpDate}
                onChange={(value) => setForm((prev) => ({ ...prev, followUpDate: value }))}
              />
            </FormField>
          </div>

          <FormField label="Note" htmlFor="note-content">
            <Textarea
              id="note-content"
              value={form.content}
              onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
              placeholder="Write the note…"
              rows={6}
            />
          </FormField>

          {form.visibility === "Shared" ? (
            <p className="rounded-lg border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
              After creating the note, open it to invite collaborators by email using a secure
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
              {isSaving ? "Saving…" : "Create Note"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
