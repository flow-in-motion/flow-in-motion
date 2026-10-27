import {
  CONFERENCE_EVENT_TYPES,
  type ConferenceEventType,
} from "@/lib/conference-event-types";

/** How each kind of event is described in forms and pages. */
export interface EventWording {
  /** Lower case, e.g. "research seminar". */
  noun: string;
  nameLabel: string;
  namePlaceholder: string;
  locationLabel: string;
  locationPlaceholder: string;
  /** A journal special issue has a deadline but no event dates. */
  hasEventDates: boolean;
}

const EVENT_WORDING: Record<ConferenceEventType, EventWording> = {
  Conference: {
    noun: "conference",
    nameLabel: "Conference name",
    namePlaceholder: "Conference name and year",
    locationLabel: "Location",
    locationPlaceholder: "City, country",
    hasEventDates: true,
  },
  Workshop: {
    noun: "workshop",
    nameLabel: "Workshop name",
    namePlaceholder: "Workshop name and year",
    locationLabel: "Location",
    locationPlaceholder: "City, country, or online",
    hasEventDates: true,
  },
  "Research seminar": {
    noun: "research seminar",
    nameLabel: "Seminar name",
    namePlaceholder: "e.g. School of Business research seminar",
    locationLabel: "Location",
    locationPlaceholder: "Venue, or online",
    hasEventDates: true,
  },
  "Journal special issue": {
    noun: "journal special issue",
    nameLabel: "Special issue title",
    namePlaceholder: "e.g. Special issue on AI in accounting",
    locationLabel: "Journal",
    locationPlaceholder: "Journal name",
    hasEventDates: false,
  },
  Other: {
    noun: "event",
    nameLabel: "Event name",
    namePlaceholder: "Event name",
    locationLabel: "Location",
    locationPlaceholder: "Where it happens",
    hasEventDates: true,
  },
};

export function eventWording(eventType: ConferenceEventType | null | undefined): EventWording {
  return EVENT_WORDING[eventType ?? "Conference"] ?? EVENT_WORDING.Conference;
}

export const CONFERENCE_TYPE_FILTERS = ["All", "Abstract", "Full paper", "Poster"] as const;
export const CONFERENCE_DEADLINE_FILTERS = ["All", "This week", "This month", "Later", "Past"] as const;

export type ConferenceTypeFilter = (typeof CONFERENCE_TYPE_FILTERS)[number];

/** Filter by kind of event: conference, workshop, seminar, special issue, … */
export const CONFERENCE_EVENT_FILTERS = ["All", ...CONFERENCE_EVENT_TYPES] as const;
export type ConferenceEventFilter = (typeof CONFERENCE_EVENT_FILTERS)[number];

/** An event with no type saved yet counts as a conference. */
export function matchesEventFilter(
  eventType: ConferenceEventType | null | undefined,
  filter: ConferenceEventFilter,
) {
  return filter === "All" || (eventType ?? "Conference") === filter;
}
export type ConferenceDeadlineFilter = (typeof CONFERENCE_DEADLINE_FILTERS)[number];

export function formatConferenceDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" })
    .format(new Date(year, month - 1, day));
}

export function formatConferenceDateRange(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
) {
  if (!startDate && !endDate) return "—";
  if (!startDate) return formatConferenceDate(endDate);
  if (!endDate) return formatConferenceDate(startDate);
  if (startDate === endDate) return formatConferenceDate(startDate);
  return `${formatConferenceDate(startDate)} – ${formatConferenceDate(endDate)}`;
}

export function conferenceTypeBadgeClass(type: string | null) {
  if (type === "Abstract") return "border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400";
  if (type === "Poster") return "border-violet-300 text-violet-700 dark:border-violet-800 dark:text-violet-400";
  return "border-blue-300 text-blue-700 dark:border-blue-800 dark:text-blue-400";
}

export function conferenceUrgencyLabel(daysRemaining: number | null) {
  if (daysRemaining === null) return "No deadline";
  if (daysRemaining < 0) return `${Math.abs(daysRemaining)} day${daysRemaining === -1 ? "" : "s"} overdue`;
  if (daysRemaining === 0) return "Due today";
  return `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left`;
}

export function conferenceUrgencyClass(daysRemaining: number | null) {
  if (daysRemaining === null) return "text-muted-foreground";
  if (daysRemaining <= 3) return "font-semibold text-destructive";
  if (daysRemaining <= 7) return "font-medium text-orange-600 dark:text-orange-400";
  return "text-muted-foreground";
}

export function matchesConferenceDeadline(
  daysRemaining: number | null,
  filter: ConferenceDeadlineFilter,
) {
  if (filter === "All") return true;
  if (daysRemaining === null) return false;
  switch (filter) {
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
