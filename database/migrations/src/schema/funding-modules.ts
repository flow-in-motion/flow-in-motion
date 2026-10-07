import {
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { fundings } from "./fundings";
import { modules } from "./modules";
import { tenants } from "./tenants";

export const fundingModules = pgTable(
  "funding_modules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    fundingId: uuid("funding_id")
      .notNull()
      .references(() => fundings.id, { onDelete: "cascade" }),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    uniqueFundingModule: uniqueIndex(
      "funding_modules_funding_id_module_id_key",
    ).on(table.fundingId, table.moduleId),
    moduleIdx: index("funding_modules_module_id_idx").on(table.moduleId),
    tenantIdx: index("funding_modules_tenant_id_idx").on(table.tenantId),
  }),
);
