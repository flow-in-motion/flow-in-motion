import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  uniqueIndex,
  index,
  AnyPgColumn,
  date,
  check,
} from "drizzle-orm/pg-core";
import { projects } from "./projects";
import { tenants } from "./tenants";
import { users } from "./users";
import { enumTable } from "./enum";

export const modules = pgTable(
  "modules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    displayId: text("display_id"),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    shortTitle: text("short_title"),
    title: text("title"),
    description: text("description"),
    abstract: text("abstract"),
    targetJournal: text("target_journal"),
    backupJournal: text("backup_journal"),
    targetConference: text("target_conference"),
    backupConference: text("backup_conference"),
    statusId: uuid("status_id").references((): AnyPgColumn => enumTable.id),
    priorityId: uuid("priority_id").references((): AnyPgColumn => enumTable.id),
    pipelineStageId: uuid("pipeline_stage_id").references(
      (): AnyPgColumn => enumTable.id,
    ),
    pipelineStageChangedAt: timestamp("pipeline_stage_changed_at", {
      withTimezone: true,
    }),
    assignedToUserId: uuid("assigned_to_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    // Draft/pending collaborator contacts do not have an application user id
    // yet. Keep their invitation id separately so "Currently With" can point
    // at the saved contact without granting that contact application access.
    assignedToInvitationId: uuid("assigned_to_invitation_id"),
    currentlyWithType: text("currently_with_type"),
    dueDate: date("due_date"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tenantDisplayIdKey: uniqueIndex("modules_tenant_id_display_id_key").on(
      table.tenantId,
      table.displayId,
    ),
    assignedToInvitationIdIdx: index("modules_assigned_to_invitation_id_idx")
      .on(table.assignedToInvitationId)
      .where(sql`${table.assignedToInvitationId} IS NOT NULL`),
    createdByIdx: index("modules_created_by_idx")
      .on(table.createdBy)
      .where(sql`${table.createdBy} IS NOT NULL`),
    currentlyWithTypeCheck: check(
      "modules_currently_with_type_check",
      sql`${table.currentlyWithType} IS NULL OR ${table.currentlyWithType} IN ('me', 'collaborator', 'journal', 'friendly_reviewer', 'others')`,
    ),
  }),
);
