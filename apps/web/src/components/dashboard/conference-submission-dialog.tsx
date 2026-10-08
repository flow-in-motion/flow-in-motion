import { Search, X } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import {
  useConferenceLinkOptions,
  type ApiConference,
  type ApiConferenceLinkOption,
  type ConferenceInput,
} from "@/api/hooks";
import { Button } from "@/components/ui/button";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { paperDisplayTitle } from "@/lib/paper-title";

export type ConferenceSubmissionInput = ConferenceInput;

interface ConferenceFormState {
  acronym: string;
  name: string;
  location: string;
  submissionDue: string;
  startDate: string;
  endDate: string;
  submissionType: string;
  projectIds: string[];
  moduleIds: string[];
}

const NO_PROJECT_LABEL = "No linked project";
const NO_PAPER_LABEL = "No linked paper";

interface ConferenceSubmissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  conference?: ApiConference | null;
  onSave: (input: ConferenceSubmissionInput) => Promise<void> | void;
}

const INITIAL_FORM: ConferenceFormState = {
  acronym: "", name: "", location: "", submissionDue: "", startDate: "",
  endDate: "", submissionType: "", projectIds: [], moduleIds: [],
};

function nextDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + 1));
  return date.toISOString().slice(0, 10);
}

function FormField({ label, htmlFor, required, children }: {
  label: string; htmlFor: string; required?: boolean; children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}{required ? <span className="ml-1 text-destructive">*</span> : null}
      </label>
      {children}
    </div>
  );
}

export function ConferenceSubmissionDialog({
  open, onOpenChange, tenantId, conference, onSave,
}: ConferenceSubmissionDialogProps) {
  const [form, setForm] = useState<ConferenceFormState>(INITIAL_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [linkedProjectLabel, setLinkedProjectLabel] = useState(NO_PROJECT_LABEL);
  const [projectQuery, setProjectQuery] = useState("");
  const [projectRequestSearch, setProjectRequestSearch] = useState("");
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [linkedPaperLabel, setLinkedPaperLabel] = useState(NO_PAPER_LABEL);
  const [paperQuery, setPaperQuery] = useState("");
  const [paperRequestSearch, setPaperRequestSearch] = useState("");
  const [paperPickerOpen, setPaperPickerOpen] = useState(false);
  const isEditing = Boolean(conference);

  const projectOptionsQuery = useConferenceLinkOptions(
    tenantId,
    projectRequestSearch,
    open && projectPickerOpen && projectRequestSearch.length > 0,
  );
  const projectOptions = (projectOptionsQuery.data ?? []).filter(
    (option) => option.kind === "project",
  );
  const normalizedProjectSearch = projectQuery.trim();
  const isWaitingForProjectSearch =
    normalizedProjectSearch !== projectRequestSearch || projectOptionsQuery.isFetching;

  const paperOptionsQuery = useConferenceLinkOptions(
    tenantId,
    paperRequestSearch,
    open && paperPickerOpen && paperRequestSearch.length > 0,
  );
  const paperOptions = (paperOptionsQuery.data ?? []).filter(
    (option) => option.kind === "paper",
  );
  const normalizedPaperSearch = paperQuery.trim();
  const isWaitingForPaperSearch =
    normalizedPaperSearch !== paperRequestSearch || paperOptionsQuery.isFetching;

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    setProjectQuery("");
    setProjectPickerOpen(false);
    setPaperQuery("");
    setPaperPickerOpen(false);
    setForm(conference ? {
      acronym: conference.acronym ?? "",
      name: conference.name,
      location: conference.location ?? "",
      submissionDue: conference.submissionDue ?? "",
      startDate: conference.startDate ?? "",
      endDate: conference.endDate ?? "",
      submissionType: conference.submissionType ?? "",
      projectIds: conference.projects.map((project) => project.id),
      moduleIds: (conference.papers ?? []).map((paper) => paper.id),
    } : INITIAL_FORM);
    setLinkedProjectLabel(conference?.projects[0]?.title ?? NO_PROJECT_LABEL);
    setLinkedPaperLabel(
      conference?.papers?.[0]
        ? paperDisplayTitle(conference.papers[0])
        : NO_PAPER_LABEL,
    );
    setProjectRequestSearch("");
    setPaperRequestSearch("");
  }, [conference, open]);

  useEffect(() => {
    if (!open || !projectPickerOpen || !normalizedProjectSearch) {
      setProjectRequestSearch("");
      return;
    }
    const timer = window.setTimeout(
      () => setProjectRequestSearch(normalizedProjectSearch),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [normalizedProjectSearch, open, projectPickerOpen]);

  useEffect(() => {
    if (!open || !paperPickerOpen || !normalizedPaperSearch) {
      setPaperRequestSearch("");
      return;
    }
    const timer = window.setTimeout(
      () => setPaperRequestSearch(normalizedPaperSearch),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [normalizedPaperSearch, open, paperPickerOpen]);

  function selectProject(option?: ApiConferenceLinkOption) {
    setForm((current) => ({
      ...current,
      projectIds: option ? [option.id] : [],
    }));
    setLinkedProjectLabel(option?.label ?? NO_PROJECT_LABEL);
    setProjectQuery("");
    setProjectRequestSearch("");
    setProjectPickerOpen(false);
  }

  function selectPaper(option?: ApiConferenceLinkOption) {
    setForm((current) => ({
      ...current,
      moduleIds: option ? [option.id] : [],
    }));
    setLinkedPaperLabel(option?.label ?? NO_PAPER_LABEL);
    setPaperQuery("");
    setPaperRequestSearch("");
    setPaperPickerOpen(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim()) {
      setFormError("Conference name is required.");
      return;
    }
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      setFormError("The conference end date cannot be before its start date.");
      return;
    }

    setIsSaving(true);
    setFormError(null);
    try {
      await onSave({
        ...form,
        acronym: form.acronym.trim().toUpperCase() || null,
        name: form.name.trim(),
        location: form.location.trim() || null,
        submissionDue: form.submissionDue || null,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        submissionType: form.submissionType.trim() || null,
      });
      onOpenChange(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "The conference could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit conference" : "Add a conference"}</DialogTitle>
          <DialogDescription>
            Track submission and event dates, and optionally link the conference to a project or paper you own.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-5">
          <div className="grid gap-4 sm:grid-cols-[9rem_1fr]">
            <FormField label="Acronym" htmlFor="conference-acronym">
              <Input id="conference-acronym" value={form.acronym} maxLength={20}
                onChange={(event) => setForm((current) => ({ ...current, acronym: event.target.value }))}
                placeholder="ASM" />
            </FormField>
            <FormField label="Conference name" htmlFor="conference-name" required>
              <Input id="conference-name" value={form.name} autoFocus required
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Conference name and year" />
            </FormField>
          </div>

          <FormField label="Location" htmlFor="conference-location">
            <Input id="conference-location" value={form.location}
              onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
              placeholder="City, country" />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Submission due" htmlFor="conference-submission-due">
              <DatePickerInput id="conference-submission-due" label="Submission due" allowTyped
                value={form.submissionDue}
                onChange={(value) => setForm((current) => ({ ...current, submissionDue: value }))} />
            </FormField>
            <FormField label="Starts" htmlFor="conference-start-date">
              <DatePickerInput id="conference-start-date" label="Conference start date" allowTyped
                value={form.startDate}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    startDate: value,
                    endDate: value && (!current.endDate || current.endDate <= value)
                      ? nextDate(value)
                      : current.endDate,
                  }))
                } />
            </FormField>
            <FormField label="Ends" htmlFor="conference-end-date">
              <DatePickerInput id="conference-end-date" label="Conference end date" allowTyped
                value={form.endDate}
                onChange={(value) => setForm((current) => ({ ...current, endDate: value }))} />
            </FormField>
          </div>

          <FormField label="Submission type" htmlFor="conference-type">
            <Select value={form.submissionType || "not-specified"}
              onValueChange={(value) => setForm((current) => ({
                ...current,
                submissionType: value === "not-specified" ? "" : value,
              }))}>
              <SelectTrigger id="conference-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="not-specified">Not specified</SelectItem>
                <SelectItem value="Abstract">Abstract</SelectItem>
                <SelectItem value="Full paper">Full paper</SelectItem>
                <SelectItem value="Poster">Poster</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Linked project" htmlFor="conference-project-link">
            <div
              className="relative"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setProjectPickerOpen(false);
              }}
            >
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="conference-project-link"
                role="combobox"
                aria-expanded={projectPickerOpen}
                aria-controls="conference-project-options"
                aria-autocomplete="list"
                value={projectPickerOpen ? projectQuery : linkedProjectLabel}
                onFocus={() => {
                  setProjectQuery("");
                  setPaperPickerOpen(false);
                  setProjectPickerOpen(true);
                }}
                onChange={(event) => setProjectQuery(event.target.value)}
                placeholder="Search all projects…"
                autoComplete="off"
                className="pl-9 pr-8"
              />
              {!projectPickerOpen && form.projectIds.length > 0 ? (
                <button
                  type="button"
                  onClick={() => selectProject()}
                  aria-label="Clear linked project"
                  className="absolute right-1 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
              {projectPickerOpen ? (
                <div
                  id="conference-project-options"
                  role="listbox"
                  aria-label="Available projects"
                  className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg"
                >
                  <button
                    type="button"
                    role="option"
                    aria-selected={form.projectIds.length === 0}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectProject()}
                    className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent focus:bg-accent focus:outline-none"
                  >
                    {NO_PROJECT_LABEL}
                  </button>
                  {!normalizedProjectSearch ? (
                    <p className="px-3 py-2 text-sm text-muted-foreground">
                      Type to search all projects.
                    </p>
                  ) : isWaitingForProjectSearch ? (
                    <p className="px-3 py-2 text-sm text-muted-foreground">
                      Searching all projects…
                    </p>
                  ) : projectOptions.length ? (
                    projectOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        role="option"
                        aria-selected={form.projectIds[0] === option.id}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectProject(option)}
                        className="flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left hover:bg-accent focus:bg-accent focus:outline-none"
                      >
                        <span className="text-sm font-medium">{option.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {option.displayId ? `Project · ${option.displayId}` : "Project"}
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="px-3 py-2 text-sm text-muted-foreground">No matches.</p>
                  )}
                </div>
              ) : null}
            </div>
          </FormField>

          <FormField label="Linked paper" htmlFor="conference-linked-paper">
            <div
              className="relative"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setPaperPickerOpen(false);
              }}
            >
              <div className="flex items-center gap-2">
                <Input
                  id="conference-linked-paper"
                  value={linkedPaperLabel}
                  readOnly
                  className="min-w-0 flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPaperQuery("");
                    setProjectPickerOpen(false);
                    setPaperPickerOpen(true);
                  }}
                >
                  <Search /> Search papers
                </Button>
                {form.moduleIds.length > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove linked paper"
                    onClick={() => selectPaper()}
                  >
                    <X />
                  </Button>
                ) : null}
              </div>
              {paperPickerOpen ? (
                <div
                  role="dialog"
                  aria-label="Search papers"
                  className="absolute z-50 mt-1 w-full rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg"
                >
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="conference-paper-search"
                      aria-label="Search all papers"
                      value={paperQuery}
                      onChange={(event) => setPaperQuery(event.target.value)}
                      placeholder="Search all papers…"
                      autoComplete="off"
                      autoFocus
                      className="pl-9"
                    />
                  </div>
                  <div role="listbox" aria-label="Available papers" className="mt-1 max-h-60 overflow-y-auto">
                    {!normalizedPaperSearch ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">
                        Type to search all papers.
                      </p>
                    ) : isWaitingForPaperSearch ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">
                        Searching all papers…
                      </p>
                    ) : paperOptions.length ? (
                      paperOptions.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          role="option"
                          aria-selected={form.moduleIds[0] === option.id}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => selectPaper(option)}
                          className="flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left hover:bg-accent focus:bg-accent focus:outline-none"
                        >
                          <span className="text-sm font-medium">{option.label}</span>
                          <span className="text-xs text-muted-foreground">
                            Paper · via {option.projectTitle}
                          </span>
                        </button>
                      ))
                    ) : (
                      <p className="px-3 py-2 text-sm text-muted-foreground">No papers found.</p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </FormField>

          {formError ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{formError}</p> : null}

          <DialogFooter className="border-t pt-4">
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving…" : isEditing ? "Save Changes" : "Add Conference"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
