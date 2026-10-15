import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { users } from './users';

export const analyticsEvents = pgTable(
  'analytics_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    name: text('name').notNull(),

    path: text('path'),

    sessionId: uuid('session_id'),

    pageKey: text('page_key'),

    featureKey: text('feature_key'),

    properties: jsonb('properties').$type<Record<string, unknown>>(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tenantCreatedAtIdx: index('analytics_events_tenant_id_created_at_idx').on(
      table.tenantId,
      table.createdAt,
    ),
    tenantNameIdx: index('analytics_events_tenant_id_name_idx').on(
      table.tenantId,
      table.name,
    ),
    userCreatedAtIdx: index('analytics_events_user_id_created_at_idx').on(
      table.userId,
      table.createdAt,
    ),
    tenantPageCreatedAtIdx: index(
      'analytics_events_tenant_id_page_key_created_at_idx',
    ).on(table.tenantId, table.pageKey, table.createdAt),
  }),
);
