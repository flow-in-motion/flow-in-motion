import { pgTable, uuid, text, timestamp, uniqueIndex, AnyPgColumn, date } from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { tenants } from './tenants';
import { users } from './users';
import { enumTable } from './enum';

export const modules = pgTable(
  'modules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    displayId: text('display_id'),
    projectId: uuid('project_id')
      .references(() => projects.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    shortTitle: text('short_title'),
    title: text('title'),
    description: text('description'),
    abstract: text('abstract'),
    targetJournal: text('target_journal'),
    backupJournal: text('backup_journal'),
    targetConference: text('target_conference'),
    backupConference: text('backup_conference'),
    statusId: uuid('status_id').references((): AnyPgColumn => enumTable.id),
    pipelineStageId: uuid('pipeline_stage_id').references((): AnyPgColumn => enumTable.id),
    pipelineStageChangedAt: timestamp('pipeline_stage_changed_at', { withTimezone: true }),
    assignedToUserId: uuid('assigned_to_user_id').references(() => users.id),
    dueDate: date('due_date'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantDisplayIdKey: uniqueIndex('modules_tenant_id_display_id_key').on(table.tenantId, table.displayId),
  }),
);