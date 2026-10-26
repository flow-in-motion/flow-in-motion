import { LoaderCircle } from "lucide-react";

import { PageSkeleton, type PageSkeletonLayout } from "@/components/shared/page-skeleton";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  title?: string;
  description?: string;
  className?: string;
  /**
   * "panel" (default) is a small spinner card for a section of a page. For a
   * whole page, pass the page's shape so placeholders appear where the real
   * content will — see PageSkeleton.
   */
  layout?: "panel" | PageSkeletonLayout;
}

export function LoadingState({
  title = "Loading",
  description = "Please wait while this information is prepared.",
  className,
  layout = "panel",
}: LoadingStateProps) {
  if (layout !== "panel") {
    return <PageSkeleton title={title} layout={layout} className={className} />;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex min-h-48 flex-col items-center justify-center rounded-lg border bg-card p-8 text-center",
        className,
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-primary ring-1 ring-border">
        <LoaderCircle className="h-5 w-5 animate-spin" />
      </div>
      <p className="mt-4 text-sm font-semibold">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>

      <div className="mt-6 flex w-full max-w-xs flex-col gap-2" aria-hidden="true">
        <div className="h-2 w-full animate-pulse rounded-full bg-muted" />
        <div className="h-2 w-4/5 animate-pulse rounded-full bg-muted [animation-delay:150ms]" />
        <div className="h-2 w-3/5 animate-pulse rounded-full bg-muted [animation-delay:300ms]" />
      </div>
    </div>
  );
}
