// database/migrations/src/schema/note-invitations.ts
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { notes } from './notes';
import { users } from './users';

export const noteInvitations = pgTable('note_invitations', {
  id: uuid('id').defaultRandom().primaryKey(),
  noteId: uuid('note_id')
    .notNull()
    .references(() => notes.id, { onDelete: 'cascade' }),
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
