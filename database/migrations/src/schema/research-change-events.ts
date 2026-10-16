import { sql } from "drizzle-orm";
import {
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";

/**
 * Private, append-only research workflow history used by owner-only Insights.
 * Record ids are intentionally not foreign keys: an audit row remains useful
 * after its paper, submission, task, or funding record is deleted.
 */
export const researchChangeEvents = pgTable(
  "research_change_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    action: text("action").notNull(),
    fieldName: text("field_name"),
    fromValue: jsonb("from_value").$type<unknown>(),
    toValue: jsonb("to_value").$type<unknown>(),
    changedBy: uuid("changed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    changedAt: timestamp("changed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tenantChangedAtIdx: index(
      "research_change_events_tenant_id_changed_at_idx",
    ).on(table.tenantId, table.changedAt),
    tenantFieldChangedAtIdx: index(
      "research_change_events_tenant_entity_field_changed_at_idx",
    ).on(table.tenantId, table.entityType, table.fieldName, table.changedAt),
    entityChangedAtIdx: index(
      "research_change_events_entity_changed_at_idx",
    ).on(table.entityType, table.entityId, table.changedAt),
    entityTypeCheck: check(
      "research_change_events_entity_type_check",
      sql`${table.entityType} IN ('paper', 'submission', 'task', 'funding')`,
    ),
    actionCheck: check(
      "research_change_events_action_check",
      sql`${table.action} IN ('created', 'updated', 'deleted')`,
    ),
  }),
);
