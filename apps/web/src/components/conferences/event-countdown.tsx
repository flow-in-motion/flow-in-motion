import { conferenceEventCountdown } from "@/lib/conference-format";

export function EventCountdown({
  startDate,
}: {
  startDate: string | null | undefined;
}) {
  const label = conferenceEventCountdown(startDate);
  return label ? (
    <span className="block text-xs text-muted-foreground">{label}</span>
  ) : null;
}
