import { pgTable, uuid, text, date, numeric, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { modules } from './modules';
import { tenants } from './tenants';
import { users } from './users';
import { enumTable } from './enum';

export const tasks = pgTable(
  'tasks',
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
    description: text('description'),
    statusId: uuid('status_id').references(() => enumTable.id),
    priorityId: uuid('priority_id').references(() => enumTable.id),
    visibilityId: uuid('visibility_id').references(() => enumTable.id),
    workingWith: uuid('working_with').references(() => users.id),
    estimatedHours: numeric('estimated_hours', { precision: 6, scale: 2 }),
    dueDate: date('due_date'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantDisplayIdKey: uniqueIndex('tasks_tenant_id_display_id_key').on(table.tenantId, table.displayId),
  }),
);
