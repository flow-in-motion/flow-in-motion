import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { tasks } from './tasks';
import { tenants } from './tenants';
import { users } from './users';

/**
 * Time someone spent on a task: either a timer run (Start → Pause/Resume →
 * Stop) or an entry added by hand.
 *
 * A timer entry stays open (ended_at is null) until it is stopped. While it
 * is running, running_since holds when the current stretch began; pausing
 * folds that stretch into duration_seconds and clears running_since. So the
 * time logged is always duration_seconds, plus now() - running_since for a
 * timer that is running right now.
 */
export const taskTimeEntries = pgTable(
  'task_time_entries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** The task's workspace, copied so time can be reported per workspace. */
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    /** Whose time this is. Each person logs their own time. */
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** 'timer' or 'manual'. */
    source: text('source').notNull().default('timer'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    /** Null while the timer is still open (running or paused). */
    endedAt: timestamp('ended_at', { withTimezone: true }),
    /** When the current running stretch began; null when paused or ended. */
    runningSince: timestamp('running_since', { withTimezone: true }),
    /** Seconds logged so far, not counting a stretch that is still running. */
    durationSeconds: integer('duration_seconds').notNull().default(0),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    taskStartedIndex: index('task_time_entries_task_id_started_at_idx').on(
      table.taskId,
      table.startedAt,
    ),
    userStartedIndex: index('task_time_entries_user_id_started_at_idx').on(
      table.userId,
      table.startedAt,
    ),
    /** One open timer per person: starting another stops the first. */
    oneOpenTimerPerUser: uniqueIndex('task_time_entries_one_open_per_user_key')
      .on(table.userId)
      .where(sql`${table.endedAt} IS NULL`),
    sourceCheck: check(
      'task_time_entries_source_check',
      sql`${table.source} IN ('timer', 'manual')`,
    ),
    durationCheck: check(
      'task_time_entries_duration_check',
      sql`${table.durationSeconds} >= 0`,
    ),
    endedCheck: check(
      'task_time_entries_ended_check',
      sql`${table.endedAt} IS NULL OR (${table.runningSince} IS NULL AND ${table.endedAt} >= ${table.startedAt})`,
    ),
    manualCheck: check(
      'task_time_entries_manual_check',
      sql`${table.source} = 'timer' OR (${table.endedAt} IS NOT NULL AND ${table.durationSeconds} > 0)`,
    ),
  }),
);
