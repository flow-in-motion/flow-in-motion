import { jsonb, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { users } from './users';

export interface AccountPreferenceValues {
  appearanceTheme?: string;
  designTheme?: string;
  colorTheme?: string;
  textSize?: string;
}

export interface DashboardLayoutPreference {
  order: string[];
  hidden: string[];
  /** Widget widths as percentages, from 25 to 100. */
  widths?: Record<string, number>;
}

export interface WorkspacePreferenceValues {
  dashboardLayout?: DashboardLayoutPreference;
  tableColumns?: Record<string, string[]>;
}

export const userPreferences = pgTable('user_preferences', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  preferences: jsonb('preferences')
    .$type<AccountPreferenceValues>()
    .notNull()
    .default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const userWorkspacePreferences = pgTable(
  'user_workspace_preferences',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    preferences: jsonb('preferences')
      .$type<WorkspacePreferenceValues>()
      .notNull()
      .default({}),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.tenantId] })],
);
