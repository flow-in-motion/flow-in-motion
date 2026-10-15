import {
  date,
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";

/**
 * Private daily research snapshots. This table has RLS enabled without
 * end-user policies; only the migration role and the scheduled internal
 * function can read or write it.
 */
export const usageDailySnapshots = pgTable(
  "usage_daily_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    snapshotDate: date("snapshot_date").notNull(),
    projectCount: integer("project_count").notNull(),
    paperCount: integer("paper_count").notNull(),
    taskCount: integer("task_count").notNull(),
    noteCount: integer("note_count").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tenantUserDateKey: uniqueIndex(
      "usage_daily_snapshots_tenant_user_date_key",
    ).on(table.tenantId, table.userId, table.snapshotDate),
    userIdIdx: index("usage_daily_snapshots_user_id_idx").on(table.userId),
    snapshotDateIdx: index("usage_daily_snapshots_snapshot_date_idx").on(
      table.snapshotDate,
    ),
  }),
);
