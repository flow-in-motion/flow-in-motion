import { BadRequestException, Injectable } from '@nestjs/common';
import type { DueReminderPreference } from '@research-tracker/migrations';
import { PreferencesRepository } from '../preferences/preferences.repository';
import {
  DueRemindersRepository,
  type DateWindow,
} from './due-reminders.repository';
import {
  GROUP_OF,
  OVERDUE_FOR_DAYS,
  type ReminderCandidate,
  type ReminderGroup,
  type ReminderItemType,
} from './due-reminders.types';

/**
 * One entry per reminder: a batch can't update the same row twice, so
 * repeated entries are dropped (keeping the most urgent seen stage).
 */
function uniqueReminders<
  T extends { type: string; itemId: string; dueDate: string; stage?: number },
>(items: T[]): T[] {
  const byKey = new Map<string, T>();
  for (const item of items) {
    const key = `${item.type}:${item.itemId}:${item.dueDate}`;
    const existing = byKey.get(key);
    if (!existing || (item.stage ?? 0) < (existing.stage ?? 0)) {
      byKey.set(key, item);
    }
  }
  return [...byKey.values()];
}

/** Used until someone changes their reminder settings. */
export const DEFAULT_DUE_REMINDERS: DueReminderPreference = {
  leadDays: [7, 1, 0],
  overdue: true,
  types: ['tasks', 'papers', 'projects', 'events', 'funding', 'notes'],
};

/** The stage an overdue reminder is at. */
export const OVERDUE_STAGE = -1;

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDay(day: string) {
  const time = Date.parse(`${day}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(time)) {
    throw new BadRequestException('today must be a date like 2026-10-28');
  }
  return time;
}

export function addDays(day: string, days: number) {
  return new Date(parseDay(day) + days * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string) {
  return Math.round((parseDay(to) - parseDay(from)) / DAY_MS);
}

export interface DueReminder {
  /** Identifies this reminder: item type, id and due date. */
  key: string;
  type: ReminderItemType;
  itemId: string;
  targetId: string;
  title: string;
  context: string | null;
  dueDate: string;
  /** Negative when overdue. */
  daysUntil: number;
  /** Days-before stage this reminder has reached; -1 is overdue. */
  stage: number;
  unread: boolean;
}

/**
 * Due-date reminders for the bell: items due soon (at the times each person
 * chose in Settings) and overdue items that aren't finished. "Today" comes
 * from the person's own device, so reminders follow their time zone.
 */
@Injectable()
export class DueRemindersService {
  constructor(
    private readonly repository: DueRemindersRepository,
    private readonly preferences: PreferencesRepository,
  ) {}

  private async settings(userId: string): Promise<DueReminderPreference> {
    const stored = (await this.preferences.findAccount(userId))?.preferences
      ?.dueReminders;
    return { ...DEFAULT_DUE_REMINDERS, ...(stored ?? {}) };
  }

  private async candidates(
    tenantId: string,
    groups: Set<ReminderGroup>,
    today: string,
    windowEnd: string,
    overdue: boolean,
  ) {
    const window = (type: ReminderItemType): DateWindow => {
      const overdueFor = OVERDUE_FOR_DAYS[type];
      if (!overdue || overdueFor === 0) return { from: today, to: windowEnd };
      return {
        from: overdueFor === null ? null : addDays(today, -overdueFor),
        to: windowEnd,
      };
    };
    const searches: Array<() => Promise<ReminderCandidate[]>> = [];
    if (groups.has('tasks')) {
      searches.push(() => this.repository.findTasks(tenantId, window('task')));
    }
    if (groups.has('papers')) {
      searches.push(() =>
        this.repository.findPapers(tenantId, window('paper')),
      );
    }
    if (groups.has('projects')) {
      searches.push(() =>
        this.repository.findProjects(tenantId, window('project')),
      );
    }
    if (groups.has('events')) {
      searches.push(
        () =>
          this.repository.findEventDeadlines(tenantId, window('conference')),
        () =>
          this.repository.findSubmissionDeadlines(
            tenantId,
            window('conference_submission'),
          ),
      );
    }
    if (groups.has('funding')) {
      searches.push(
        () =>
          this.repository.findFundingDeadlines(
            tenantId,
            window('funding_deadline'),
          ),
        () =>
          this.repository.findFundingFollowUps(
            tenantId,
            window('funding_follow_up'),
          ),
      );
    }
    if (groups.has('notes')) {
      searches.push(() =>
        this.repository.findNoteFollowUps(tenantId, window('note')),
      );
    }
    // Run one after another: they share the request's database connection.
    const results: ReminderCandidate[] = [];
    for (const search of searches) results.push(...(await search()));
    return results;
  }

  async list(tenantId: string, userId: string, today: string) {
    parseDay(today);
    const settings = await this.settings(userId);
    const leads = [...new Set(settings.leadDays)].sort((a, b) => a - b);
    const groups = new Set(settings.types as ReminderGroup[]);
    if ((leads.length === 0 && !settings.overdue) || groups.size === 0) {
      return { items: [] as DueReminder[], unreadCount: 0, settings };
    }

    const windowEnd = addDays(today, Math.max(0, ...leads));
    const candidates = await this.candidates(
      tenantId,
      groups,
      today,
      windowEnd,
      settings.overdue,
    );
    const earliest = candidates.reduce<string | null>(
      (min, item) => (min === null || item.dueDate < min ? item.dueDate : min),
      null,
    );
    const states = new Map(
      (await this.repository.findStates(userId, tenantId, earliest)).map(
        (state) => [
          `${state.itemType}:${state.itemId}:${state.dueDate}`,
          state,
        ],
      ),
    );

    const items: DueReminder[] = [];
    for (const candidate of candidates) {
      if (!groups.has(GROUP_OF[candidate.type])) continue;
      const daysUntil = daysBetween(today, candidate.dueDate);
      let stage: number | undefined;
      if (daysUntil < 0) {
        const overdueFor = OVERDUE_FOR_DAYS[candidate.type];
        const showOverdue =
          settings.overdue &&
          overdueFor !== 0 &&
          (overdueFor === null || -daysUntil <= overdueFor);
        stage = showOverdue ? OVERDUE_STAGE : undefined;
      } else {
        stage = leads.find((lead) => daysUntil <= lead);
      }
      if (stage === undefined) continue;

      const key = `${candidate.type}:${candidate.itemId}:${candidate.dueDate}`;
      const state = states.get(key);
      if (state?.dismissedAt) continue;
      items.push({
        key,
        ...candidate,
        daysUntil,
        stage,
        unread: state?.seenStage == null || stage < state.seenStage,
      });
    }

    items.sort(
      (a, b) =>
        a.daysUntil - b.daysUntil ||
        a.title.localeCompare(b.title) ||
        a.key.localeCompare(b.key),
    );
    return {
      items,
      unreadCount: items.filter((item) => item.unread).length,
      settings,
    };
  }

  async markSeen(
    tenantId: string,
    userId: string,
    items: Array<{
      type: ReminderItemType;
      itemId: string;
      dueDate: string;
      stage: number;
    }>,
  ) {
    await this.repository.markSeen(userId, tenantId, uniqueReminders(items));
    return { ok: true };
  }

  /** Hides reminders (one, or all at once) until their due dates change. */
  async dismiss(
    tenantId: string,
    userId: string,
    items: Array<{ type: ReminderItemType; itemId: string; dueDate: string }>,
  ) {
    await this.repository.dismiss(userId, tenantId, uniqueReminders(items));
    return { ok: true };
  }
}
