import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  useCurrentWorkTimers,
  useWorkTime,
  useWorkTimeAction,
  workElapsed,
  type WorkTimeEntry,
  type WorkTimeTarget,
} from "@/api/work-time-tracking";
import { useTicker } from "@/api/time-tracking";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDuration } from "@/lib/time-format";
import { TimeEntryForm } from "./time-entry-form";

export function WorkTimeDialog({
  kind,
  targetId,
  title,
  onClose,
}: WorkTimeTarget & { title: string; onClose: () => void }) {
  const data = useWorkTime({ kind, targetId });
  const current = useCurrentWorkTimers();
  const action = useWorkTimeAction();
  const [form, setForm] = useState<WorkTimeEntry | "add" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timers = current.data?.timers ?? [];
  const ownTimers = timers.filter(
    (t) => t.kind === kind && t.targetId === targetId,
  );
  useTicker(ownTimers.some((t) => t.isRunning));
  const entries = data.data?.entries ?? [];
  function elapsed(entry: WorkTimeEntry) {
    const live = timers.find((t) => t.id === entry.id);
    return workElapsed(
      live ?? entry,
      live ? current.data?.receivedAt : data.data?.receivedAt,
    );
  }
  // Closed/manual time plus each open entry exactly once.
  const total = entries.reduce((sum, entry) => sum + elapsed(entry), 0);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Time logged</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>
        <p className="text-sm">
          Your time:{" "}
          <strong className="tabular-nums">{formatDuration(total)}</strong>
        </p>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {data.isPending ? (
          <p className="text-sm text-muted-foreground">Loading time entries…</p>
        ) : data.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {data.error.message}{" "}
            <button
              type="button"
              className="underline"
              onClick={() => void data.refetch()}
            >
              Retry
            </button>
          </p>
        ) : (
          <>
            {form ? (
              <TimeEntryForm
                key={form === "add" ? "add" : form.id}
                idPrefix={`work-time-${targetId}`}
                entry={form === "add" ? undefined : { ...form, taskId: null }}
                isSaving={action.isPending}
                onCancel={() => setForm(null)}
                onSubmit={async (input) => {
                  await action.mutateAsync(
                    form === "add"
                      ? { action: "add", kind, targetId, input }
                      : { action: "edit", entryId: form.id, input },
                  );
                  setForm(null);
                }}
              />
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => setForm("add")}
              >
                <Plus /> Add time
              </Button>
            )}
            {!entries.length ? (
              <p className="text-sm text-muted-foreground">
                No time logged yet. Start the timer while you work, or add time
                by hand.
              </p>
            ) : (
              <ul className="space-y-2">
                {entries.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-start justify-between gap-3 rounded-md border border-border bg-card px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm">
                        <strong className="tabular-nums">
                          {formatDuration(elapsed(entry))}
                        </strong>{" "}
                        <span className="text-muted-foreground">
                          {new Date(entry.startedAt).toLocaleDateString()}
                        </span>
                        {entry.isOpen ? (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {(timers.find((t) => t.id === entry.id)
                              ?.isRunning ?? entry.isRunning)
                              ? "In progress"
                              : "Paused"}
                          </span>
                        ) : null}
                      </p>
                      {entry.note ? (
                        <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
                          {entry.note}
                        </p>
                      ) : null}
                    </div>
                    {!entry.isOpen ? (
                      <span className="flex shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Edit time entry"
                          onClick={() => setForm(entry)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Delete time entry"
                          disabled={action.isPending}
                          onClick={() => {
                            if (!window.confirm("Delete this time entry?"))
                              return;
                            setError(null);
                            void action
                              .mutateAsync({
                                action: "delete",
                                entryId: entry.id,
                              })
                              .catch((e: unknown) =>
                                setError(
                                  e instanceof Error
                                    ? e.message
                                    : "Could not delete the entry.",
                                ),
                              );
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
