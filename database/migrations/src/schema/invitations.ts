import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { users } from './users';

export const invitations = pgTable('invitations', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: text('role').notNull(),
  invitedBy: uuid('invited_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  status: text('status').notNull().default('pending'), // pending | accepted | revoked | expired
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
