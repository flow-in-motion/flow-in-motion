import { pgTable, uuid, text, date, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { modules } from './modules';
import { tenants } from './tenants';
import { users } from './users';

export const moduleSubmissions = pgTable(
  'module_submissions',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    moduleId: uuid('module_id')
      .notNull()
      .references(() => modules.id, { onDelete: 'cascade' }),

    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    submittedDate: date('submitted_date').notNull(),
    journalName: text('journal_name').notNull(),
    status: text('status').notNull(),
    revisionRounds: integer('revision_rounds'),
    decisionDate: date('decision_date'),
    notes: text('notes'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tenantModuleIdx: index('module_submissions_tenant_id_module_id_idx').on(
      table.tenantId,
      table.moduleId,
    ),
  }),
);
