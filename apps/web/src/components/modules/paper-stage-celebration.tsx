import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import confetti from "canvas-confetti";
import { PartyPopper, Volume2, VolumeX, X } from "lucide-react";

import { Button } from "@/components/ui/button";

export const SUBMITTED_UNDER_REVIEW_STAGE = "Submitted, Under Review";

/** How long the celebration stays on screen before closing by itself. */
export const CELEBRATION_DURATION_MS = 7000;

const SOUND_MUTED_KEY = "research-in-motion.celebration-sound-muted";
const CONFETTI_COLORS = ["#7c3aed", "#2563eb", "#0891b2", "#f59e0b", "#ec4899"];
const CONFETTI_Z_INDEX = 130;

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
 * Plays a short rising "ta-da" chime, synthesised with the Web Audio API so
 * no audio file has to be shipped. Silently does nothing where audio isn't
 * available (old browsers, tests) or the browser blocks playback.
 */
function playCelebrationChime() {
  const AudioContextClass =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    const context = new AudioContextClass();
    const master = context.createGain();
    master.gain.value = 0.18;
    master.connect(context.destination);

    // C5, E5, G5 arpeggio resolving onto a held C6 chord.
    const notes: Array<{ frequency: number; start: number; length: number }> = [
      { frequency: 523.25, start: 0, length: 0.22 },
      { frequency: 659.25, start: 0.11, length: 0.22 },
      { frequency: 783.99, start: 0.22, length: 0.24 },
      { frequency: 1046.5, start: 0.36, length: 0.9 },
      { frequency: 1318.51, start: 0.36, length: 0.9 },
      { frequency: 1567.98, start: 0.36, length: 0.9 },
    ];

    const now = context.currentTime;
    for (const note of notes) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.value = note.frequency;

      const start = now + note.start;
      const end = start + note.length;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.9, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);

      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(start);
      oscillator.stop(end + 0.05);
    }

    window.setTimeout(() => void context.close().catch(() => undefined), 1800);
  } catch {
    // Audio is a nice-to-have; never let it break the celebration.
  }
}

/** A big centre burst followed by side "cannons", fireworks-style. */
function launchConfetti() {
  void confetti({
    particleCount: 180,
    spread: 110,
    startVelocity: 55,
    scalar: 1.2,
    origin: { x: 0.5, y: 0.6 },
    colors: CONFETTI_COLORS,
    disableForReducedMotion: true,
    zIndex: CONFETTI_Z_INDEX,
  });

  const followUps = [
    { delay: 350, origin: { x: 0, y: 0.75 }, angle: 60 },
    { delay: 350, origin: { x: 1, y: 0.75 }, angle: 120 },
    { delay: 900, origin: { x: 0.2, y: 0.5 }, angle: 75 },
    { delay: 900, origin: { x: 0.8, y: 0.5 }, angle: 105 },
  ];

  return followUps.map(({ delay, origin, angle }) =>
    window.setTimeout(() => {
      void confetti({
        particleCount: 90,
        angle,
        spread: 70,
        startVelocity: 60,
        origin,
        colors: CONFETTI_COLORS,
        disableForReducedMotion: true,
        zIndex: CONFETTI_Z_INDEX,
      });
    }, delay),
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
  const [soundMuted, setSoundMuted] = useState(readSoundMuted);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  useEffect(() => {
    if (!open) return;

    const timers: number[] = [];
    if (!prefersReducedMotion()) timers.push(...launchConfetti());
    if (!readSoundMuted()) playCelebrationChime();

    timers.push(window.setTimeout(close, CELEBRATION_DURATION_MS));

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, close]);

  function toggleSound() {
    const nextMuted = !soundMuted;
    setSoundMuted(nextMuted);
    writeSoundMuted(nextMuted);
    if (!nextMuted) playCelebrationChime();
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 animate-in fade-in duration-300"
      onClick={close}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-br from-violet-950/70 via-slate-950/60 to-blue-950/70 backdrop-blur-sm"
      />

      <div
        role="status"
        aria-live="polite"
        onClick={(event) => event.stopPropagation()}
        className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-violet-200 bg-card px-6 pb-6 pt-10 text-center shadow-2xl animate-in fade-in zoom-in-90 slide-in-from-bottom-6 duration-500 motion-reduce:animate-none dark:border-violet-800 sm:px-10"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-violet-100 to-transparent dark:from-violet-950/60"
        />

        <div className="absolute right-3 top-3 flex items-center gap-1">
          <button
            type="button"
            onClick={toggleSound}
            aria-label={
              soundMuted
                ? "Unmute celebration sound"
                : "Mute celebration sound"
            }
            aria-pressed={soundMuted}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {soundMuted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={close}
            aria-label="Close celebration"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center">
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full bg-violet-400/40 animate-ping motion-reduce:animate-none"
          />
          <span
            aria-hidden="true"
            className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-blue-600 text-white shadow-lg animate-in zoom-in-50 spin-in-12 duration-700 motion-reduce:animate-none"
          >
            <PartyPopper className="h-11 w-11" />
          </span>
        </div>

        <p className="relative text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Paper submitted — congratulations!
        </p>
        <p className="relative mt-3 text-base text-muted-foreground">
          {paperTitle ? (
            <>
              <span className="font-semibold text-foreground">{paperTitle}</span>{" "}
              is now submitted and under review.
            </>
          ) : (
            "Your paper is now submitted and under review."
          )}
        </p>
        <p className="relative mt-1 text-sm text-muted-foreground">
          A big milestone. Fingers crossed for the reviewers!
        </p>

        <Button type="button" size="lg" className="relative mt-7" onClick={close}>
          Back to work
        </Button>

        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-1 bg-violet-100 dark:bg-violet-950"
        >
          <div
            className="h-full origin-left bg-gradient-to-r from-violet-600 to-blue-600 motion-reduce:hidden"
            style={{
              animation: `celebration-countdown ${CELEBRATION_DURATION_MS}ms linear forwards`,
            }}
          />
        </div>
      </div>

      <style>{`@keyframes celebration-countdown { from { transform: scaleX(1); } to { transform: scaleX(0); } }`}</style>
    </div>,
    document.body,
  );
}
