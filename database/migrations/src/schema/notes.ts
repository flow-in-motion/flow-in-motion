import { pgTable, uuid, text, timestamp, date, uniqueIndex } from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { modules } from './modules';
import { tenants } from './tenants';
import { users } from './users';
import { enumTable } from './enum';

export const notes = pgTable(
  'notes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    displayId: text('display_id'),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .references(() => projects.id, { onDelete: 'cascade' }),
    moduleId: uuid('module_id').references(() => modules.id, { onDelete: 'cascade' }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    content: text('content'),
    visibilityId: uuid('visibility_id').references(() => enumTable.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    followUpDate: date('follow_up_date'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantDisplayIdKey: uniqueIndex('notes_tenant_id_display_id_key').on(table.tenantId, table.displayId),
  }),
);
