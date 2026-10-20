import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PartyPopper, Volume2, VolumeX, X } from "lucide-react";

import { Button } from "@/components/ui/button";

export const SUBMITTED_UNDER_REVIEW_STAGE = "Submitted, Under Review";

/** The fireworks video is 5s; keep the message up a little longer. */
export const CELEBRATION_DURATION_MS = 7000;

export const CELEBRATION_VIDEO_SRC = "/celebration/submission-fireworks.mp4";

const SOUND_MUTED_KEY = "research-in-motion.celebration-sound-muted";

export function enteredSubmittedUnderReview(
  previousStage: string | null | undefined,
  nextStage: string | null | undefined,
) {
  return (
    previousStage !== SUBMITTED_UNDER_REVIEW_STAGE &&
    nextStage === SUBMITTED_UNDER_REVIEW_STAGE
  );
}

function readSoundMuted() {
  try {
    return window.localStorage.getItem(SOUND_MUTED_KEY) === "true";
  } catch {
    return false;
  }
}

function writeSoundMuted(muted: boolean) {
  try {
    window.localStorage.setItem(SOUND_MUTED_KEY, String(muted));
  } catch {
    // Storage can be unavailable (private browsing); the choice just
    // won't be remembered next time.
  }
}

function prefersReducedMotion() {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Starts playback, falling back to muted playback if the browser blocks
 * autoplay with sound. Never throws: the video is decoration.
 */
function startVideo(video: HTMLVideoElement, muted: boolean) {
  try {
    video.muted = muted;
    const attempt = video.play();
    if (attempt && typeof attempt.catch === "function") {
      attempt.catch(() => {
        if (video.muted) return;
        video.muted = true;
        video.play()?.catch?.(() => undefined);
      });
    }
  } catch {
    // Media playback isn't available (e.g. in tests); show the card anyway.
  }
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
  const [soundMuted, setSoundMuted] = useState(readSoundMuted);
  const [showVideo] = useState(() => !prefersReducedMotion());
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  useEffect(() => {
    if (!open) return;

    if (videoRef.current) startVideo(videoRef.current, readSoundMuted());

    const timeout = window.setTimeout(close, CELEBRATION_DURATION_MS);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, close]);

  function toggleSound() {
    const nextMuted = !soundMuted;
    setSoundMuted(nextMuted);
    writeSoundMuted(nextMuted);
    if (videoRef.current) videoRef.current.muted = nextMuted;
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] overflow-hidden bg-[#02030a] animate-in fade-in duration-300"
      onClick={close}
    >
      {showVideo ? (
        <video
          ref={videoRef}
          data-testid="celebration-video"
          src={CELEBRATION_VIDEO_SRC}
          autoPlay
          playsInline
          muted={soundMuted}
          preload="auto"
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}

      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#02030a]/90 via-[#02030a]/40 to-transparent"
      />

      <div className="absolute right-4 top-4 z-10 flex items-center gap-1">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            toggleSound();
          }}
          aria-label={
            soundMuted ? "Unmute celebration sound" : "Mute celebration sound"
          }
          aria-pressed={soundMuted}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur transition-colors hover:bg-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          {soundMuted ? (
            <VolumeX className="h-5 w-5" />
          ) : (
            <Volume2 className="h-5 w-5" />
          )}
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            close();
          }}
          aria-label="Close celebration"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur transition-colors hover:bg-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex justify-center px-4 pb-10 sm:pb-16">
        <div
          role="status"
          aria-live="polite"
          onClick={(event) => event.stopPropagation()}
          className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/15 bg-white/10 px-6 pb-6 pt-7 text-center text-white shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-8 duration-700 motion-reduce:animate-none sm:px-10"
        >
          <span
            aria-hidden="true"
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-500 shadow-lg"
          >
            <PartyPopper className="h-7 w-7" />
          </span>

          <p className="text-2xl font-bold tracking-tight sm:text-3xl">
            Paper submitted — congratulations!
          </p>
          <p className="mt-3 text-base text-white/80">
            {paperTitle ? (
              <>
                <span className="font-semibold text-white">{paperTitle}</span>{" "}
                is now submitted and under review.
              </>
            ) : (
              "Your paper is now submitted and under review."
            )}
          </p>
          <p className="mt-1 text-sm text-white/60">
            A big milestone. Fingers crossed for the reviewers!
          </p>

          <Button
            type="button"
            size="lg"
            variant="secondary"
            className="mt-6"
            onClick={close}
          >
            Back to work
          </Button>

          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-1 bg-white/10"
          >
            <div
              className="h-full origin-left bg-gradient-to-r from-violet-400 to-blue-400 motion-reduce:hidden"
              style={{
                animation: `celebration-countdown ${CELEBRATION_DURATION_MS}ms linear forwards`,
              }}
            />
          </div>
        </div>
      </div>

      <style>{`@keyframes celebration-countdown { from { transform: scaleX(1); } to { transform: scaleX(0); } }`}</style>
    </div>,
    document.body,
  );
}
