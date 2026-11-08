import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import {
  useCurrentWorkTimers,
  useWorkTime,
  useWorkTimeAction,
  workElapsed,
  type WorkTimeTarget,
} from "@/api/work-time-tracking";
import { useTicker, type ApiTimeEntry } from "@/api/time-tracking";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDuration } from "@/lib/time-format";

import { TimeEntryForm } from "./time-entry-form";
import { TimeProgress } from "./time-progress";

const dayFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});
const clockFormat = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
});

function whenLabel(entry: ApiTimeEntry) {
  const start = new Date(entry.startedAt);
  const day = dayFormat.format(start);
  if (entry.source === "manual") return `${day} · added by hand`;
  if (!entry.endedAt) return `${day} · from ${clockFormat.format(start)}`;
  return `${day} · ${clockFormat.format(start)}–${clockFormat.format(new Date(entry.endedAt))}`;
}

type FormState = { mode: "add" } | { mode: "edit"; entry: ApiTimeEntry } | null;

/** Same Time panel and manual-entry workflow as Tasks and Papers. */
export function WorkTimeCard({ kind, targetId }: WorkTimeTarget) {
  const time = useWorkTime({ kind, targetId });
  const current = useCurrentWorkTimers();
  const addEntry = useWorkTimeAction();
  const updateEntry = useWorkTimeAction();
  const deleteEntry = useWorkTimeAction();
  const [form, setForm] = useState<FormState>(null);
  const [error, setError] = useState<string | null>(null);
  const timers = (current.data?.timers ?? []).filter(
    (timer) => timer.kind === kind && timer.targetId === targetId,
  );
  const now = useTicker(timers.some((timer) => timer.isRunning));
  const stored = time.data?.entries ?? [];
  const entries: ApiTimeEntry[] = stored.map((entry) => ({
    ...entry,
    taskId: null,
  }));
  const timersById = new Map(timers.map((timer) => [timer.id, timer]));
  const entriesById = new Map(stored.map((entry) => [entry.id, entry]));
  const live = {
    timers,
    elapsedSecondsFor(id: string, fallback: number) {
      const timer = timersById.get(id);
      if (timer) return workElapsed(timer, current.data?.receivedAt, now);
      const entry = entriesById.get(id);
      return entry ? workElapsed(entry, time.data?.receivedAt, now) : fallback;
    },
  };
  const total = entries.reduce(
    (sum, entry) =>
      sum + live.elapsedSecondsFor(entry.id, entry.durationSeconds),
    0,
  );
  const headingId = `work-time-${kind}-${targetId}-heading`;
  const itemLabel =
    kind === "project" ? "project" : kind === "note" ? "note" : "HDR record";

  async function handleDelete(entry: ApiTimeEntry) {
    if (
      !window.confirm(
        `Delete ${formatDuration(entry.durationSeconds)} logged on ${dayFormat.format(new Date(entry.startedAt))}?`,
      )
    ) {
      return;
    }
    setError(null);
    try {
      await deleteEntry.mutateAsync({ action: "delete", entryId: entry.id });
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Couldn't delete the time. Please try again.",
      );
    }
  }

  return (
    <section aria-labelledby={headingId}>
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle id={headingId}>Time</CardTitle>
          <div className="flex flex-wrap items-start gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setForm({ mode: "add" })}
              disabled={form?.mode === "add"}
            >
              <Plus /> Add time
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {kind === "project"
              ? "Time logged directly on this project. Time on linked tasks and papers is recorded separately."
              : kind === "note"
                ? "Time logged directly on this note."
                : "Time spent with or for this student or scholar."}
          </p>
          {time.isError ? (
            <p role="alert" className="text-sm text-destructive">
              Couldn&apos;t load the time on this {itemLabel}.
            </p>
          ) : (
            <TimeProgress loggedSeconds={total} estimateSeconds={null} />
          )}

          {form?.mode === "add" ? (
            <TimeEntryForm
              idPrefix={`add-time-${kind}-${targetId}`}
              isSaving={addEntry.isPending}
              onCancel={() => setForm(null)}
              onSubmit={async (input) => {
                await addEntry.mutateAsync({
                  action: "add",
                  kind,
                  targetId,
                  input,
                });
                setForm(null);
              }}
            />
          ) : null}

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {time.isPending ? (
            <p className="text-sm text-muted-foreground">Loading time…</p>
          ) : entries.length === 0 && !form ? (
            <p className="text-sm text-muted-foreground">
              No time logged yet. Start the timer while you work, or add time by
              hand.
            </p>
          ) : entries.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                Your time
              </h3>
              <ul className="space-y-2">
                {entries.map((entry) =>
                  form?.mode === "edit" && form.entry.id === entry.id ? (
                    <li key={entry.id}>
                      <TimeEntryForm
                        entry={entry}
                        idPrefix={`edit-time-${entry.id}`}
                        isSaving={updateEntry.isPending}
                        onCancel={() => setForm(null)}
                        onSubmit={async (input) => {
                          await updateEntry.mutateAsync({
                            action: "edit",
                            entryId: entry.id,
                            input,
                          });
                          setForm(null);
                        }}
                      />
                    </li>
                  ) : (
                    <li
                      key={entry.id}
                      className="flex items-start justify-between gap-3 rounded-md border border-border bg-card px-3 py-2"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-sm">
                          <span className="font-semibold tabular-nums">
                            {formatDuration(
                              live.elapsedSecondsFor(
                                entry.id,
                                entry.durationSeconds,
                              ),
                            )}
                          </span>{" "}
                          <span className="text-muted-foreground">
                            {whenLabel(entry)}
                          </span>
                        </p>
                        {entry.note ? (
                          <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
                            {entry.note}
                          </p>
                        ) : null}
                      </div>
                      {entry.isOpen ? (
                        <Badge variant="outline" className="shrink-0">
                          {(live.timers.find((timer) => timer.id === entry.id)
                            ?.isRunning ?? entry.isRunning)
                            ? "In progress"
                            : "Paused"}
                        </Badge>
                      ) : (
                        <span className="flex shrink-0 items-center">
                          <button
                            type="button"
                            onClick={() => setForm({ mode: "edit", entry })}
                            aria-label={`Edit time logged ${whenLabel(entry)}`}
                            title="Edit"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(entry)}
                            disabled={deleteEntry.isPending}
                            aria-label={`Delete time logged ${whenLabel(entry)}`}
                            title="Delete"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      )}
                    </li>
                  ),
                )}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
