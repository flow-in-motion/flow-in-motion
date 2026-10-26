import { TONE_BADGE_CLASSES, toneFor } from "@/lib/tones";

/** Filled badge for a task priority — see lib/tones for what each colour means. */
export function priorityBadgeClass(priority: string | null) {
  if (!priority) return "border-border bg-transparent text-muted-foreground";
  return TONE_BADGE_CLASSES[toneFor(priority)];
}
