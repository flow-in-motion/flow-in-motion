import { SUBMITTED_UNDER_REVIEW_STAGE } from "@/components/modules/paper-stage-celebration";

/** Stages in which a logged, active journal submission can still be with a journal. */
export function hasActiveSubmissionStage(stage: string | null) {
  return stage === SUBMITTED_UNDER_REVIEW_STAGE || stage === "Revisions";
}

/** The paper stage resulting from a newly logged submission status. */
export function stageForSubmissionStatus(status: string) {
  if (["Submitted", "Under review", "Resubmitted"].includes(status)) {
    return SUBMITTED_UNDER_REVIEW_STAGE;
  }
  if (status === "Rejected" || status === "Revision requested") {
    return "Revisions";
  }
  if (status === "Accepted") return "Accepted";
  return null;
}
