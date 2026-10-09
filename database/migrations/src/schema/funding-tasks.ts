import {
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { fundings } from "./fundings";
import { tasks } from "./tasks";
import { tenants } from "./tenants";

export const fundingTasks = pgTable(
  "funding_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    fundingId: uuid("funding_id")
      .notNull()
      .references(() => fundings.id, { onDelete: "cascade" }),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    uniqueFundingTask: uniqueIndex("funding_tasks_funding_id_task_id_key").on(
      table.fundingId,
      table.taskId,
    ),
    taskIdx: index("funding_tasks_task_id_idx").on(table.taskId),
    tenantIdx: index("funding_tasks_tenant_id_idx").on(table.tenantId),
  }),
);
