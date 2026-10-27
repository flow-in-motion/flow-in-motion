import {
    pgTable,
    uuid,
    text,
    date,
    timestamp,
    index,
    check,
  } from 'drizzle-orm/pg-core';
  import { sql } from 'drizzle-orm';
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
      notes: text('notes'),
  
      submissionDue: date('submission_due'),
      startDate: date('start_date'),
      endDate: date('end_date'),
  
      /**
       * Conference, Workshop, Research seminar, Journal special issue or
       * Other. Any event with a submission deadline can be tracked here.
       */
      eventType: text('event_type').notNull().default('Conference'),
      submissionType: text('submission_type'),
      intents: text('intents')
        .array()
        .notNull()
        .default(sql`ARRAY[]::text[]`),
  
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
      eventTypeCheck: check(
        'conferences_event_type_check',
        sql`${table.eventType} IN ('Conference', 'Workshop', 'Research seminar', 'Journal special issue', 'Other')`,
      ),
      intentsCheck: check(
        'conferences_intents_check',
        sql`${table.intents} <@ ARRAY['Considering', 'Submitting', 'Attending']::text[] AND array_position(${table.intents}, NULL) IS NULL`,
      ),
    }),
  );
