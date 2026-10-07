import { useEffect, useState, type FormEvent } from "react";
import { Star, X } from "lucide-react";

import { useCreateFeedback } from "@/api/hooks";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface FeedbackDialogProps {
  open: boolean;
  tenantId: string;
  onOpenChange: (open: boolean) => void;
  /**
   * A screenshot captured by the caller before opening this dialog (so the
   * capture happens before the dialog itself is in the DOM). Optional —
   * the person can also remove it before sending.
   */
  initialScreenshotDataUrl?: string;
}

export function FeedbackDialog({
  open,
  tenantId,
  onOpenChange,
  initialScreenshotDataUrl,
}: FeedbackDialogProps) {
  const createFeedback = useCreateFeedback(tenantId);

  const [message, setMessage] = useState("");
  const [rating, setRating] = useState<number | undefined>();
  const [hoverRating, setHoverRating] = useState<number | undefined>();
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<
    string | undefined
  >(initialScreenshotDataUrl);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setScreenshotDataUrl(initialScreenshotDataUrl);
    }
    // Only pick up a freshly captured screenshot when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function reset() {
    setMessage("");
    setRating(undefined);
    setHoverRating(undefined);
    setScreenshotDataUrl(undefined);
    setSubmitted(false);
    setError(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      reset();
    }

    onOpenChange(nextOpen);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedMessage = message.trim();

    if (trimmedMessage.length < 2) {
      setError("Please enter at least 2 characters.");
      return;
    }

    setError(null);

    try {
      await createFeedback.mutateAsync({
        message: trimmedMessage,
        rating,
        screenshotDataUrl,
      });

      setSubmitted(true);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Your feedback could not be submitted. Please try again.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        {submitted ? (
          <>
            <DialogHeader>
              <DialogTitle>Thank you for your feedback</DialogTitle>
              <DialogDescription>
                Your feedback has been recorded and will help us improve the
                research experience.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter>
              <Button
                type="button"
                onClick={() => handleOpenChange(false)}
              >
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <DialogHeader>
              <DialogTitle>Share feedback</DialogTitle>
              <DialogDescription>
                Tell us what is working well or what could be improved.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <label
                htmlFor="feedback-message"
                className="text-sm font-medium"
              >
                What were you trying to do?
              </label>

              <Textarea
                id="feedback-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="What were you trying to do, and what happened?"
                rows={6}
                minLength={2}
                maxLength={2000}
                required
              />

              <p className="text-right text-xs text-muted-foreground">
                {message.length}/2000
              </p>
            </div>

            {screenshotDataUrl ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Screenshot</p>
                <div className="relative overflow-hidden rounded-md border">
                  <img
                    src={screenshotDataUrl}
                    alt="Screenshot of the current page"
                    className="max-h-40 w-full object-cover object-top"
                  />
                  <button
                    type="button"
                    onClick={() => setScreenshotDataUrl(undefined)}
                    aria-label="Remove screenshot"
                    title="Remove screenshot"
                    className="absolute right-1.5 top-1.5 rounded-full bg-background/90 p-1 text-muted-foreground shadow-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ) : null}

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">
                Rating <span className="text-muted-foreground">(optional)</span>
              </legend>

              <div
                className="flex gap-1"
                onMouseLeave={() => setHoverRating(undefined)}
              >
                {[1, 2, 3, 4, 5].map((value) => {
                  const filled = value <= (hoverRating ?? rating ?? 0);
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-label={`Rate ${value} out of 5`}
                      aria-pressed={rating === value}
                      onMouseEnter={() => setHoverRating(value)}
                      onClick={() =>
                        setRating((current) =>
                          current === value ? undefined : value,
                        )
                      }
                      className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Star
                        className={cn(
                          "h-6 w-6",
                          filled && "fill-amber-400 text-amber-500",
                        )}
                      />
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={createFeedback.isPending}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                disabled={
                  !tenantId ||
                  message.trim().length < 2 ||
                  createFeedback.isPending
                }
              >
                {createFeedback.isPending
                  ? "Sending…"
                  : "Send feedback"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
