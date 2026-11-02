import { useCallback, useRef, useState } from "react";

import { useCreatePaperSubmission, type SubmissionInput } from "@/api/hooks";
import { SUBMITTED_UNDER_REVIEW_STAGE } from "@/components/modules/paper-stage-celebration";
import type {
  SubmissionFormInput,
  SubmissionSaveInput,
} from "@/components/modules/submission-dialog";

/** Currently With once a paper has gone to a journal. */
export const WITH_JOURNAL = {
  currentlyWithType: "journal",
  assignedToUserId: null,
  assignedToInvitationId: null,
} as const;

/** What a newly logged submission sends to the server. */
export function newSubmissionInput(form: SubmissionFormInput): SubmissionInput {
  return {
    submittedDate: form.submittedDate,
    journalName: form.journalName,
    paperTitle: form.paperTitle || undefined,
    status: form.status,
    revisionRounds: form.revisionRounds ? Number(form.revisionRounds) : undefined,
    decisionDate: form.decisionDate || undefined,
    notes: form.notes || undefined,
  };
}

export interface PaperToSubmit {
  id: string;
  /** Shown as the title as submitted, which the user can change. */
  title: string;
  pipelineStage: string | null | undefined;
}

type MoveInput = {
  pipelineStage: string;
} & typeof WITH_JOURNAL;

interface PendingMove {
  paper: PaperToSubmit;
  resolve: (moved: boolean) => void;
}

/**
 * Moving a paper into "Submitted, Under Review" from a list or the pipeline.
 * `requestMove` opens the submission form; saving it logs the submission,
 * moves the paper and sets Currently With to Journal. It resolves true once
 * the paper has moved, or false if the form was cancelled, in which case
 * nothing changes. Render `<SubmissionDialog {...moveDialogProps} />` once on
 * the page; `updatePaper` is how that page saves a paper.
 */
export function useMoveToSubmitted(
  tenantId: string,
  updatePaper: (moduleId: string, input: MoveInput) => Promise<unknown>,
) {
  const [pending, setPending] = useState<PendingMove | null>(null);
  const createSubmission = useCreatePaperSubmission(tenantId);
  // Set once the submission is logged, so retrying a failed move doesn't
  // log it a second time.
  const loggedRef = useRef(false);
  const movedRef = useRef(false);

  const requestMove = useCallback(
    (paper: PaperToSubmit) =>
      new Promise<boolean>((resolve) => {
        loggedRef.current = false;
        movedRef.current = false;
        setPending({ paper, resolve });
      }),
    [],
  );

  async function handleSave(input: SubmissionSaveInput) {
    if (!pending) return;
    const { paper } = pending;
    if (!loggedRef.current) {
      await createSubmission.mutateAsync({
        moduleId: paper.id,
        input: newSubmissionInput(input),
      });
      loggedRef.current = true;
    }
    const move: MoveInput = {
      pipelineStage: SUBMITTED_UNDER_REVIEW_STAGE,
      ...WITH_JOURNAL,
    };
    try {
      await updatePaper(paper.id, move);
    } catch (error) {
      throw new Error(
        `The submission was logged, but the paper couldn't be moved${
          error instanceof Error ? ` (${error.message})` : ""
        }. Save again to try moving it.`,
      );
    }
    movedRef.current = true;
  }

  function handleOpenChange(open: boolean) {
    if (open || !pending) return;
    pending.resolve(movedRef.current);
    setPending(null);
  }

  const moveDialogProps = {
    open: pending !== null,
    onOpenChange: handleOpenChange,
    defaultPaperTitle: pending?.paper.title ?? "",
    currentPipelineStage: pending?.paper.pipelineStage ?? null,
    forStageChange: true,
    onSave: handleSave,
  };

  return { requestMove, moveDialogProps };
}
