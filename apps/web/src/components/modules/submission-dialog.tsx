import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import type { ApiModuleSubmission } from "@/api/hooks";
import { SUBMITTED_UNDER_REVIEW_STAGE } from "@/components/modules/paper-stage-celebration";
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

export const SUBMISSION_STATUSES = [
  "Submitted",
  "Under review",
  "Revision requested",
  "Resubmitted",
  "Accepted",
  "Rejected",
  "Withdrawn",
] as const;

const IN_REVIEW_STATUSES = new Set(["Submitted", "Under review", "Resubmitted"]);

export interface SubmissionFormInput {
  submittedDate: string;
  journalName: string;
  paperTitle: string;
  status: string;
  revisionRounds: string;
  decisionDate: string;
  notes: string;
}

export type SubmissionSaveInput = SubmissionFormInput;

/** Today's date where the user is, as YYYY-MM-DD. */
function todayDate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

interface SubmissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submission?: ApiModuleSubmission | null;
  /** Pre-fills the title for a new submission (the paper's current title). */
  defaultPaperTitle?: string;
  /**
   * Opened because the paper is being moved into "Submitted, Under Review":
   * the move is the point, so there's no tick box, today's date is filled
   * in, and Cancel leaves the paper where it was.
   */
  forStageChange?: boolean;
  /**
   * With `forStageChange`, for edit forms: the details are only collected
   * here, and logged when the paper itself is saved.
   */
  logWhenPaperSaved?: boolean;
  onSave: (input: SubmissionSaveInput) => Promise<void> | void;
}

const INITIAL_FORM: SubmissionFormInput = {
  submittedDate: "",
  journalName: "",
  paperTitle: "",
  status: SUBMISSION_STATUSES[0],
  revisionRounds: "",
  decisionDate: "",
  notes: "",
};

function formFromSubmission(submission: ApiModuleSubmission): SubmissionFormInput {
  return {
    submittedDate: submission.submittedDate,
    journalName: submission.journalName,
    paperTitle: submission.paperTitle ?? "",
    status: submission.status,
    revisionRounds:
      submission.revisionRounds === null ? "" : String(submission.revisionRounds),
    decisionDate: submission.decisionDate ?? "",
    notes: submission.notes ?? "",
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

export function SubmissionDialog({
  open,
  onOpenChange,
  submission,
  defaultPaperTitle = "",
  forStageChange = false,
  logWhenPaperSaved = false,
  onSave,
}: SubmissionDialogProps) {
  const [form, setForm] = useState<SubmissionFormInput>(INITIAL_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const isEditing = Boolean(submission);

  useEffect(() => {
    if (!open) return;
    setSaveError(null);
    setForm(
      submission
        ? formFromSubmission(submission)
        : {
            ...INITIAL_FORM,
            paperTitle: defaultPaperTitle,
            submittedDate: forStageChange ? todayDate() : "",
          },
    );
  }, [open, submission, defaultPaperTitle, forStageChange]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.submittedDate || !form.journalName.trim()) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave({
        ...form,
        journalName: form.journalName.trim(),
        paperTitle: form.paperTitle.trim(),
        notes: form.notes.trim(),
      });
      onOpenChange(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "The submission could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? "Edit submission"
              : forStageChange
                ? "Where was this paper submitted?"
                : "Log a submission"}
          </DialogTitle>
          <DialogDescription>
            {forStageChange && logWhenPaperSaved
              ? `When you save the paper, it moves to “${SUBMITTED_UNDER_REVIEW_STAGE}”, this submission is logged and Currently with is set to Journal. Cancel to keep the current stage.`
              : forStageChange
              ? `Moving the paper to “${SUBMITTED_UNDER_REVIEW_STAGE}” logs this submission and sets Currently with to Journal. Cancel to leave the paper where it is.`
              : `Record where and when this paper was submitted. Submitted and Resubmitted move it to “${SUBMITTED_UNDER_REVIEW_STAGE}”; Rejected and Revision requested move it to “Revisions”; Accepted moves it to “Accepted”.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void handleSubmit(event)} className="grid gap-5">
          <FormField label="Paper title (as submitted)" htmlFor="submission-paper-title">
            <Textarea
              id="submission-paper-title"
              value={form.paperTitle}
              onChange={(event) =>
                setForm((current) => ({ ...current, paperTitle: event.target.value }))
              }
              placeholder="The title used for this submission"
              rows={2}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Submitted date" htmlFor="submission-submitted-date" required>
              <DatePickerInput
                id="submission-submitted-date"
                label="Submitted date"
                value={form.submittedDate}
                onChange={(value) => setForm((current) => ({ ...current, submittedDate: value }))}
              />
            </FormField>

            <FormField label="Journal / venue" htmlFor="submission-journal" required>
              <Input
                id="submission-journal"
                value={form.journalName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, journalName: event.target.value }))
                }
                placeholder="e.g. Nature Communications"
                required
              />
            </FormField>

            <FormField label="Status" htmlFor="submission-status">
              <Select
                value={form.status}
                onValueChange={(value) => setForm((current) => ({ ...current, status: value }))}
              >
                <SelectTrigger id="submission-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUBMISSION_STATUSES.filter((status) => !forStageChange || IN_REVIEW_STATUSES.has(status)).map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Revision rounds" htmlFor="submission-revision-rounds">
              <Input
                id="submission-revision-rounds"
                type="number"
                min="0"
                step="1"
                value={form.revisionRounds}
                onChange={(event) =>
                  setForm((current) => ({ ...current, revisionRounds: event.target.value }))
                }
                placeholder="0"
              />
            </FormField>

            <FormField label="Decision date" htmlFor="submission-decision-date">
              <DatePickerInput
                id="submission-decision-date"
                label="Decision date"
                value={form.decisionDate}
                onChange={(value) => setForm((current) => ({ ...current, decisionDate: value }))}
              />
            </FormField>
          </div>

          <FormField label="Notes" htmlFor="submission-notes">
            <Textarea
              id="submission-notes"
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="e.g. Reviewer 2 requested more controls"
              rows={3}
            />
          </FormField>

          {saveError ? (
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {saveError}
            </p>
          ) : null}

          <DialogFooter className="border-t pt-4">
            <DialogClose asChild><Button type="button" variant="outline" disabled={isSaving}>Cancel</Button></DialogClose>
            <Button type="submit" disabled={isSaving}>
              {isSaving
                ? "Saving…"
                : isEditing
                  ? "Save Changes"
                  : forStageChange
                    ? logWhenPaperSaved
                      ? "Continue"
                      : "Save and move paper"
                    : "Save submission"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
