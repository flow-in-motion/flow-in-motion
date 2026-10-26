import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  /** Sizes the area the message is centred in; the message itself stays a modest card. */
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  description = "This information could not be loaded. Please try again.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div className={cn("flex w-full items-center justify-center py-10", className)}>
      <div
        role="alert"
        // Sized by its content: compact for a short message, wider (up to a
        // comfortable reading width) and taller for a longer one.
        className="flex w-fit min-w-0 max-w-full flex-col items-center rounded-xl border bg-card px-6 py-7 text-center shadow-[var(--shadow-sm)] sm:min-w-[22rem] sm:max-w-2xl sm:px-8"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-400 dark:ring-red-900">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <p className="mt-3 break-words text-base font-semibold">{title}</p>
        <p className="mt-1 whitespace-pre-line break-words text-sm leading-6 text-muted-foreground">
          {description}
        </p>
        {onRetry ? (
          <Button type="button" variant="outline" size="sm" onClick={onRetry} className="mt-5">
            Try again
          </Button>
        ) : null}
      </div>
    </div>
  );
}
