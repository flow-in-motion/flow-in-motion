import {
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { fundings } from "./fundings";
import { projects } from "./projects";
import { tenants } from "./tenants";

export const fundingProjects = pgTable(
  "funding_projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    fundingId: uuid("funding_id")
      .notNull()
      .references(() => fundings.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    uniqueFundingProject: uniqueIndex(
      "funding_projects_funding_id_project_id_key",
    ).on(table.fundingId, table.projectId),
    projectIdx: index("funding_projects_project_id_idx").on(table.projectId),
    tenantIdx: index("funding_projects_tenant_id_idx").on(table.tenantId),
  }),
);
