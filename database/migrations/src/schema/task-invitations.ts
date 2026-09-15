// database/migrations/src/schema/task-invitations.ts
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { tasks } from './tasks';
import { users } from './users';

export const taskInvitations = pgTable('task_invitations', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskId: uuid('task_id')
    .notNull()
    .references(() => tasks.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  name: text('name'),
  affiliation: text('affiliation'),
  invitedBy: uuid('invited_by')
    .notNull()
    .references(() => users.id),
  token: text('token').unique(),
  status: text('status').notNull().default('draft'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
