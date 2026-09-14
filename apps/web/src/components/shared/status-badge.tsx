import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusTone = "blue" | "green" | "orange" | "red" | "grey";

const inferredTones: Record<string, StatusTone> = {
  Active: "green",
  Complete: "green",
  Successful: "green",
  Lead: "green",
  Owner: "blue",
  Medium: "blue",
  Review: "orange",
  High: "orange",
  Collaborator: "orange",
  Critical: "red",
  Blocked: "red",
  Stalled: "red",
  "On hold": "red",
  Supervisor: "grey",
};

const toneClasses: Record<StatusTone, string> = {
  blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
  green:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  orange:
    "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300",
  red: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300",
  grey: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300",
};

interface StatusBadgeProps {
  status: string;
  tone?: StatusTone;
  className?: string;
}

export function StatusBadge({ status, tone, className }: StatusBadgeProps) {
  const resolvedTone = tone ?? inferredTones[status] ?? "grey";

  return (
    <Badge
      variant="outline"
      className={cn(
        "whitespace-nowrap before:mr-1.5 before:h-1.5 before:w-1.5 before:rounded-full before:bg-current before:opacity-70",
        toneClasses[resolvedTone],
        className,
      )}
    >
      {status}
    </Badge>
  );
}
