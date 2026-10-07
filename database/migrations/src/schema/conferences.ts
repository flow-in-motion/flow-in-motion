import {
    pgTable,
    uuid,
    text,
    date,
    timestamp,
    index,
  } from 'drizzle-orm/pg-core';
  import { tenants } from './tenants';
  import { users } from './users';
  
  export const conferences = pgTable(
    'conferences',
    {
      id: uuid('id').defaultRandom().primaryKey(),
  
      tenantId: uuid('tenant_id')
        .notNull()
        .references(() => tenants.id, { onDelete: 'cascade' }),
  
      ownerUserId: uuid('owner_user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
  
      acronym: text('acronym'),
      name: text('name').notNull(),
      location: text('location'),
  
      submissionDue: date('submission_due'),
      startDate: date('start_date'),
      endDate: date('end_date'),
  
      submissionType: text('submission_type'),
  
      createdAt: timestamp('created_at', { withTimezone: true })
        .defaultNow()
        .notNull(),
  
      updatedAt: timestamp('updated_at', { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => ({
      tenantIdx: index('conferences_tenant_id_idx').on(table.tenantId),
      submissionDueIdx: index('conferences_submission_due_idx').on(
        table.submissionDue,
      ),
    }),
  );
