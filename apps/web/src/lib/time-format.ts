/** "45m", "4h 20m", "6h". Under a minute shows as "<1m" (0 as "0m"). */
export function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  if (seconds === 0) return "0m";
  if (seconds < 60) return "<1m";
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** A running clock: "04:05", "1:02:09". */
export function formatClock(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(secs).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** A task's estimate ("1.50") in seconds, or null when there isn't one. */
export function estimateSeconds(estimatedHours: string | number | null | undefined) {
  if (estimatedHours === null || estimatedHours === undefined || estimatedHours === "") {
    return null;
  }
  const hours = Number(estimatedHours);
  if (!Number.isFinite(hours) || hours <= 0) return null;
  return Math.round(hours * 3600);
}

/**
 * A task's estimate in the same style as logged time ("1h 30m"), so the two
 * are easy to compare. "—" when there is no estimate.
 */
export function formatEstimate(estimatedHours: string | number | null | undefined) {
  const seconds = estimateSeconds(estimatedHours);
  return seconds === null ? "—" : formatDuration(seconds);
}

/** "2026-10-28" for a Date, in the viewer's time zone. */
export function localDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * The moment to record for time added by hand on a day: midday local time,
 * so the day stays the same in any nearby time zone.
 */
export function middayOn(dateInput: string) {
  const [year, month, day] = dateInput.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, 12, 0, 0, 0);
}
