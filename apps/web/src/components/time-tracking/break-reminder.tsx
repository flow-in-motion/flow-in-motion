import { useEffect, useState } from "react";
import { Coffee } from "lucide-react";

import {
  useBreakReminderSettings,
  useCurrentTimer,
  usePauseTimer,
  useTicker,
} from "@/api/time-tracking";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SNOOZE_MS, decideBreak } from "@/lib/break-reminders";
import { setBreakState, useBreakState } from "@/lib/break-state";
import { playChime, primeChime } from "@/lib/chime";
import { appIsInBackground, showNotification } from "@/lib/notify";
import { formatDuration } from "@/lib/time-format";

/**
 * While a task timer runs, reminds the person to take a break after the
 * time they chose in Settings. Taking a break pauses the timer and counts
 * the break down in the timer bar.
 */
export function BreakReminder() {
  const { settings, isLoaded } = useBreakReminderSettings();
  const current = useCurrentTimer();
  const pause = usePauseTimer();
  const state = useBreakState();
  const [error, setError] = useState<string | null>(null);

  const [takingBreak, setTakingBreak] = useState(false);

  const timers = current.data?.timers;
  const timerCount = timers?.length ?? 0;
  const onlyTimer = timerCount === 1 ? timers?.[0] : undefined;
  const itemTitle = onlyTimer?.moduleId
    ? onlyTimer.paperTitle || "Untitled paper"
    : onlyTimer?.taskTitle || "Untitled task";

  let longestRunningSeconds: number | null = null;
  let runningCount = 0;

  for (const timer of timers ?? []) {
    if (timer.isRunning) {
      runningCount += 1;
      longestRunningSeconds = Math.max(
        longestRunningSeconds ?? 0,
        timer.runningSeconds,
      );
    }
  }

  const active = isLoaded && settings.enabled && timerCount > 0;
  const now = useTicker(active);
  const stretchStart =
    longestRunningSeconds !== null && current.data
      ? current.data.receivedAt - longestRunningSeconds * 1000
      : null;

  const decision = decideBreak({
    now,
    settings,
    state,
    timerOpen: timerCount > 0,
    stretchStart,
  });

  // Browsers only allow sound after a click or key press on the page.
  useEffect(() => {
    if (!settings.sound) return;
    const prime = () => primeChime();
    window.addEventListener("pointerdown", prime, { once: true });
    window.addEventListener("keydown", prime, { once: true });
    return () => {
      window.removeEventListener("pointerdown", prime);
      window.removeEventListener("keydown", prime);
    };
  }, [settings.sound]);

  useEffect(() => {
    if (!active) return;
    const latest = decideBreak({
      now,
      settings,
      state,
      timerOpen: timerCount > 0,
      stretchStart,
    });
    const update = { ...(latest.update ?? {}) };

    if (settings.sound) {
      if (latest.reminderDue && state.chimedFor !== latest.reminderAt) {
        playChime("reminder");
        update.chimedFor = latest.reminderAt;
      }
      if (latest.breakOver && state.chimedBreakEnd !== state.breakEndsAt) {
        playChime("break-over");
        update.chimedBreakEnd = state.breakEndsAt;
      }
    }

    // A notification is for when the app isn't in front: in another tab,
    // behind another app, or minimised. Otherwise the pop-up is enough.
    if (settings.notifications && appIsInBackground()) {
      if (latest.reminderDue && state.notifiedFor !== latest.reminderAt) {
        showNotification(
          "Time for a break",
          `You've been working for ${formatDuration(latest.workedMs / 1000)}. Step away for ${settings.breakMinutes} minutes.`,
          "rim-break",
          // The app plays its own chime, so keep the system one quiet.
          { silent: settings.sound },
        );
        update.notifiedFor = latest.reminderAt;
      }
      if (latest.breakOver && state.notifiedBreakEnd !== state.breakEndsAt) {
        showNotification(
          "Break's over",
          timerCount === 1
  ? `Ready to get back to “${itemTitle}”?`
  : "Ready to get back to work?",
          "rim-break",
          { silent: settings.sound },
        );
        update.notifiedBreakEnd = state.breakEndsAt;
      }
    }

    if (Object.keys(update).length > 0) setBreakState(update);
  }, [active, now, settings, state, stretchStart, timerCount, itemTitle]);

  const open =
  active && (decision.reminderDue || takingBreak || error !== null);

  async function takeBreak() {
    if (takingBreak) return;

    setError(null);
    setTakingBreak(true);

    try {
      const running = (current.data?.timers ?? []).filter(
        (timer) => timer.isRunning,
      );

      const results = await Promise.allSettled(
        running.map((timer) => pause.mutateAsync(timer.id)),
      );

      const failed = results.filter(
        (result) => result.status === "rejected",
      ).length;

      if (failed > 0) {
        throw new Error(
          `Couldn't pause ${failed} ${
            failed === 1 ? "timer" : "timers"
          }. Other timers were paused. Try again to pause the remaining timers.`,
        );
      }

      const startedAt = Date.now();

      setBreakState({
        breakEndsAt: startedAt + settings.breakMinutes * 60_000,
        streakStart: null,
        snoozeUntil: null,
        notifiedBreakEnd: null,
        chimedBreakEnd: null,
      });
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : "Couldn't pause the timers. Please try again.",
      );
    } finally {
      setTakingBreak(false);
    }
  }

  function snooze() {
    setError(null);
    setBreakState({ snoozeUntil: Date.now() + SNOOZE_MS });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !takingBreak) snooze();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coffee className="h-5 w-5 text-primary" />
            Time for a break
          </DialogTitle>
          <DialogDescription>
            You&apos;ve been working for{" "}
            {formatDuration(decision.workedMs / 1000)}
            {onlyTimer ? (
              <> on “{itemTitle}”</>
            ) : (
              <> across {runningCount} running timers</>
            )}
            . Step away for {settings.breakMinutes} minutes: stand up,
            stretch, get some water or rest your eyes.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={snooze}>
            Snooze 10 minutes
          </Button>
          <Button
            type="button"
            onClick={() => void takeBreak()}
            disabled={takingBreak}
          >
            Take a {settings.breakMinutes}-minute break
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
