import {
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  date,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";

/**
 * Private research snapshots. This table has RLS enabled without end-user
 * policies; only the migration role and the scheduled internal function can
 * read or write it.
 */
export const usageWeeklySnapshots = pgTable(
  "usage_weekly_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weekStart: date("week_start").notNull(),
    projectCount: integer("project_count").notNull(),
    paperCount: integer("paper_count").notNull(),
    taskCount: integer("task_count").notNull(),
    noteCount: integer("note_count").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tenantUserWeekKey: uniqueIndex(
      "usage_weekly_snapshots_tenant_user_week_key",
    ).on(table.tenantId, table.userId, table.weekStart),
    userIdIdx: index("usage_weekly_snapshots_user_id_idx").on(table.userId),
    weekStartIdx: index("usage_weekly_snapshots_week_start_idx").on(
      table.weekStart,
    ),
  }),
);
