import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  description = "This information could not be loaded. Please try again.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex min-h-52 flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50/60 p-8 text-center dark:border-red-900 dark:bg-red-950/20",
        className,
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600 ring-1 ring-red-200 dark:bg-red-900/40 dark:text-red-400 dark:ring-red-800">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <p className="mt-4 text-base font-semibold">{title}</p>
      <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      {onRetry ? (
        <Button type="button" variant="outline" size="sm" onClick={onRetry} className="mt-5">
          Try again
        </Button>
      ) : null}
    </div>
  );
}
