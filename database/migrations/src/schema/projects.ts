import { pgTable, uuid, text, date, numeric, timestamp, uniqueIndex, AnyPgColumn } from 'drizzle-orm/pg-core';
import { users } from './users';
import { tenants } from './tenants';
import { enumTable } from './enum';

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    displayId: text('display_id'),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    researchArea: text('research_area'),
    statusId: uuid('status_id').references((): AnyPgColumn => enumTable.id),
    importanceId: uuid('importance_id').references((): AnyPgColumn => enumTable.id),
    scheduledFor: date('scheduled_for'),
    dueDate: date('due_date'),
    totalBudget: numeric('total_budget', { precision: 12, scale: 2 }),
    targetJournals: text('target_journals'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantDisplayIdKey: uniqueIndex('projects_tenant_id_display_id_key').on(table.tenantId, table.displayId),
  }),
);
