/** The kinds of dated item a reminder can be about. */
export const REMINDER_ITEM_TYPES = [
  'task',
  'paper',
  'project',
  'conference',
  'conference_submission',
  'funding_deadline',
  'funding_follow_up',
  'note',
] as const;
export type ReminderItemType = (typeof REMINDER_ITEM_TYPES)[number];

/** The groups people switch on and off in Settings. */
export type ReminderGroup =
  'tasks' | 'papers' | 'projects' | 'events' | 'funding' | 'notes';

export const GROUP_OF: Record<ReminderItemType, ReminderGroup> = {
  task: 'tasks',
  paper: 'papers',
  project: 'projects',
  conference: 'events',
  conference_submission: 'events',
  funding_deadline: 'funding',
  funding_follow_up: 'funding',
  note: 'notes',
};

/**
 * How long overdue items keep being shown, in days. Null keeps them until
 * the item is done or the reminder dismissed; 0 means never (a passed event
 * deadline can't be acted on any more).
 */
export const OVERDUE_FOR_DAYS: Record<ReminderItemType, number | null> = {
  task: null,
  paper: null,
  project: null,
  conference: 0,
  conference_submission: 0,
  funding_deadline: null,
  funding_follow_up: 14,
  note: 14,
};

/** A dated item the person can see, before reminder rules are applied. */
export interface ReminderCandidate {
  type: ReminderItemType;
  itemId: string;
  /** The page the reminder opens (a conference for its submissions). */
  targetId: string;
  title: string;
  /** Where it belongs, e.g. its project or event. */
  context: string | null;
  dueDate: string;
}
