import { sql } from "drizzle-orm";
import {
  check,
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
import { projects } from "./projects";
import { tenants } from "./tenants";

/**
 * One submission to a conference or event, and (for papers) its
 * presentation details. A submission is a paper, a project, or just a typed
 * title (for example a PDW), never more than one of paper and project.
 */
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

    /** The paper being submitted, if it is a paper. */
    moduleId: uuid("module_id").references(() => modules.id, {
      onDelete: "cascade",
    }),

    /** The project being submitted, if it is a project. */
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),

    /** Full paper, Abstract, Poster, PDW, … */
    submissionType: text("submission_type"),
    /** Planning, Submitted, Accepted, Rejected, Withdrawn or Presented. */
    status: text("status"),
    /** This submission's own deadline, when it differs from the event's. */
    submissionDue: date("submission_due"),

    presentedDate: date("presented_date"),
    presentationType: text("presentation_type"),
    /** Title as submitted; the only title for a typed submission. */
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

    projectIdx: index("conference_modules_project_id_idx").on(table.projectId),

    tenantIdx: index("conference_modules_tenant_id_idx").on(table.tenantId),

    subjectCheck: check(
      "conference_modules_subject_check",
      sql`num_nonnulls(${table.moduleId}, ${table.projectId}) <= 1 AND (${table.moduleId} IS NOT NULL OR ${table.projectId} IS NOT NULL OR nullif(btrim(${table.paperTitle}), '') IS NOT NULL)`,
    ),

    statusCheck: check(
      "conference_modules_status_check",
      sql`${table.status} IS NULL OR ${table.status} IN ('Planning', 'Submitted', 'Accepted', 'Rejected', 'Withdrawn', 'Presented')`,
    ),
  }),
);
