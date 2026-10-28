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

  const timer = current.data?.timer ?? null;
  const active = isLoaded && settings.enabled && timer !== null;
  const now = useTicker(active);
  const stretchStart =
    timer?.isRunning && current.data
      ? current.data.receivedAt - timer.runningSeconds * 1000
      : null;

  const decision = decideBreak({
    now,
    settings,
    state,
    timerOpen: timer !== null,
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
      timerOpen: timer !== null,
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
          timer ? `Ready to get back to “${timer.taskTitle}”?` : "Ready to get back to work?",
          "rim-break",
          { silent: settings.sound },
        );
        update.notifiedBreakEnd = state.breakEndsAt;
      }
    }

    if (Object.keys(update).length > 0) setBreakState(update);
  }, [active, now, settings, state, stretchStart, timer]);

  const open = active && decision.reminderDue;

  async function takeBreak() {
    setError(null);
    try {
      await pause.mutateAsync();
      const startedAt = Date.now();
      setBreakState({
        breakEndsAt: startedAt + settings.breakMinutes * 60_000,
        streakStart: null,
        snoozeUntil: null,
        notifiedBreakEnd: null,
      });
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Couldn't pause the timer. Please try again.",
      );
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
        if (!next) snooze();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coffee className="h-5 w-5 text-primary" />
            Time for a break
          </DialogTitle>
          <DialogDescription>
            You&apos;ve been working for {formatDuration(decision.workedMs / 1000)}
            {timer ? <> on “{timer.taskTitle}”</> : null}. Step away for{" "}
            {settings.breakMinutes} minutes: stand up, stretch, get some
            water or rest your eyes.
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
            disabled={pause.isPending}
          >
            Take a {settings.breakMinutes}-minute break
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
