import {
  date,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { conferences } from "./conferences";
import { modules } from "./modules";
import { tenants } from "./tenants";

export const conferenceModules = pgTable(
  "conference_modules",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    conferenceId: uuid("conference_id")
      .notNull()
      .references(() => conferences.id, { onDelete: "cascade" }),

    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),

    presentedDate: date("presented_date"),
    presentationType: text("presentation_type"),
    paperTitle: text("paper_title"),
    abstract: text("abstract"),
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    uniqueConferenceModule: uniqueIndex(
      "conference_modules_conference_id_module_id_key",
    ).on(table.conferenceId, table.moduleId),

    moduleIdx: index("conference_modules_module_id_idx").on(table.moduleId),

    tenantIdx: index("conference_modules_tenant_id_idx").on(table.tenantId),
  }),
);