import { sql } from 'drizzle-orm';
import {
  check,
  date,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { tenants } from './tenants';
import { users } from './users';

/**
 * What someone has already seen or dismissed in their due-date reminders.
 * A reminder is one item's due date (a task, paper, project, event
 * deadline, funding deadline or follow-up); it is "unread" until the
 * person has seen its current stage (1 week before, tomorrow, today,
 * overdue, ...). Keyed by the due date, so moving the date brings the
 * reminder back.
 */
export const dueReminderStates = pgTable(
  'due_reminder_states',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    /** task, paper, project, conference, conference_submission,
     * funding_deadline, funding_follow_up or note. */
    itemType: text('item_type').notNull(),
    itemId: uuid('item_id').notNull(),
    dueDate: date('due_date').notNull(),
    /** Days before the due date of the latest stage seen; -1 is overdue. */
    seenStage: integer('seen_stage'),
    dismissedAt: timestamp('dismissed_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.itemType, table.itemId, table.dueDate],
    }),
    check(
      'due_reminder_states_item_type_check',
      sql`${table.itemType} IN ('task', 'paper', 'project', 'conference', 'conference_submission', 'funding_deadline', 'funding_follow_up', 'note')`,
    ),
    check(
      'due_reminder_states_seen_stage_check',
      sql`${table.seenStage} IS NULL OR ${table.seenStage} >= -1`,
    ),
  ],
);
