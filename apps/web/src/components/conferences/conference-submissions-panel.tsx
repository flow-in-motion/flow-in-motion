import { useEffect, useId, useState, type FormEvent } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";

import {
  CONFERENCE_SUBMISSION_STATUSES,
  CONFERENCE_SUBMISSION_TYPES,
  useAddConferenceSubmission,
  useConferenceLinkOptions,
  useRemoveConferenceSubmission,
  useUpdateConferenceSubmission,
  type ApiConferenceLinkOption,
  type ApiConferenceSubmission,
  type ConferenceSubmissionInput,
  type ConferenceSubmissionStatus,
  type ConferenceSubmissionType,
} from "@/api/hooks";
import { PanelToggleButton } from "@/components/shared/linked-items-panels";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { statusBadgeClass } from "@/lib/tones";
import { cn } from "@/lib/utils";

type SubmissionKind = ApiConferenceSubmission["kind"];

const KIND_LABELS: Record<SubmissionKind, string> = {
  paper: "Paper",
  project: "Project",
  other: "Other",
};

const NOT_SPECIFIED = "not-specified";

function formatDate(iso: string | null) {
  if (!iso) return null;
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function submissionHref(submission: ApiConferenceSubmission) {
  if (submission.moduleId) return `/modules/${submission.moduleId}`;
  if (submission.projectId) return `/projects/${submission.projectId}`;
  return null;
}

/** One-line summary under a submission's name: type, deadline, presented. */
function submissionDetails(
  submission: ApiConferenceSubmission,
  conferenceDue: string | null,
) {
  const due = submission.submissionDue ?? conferenceDue;
  return [
    KIND_LABELS[submission.kind],
    submission.submissionType,
    due ? `Due ${formatDate(due)}` : null,
    submission.presentedDate
      ? `Presented ${formatDate(submission.presentedDate)}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Pick one paper or project the caller may submit, by searching.
 */
function SubmissionSubjectPicker({
  id,
  kind,
  tenantId,
  selected,
  onSelect,
}: {
  id: string;
  kind: "paper" | "project";
  tenantId: string;
  selected: ApiConferenceLinkOption | null;
  onSelect: (option: ApiConferenceLinkOption | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [requestSearch, setRequestSearch] = useState("");
  const options = useConferenceLinkOptions(tenantId, requestSearch, !selected);
  const matches = (options.data ?? []).filter((option) => option.kind === kind);
  const isWaiting = query.trim() !== requestSearch || options.isFetching;

  useEffect(() => {
    const search = query.trim();
    const timer = window.setTimeout(() => setRequestSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2">
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{selected.label}</span>
          <span className="block text-xs text-muted-foreground">
            {kind === "paper"
              ? selected.projectTitle
                ? `Paper · via ${selected.projectTitle}`
                : "Paper"
              : selected.displayId
                ? `Project · ${selected.displayId}`
                : "Project"}
          </span>
        </span>
        <Button type="button" variant="outline" size="sm" onClick={() => onSelect(null)}>
          Change
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          id={id}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search your ${kind}s…`}
          autoComplete="off"
          aria-controls={`${id}-options`}
          className="pl-9"
        />
      </div>
      <div
        id={`${id}-options`}
        role="listbox"
        aria-label={`Your ${kind}s`}
        className="max-h-52 overflow-y-auto rounded-lg border bg-popover p-1"
      >
        {isWaiting ? (
          <p className="px-3 py-2 text-sm text-muted-foreground">Loading {kind}s…</p>
        ) : matches.length ? (
          matches.map((option) => (
            <button
              key={option.id}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => onSelect(option)}
              className="flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left hover:bg-accent focus:bg-accent focus:outline-none"
            >
              <span className="text-sm font-medium">{option.label}</span>
              <span className="text-xs text-muted-foreground">
                {kind === "paper"
                  ? option.projectTitle
                    ? `Paper · via ${option.projectTitle}`
                    : "Paper"
                  : option.displayId
                    ? `Project · ${option.displayId}`
                    : "Project"}
              </span>
            </button>
          ))
        ) : (
          <p className="px-3 py-2 text-sm text-muted-foreground">No {kind}s found.</p>
        )}
      </div>
    </div>
  );
}

interface SubmissionFormState {
  kind: SubmissionKind;
  subject: ApiConferenceLinkOption | null;
  title: string;
  submissionType: string;
  status: string;
  submissionDue: string;
  notes: string;
}

function initialForm(submission: ApiConferenceSubmission | null): SubmissionFormState {
  return {
    kind: submission?.kind ?? "paper",
    subject: null,
    title: submission?.titleAsSubmitted ?? "",
    submissionType: submission?.submissionType ?? "",
    status: submission?.status ?? "",
    submissionDue: submission?.submissionDue ?? "",
    notes: submission?.notes ?? "",
  };
}

/** Add a submission, or edit one (its paper or project can't be swapped). */
function SubmissionFormDialog({
  open,
  onOpenChange,
  tenantId,
  conferenceId,
  conferenceDue,
  submission,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  conferenceId: string;
  conferenceDue: string | null;
  submission: ApiConferenceSubmission | null;
}) {
  const fieldId = useId();
  const addSubmission = useAddConferenceSubmission(tenantId);
  const updateSubmission = useUpdateConferenceSubmission(tenantId);
  const [form, setForm] = useState<SubmissionFormState>(() => initialForm(submission));
  const [error, setError] = useState<string | null>(null);
  const isEditing = Boolean(submission);
  const isSaving = addSubmission.isPending || updateSubmission.isPending;

  useEffect(() => {
    if (open) {
      setForm(initialForm(submission));
      setError(null);
    }
  }, [open, submission]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const title = form.title.trim() || null;
    if (!isEditing && form.kind !== "other" && !form.subject) {
      setError(`Choose the ${form.kind} you're submitting.`);
      return;
    }
    if (form.kind === "other" && !title) {
      setError("Give the submission a title.");
      return;
    }

    const details = {
      title,
      submissionType: (form.submissionType || null) as ConferenceSubmissionType | null,
      status: (form.status || null) as ConferenceSubmissionStatus | null,
      submissionDue: form.submissionDue || null,
      notes: form.notes.trim() || null,
    };

    try {
      if (submission) {
        await updateSubmission.mutateAsync({
          conferenceId,
          submissionId: submission.id,
          input: details,
        });
      } else {
        const input: ConferenceSubmissionInput = {
          ...details,
          ...(form.kind === "paper" && form.subject ? { moduleId: form.subject.id } : {}),
          ...(form.kind === "project" && form.subject ? { projectId: form.subject.id } : {}),
        };
        await addSubmission.mutateAsync({ conferenceId, input });
      }
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The submission could not be saved.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={submit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit submission" : "Add a submission"}</DialogTitle>
            <DialogDescription>
              Link a paper or project, or just describe what you&apos;re submitting, such as a PDW.
            </DialogDescription>
          </DialogHeader>

          <fieldset disabled={isSaving} className="grid gap-4">
            {submission ? (
              <div>
                <p className="text-sm text-muted-foreground">Submitting</p>
                <p className="mt-1 font-medium">
                  {submission.kind === "other"
                    ? "Something else"
                    : `${KIND_LABELS[submission.kind]}: ${submission.name}`}
                </p>
              </div>
            ) : (
              <div className="grid gap-2">
                <span id={`${fieldId}-kind`} className="text-sm font-medium">
                  What are you submitting?
                </span>
                <div role="radiogroup" aria-labelledby={`${fieldId}-kind`} className="flex flex-wrap gap-2">
                  {(["paper", "project", "other"] as const).map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      role="radio"
                      aria-checked={form.kind === kind}
                      onClick={() => setForm((current) => ({ ...current, kind, subject: null }))}
                      className={cn(
                        "rounded-full border px-3 py-1 text-sm transition-colors",
                        form.kind === kind
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
                      )}
                    >
                      {kind === "paper" ? "A paper" : kind === "project" ? "A project" : "Something else"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!submission && form.kind !== "other" ? (
              <div className="grid gap-1.5">
                <label htmlFor={`${fieldId}-subject`} className="text-sm font-medium">
                  {form.kind === "paper" ? "Paper" : "Project"} *
                </label>
                <SubmissionSubjectPicker
                  id={`${fieldId}-subject`}
                  kind={form.kind}
                  tenantId={tenantId}
                  selected={form.subject}
                  onSelect={(subject) => setForm((current) => ({ ...current, subject }))}
                />
              </div>
            ) : null}

            <div className="grid gap-1.5">
              <label htmlFor={`${fieldId}-title`} className="text-sm font-medium">
                {form.kind === "other" ? "Title *" : "Title as submitted"}
              </label>
              <Input
                id={`${fieldId}-title`}
                value={form.title}
                maxLength={1000}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder={
                  form.kind === "other"
                    ? "e.g. PDW: Qualitative methods in practice"
                    : "Leave empty to use its name in the app"
                }
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <label htmlFor={`${fieldId}-type`} className="text-sm font-medium">Type</label>
                <Select
                  value={form.submissionType || NOT_SPECIFIED}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, submissionType: value === NOT_SPECIFIED ? "" : value }))
                  }
                >
                  <SelectTrigger id={`${fieldId}-type`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NOT_SPECIFIED}>Not specified</SelectItem>
                    {CONFERENCE_SUBMISSION_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <label htmlFor={`${fieldId}-status`} className="text-sm font-medium">Status</label>
                <Select
                  value={form.status || NOT_SPECIFIED}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, status: value === NOT_SPECIFIED ? "" : value }))
                  }
                >
                  <SelectTrigger id={`${fieldId}-status`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NOT_SPECIFIED}>Not specified</SelectItem>
                    {CONFERENCE_SUBMISSION_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-1.5">
              <label htmlFor={`${fieldId}-due`} className="text-sm font-medium">Deadline</label>
              <DatePickerInput
                id={`${fieldId}-due`}
                label="Submission deadline"
                value={form.submissionDue}
                onChange={(value) => setForm((current) => ({ ...current, submissionDue: value }))}
              />
              <p className="text-xs text-muted-foreground">
                {conferenceDue
                  ? `Leave empty to use the conference deadline (${formatDate(conferenceDue)}).`
                  : "Only needed if this submission has its own deadline."}
              </p>
            </div>

            <div className="grid gap-1.5">
              <label htmlFor={`${fieldId}-notes`} className="text-sm font-medium">Notes</label>
              <Textarea
                id={`${fieldId}-notes`}
                value={form.notes}
                rows={3}
                maxLength={50000}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              />
            </div>
          </fieldset>

          {error ? (
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter className="border-t pt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving…" : isEditing ? "Save Changes" : "Add Submission"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Everything sent to a conference: papers, projects and anything else (such
 * as a PDW), each with its own type, status and deadline.
 */
export function ConferenceSubmissionsPanel({
  tenantId,
  conferenceId,
  conferenceDue,
  submissions,
  canManage,
}: {
  tenantId: string;
  conferenceId: string;
  conferenceDue: string | null;
  submissions: ApiConferenceSubmission[];
  canManage: boolean;
}) {
  const [visible, setVisible] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ApiConferenceSubmission | null>(null);
  const [error, setError] = useState<string | null>(null);
  const removeSubmission = useRemoveConferenceSubmission(tenantId);

  function openAdd() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(submission: ApiConferenceSubmission) {
    setEditing(submission);
    setDialogOpen(true);
  }

  async function remove(submission: ApiConferenceSubmission) {
    const keeps =
      submission.kind === "other" ? "" : ` The ${submission.kind} itself won't be deleted.`;
    if (!window.confirm(`Remove "${submission.name}" from this conference's submissions?${keeps}`)) {
      return;
    }
    setError(null);
    try {
      await removeSubmission.mutateAsync({ conferenceId, submissionId: submission.id });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The submission could not be removed.");
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle>Submissions ({submissions.length})</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          {canManage ? (
            <Button variant="outline" size="sm" onClick={openAdd}>
              <Plus />
              Add submission
            </Button>
          ) : null}
          <PanelToggleButton
            visible={visible}
            onToggle={() => setVisible((value) => !value)}
            label="submissions"
            controls="conference-submissions-content"
          />
        </div>
      </CardHeader>
      {visible ? (
        <CardContent id="conference-submissions-content">
          {error ? (
            <p role="alert" className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {submissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No submissions yet. Add the papers, projects or anything else (such as a PDW) you&apos;re sending to this conference.
            </p>
          ) : (
            <ul aria-label="Submissions" className="grid gap-2">
              {submissions.map((submission) => {
                const href = submissionHref(submission);
                const name = (
                  <>
                    {submission.displayId ? (
                      <span className="block font-mono text-[10px] text-muted-foreground">
                        {submission.displayId}
                      </span>
                    ) : null}
                    <span className="block text-sm font-semibold">{submission.name}</span>
                    {submission.titleAsSubmitted && submission.kind !== "other" ? (
                      <span className="block text-xs text-muted-foreground">
                        Submitted as “{submission.titleAsSubmitted}”
                      </span>
                    ) : null}
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {submissionDetails(submission, conferenceDue)}
                    </span>
                  </>
                );
                return (
                  <li
                    key={submission.id}
                    className="flex items-start gap-2 rounded-md border border-border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-muted/40"
                  >
                    {href ? (
                      <Link
                        to={href}
                        className="min-w-0 flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {name}
                      </Link>
                    ) : (
                      <div className="min-w-0 flex-1">{name}</div>
                    )}
                    {submission.status ? (
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center whitespace-nowrap rounded-md border px-1.5 py-px text-[0.6875rem] font-medium leading-4",
                          statusBadgeClass(submission.status),
                        )}
                      >
                        <span className="sr-only">Status: </span>
                        {submission.status}
                      </span>
                    ) : null}
                    {canManage ? (
                      <span className="flex shrink-0 items-center">
                        <button
                          type="button"
                          onClick={() => openEdit(submission)}
                          aria-label={`Edit submission ${submission.name}`}
                          title="Edit"
                          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void remove(submission)}
                          aria-label={`Remove submission ${submission.name}`}
                          title="Remove"
                          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      ) : null}
      {canManage ? (
        <SubmissionFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          tenantId={tenantId}
          conferenceId={conferenceId}
          conferenceDue={conferenceDue}
          submission={editing}
        />
      ) : null}
    </Card>
  );
}
