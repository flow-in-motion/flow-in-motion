import type { ApiModule, PaperCurrentlyWithType } from "@/api/hooks";

export const PAPER_CURRENTLY_WITH_LABELS: Record<
  PaperCurrentlyWithType,
  string
> = {
  me: "Me",
  collaborator: "Collaborator/Coauthor",
  journal: "Journal",
  friendly_reviewer: "Friendly reviewer",
};

export function paperCurrentlyWithLabel(
  paper: Pick<ApiModule, "assignedToUserId" | "currentlyWithType">,
  currentUserId?: string,
  nameByUserId?: ReadonlyMap<string, string>,
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
    return nameByUserId?.get(paper.assignedToUserId) ?? "Collaborator/Coauthor";
  }
  return paper.currentlyWithType
    ? PAPER_CURRENTLY_WITH_LABELS[paper.currentlyWithType]
    : "Not set";
}
