/**
 * One colour, one meaning, everywhere in the app. Normal states carry no
 * colour, so colour only appears when something is worth noticing:
 *
 * - neutral   — the normal state: Active, To do, Underway, Low/Medium
 *               priority, every role. No colour.
 * - success   — finished: Complete, Accepted, Successful.
 * - attention — needs a look soon: High priority, Stalled, Waiting, Review.
 * - danger    — urgent or blocked: Critical, Blocked, Overdue, Rejected.
 *
 * The workspace's own accent colour (the colour theme) is used for
 * navigation, buttons and icons — never to mean a status.
 */
export type Tone = "neutral" | "success" | "attention" | "danger";

const VALUE_TONES: Record<string, Tone> = {
  // Finished
  Complete: "success",
  Completed: "success",
  Accepted: "success",
  Successful: "success",
  Presented: "success",
  // Needs a look
  High: "attention",
  Review: "attention",
  Stalled: "attention",
  Waiting: "attention",
  "Revision requested": "attention",
  // Urgent or blocked
  Critical: "danger",
  Blocked: "danger",
  Overdue: "danger",
  Rejected: "danger",
};

/** The tone for a status, priority or result value. Unknown values are neutral. */
export function toneFor(value: string | null | undefined): Tone {
  return (value && VALUE_TONES[value]) || "neutral";
}

/** Outlined text, for inline dropdowns in tables (border + text colour). */
export const TONE_PILL_CLASSES: Record<Tone, string> = {
  neutral: "border-border text-muted-foreground",
  success:
    "border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400",
  attention:
    "border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400",
  danger: "border-red-300 text-red-700 dark:border-red-800 dark:text-red-400",
};

/** Filled badge (border + soft background + text colour). */
export const TONE_BADGE_CLASSES: Record<Tone, string> = {
  neutral: "border-border bg-muted/50 text-muted-foreground",
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400",
  attention:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  danger:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400",
};

/** Small solid dot or chart segment. */
export const TONE_DOT_CLASSES: Record<Tone, string> = {
  neutral: "bg-muted-foreground/50",
  success: "bg-emerald-500",
  attention: "bg-amber-500",
  danger: "bg-red-500",
};

/** Text colour inside SVG drawings (e.g. mind map bubbles). */
export const TONE_FILL_CLASSES: Record<Tone, string> = {
  neutral: "fill-muted-foreground",
  success: "fill-emerald-700 dark:fill-emerald-400",
  attention: "fill-amber-700 dark:fill-amber-300",
  danger: "fill-red-700 dark:fill-red-400",
};

/** Inline-dropdown classes for a status or priority value. */
export function statusPillClass(value: string | null) {
  return TONE_PILL_CLASSES[toneFor(value)];
}

export const priorityPillClass = statusPillClass;

/** Roles describe who someone is, not a state, so they are never coloured. */
export function rolePillClass() {
  return TONE_PILL_CLASSES.neutral;
}

/** Filled-badge classes for a status or priority value. */
export function statusBadgeClass(value: string | null) {
  return TONE_BADGE_CLASSES[toneFor(value)];
}
