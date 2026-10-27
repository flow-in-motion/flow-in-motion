/**
 * Any time-bounded thing with a submission deadline: a conference, a
 * workshop, a research seminar talk, a journal special issue's call for
 * papers, or something else. Matches the API and database check.
 */
export const CONFERENCE_EVENT_TYPES = [
  "Conference",
  "Workshop",
  "Research seminar",
  "Journal special issue",
  "Other",
] as const;

export type ConferenceEventType = (typeof CONFERENCE_EVENT_TYPES)[number];
