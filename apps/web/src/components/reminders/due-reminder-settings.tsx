import { useState } from "react";
import { Bell } from "lucide-react";

import {
  DUE_REMINDER_LEAD_DAYS,
  DUE_REMINDER_TYPES,
  useDueReminderSettings,
  useSaveDueReminderSettings,
  type DueReminderSettings,
} from "@/api/due-reminders";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

function leadLabel(days: number) {
  if (days === 0) return "On the day";
  if (days === 1) return "1 day before";
  if (days === 7) return "1 week before";
  if (days === 14) return "2 weeks before";
  return `${days} days before`;
}

const choiceClass =
  "rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent/50 disabled:cursor-not-allowed disabled:opacity-50";
const selectedClass = "border-primary bg-primary/5 ring-1 ring-primary";

/** When the bell reminds about due dates, and what about. */
export function DueReminderSettingsCard({ className }: { className?: string }) {
  const { settings, isLoaded } = useDueReminderSettings();
  const { save, isPending } = useSaveDueReminderSettings();
  const [status, setStatus] = useState<string | null>(null);
  const disabled = !isLoaded || isPending;

  async function update(patch: Partial<DueReminderSettings>) {
    setStatus(null);
    try {
      await save({ ...settings, ...patch });
      setStatus("Saved");
    } catch {
      setStatus("Couldn't save. Please try again.");
    }
  }

  function toggle<T>(list: readonly T[], value: T) {
    return list.includes(value)
      ? list.filter((item) => item !== value)
      : [...list, value];
  }

  const nothingOn =
    (settings.leadDays.length === 0 && !settings.overdue) ||
    settings.types.length === 0;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          Due-date reminders
        </CardTitle>
        <CardDescription>
          The bell at the top of the app lists what&apos;s coming up and
          anything overdue. Choose when it reminds you, and about what.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <fieldset className="space-y-2" disabled={disabled}>
          <legend className="text-sm font-medium">Remind me</legend>
          <div className="flex flex-wrap gap-2">
            {[...DUE_REMINDER_LEAD_DAYS].reverse().map((days) => {
              const selected = settings.leadDays.includes(days);
              return (
                <button
                  key={days}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    void update({ leadDays: toggle(settings.leadDays, days) })
                  }
                  className={cn(choiceClass, selected && selectedClass)}
                >
                  {leadLabel(days)}
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
            checked={settings.overdue}
            disabled={disabled}
            onChange={(event) => void update({ overdue: event.target.checked })}
          />
          <span>
            <span className="font-medium">Keep reminding me when overdue</span>
            <span className="block text-muted-foreground">
              Until the item is finished or you dismiss the reminder.
              Follow-ups stop after two weeks.
            </span>
          </span>
        </label>

        <fieldset className="space-y-2" disabled={disabled}>
          <legend className="text-sm font-medium">Remind me about</legend>
          <div className="flex flex-wrap gap-2">
            {DUE_REMINDER_TYPES.map((type) => {
              const selected = settings.types.includes(type.id);
              return (
                <button
                  key={type.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    void update({ types: toggle(settings.types, type.id) })
                  }
                  className={cn(choiceClass, selected && selectedClass)}
                >
                  {type.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        {nothingOn ? (
          <p role="status" className="text-sm text-amber-700 dark:text-amber-400">
            Reminders are off: choose at least one time and one kind of item.
          </p>
        ) : null}
        <p aria-live="polite" className="min-h-5 text-xs text-muted-foreground">
          {status}
        </p>
      </CardContent>
    </Card>
  );
}
