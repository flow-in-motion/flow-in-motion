import {
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { fundings } from "./fundings";
import { notes } from "./notes";
import { tenants } from "./tenants";

export const fundingNotes = pgTable(
  "funding_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    fundingId: uuid("funding_id")
      .notNull()
      .references(() => fundings.id, { onDelete: "cascade" }),
    noteId: uuid("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    uniqueFundingNote: uniqueIndex("funding_notes_funding_id_note_id_key").on(
      table.fundingId,
      table.noteId,
    ),
    noteIdx: index("funding_notes_note_id_idx").on(table.noteId),
    tenantIdx: index("funding_notes_tenant_id_idx").on(table.tenantId),
  }),
);
