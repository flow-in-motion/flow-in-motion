import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { authenticatedJson } from "@/api/client";
import {
  useAccountPreferences,
  useUpdateAccountPreferences,
} from "@/api/hooks";
import { localDateInput } from "@/lib/time-format";

export type ReminderItemType =
  | "task"
  | "paper"
  | "project"
  | "conference"
  | "conference_submission"
  | "funding_deadline"
  | "funding_follow_up"
  | "note";

export interface ApiDueReminder {
  key: string;
  type: ReminderItemType;
  itemId: string;
  /** The page it opens: a conference for its submissions. */
  targetId: string;
  title: string;
  context: string | null;
  dueDate: string;
  /** Negative when overdue. */
  daysUntil: number;
  /** Days-before stage reached; -1 when overdue. */
  stage: number;
  unread: boolean;
}

export interface DueReminderSettings {
  leadDays: number[];
  overdue: boolean;
  types: string[];
}

export const DUE_REMINDER_LEAD_DAYS = [0, 1, 2, 3, 7, 14] as const;
export const DUE_REMINDER_TYPES = [
  { id: "tasks", label: "Tasks" },
  { id: "papers", label: "Papers" },
  { id: "projects", label: "Projects" },
  { id: "events", label: "Conference & event deadlines" },
  { id: "funding", label: "Funding deadlines & follow-ups" },
  { id: "notes", label: "Note follow-ups" },
] as const;

export const DEFAULT_DUE_REMINDERS: DueReminderSettings = {
  leadDays: [7, 1, 0],
  overdue: true,
  types: DUE_REMINDER_TYPES.map((type) => type.id),
};

const dueRemindersKey = (tenantId: string) =>
  ["api", "tenant", tenantId, "due-reminders"] as const;

/** Where a reminder takes you. */
export function reminderHref(reminder: Pick<ApiDueReminder, "type" | "targetId">) {
  switch (reminder.type) {
    case "task":
      return `/tasks/${reminder.targetId}`;
    case "paper":
      return `/modules/${reminder.targetId}`;
    case "project":
      return `/projects/${reminder.targetId}`;
    case "conference":
    case "conference_submission":
      return `/conferences/${reminder.targetId}`;
    case "funding_deadline":
    case "funding_follow_up":
      return `/funding/${reminder.targetId}`;
    case "note":
      return `/daily-notes/${reminder.targetId}`;
  }
}

/**
 * Items due soon or overdue in the current workspace. "Today" is this
 * device's date, so reminders follow the person's time zone.
 */
export function useDueReminders(tenantId: string) {
  const today = localDateInput(new Date());
  return useQuery({
    queryKey: [...dueRemindersKey(tenantId), today],
    enabled: Boolean(tenantId),
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: true,
    queryFn: () =>
      authenticatedJson<{ items: ApiDueReminder[]; unreadCount: number }>(
        `/api/v1/tenant/${encodeURIComponent(tenantId)}/due-reminders?today=${today}`,
      ),
  });
}

export function useMarkRemindersSeen(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reminders: ApiDueReminder[]) =>
      authenticatedJson<{ ok: true }>(
        `/api/v1/tenant/${encodeURIComponent(tenantId)}/due-reminders/seen`,
        {
          method: "POST",
          body: JSON.stringify({
            items: reminders.map((reminder) => ({
              type: reminder.type,
              itemId: reminder.itemId,
              dueDate: reminder.dueDate,
              stage: reminder.stage,
            })),
          }),
        },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: dueRemindersKey(tenantId) }),
  });
}

export function useDismissReminder(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reminder: ApiDueReminder) =>
      authenticatedJson<{ ok: true }>(
        `/api/v1/tenant/${encodeURIComponent(tenantId)}/due-reminders/dismiss`,
        {
          method: "POST",
          body: JSON.stringify({
            type: reminder.type,
            itemId: reminder.itemId,
            dueDate: reminder.dueDate,
          }),
        },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: dueRemindersKey(tenantId) }),
  });
}

/** Hides every reminder listed, until their due dates change. */
export function useDismissAllReminders(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reminders: ApiDueReminder[]) =>
      authenticatedJson<{ ok: true }>(
        `/api/v1/tenant/${encodeURIComponent(tenantId)}/due-reminders/dismiss-all`,
        {
          method: "POST",
          body: JSON.stringify({
            items: reminders.map((reminder) => ({
              type: reminder.type,
              itemId: reminder.itemId,
              dueDate: reminder.dueDate,
            })),
          }),
        },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: dueRemindersKey(tenantId) }),
  });
}

/** The caller's reminder settings, with defaults filled in. */
export function useDueReminderSettings() {
  const query = useAccountPreferences();
  const settings: DueReminderSettings = {
    ...DEFAULT_DUE_REMINDERS,
    ...(query.data?.dueReminders ?? {}),
  };
  return { settings, isLoaded: query.isSuccess || query.isError };
}

export function useSaveDueReminderSettings() {
  const update = useUpdateAccountPreferences();
  const queryClient = useQueryClient();
  return {
    save: async (dueReminders: DueReminderSettings) => {
      await update.mutateAsync({ dueReminders });
      // The bell shows different items now.
      await queryClient.invalidateQueries({
        predicate: (query) => query.queryKey.includes("due-reminders"),
      });
    },
    isPending: update.isPending,
  };
}
