import { Badge } from "@/components/ui/badge";
import { TONE_BADGE_CLASSES, toneFor, type Tone } from "@/lib/tones";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  tone?: Tone;
  className?: string;
}

export function StatusBadge({ status, tone, className }: StatusBadgeProps) {
  // Same meaning, same colour as everywhere else — see lib/tones.
  const resolvedTone = tone ?? toneFor(status);

  return (
    <Badge
      variant="outline"
      className={cn(
        "whitespace-nowrap before:mr-1.5 before:h-1.5 before:w-1.5 before:rounded-full before:bg-current before:opacity-70",
        TONE_BADGE_CLASSES[resolvedTone],
        className,
      )}
    >
      {status}
    </Badge>
  );
}
