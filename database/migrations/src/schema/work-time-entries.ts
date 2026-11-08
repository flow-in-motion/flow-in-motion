import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";
import { projects } from "./projects";
import { notes } from "./notes";
import { hdrPeople } from "./hdr-people";

// Direct time only; never rolls up or changes time on tasks or papers.
export const workTimeEntries = pgTable(
  "work_time_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    noteId: uuid("note_id").references(() => notes.id, { onDelete: "cascade" }),
    hdrPersonId: uuid("hdr_person_id").references(() => hdrPeople.id, {
      onDelete: "cascade",
    }),
    source: text("source").notNull().default("timer"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    runningSince: timestamp("running_since", { withTimezone: true }),
    durationSeconds: integer("duration_seconds").notNull().default(0),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "work_time_one_target",
      sql`num_nonnulls(${t.projectId}, ${t.noteId}, ${t.hdrPersonId}) = 1`,
    ),
    check("work_time_source", sql`${t.source} IN ('timer', 'manual')`),
    check("work_time_duration", sql`${t.durationSeconds} >= 0`),
    check(
      "work_time_dates",
      sql`${t.endedAt} IS NULL OR (${t.runningSince} IS NULL AND ${t.endedAt} >= ${t.startedAt})`,
    ),
    check(
      "work_time_manual",
      sql`${t.source} <> 'manual' OR (${t.endedAt} IS NOT NULL AND ${t.durationSeconds} BETWEEN 60 AND 86400)`,
    ),
    check(
      "work_time_note",
      sql`${t.note} IS NULL OR length(${t.note}) <= 2000`,
    ),
    uniqueIndex("work_time_open_project")
      .on(t.userId, t.projectId)
      .where(sql`${t.endedAt} IS NULL AND ${t.projectId} IS NOT NULL`),
    uniqueIndex("work_time_open_note")
      .on(t.userId, t.noteId)
      .where(sql`${t.endedAt} IS NULL AND ${t.noteId} IS NOT NULL`),
    uniqueIndex("work_time_open_hdr")
      .on(t.userId, t.hdrPersonId)
      .where(sql`${t.endedAt} IS NULL AND ${t.hdrPersonId} IS NOT NULL`),
    index("work_time_user_started_idx").on(t.userId, t.startedAt, t.id),
    index("work_time_project_idx").on(t.projectId),
    index("work_time_note_idx").on(t.noteId),
    index("work_time_hdr_idx").on(t.hdrPersonId),
  ],
);
