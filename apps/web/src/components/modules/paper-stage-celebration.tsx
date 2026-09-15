import { useEffect } from "react";
import { createPortal } from "react-dom";
import confetti from "canvas-confetti";
import { Sparkles, X } from "lucide-react";

export const SUBMITTED_UNDER_REVIEW_STAGE = "Submitted, Under Review";

export function enteredSubmittedUnderReview(
  previousStage: string | null | undefined,
  nextStage: string | null | undefined,
) {
  return (
    previousStage !== SUBMITTED_UNDER_REVIEW_STAGE &&
    nextStage === SUBMITTED_UNDER_REVIEW_STAGE
  );
}

interface PaperStageCelebrationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paperTitle?: string | null;
}

export function PaperStageCelebration({
  open,
  onOpenChange,
  paperTitle,
}: PaperStageCelebrationProps) {
  useEffect(() => {
    if (!open) return;

    const prefersReducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!prefersReducedMotion) {
      void confetti({
        particleCount: 110,
        spread: 80,
        startVelocity: 42,
        origin: { x: 0.5, y: 0.7 },
        colors: ["#7c3aed", "#2563eb", "#0891b2", "#f59e0b"],
        disableForReducedMotion: true,
        zIndex: 120,
      });
    }

    const timeout = window.setTimeout(() => {
      onOpenChange(false);
    }, 4500);

    return () => window.clearTimeout(timeout);
  }, [open, onOpenChange]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 z-[120] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-violet-200 bg-card p-4 shadow-xl dark:border-violet-800"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="rounded-xl bg-violet-100 p-2 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
        >
          <Sparkles className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">
            Paper submitted — congratulations!
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {paperTitle ? (
              <>
                <span className="font-medium text-foreground">{paperTitle}</span>{" "}
                is now submitted and under review.
              </>
            ) : (
              "Your paper is now submitted and under review."
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label="Close celebration"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>,
    document.body,
  );
}
