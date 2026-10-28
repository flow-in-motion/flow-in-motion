import { useEffect, useState, type KeyboardEvent } from "react";
import { Coffee } from "lucide-react";

import {
  useBreakReminderSettings,
  useSaveBreakReminderSettings,
} from "@/api/time-tracking";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BREAK_LENGTH_MINUTES,
  BREAK_LENGTH_MINUTES_RANGE,
  BREAK_WORK_MINUTES,
  BREAK_WORK_MINUTES_RANGE,
  type BreakReminderSettings,
} from "@/lib/break-reminders";
import { playChime } from "@/lib/chime";
import {
  notificationPermission,
  requestNotificationPermission,
} from "@/lib/notify";

const BLOCKED_MESSAGE =
  "Notifications are blocked for this site. Click the icon next to the web address, set Notifications to Allow, then reload the page.";
const NOT_ALLOWED_YET_MESSAGE =
  "Your browser hasn't allowed notifications from this site yet.";
/** Chrome stops showing the request after it has been dismissed a few times. */
const NO_PROMPT_MESSAGE =
  "Your browser didn't allow notifications. If it didn't ask, it has stopped asking for this site: click the icon next to the web address, open Site settings, set Notifications to Allow, then reload this page.";
import { cn } from "@/lib/utils";

function minutesLabel(minutes: number) {
  if (minutes === 60) return "1 hour";
  if (minutes === 90) return "1½ hours";
  return `${minutes} min`;
}

const choiceClass =
  "rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent/50 disabled:cursor-not-allowed disabled:opacity-50";
const selectedClass = "border-primary bg-primary/5 ring-1 ring-primary";

/** Preset times, plus Custom for any whole number of minutes in range. */
function ChoiceGroup({
  id,
  label,
  options,
  range,
  value,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  options: readonly number[];
  range: { min: number; max: number };
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  const isPreset = options.includes(value);
  const [customOpen, setCustomOpen] = useState(!isPreset);
  const [draft, setDraft] = useState(isPreset ? "" : String(value));
  const [error, setError] = useState<string | null>(null);
  const showCustom = customOpen || !isPreset;

  function commit() {
    setError(null);
    const minutes = Number(draft);
    if (!draft.trim() || !Number.isInteger(minutes)) {
      setError(`Enter a whole number of minutes from ${range.min} to ${range.max}.`);
      return;
    }
    if (minutes < range.min || minutes > range.max) {
      setError(`Choose between ${range.min} and ${range.max} minutes.`);
      return;
    }
    if (minutes !== value) onChange(minutes);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    }
  }

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = !showCustom && option === value;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                setCustomOpen(false);
                setError(null);
                if (option !== value || showCustom) onChange(option);
              }}
              className={cn(choiceClass, selected && selectedClass)}
            >
              {minutesLabel(option)}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={showCustom}
          onClick={() => {
            setCustomOpen(true);
            setDraft(String(value));
          }}
          className={cn(choiceClass, showCustom && selectedClass)}
        >
          Custom
        </button>
      </div>
      {showCustom ? (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={id} className="sr-only">
            {`${label}, in minutes`}
          </label>
          <Input
            id={id}
            type="number"
            inputMode="numeric"
            min={range.min}
            max={range.max}
            step={1}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            aria-invalid={error ? true : undefined}
            className="w-24"
          />
          <span className="text-sm text-muted-foreground">
            minutes ({range.min}–{range.max})
          </span>
          {error ? (
            <p role="alert" className="w-full text-xs text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </fieldset>
  );
}

/** Settings for reminders to take a break while a task timer runs. */
export function BreakReminderSettingsCard({ className }: { className?: string }) {
  const { settings, isLoaded } = useBreakReminderSettings();
  const { save, isPending } = useSaveBreakReminderSettings();
  const [status, setStatus] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [permission, setPermission] = useState(() => notificationPermission());

  // The person may change the browser's permission while the page is open.
  useEffect(() => {
    const refresh = () => setPermission(notificationPermission());
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  async function update(patch: Partial<BreakReminderSettings>) {
    setStatus(null);
    try {
      await save({ ...settings, ...patch });
      setStatus("Saved");
    } catch {
      setStatus("Couldn't save. Please try again.");
    }
  }

  /** Asks the browser, then turns notifications on if it agrees. */
  async function allowNotifications() {
    setNotice(null);
    const result = await requestNotificationPermission();
    setPermission(result);
    if (result === "unsupported") {
      setNotice("This browser can't show notifications.");
      return;
    }
    if (result !== "granted") {
      setNotice(result === "denied" ? BLOCKED_MESSAGE : NO_PROMPT_MESSAGE);
      return;
    }
    if (settings.notifications) setStatus("Notifications are on");
    else await update({ notifications: true });
  }

  async function toggleNotifications(checked: boolean) {
    setNotice(null);
    if (checked) await allowNotifications();
    else await update({ notifications: false });
  }

  // On only when both the setting and the browser say yes.
  const notificationsOn = settings.notifications && permission === "granted";
  const waitingForBrowser =
    settings.notifications && permission === "default" && !notice;
  const blocked = settings.notifications && permission === "denied";

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coffee className="h-5 w-5 text-primary" />
          Break reminders
        </CardTitle>
        <CardDescription>
          While a task timer runs, get a reminder to step away. A pause of
          five minutes or more counts as a break.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
            checked={settings.enabled}
            disabled={!isLoaded || isPending}
            onChange={(event) => void update({ enabled: event.target.checked })}
          />
          <span>
            <span className="font-medium">Remind me to take breaks</span>
            <span className="block text-muted-foreground">
              Only while a task timer is running.
            </span>
          </span>
        </label>

        <ChoiceGroup
          key={`work-${isLoaded}`}
          id="break-work-minutes"
          label="Remind me after"
          options={BREAK_WORK_MINUTES}
          range={BREAK_WORK_MINUTES_RANGE}
          value={settings.workMinutes}
          disabled={!isLoaded || !settings.enabled || isPending}
          onChange={(workMinutes) => void update({ workMinutes })}
        />
        <ChoiceGroup
          key={`break-${isLoaded}`}
          id="break-length-minutes"
          label="Break length"
          options={BREAK_LENGTH_MINUTES}
          range={BREAK_LENGTH_MINUTES_RANGE}
          value={settings.breakMinutes}
          disabled={!isLoaded || !settings.enabled || isPending}
          onChange={(breakMinutes) => void update({ breakMinutes })}
        />

        <div className="flex items-start justify-between gap-3">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
              checked={settings.sound}
              disabled={!isLoaded || !settings.enabled || isPending}
              onChange={(event) => void update({ sound: event.target.checked })}
            />
            <span>
              <span className="font-medium">Play a sound</span>
              <span className="block text-muted-foreground">
                A soft chime when it&apos;s time for a break, and when a
                break ends.
              </span>
            </span>
          </label>
          <button
            type="button"
            onClick={() => playChime("reminder")}
            className="shrink-0 rounded-md px-2 py-1 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Play sound
          </button>
        </div>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
            checked={notificationsOn}
            disabled={!isLoaded || !settings.enabled || isPending}
            onChange={(event) => void toggleNotifications(event.target.checked)}
          />
          <span>
            <span className="font-medium">
              Also show a system notification
            </span>
            <span className="block text-muted-foreground">
              So you see the reminder when you&apos;re in another tab or app.
              It only works while the app is open somewhere.
            </span>
          </span>
        </label>

        {waitingForBrowser ? (
          <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50/60 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
            <p>
              {NOT_ALLOWED_YET_MESSAGE} Click below, then choose{" "}
              <span className="font-medium">Allow</span> when your browser
              asks.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void allowNotifications()}
            >
              Allow notifications
            </Button>
          </div>
        ) : null}

        {notice || blocked ? (
          <p role="alert" className="text-sm text-amber-700 dark:text-amber-400">
            {notice ?? BLOCKED_MESSAGE}
          </p>
        ) : null}

        <p aria-live="polite" className="min-h-5 text-xs text-muted-foreground">
          {status}
        </p>
      </CardContent>
    </Card>
  );
}
