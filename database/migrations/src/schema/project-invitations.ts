// database/migrations/src/schema/project-invitations.ts
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { users } from './users';

export const projectInvitations = pgTable('project_invitations', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  name: text('name'),
  affiliation: text('affiliation'),
  role: text('role').notNull(),
  invitedBy: uuid('invited_by')
    .notNull()
    .references(() => users.id),
  token: text('token').unique(),
  status: text('status').notNull().default('draft'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
