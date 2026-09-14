import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import type { ApiModuleSubmission } from "@/api/hooks";
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

export interface SubmissionFormInput {
  submittedDate: string;
  journalName: string;
  status: string;
  revisionRounds: string;
  decisionDate: string;
  notes: string;
}

interface SubmissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submission?: ApiModuleSubmission | null;
  onSave: (input: SubmissionFormInput) => Promise<void> | void;
}

const INITIAL_FORM: SubmissionFormInput = {
  submittedDate: "",
  journalName: "",
  status: SUBMISSION_STATUSES[0],
  revisionRounds: "",
  decisionDate: "",
  notes: "",
};

function formFromSubmission(submission: ApiModuleSubmission): SubmissionFormInput {
  return {
    submittedDate: submission.submittedDate,
    journalName: submission.journalName,
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
  onSave,
}: SubmissionDialogProps) {
  const [form, setForm] = useState<SubmissionFormInput>(INITIAL_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const isEditing = Boolean(submission);

  useEffect(() => {
    if (!open) return;
    setSaveError(null);
    setForm(submission ? formFromSubmission(submission) : INITIAL_FORM);
  }, [open, submission]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.submittedDate || !form.journalName.trim()) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave({
        ...form,
        journalName: form.journalName.trim(),
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
          <DialogTitle>{isEditing ? "Edit submission" : "Log a submission"}</DialogTitle>
          <DialogDescription>
            Record where and when this paper was submitted, so you can look back at how long
            review and revisions took.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void handleSubmit(event)} className="grid gap-5">
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
                  {SUBMISSION_STATUSES.map((status) => (
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
              {isSaving ? "Saving…" : isEditing ? "Save Changes" : "Save submission"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
