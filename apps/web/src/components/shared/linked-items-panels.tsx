import type { ReactNode } from "react";
import { useState } from "react";
import { ChevronDown, ChevronUp, Unlink, Pin } from "lucide-react";
import { Link } from "react-router-dom";

import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Full-width Tasks and Notes panels shared by the paper, project and funding
 * pages. Each panel can be hidden, previews three items, and offers
 * "Show all" for the rest.
 */

export const PANEL_PREVIEW_COUNT = 3;

const TASK_PRIORITY_ORDER: Record<string, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

export interface PanelTask {
  id: string;
  displayId?: string | null;
  title: string;
  status?: string | null;
  priority?: string | null;
  dueDate: string | null;
}

export interface PanelNote {
  id: string;
  title: string;
  content?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
  modulePinned?: boolean;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const [year, month, day] = iso.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

/** Active tasks only, nearest due date first (undated last), then priority. */
function sortActiveTasks<T extends PanelTask>(tasks: T[]): T[] {
  return tasks
    .filter((task) => task.status !== "Complete")
    .sort((a, b) => {
      if (a.dueDate !== b.dueDate) {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      }
      return (
        (TASK_PRIORITY_ORDER[a.priority ?? ""] ?? 99) -
          (TASK_PRIORITY_ORDER[b.priority ?? ""] ?? 99) ||
        a.title.localeCompare(b.title)
      );
    });
}

/** Pinned first when enabled, then most recently updated. */
function sortRecentNotes<T extends PanelNote>(
  notes: T[],
  pinnedFirst = false,
): T[] {
  const stamp = (note: PanelNote) => note.updatedAt ?? note.createdAt ?? "";

  return [...notes].sort((a, b) => {
    const pinOrder = pinnedFirst
      ? Number(Boolean(b.modulePinned)) - Number(Boolean(a.modulePinned))
      : 0;

    return (
      pinOrder ||
      stamp(b).localeCompare(stamp(a)) ||
      a.id.localeCompare(b.id)
    );
  });
}

export function PanelToggleButton({
  visible,
  onToggle,
  label,
  controls,
}: {
  visible: boolean;
  onToggle: () => void;
  label: string;
  controls: string;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      aria-expanded={visible}
      aria-controls={controls}
      onClick={onToggle}
    >
      {visible ? <ChevronUp /> : <ChevronDown />}
      {visible ? `Hide ${label}` : `Show ${label}`}
    </Button>
  );
}

export function ShowMoreButton({
  expanded,
  total,
  noun,
  onToggle,
}: {
  expanded: boolean;
  total: number;
  noun: string;
  onToggle: () => void;
}) {
  if (total <= PANEL_PREVIEW_COUNT) return null;
  return (
    <Button
      variant="ghost"
      size="sm"
      className="mt-2 w-full text-muted-foreground"
      onClick={onToggle}
    >
      {expanded ? <ChevronUp /> : <ChevronDown />}
      {expanded ? "Show fewer" : `Show all ${total} ${noun}`}
    </Button>
  );
}

function UnlinkButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title="Unlink"
      className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Unlink className="h-3.5 w-3.5" />
    </button>
  );
}

export function LinkedTasksPanel<T extends PanelTask>({
  tasks,
  entityLabel,
  contentId,
  visible,
  onToggleVisible,
  actions,
  onUnlink,
  unlinkLabel = (task) => `Unlink ${task.title} from this ${entityLabel}`,
}: {
  tasks: T[];
  /** e.g. "paper", "project" — used in empty-state text. */
  entityLabel: string;
  contentId: string;
  visible: boolean;
  onToggleVisible: () => void;
  /** Header buttons such as "Link existing" and "Add task". */
  actions?: ReactNode;
  onUnlink?: (task: T) => void;
  unlinkLabel?: (task: T) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const activeTasks = sortActiveTasks(tasks);
  const shownTasks = expanded
    ? activeTasks
    : activeTasks.slice(0, PANEL_PREVIEW_COUNT);
  const completedCount = tasks.length - activeTasks.length;

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle>Tasks ({activeTasks.length} active)</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          <PanelToggleButton
            visible={visible}
            onToggle={onToggleVisible}
            label="tasks"
            controls={contentId}
          />
        </div>
      </CardHeader>
      {visible ? (
        <CardContent id={contentId}>
          {activeTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {completedCount > 0
                ? `All tasks for this ${entityLabel} are complete.`
                : `No tasks are linked to this ${entityLabel}.`}
            </p>
          ) : (
            <div className="grid gap-2">
              {shownTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-1 rounded-md border border-border bg-card px-3 py-2 transition-colors hover:border-primary/40 hover:bg-muted/40"
                >
                  <Link
                    to={`/tasks/${task.id}`}
                    className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="flex min-w-0 items-baseline gap-2">
                      {task.displayId ? (
                        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                          {task.displayId}
                        </span>
                      ) : null}
                      <span className="truncate text-sm font-semibold">
                        {task.title}
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="whitespace-nowrap text-xs text-muted-foreground">
                        Due {formatDate(task.dueDate)}
                      </span>
                      <StatusBadge status={task.status ?? "—"} />
                      <StatusBadge status={task.priority ?? "—"} />
                    </span>
                  </Link>
                  {onUnlink ? (
                    <UnlinkButton
                      label={unlinkLabel(task)}
                      onClick={() => onUnlink(task)}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          )}
          <ShowMoreButton
            expanded={expanded}
            total={activeTasks.length}
            noun="active tasks"
            onToggle={() => setExpanded((value) => !value)}
          />
          {completedCount > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {completedCount} completed{" "}
              {completedCount === 1 ? "task is" : "tasks are"} hidden.{" "}
              <Link to="/tasks" className="underline hover:text-foreground">
                View all tasks
              </Link>
            </p>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}

export function LinkedNotesPanel<T extends PanelNote>({
  notes,
  entityLabel,
  contentId,
  visible,
  onToggleVisible,
  actions,
  pinnedFirst = false,
  onTogglePin,
  pinDisabled = false,
  onUnlink,
  unlinkLabel = (note) => `Unlink ${note.title} from this ${entityLabel}`,
}: {
  notes: T[];
  entityLabel: string;
  contentId: string;
  visible: boolean;
  onToggleVisible: () => void;
  actions?: ReactNode;
  pinnedFirst?: boolean;
  onTogglePin?: (note: T) => void;
  pinDisabled?: boolean;
  onUnlink?: (note: T) => void;
  unlinkLabel?: (note: T) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const sortedNotes = sortRecentNotes(notes, pinnedFirst);
  const shownNotes = expanded
    ? sortedNotes
    : sortedNotes.slice(0, PANEL_PREVIEW_COUNT);

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle>Notes ({notes.length})</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          <PanelToggleButton
            visible={visible}
            onToggle={onToggleVisible}
            label="notes"
            controls={contentId}
          />
        </div>
      </CardHeader>
      {visible ? (
        <CardContent id={contentId}>
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No notes are linked to this {entityLabel}.
            </p>
          ) : (
            <div className="grid gap-2">
              {shownNotes.map((note) => (
                <div
                  key={note.id}
                  className="flex items-start gap-1 rounded-md border border-border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-muted/40"
                >
                  <Link
                    to={`/daily-notes/${note.id}`}
                    className="min-w-0 flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="text-sm font-semibold">{note.title}</span>
                    {note.content ? (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {note.content}
                      </p>
                    ) : null}
                  </Link>
                  {onTogglePin ? (
                    <button
                      type="button"
                      onClick={() => onTogglePin(note)}
                      disabled={pinDisabled}
                      aria-label={`${note.modulePinned ? "Unpin" : "Pin"} ${note.title}`}
                      aria-pressed={Boolean(note.modulePinned)}
                      title={note.modulePinned ? "Unpin note" : "Pin note"}
                      className={`shrink-0 rounded-md p-1.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
                        note.modulePinned
                          ? "text-primary"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Pin
                        className="h-3.5 w-3.5"
                        fill={note.modulePinned ? "currentColor" : "none"}
                        aria-hidden="true"
                      />
                    </button>
                  ) : pinnedFirst && note.modulePinned ? (
                    <span
                      className="shrink-0 p-1.5 text-primary"
                      title="Pinned note"
                    >
                      <Pin
                        className="h-3.5 w-3.5"
                        fill="currentColor"
                        aria-hidden="true"
                      />
                      <span className="sr-only">Pinned note</span>
                    </span>
                  ) : null}
                  {onUnlink ? (
                    <UnlinkButton
                      label={unlinkLabel(note)}
                      onClick={() => onUnlink(note)}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          )}
          <ShowMoreButton
            expanded={expanded}
            total={notes.length}
            noun="notes"
            onToggle={() => setExpanded((value) => !value)}
          />
        </CardContent>
      ) : null}
    </Card>
  );
}
