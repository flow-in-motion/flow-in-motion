import { useState } from "react";
import {
  Bell,
  CheckCheck,
  DollarSign,
  FileStack,
  FolderKanban,
  ListTodo,
  NotebookPen,
  Presentation,
  Settings,
  X,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";

import {
  reminderHref,
  useDismissAllReminders,
  useDismissReminder,
  useDueReminders,
  useMarkRemindersSeen,
  type ApiDueReminder,
} from "@/api/due-reminders";
import { useCurrentWorkspace } from "@/api/hooks";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import {
  REMINDER_GROUPS,
  REMINDER_KIND_LABELS,
  reminderGroup,
  reminderWhen,
} from "./reminder-format";

const KIND_ICONS: Record<ApiDueReminder["type"], LucideIcon> = {
  task: ListTodo,
  paper: FileStack,
  project: FolderKanban,
  conference: Presentation,
  conference_submission: Presentation,
  funding_deadline: DollarSign,
  funding_follow_up: DollarSign,
  note: NotebookPen,
};

/**
 * The bell: what's due soon and what's overdue. Opening it marks the
 * reminders as seen; each one can be dismissed until its date changes.
 */
export function DueRemindersBell({ className }: { className?: string }) {
  const workspace = useCurrentWorkspace();
  const tenantId = workspace.data?.id ?? "";
  const reminders = useDueReminders(tenantId);
  const markSeen = useMarkRemindersSeen(tenantId);
  const dismiss = useDismissReminder(tenantId);
  const dismissAll = useDismissAllReminders(tenantId);
  const [open, setOpen] = useState(false);
  const [confirmingDismissAll, setConfirmingDismissAll] = useState(false);
  const [dismissAllError, setDismissAllError] = useState<string | null>(null);
  // Keep "New" on what was unread when the bell opened.
  const [newKeys, setNewKeys] = useState<ReadonlySet<string>>(new Set());

  const items = reminders.data?.items ?? [];
  const unreadCount = reminders.data?.unreadCount ?? 0;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    setConfirmingDismissAll(false);
    setDismissAllError(null);
    if (!next) return;
    const unread = items.filter((item) => item.unread);
    setNewKeys(new Set(unread.map((item) => item.key)));
    if (unread.length > 0) markSeen.mutate(unread);
    void reminders.refetch();
  }

  async function handleDismissAll() {
    setDismissAllError(null);
    try {
      await dismissAll.mutateAsync(items);
      setConfirmingDismissAll(false);
    } catch {
      setDismissAllError("Couldn't dismiss the reminders. Please try again.");
    }
  }

  if (!tenantId) return null;

  const label =
    unreadCount > 0
      ? `Reminders, ${unreadCount} new`
      : "Reminders";

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={label}
          title="Reminders"
          className={cn("relative shrink-0", className)}
        >
          <Bell />
          {unreadCount > 0 ? (
            <span
              aria-hidden="true"
              className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b px-5 py-4 text-left">
          <SheetTitle>Reminders</SheetTitle>
          <SheetDescription>
            What&apos;s due soon and anything overdue in this workspace.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 px-5 py-4">
          {reminders.isPending ? (
            <p className="text-sm text-muted-foreground">Loading reminders…</p>
          ) : reminders.isError ? (
            <p role="alert" className="text-sm text-destructive">
              Couldn&apos;t load reminders. Please try again.
            </p>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/60" />
              <p className="text-sm font-medium">You&apos;re all caught up</p>
              <p className="text-sm text-muted-foreground">
                Nothing is due soon or overdue.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {REMINDER_GROUPS.map((group) => {
                const groupItems = items.filter(
                  (item) => reminderGroup(item.daysUntil) === group.id,
                );
                if (groupItems.length === 0) return null;
                return (
                  <section key={group.id} aria-label={group.label}>
                    <h3
                      className={cn(
                        "mb-2 text-xs font-semibold uppercase tracking-[0.07em] text-muted-foreground",
                        group.id === "overdue" && "text-destructive",
                      )}
                    >
                      {group.label}
                    </h3>
                    <ul className="space-y-2">
                      {groupItems.map((item) => {
                        const Icon = KIND_ICONS[item.type];
                        const isNew = newKeys.has(item.key) || item.unread;
                        return (
                          <li
                            key={item.key}
                            className={cn(
                              "flex items-start gap-2 rounded-lg border bg-card p-3",
                              isNew && "border-primary/40 bg-primary/[0.04]",
                            )}
                          >
                            <Icon
                              className={cn(
                                "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground",
                                item.daysUntil < 0 && "text-destructive",
                              )}
                              aria-hidden="true"
                            />
                            <Link
                              to={reminderHref(item)}
                              onClick={() => setOpen(false)}
                              className="min-w-0 flex-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <span className="flex items-center gap-2">
                                <span className="truncate text-sm font-semibold hover:underline">
                                  {item.title}
                                </span>
                                {isNew ? (
                                  <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none text-primary-foreground">
                                    New
                                  </span>
                                ) : null}
                              </span>
                              <span
                                className={cn(
                                  "block text-xs text-muted-foreground",
                                  item.daysUntil < 0 && "font-medium text-destructive",
                                )}
                              >
                                {reminderWhen(item)}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {REMINDER_KIND_LABELS[item.type]}
                                {item.context ? ` · ${item.context}` : ""}
                              </span>
                            </Link>
                            <button
                              type="button"
                              onClick={() => dismiss.mutate(item)}
                              disabled={dismiss.isPending}
                              aria-label={`Dismiss reminder for ${item.title}`}
                              title="Dismiss"
                              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-2 border-t px-5 py-3">
          {confirmingDismissAll ? (
            <div
              role="group"
              aria-label="Dismiss all reminders"
              className="flex flex-wrap items-center gap-2"
            >
              <span className="mr-auto text-sm">
                Dismiss all {items.length}{" "}
                {items.length === 1 ? "reminder" : "reminders"}?
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmingDismissAll(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={dismissAll.isPending}
                onClick={() => void handleDismissAll()}
              >
                {dismissAll.isPending ? "Dismissing…" : "Dismiss all"}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <Link
                to="/settings#due-reminders"
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                <Settings className="h-4 w-4" />
                Reminder settings
              </Link>
              {items.length > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmingDismissAll(true)}
                >
                  <CheckCheck />
                  Dismiss all
                </Button>
              ) : null}
            </div>
          )}
          {confirmingDismissAll ? (
            <p className="text-xs text-muted-foreground">
              They&apos;ll come back only if their due dates change.
            </p>
          ) : null}
          {dismissAllError ? (
            <p role="alert" className="text-xs text-destructive">
              {dismissAllError}
            </p>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
