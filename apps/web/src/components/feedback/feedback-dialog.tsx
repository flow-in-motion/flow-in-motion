import { useState, type FormEvent } from "react";
import { Star } from "lucide-react";

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
}

export function FeedbackDialog({
  open,
  tenantId,
  onOpenChange,
}: FeedbackDialogProps) {
  const createFeedback = useCreateFeedback(tenantId);

  const [message, setMessage] = useState("");
  const [rating, setRating] = useState<number | undefined>();
  const [hoverRating, setHoverRating] = useState<number | undefined>();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setMessage("");
    setRating(undefined);
    setHoverRating(undefined);
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
                Feedback
              </label>

              <Textarea
                id="feedback-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Share your feedback…"
                rows={6}
                minLength={2}
                maxLength={2000}
                required
              />

              <p className="text-right text-xs text-muted-foreground">
                {message.length}/2000
              </p>
            </div>

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
