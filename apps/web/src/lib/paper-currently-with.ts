import type { ApiModule, PaperCurrentlyWithType } from "@/api/hooks";

export const PAPER_CURRENTLY_WITH_LABELS: Record<
  PaperCurrentlyWithType,
  string
> = {
  me: "Me",
  collaborator: "Collaborator/Coauthor",
  journal: "Journal",
  friendly_reviewer: "Friendly reviewer",
  others: "Others",
};

/** Shown when a paper is with a collaborator but no specific person is chosen. */
export const GENERAL_COLLABORATOR_LABEL = "Collaborator/Author";

export function paperCurrentlyWithLabel(
  paper: Pick<
    ApiModule,
    | "assignedToUserId"
    | "assignedToInvitationId"
    | "assignedToDisplayName"
    | "currentlyWithType"
  >,
  currentUserId?: string,
  nameByAssigneeId?: ReadonlyMap<string, string>,
) {
  if (paper.currentlyWithType === "journal") return "Journal";
  if (paper.currentlyWithType === "friendly_reviewer") {
    return "Friendly reviewer";
  }
  if (
    paper.currentlyWithType === "me" ||
    (paper.assignedToUserId && paper.assignedToUserId === currentUserId)
  ) {
    return "Me";
  }
  if (paper.assignedToUserId) {
    return (
      paper.assignedToDisplayName ??
      nameByAssigneeId?.get(paper.assignedToUserId) ??
      "Collaborator/Coauthor"
    );
  }
  if (paper.assignedToInvitationId) {
    return (
      paper.assignedToDisplayName ??
      nameByAssigneeId?.get(paper.assignedToInvitationId) ??
      "Collaborator/Coauthor"
    );
  }
  if (paper.currentlyWithType === "collaborator") {
    return GENERAL_COLLABORATOR_LABEL;
  }
  return paper.currentlyWithType
    ? PAPER_CURRENTLY_WITH_LABELS[paper.currentlyWithType]
    : "Not set";
}
