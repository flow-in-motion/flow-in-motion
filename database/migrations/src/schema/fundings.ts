import {
  date,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";

export const fundings = pgTable(
  "fundings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fundingBody: text("funding_body").notNull(),
    scheme: text("scheme"),
    partners: text("partners"),
    amount: numeric("amount", { precision: 14, scale: 2 }),
    currency: text("currency"),
    applicationDeadline: date("application_deadline"),
    followUpDate: date("follow_up_date"),
    status: text("status"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tenantIdx: index("fundings_tenant_id_idx").on(table.tenantId),
    deadlineIdx: index("fundings_application_deadline_idx").on(
      table.applicationDeadline,
    ),
    followUpDateIdx: index("fundings_follow_up_date_idx").on(
      table.followUpDate,
    ),
  }),
);
