import { SUBMITTED_UNDER_REVIEW_STAGE } from "@/components/modules/paper-stage-celebration";

/** The paper stage resulting from a newly logged submission status. */
export function stageForSubmissionStatus(status: string) {
  if (["Submitted", "Under review", "Resubmitted"].includes(status)) {
    return SUBMITTED_UNDER_REVIEW_STAGE;
  }
  if (status === "Rejected" || status === "Revision requested") {
    return "Revisions";
  }
  return null;
}
