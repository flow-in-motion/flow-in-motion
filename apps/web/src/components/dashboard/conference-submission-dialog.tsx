import { Check, Search, X } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import {
  CONFERENCE_INTENTS,
  useConferenceLinkOptions,
  type ApiConference,
  type ApiConferenceLinkOption,
  type ConferenceIntent,
  type ConferenceInput,
} from "@/api/hooks";
import { Button } from "@/components/ui/button";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { eventWording } from "@/lib/conference-format";
import {
  CONFERENCE_EVENT_TYPES,
  type ConferenceEventType,
} from "@/lib/conference-event-types";
import { paperDisplayTitle } from "@/lib/paper-title";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

export type ConferenceSubmissionInput = ConferenceInput;

interface ConferenceFormState {
  eventType: ConferenceEventType;
  acronym: string;
  name: string;
  location: string;
  websiteUrl: string,
  notes: string;
  submissionDue: string;
  startDate: string;
  endDate: string;
  submissionType: string;
  intents: ConferenceIntent[];
}

/** A project or paper linked to the conference, with the name shown for it. */
interface LinkedItem {
  id: string;
  label: string;
}

interface ConferenceSubmissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  conference?: ApiConference | null;
  onSave: (input: ConferenceSubmissionInput) => Promise<void> | void;
}

const INITIAL_FORM: ConferenceFormState = {
  eventType: "Conference",
  acronym: "",
  name: "",
  location: "",
  websiteUrl: "",
  notes: "",
  submissionDue: "",
  startDate: "",
  endDate: "",
  submissionType: "",
  intents: [],
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

/**
 * Search box for linking any number of projects or papers. Picked items show
 * as chips above it; the list stays open so several can be picked in a row,
 * and picking an item again unlinks it.
 */
function ConferenceLinkPicker({
  id,
  kind,
  tenantId,
  dialogOpen,
  selected,
  onChange,
}: {
  id: string;
  kind: "project" | "paper";
  tenantId: string;
  dialogOpen: boolean;
  selected: LinkedItem[];
  onChange: (items: LinkedItem[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [requestSearch, setRequestSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const optionsQuery = useConferenceLinkOptions(
    tenantId,
    requestSearch,
    dialogOpen && pickerOpen,
  );
  const options = (optionsQuery.data ?? []).filter(
    (option) => option.kind === kind,
  );
  const normalizedSearch = query.trim();
  const isWaiting =
    normalizedSearch !== requestSearch || optionsQuery.isFetching;
  const selectedIds = new Set(selected.map((item) => item.id));
  const plural = `${kind}s`;

  useEffect(() => {
    if (!dialogOpen) {
      setQuery("");
      setPickerOpen(false);
    }
  }, [dialogOpen]);

  useEffect(() => {
    if (!dialogOpen || !pickerOpen || !normalizedSearch) {
      setRequestSearch("");
      return;
    }
    const timer = window.setTimeout(
      () => setRequestSearch(normalizedSearch),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [dialogOpen, normalizedSearch, pickerOpen]);

  function toggle(option: ApiConferenceLinkOption) {
    onChange(
      selectedIds.has(option.id)
        ? selected.filter((item) => item.id !== option.id)
        : [...selected, { id: option.id, label: option.label }],
    );
    setQuery("");
  }

  function remove(itemId: string) {
    onChange(selected.filter((item) => item.id !== itemId));
  }

  return (
    <div className="flex flex-col gap-2">
      {selected.length > 0 ? (
        <ul aria-label={`Linked ${plural}`} className="flex flex-wrap gap-1.5">
          {selected.map((item) => (
            <li
              key={item.id}
              className="inline-flex max-w-full items-center gap-0.5 rounded-md border bg-muted/50 py-0.5 pl-2 pr-0.5 text-sm"
            >
              <span className="truncate">{item.label}</span>
              <button
                type="button"
                onClick={() => remove(item.id)}
                aria-label={`Unlink ${item.label}`}
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div
        className="relative"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setPickerOpen(false);
          }
        }}
      >
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          id={id}
          role="combobox"
          aria-expanded={pickerOpen}
          aria-controls={`${id}-options`}
          aria-autocomplete="list"
          value={query}
          onFocus={() => setPickerOpen(true)}
          onClick={() => setPickerOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setPickerOpen(true);
          }}
          placeholder={
            selected.length > 0
              ? `Search to add another ${kind}…`
              : `Search your ${plural}…`
          }
          autoComplete="off"
          className="pl-9"
        />
        {pickerOpen ? (
          <div
            id={`${id}-options`}
            role="listbox"
            aria-multiselectable="true"
            aria-label={`Available ${plural}`}
            // Sits in the form rather than floating over it: the list stays
            // open while picking several, and must not cover the next field.
            className="mt-1 max-h-60 w-full overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-sm"
          >
            {isWaiting ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                Loading {plural}…
              </p>
            ) : options.length ? (
              options.map((option) => {
                const isSelected = selectedIds.has(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => toggle(option)}
                    className="flex w-full items-start gap-2 rounded-md px-3 py-2 text-left hover:bg-accent focus:bg-accent focus:outline-none"
                  >
                    <Check
                      aria-hidden="true"
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0 text-primary",
                        isSelected ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-sm font-medium">{option.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {kind === "project"
                          ? option.displayId
                            ? `Project · ${option.displayId}`
                            : "Project"
                          : option.projectTitle
                            ? `Paper · via ${option.projectTitle}`
                            : "Paper"}
                      </span>
                    </span>
                  </button>
                );
              })
            ) : (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                No {plural} found.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ConferenceSubmissionDialog({
  open, onOpenChange, tenantId, conference, onSave,
}: ConferenceSubmissionDialogProps) {
  const [form, setForm] = useState<ConferenceFormState>(INITIAL_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [linkedProjects, setLinkedProjects] = useState<LinkedItem[]>([]);
  const [linkedPapers, setLinkedPapers] = useState<LinkedItem[]>([]);
  const isEditing = Boolean(conference);
  const wording = eventWording(form.eventType);

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    setForm(conference ? {
      eventType: conference.eventType ?? "Conference",
      acronym: conference.acronym ?? "",
      name: conference.name,
      location: conference.location ?? "",
      websiteUrl: conference.websiteUrl ?? "",
      notes: conference.notes ?? "",
      submissionDue: conference.submissionDue ?? "",
      startDate: conference.startDate ?? "",
      endDate: conference.endDate ?? "",
      submissionType: conference.submissionType ?? "",
      intents: conference.intents ?? [],
    } : INITIAL_FORM);
    setLinkedProjects(
      (conference?.projects ?? []).map((project) => ({
        id: project.id,
        label: project.title,
      })),
    );
    setLinkedPapers(
      (conference?.papers ?? []).map((paper) => ({
        id: paper.id,
        label: paperDisplayTitle(paper),
      })),
    );
  }, [conference, open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim()) {
      setFormError(`${wording.nameLabel} is required.`);
      return;
    }
    if (
      wording.hasEventDates &&
      form.startDate && form.endDate && form.endDate < form.startDate
    ) {
      setFormError(`The ${wording.noun} end date cannot be before its start date.`);
      return;
    }

    setIsSaving(true);
    setFormError(null);
    try {
      await onSave({
        ...form,
        projectIds: linkedProjects.map((project) => project.id),
        moduleIds: linkedPapers.map((paper) => paper.id),
        acronym: form.acronym.trim().toUpperCase() || null,
        name: form.name.trim(),
        location: form.location.trim() || null,
        websiteUrl: form.websiteUrl.trim() || null,
        notes: form.notes.trim() || null,
        submissionDue: form.submissionDue || null,
        // A journal special issue has a deadline but no event dates.
        startDate: (wording.hasEventDates && form.startDate) || null,
        endDate: (wording.hasEventDates && form.endDate) || null,
        submissionType: form.submissionType.trim() || null,
      });
      onOpenChange(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : `The ${wording.noun} could not be saved.`);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? `Edit ${wording.noun}` : "Add an event"}
          </DialogTitle>
          <DialogDescription>
            Track a conference, workshop, seminar, special issue call or any other deadline, and optionally link it to any projects or papers you own.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-5">
          <FormField label="Event type" htmlFor="conference-event-type">
            <Select value={form.eventType}
              onValueChange={(value) => setForm((current) => ({
                ...current,
                eventType: value as ConferenceEventType,
              }))}>
              <SelectTrigger id="conference-event-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CONFERENCE_EVENT_TYPES.map((eventType) => (
                  <SelectItem key={eventType} value={eventType}>{eventType}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <div className="grid gap-4 sm:grid-cols-[9rem_1fr]">
            <FormField label="Acronym" htmlFor="conference-acronym">
              <Input id="conference-acronym" value={form.acronym} maxLength={20}
                onChange={(event) => setForm((current) => ({ ...current, acronym: event.target.value }))}
                placeholder="ASM" />
            </FormField>
            <FormField label={wording.nameLabel} htmlFor="conference-name" required>
              <Input id="conference-name" value={form.name} autoFocus required
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder={wording.namePlaceholder} />
            </FormField>
          </div>

          <FormField label={wording.locationLabel} htmlFor="conference-location">
            <Input id="conference-location" value={form.location}
              onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
              placeholder={wording.locationPlaceholder} />
          </FormField>

          <FormField
            label="Conference website"
            htmlFor="conference-website"
          >
            <Input
              id="conference-website"
              type="url"
              inputMode="url"
              autoComplete="url"
              value={form.websiteUrl}
              maxLength={2048}
              pattern="https?://.+"
              title="Enter a website address starting with https:// or http://"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  websiteUrl: event.target.value,
                }))
              }
              placeholder="https://conference.example.org"
            />
          </FormField>

          <FormField label="Notes / abstract" htmlFor="conference-notes">
            <Textarea
              id="conference-notes"
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              rows={7}
              maxLength={50000}
              placeholder="Add an abstract, submission details, or other notes."
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Submission due" htmlFor="conference-submission-due">
              <DatePickerInput id="conference-submission-due" label="Submission due" allowTyped
                value={form.submissionDue}
                onChange={(value) => setForm((current) => ({ ...current, submissionDue: value }))} />
            </FormField>
            {wording.hasEventDates ? (
              <>
                <FormField label="Starts" htmlFor="conference-start-date">
                  <DatePickerInput id="conference-start-date" label={`${wording.noun} start date`} allowTyped
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
                  <DatePickerInput id="conference-end-date" label={`${wording.noun} end date`} allowTyped
                    value={form.endDate}
                    onChange={(value) => setForm((current) => ({ ...current, endDate: value }))} />
                </FormField>
              </>
            ) : null}
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

          <FormField label="Intent" htmlFor="conference-intent">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button id="conference-intent" type="button" variant="outline" className="justify-start font-normal" aria-label={`Intent: ${form.intents.length > 0 ? form.intents.join(", ") : "Not specified"}`}>
                  {form.intents.length > 0 ? form.intents.join(", ") : "Not specified"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
                {CONFERENCE_INTENTS.map((intent) => (
                  <DropdownMenuCheckboxItem
                    key={intent}
                    checked={form.intents.includes(intent)}
                    onSelect={(event) => event.preventDefault()}
                    onCheckedChange={() =>
                      setForm((current) => ({
                        ...current,
                        intents: current.intents.includes(intent)
                          ? current.intents.filter((value) => value !== intent)
                          : [...current.intents, intent],
                      }))
                    }
                  >
                    {intent}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </FormField>

          <FormField label="Linked projects" htmlFor="conference-project-link">
            <ConferenceLinkPicker
              id="conference-project-link"
              kind="project"
              tenantId={tenantId}
              dialogOpen={open}
              selected={linkedProjects}
              onChange={setLinkedProjects}
            />
          </FormField>

          <FormField label="Linked papers" htmlFor="conference-linked-paper">
            <ConferenceLinkPicker
              id="conference-linked-paper"
              kind="paper"
              tenantId={tenantId}
              dialogOpen={open}
              selected={linkedPapers}
              onChange={setLinkedPapers}
            />
          </FormField>

          {formError ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{formError}</p> : null}

          <DialogFooter className="border-t pt-4">
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving…" : isEditing ? "Save Changes" : "Add Event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
