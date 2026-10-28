import type { ApiDueReminder } from "@/api/due-reminders";

const dayFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** "Due tomorrow", "Overdue by 3 days", "Follow up in 5 days (Mon 2 Nov)". */
export function reminderWhen(reminder: Pick<ApiDueReminder, "type" | "daysUntil" | "dueDate">) {
  const followUp =
    reminder.type === "note" || reminder.type === "funding_follow_up";
  const verb = followUp ? "Follow up" : "Due";
  const days = reminder.daysUntil;
  if (days < 0) {
    return followUp
      ? `Follow-up was ${plural(-days, "day")} ago`
      : `Overdue by ${plural(-days, "day")}`;
  }
  if (days === 0) return `${verb} today`;
  if (days === 1) return `${verb} tomorrow`;
  const date = dayFormat.format(new Date(`${reminder.dueDate}T00:00:00`));
  return `${verb} in ${days} days (${date})`;
}

export type ReminderGroupId = "overdue" | "today" | "tomorrow" | "soon";

export const REMINDER_GROUPS: Array<{ id: ReminderGroupId; label: string }> = [
  { id: "overdue", label: "Overdue" },
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "soon", label: "Coming up" },
];

export function reminderGroup(daysUntil: number): ReminderGroupId {
  if (daysUntil < 0) return "overdue";
  if (daysUntil === 0) return "today";
  if (daysUntil === 1) return "tomorrow";
  return "soon";
}

export const REMINDER_KIND_LABELS: Record<ApiDueReminder["type"], string> = {
  task: "Task",
  paper: "Paper",
  project: "Project",
  conference: "Event deadline",
  conference_submission: "Submission",
  funding_deadline: "Funding",
  funding_follow_up: "Funding",
  note: "Note",
};
