import { useState, type FormEvent } from "react";

import type { ApiTimeEntry, TimeEntryInput } from "@/api/time-tracking";
import { Button } from "@/components/ui/button";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { Input } from "@/components/ui/input";
import { localDateInput, middayOn } from "@/lib/time-format";

const MAX_MINUTES = 24 * 60;

/** The moment to save: same time of day as before, on the chosen day. */
function startFor(dateInput: string, entry?: ApiTimeEntry) {
  if (!entry) return middayOn(dateInput);
  const original = new Date(entry.startedAt);
  if (localDateInput(original) === dateInput) return original;
  const [year, month, day] = dateInput.split("-").map(Number);
  const moved = new Date(original);
  moved.setFullYear(year, (month ?? 1) - 1, day ?? 1);
  return moved;
}

/** Add time by hand, or correct an entry. */
export function TimeEntryForm({
  entry,
  idPrefix,
  isSaving,
  onSubmit,
  onCancel,
}: {
  /** The entry being corrected; omit to add new time. */
  entry?: ApiTimeEntry;
  idPrefix: string;
  isSaving: boolean;
  onSubmit: (input: TimeEntryInput) => Promise<void>;
  onCancel: () => void;
}) {
  const existingMinutes = entry ? Math.round(entry.durationSeconds / 60) : 0;
  const [date, setDate] = useState(() =>
    localDateInput(entry ? new Date(entry.startedAt) : new Date()),
  );
  const [hours, setHours] = useState(
    entry ? String(Math.floor(existingMinutes / 60)) : "",
  );
  const [minutes, setMinutes] = useState(
    entry ? String(existingMinutes % 60) : "",
  );
  const [note, setNote] = useState(entry?.note ?? "");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const total =
      Math.round(Number(hours || 0)) * 60 + Math.round(Number(minutes || 0));
    if (!date) {
      setError("Choose the day you worked on this.");
      return;
    }
    if (date > localDateInput(new Date())) {
      setError("Time can't be added for a future day.");
      return;
    }
    if (!Number.isFinite(total) || total < 1 || total > MAX_MINUTES) {
      setError("Enter between 1 minute and 24 hours.");
      return;
    }
    try {
      await onSubmit({
        startedAt: startFor(date, entry).toISOString(),
        minutes: total,
        note: note.trim() || null,
      });
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Couldn't save the time. Please try again.",
      );
    }
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      aria-label={entry ? "Edit time entry" : "Add time"}
      className="space-y-3 rounded-md border border-primary/20 bg-muted/20 p-3"
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)_minmax(0,0.6fr)]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-date`} className="text-sm font-medium">
            Day
          </label>
          <DatePickerInput
            id={`${idPrefix}-date`}
            label="Day"
            value={date}
            onChange={setDate}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-hours`} className="text-sm font-medium">
            Hours
          </label>
          <Input
            id={`${idPrefix}-hours`}
            type="number"
            inputMode="numeric"
            min={0}
            max={24}
            step={1}
            value={hours}
            placeholder="0"
            onChange={(event) => setHours(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={`${idPrefix}-minutes`}
            className="text-sm font-medium"
          >
            Minutes
          </label>
          <Input
            id={`${idPrefix}-minutes`}
            type="number"
            inputMode="numeric"
            min={0}
            max={59}
            step={1}
            value={minutes}
            placeholder="0"
            onChange={(event) => setMinutes(event.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${idPrefix}-note`} className="text-sm font-medium">
          What did you do? <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <Input
          id={`${idPrefix}-note`}
          value={note}
          maxLength={2000}
          placeholder="e.g. Drafted the introduction"
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={isSaving}>
          {isSaving ? "Saving…" : entry ? "Save changes" : "Add time"}
        </Button>
      </div>
    </form>
  );
}
