import { useLiveTimer } from "@/api/time-tracking";
import { formatDuration } from "@/lib/time-format";

export function PaperLoggedTime({
  paper,
  emptyLabel = "—",
}: {
  paper: { id: string; loggedSeconds?: number };
  emptyLabel?: string;
}) {
  const live = useLiveTimer();
  const seconds =
    (paper.loggedSeconds ?? 0) + live.extraSecondsForPaper(paper.id);

  return <>{seconds > 0 ? formatDuration(seconds) : emptyLabel}</>;
}
