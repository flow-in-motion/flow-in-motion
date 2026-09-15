import { Search, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";

import type { ApiConference, ApiModule, ApiProject, ConferenceInput } from "@/api/hooks";
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

const NO_LINK_LABEL = "No linked project or module/paper";

interface LinkOption {
  key: string;
  projectId: string;
  label: string;
  meta: string;
}

interface ConferenceSubmissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: ApiProject[];
  modules: ApiModule[];
  conference?: ApiConference | null;
  onSave: (input: ConferenceSubmissionInput) => Promise<void> | void;
}

const INITIAL_FORM: ConferenceSubmissionInput = {
  acronym: "", name: "", location: "", submissionDue: "", startDate: "",
  endDate: "", submissionType: "Abstract", projectIds: [],
};

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
  open, onOpenChange, projects, modules, conference, onSave,
}: ConferenceSubmissionDialogProps) {
  const [form, setForm] = useState<ConferenceSubmissionInput>(INITIAL_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [linkedLabel, setLinkedLabel] = useState(NO_LINK_LABEL);
  const [linkQuery, setLinkQuery] = useState("");
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const isEditing = Boolean(conference);

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    setLinkQuery("");
    setLinkPickerOpen(false);
    setForm(conference ? {
      acronym: conference.acronym,
      name: conference.name,
      location: conference.location,
      submissionDue: conference.submissionDue,
      startDate: conference.startDate,
      endDate: conference.endDate,
      submissionType: conference.submissionType ?? "Abstract",
      projectIds: conference.projects.map((project) => project.id),
    } : INITIAL_FORM);
    setLinkedLabel(conference?.projects[0]?.title ?? NO_LINK_LABEL);
  }, [conference, open]);

  const projectById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);

  const linkOptions = useMemo<LinkOption[]>(() => {
    const projectOptions: LinkOption[] = projects.map((project) => ({
      key: `project:${project.id}`,
      projectId: project.id,
      label: project.title,
      meta: project.displayId ? `Project · ${project.displayId}` : "Project",
    }));
    const moduleOptions: LinkOption[] = modules
      .filter((module): module is ApiModule & { projectId: string } => Boolean(module.projectId))
      .map((module) => {
        const parentProject = projectById.get(module.projectId);

        return {
          key: `module:${module.id}`,
          projectId: module.projectId,
          label: paperDisplayTitle(module),
          meta: parentProject
            ? `Paper · via ${parentProject.title}`
            : "Paper",
        };
      });
    return [...projectOptions, ...moduleOptions];
  }, [modules, projectById, projects]);

  const filteredLinkOptions = useMemo(() => {
    const query = linkQuery.trim().toLowerCase();
    if (!query) return linkOptions;
    return linkOptions.filter(
      (option) => option.label.toLowerCase().includes(query) || option.meta.toLowerCase().includes(query),
    );
  }, [linkOptions, linkQuery]);

  function selectLink(projectId: string, label: string) {
    setForm((current) => ({ ...current, projectIds: projectId ? [projectId] : [] }));
    setLinkedLabel(label);
    setLinkQuery("");
    setLinkPickerOpen(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.submissionDue || !form.startDate || !form.endDate) {
      setFormError("Enter the submission, start, and end dates.");
      return;
    }
    if (form.endDate < form.startDate) {
      setFormError("The conference end date cannot be before its start date.");
      return;
    }

    setIsSaving(true);
    setFormError(null);
    try {
      await onSave({
        ...form,
        acronym: form.acronym.trim().toUpperCase(),
        name: form.name.trim(),
        location: form.location.trim(),
        submissionType: form.submissionType?.trim() || undefined,
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
            Track submission and event dates, and optionally link the conference to a project you own.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-5">
          <div className="grid gap-4 sm:grid-cols-[9rem_1fr]">
            <FormField label="Acronym" htmlFor="conference-acronym" required>
              <Input id="conference-acronym" value={form.acronym} maxLength={20} autoFocus required
                onChange={(event) => setForm((current) => ({ ...current, acronym: event.target.value }))}
                placeholder="ASM" />
            </FormField>
            <FormField label="Conference name" htmlFor="conference-name" required>
              <Input id="conference-name" value={form.name} required
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Conference name and year" />
            </FormField>
          </div>

          <FormField label="Location" htmlFor="conference-location" required>
            <Input id="conference-location" value={form.location} required
              onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
              placeholder="City, country" />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Submission due" htmlFor="conference-submission-due" required>
              <DatePickerInput id="conference-submission-due" label="Submission due" allowTyped
                value={form.submissionDue}
                onChange={(value) => setForm((current) => ({ ...current, submissionDue: value }))} />
            </FormField>
            <FormField label="Starts" htmlFor="conference-start-date" required>
              <DatePickerInput id="conference-start-date" label="Conference start date" allowTyped
                value={form.startDate}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    startDate: value,
                    endDate: current.endDate || value,
                  }))
                } />
            </FormField>
            <FormField label="Ends" htmlFor="conference-end-date" required>
              <DatePickerInput id="conference-end-date" label="Conference end date" allowTyped
                value={form.endDate}
                onChange={(value) => setForm((current) => ({ ...current, endDate: value }))} />
            </FormField>
          </div>

          <FormField label="Submission type" htmlFor="conference-type">
            <Select value={form.submissionType}
              onValueChange={(value) => setForm((current) => ({ ...current, submissionType: value }))}>
              <SelectTrigger id="conference-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Abstract">Abstract</SelectItem>
                <SelectItem value="Full paper">Full paper</SelectItem>
                <SelectItem value="Poster">Poster</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Linked project or module/paper" htmlFor="conference-link">
            <div
              className="relative"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setLinkPickerOpen(false);
              }}
            >
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="conference-link"
                role="combobox"
                aria-expanded={linkPickerOpen}
                aria-controls="conference-link-options"
                aria-autocomplete="list"
                value={linkPickerOpen ? linkQuery : linkedLabel}
                onFocus={() => {
                  setLinkQuery("");
                  setLinkPickerOpen(true);
                }}
                onChange={(event) => setLinkQuery(event.target.value)}
                placeholder="Search a project, module or paper…"
                autoComplete="off"
                className="pl-9 pr-8"
              />
              {!linkPickerOpen && form.projectIds.length > 0 ? (
                <button
                  type="button"
                  onClick={() => selectLink("", NO_LINK_LABEL)}
                  aria-label="Clear linked project or module/paper"
                  className="absolute right-1 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
              {linkPickerOpen ? (
                <div
                  id="conference-link-options"
                  role="listbox"
                  aria-label="Available projects, modules and papers"
                  className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg"
                >
                  <button
                    type="button"
                    role="option"
                    aria-selected={form.projectIds.length === 0}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectLink("", NO_LINK_LABEL)}
                    className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent focus:bg-accent focus:outline-none"
                  >
                    {NO_LINK_LABEL}
                  </button>
                  {filteredLinkOptions.length ? (
                    filteredLinkOptions.map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        role="option"
                        aria-selected={form.projectIds[0] === option.projectId && linkedLabel === option.label}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectLink(option.projectId, option.label)}
                        className="flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left hover:bg-accent focus:bg-accent focus:outline-none"
                      >
                        <span className="text-sm font-medium">{option.label}</span>
                        <span className="text-xs text-muted-foreground">{option.meta}</span>
                      </button>
                    ))
                  ) : (
                    <p className="px-3 py-2 text-sm text-muted-foreground">No matches.</p>
                  )}
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
