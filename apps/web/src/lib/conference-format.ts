export const CONFERENCE_TYPE_FILTERS = ["All", "Abstract", "Full paper", "Poster"] as const;
export const CONFERENCE_DEADLINE_FILTERS = ["All", "This week", "This month", "Later", "Past"] as const;

export type ConferenceTypeFilter = (typeof CONFERENCE_TYPE_FILTERS)[number];
export type ConferenceDeadlineFilter = (typeof CONFERENCE_DEADLINE_FILTERS)[number];

export function formatConferenceDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" })
    .format(new Date(year, month - 1, day));
}

export function formatConferenceDateRange(startDate: string, endDate: string) {
  if (startDate === endDate) return formatConferenceDate(startDate);
  return `${formatConferenceDate(startDate)} – ${formatConferenceDate(endDate)}`;
}

export function conferenceTypeBadgeClass(type: string | null) {
  if (type === "Abstract") return "border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400";
  if (type === "Poster") return "border-violet-300 text-violet-700 dark:border-violet-800 dark:text-violet-400";
  return "border-blue-300 text-blue-700 dark:border-blue-800 dark:text-blue-400";
}

export function conferenceUrgencyLabel(daysRemaining: number) {
  if (daysRemaining < 0) return `${Math.abs(daysRemaining)} day${daysRemaining === -1 ? "" : "s"} overdue`;
  if (daysRemaining === 0) return "Due today";
  return `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left`;
}

export function conferenceUrgencyClass(daysRemaining: number) {
  if (daysRemaining <= 3) return "font-semibold text-destructive";
  if (daysRemaining <= 7) return "font-medium text-orange-600 dark:text-orange-400";
  return "text-muted-foreground";
}

export function matchesConferenceDeadline(daysRemaining: number, filter: ConferenceDeadlineFilter) {
  switch (filter) {
    case "All":
      return true;
    case "This week":
      return daysRemaining >= 0 && daysRemaining <= 7;
    case "This month":
      return daysRemaining > 7 && daysRemaining <= 30;
    case "Later":
      return daysRemaining > 30;
    case "Past":
      return daysRemaining < 0;
  }
}
