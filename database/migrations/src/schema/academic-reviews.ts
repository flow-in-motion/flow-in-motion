import { sql } from "drizzle-orm";
import {
  check,
  date,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";

// Independent of HDR students, papers, projects, tasks and their sharing rules.
export const academicReviews = pgTable(
  "academic_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    studentName: text("student_name"),
    studentNumber: text("student_number"),
    supervisorName1: text("supervisor_name_1"),
    supervisorName2: text("supervisor_name_2"),
    universityName: text("university_name"),
    school: text("school"),
    country: text("country"),
    thesisTitle: text("thesis_title"),
    degreeType: text("degree_type"),
    fee: text("fee"),
    abstract: text("abstract"),
    journalName: text("journal_name"),
    manuscriptReference: text("manuscript_reference"),
    manuscriptTitle: text("manuscript_title"),
    journalRanking: text("journal_ranking"),
    requestedOn: date("requested_on"),
    dueOn: date("due_on"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("academic_reviews_id_tenant_key").on(t.id, t.tenantId),
    index("academic_reviews_owner_tenant_kind_created_idx").on(
      t.ownerUserId,
      t.tenantId,
      t.kind,
      t.createdAt,
      t.id,
    ),
    check(
      "academic_reviews_kind_check",
      sql`${t.kind} IN ('journal', 'examination')`,
    ),
    check(
      "academic_reviews_required_name_check",
      sql`(${t.kind} = 'examination' AND ${t.studentName} IS NOT NULL AND length(trim(${t.studentName})) BETWEEN 1 AND 300) OR (${t.kind} = 'journal' AND ${t.manuscriptTitle} IS NOT NULL AND length(trim(${t.manuscriptTitle})) BETWEEN 1 AND 1000)`,
    ),
    check(
      "academic_reviews_degree_check",
      sql`${t.degreeType} IS NULL OR ${t.degreeType} IN ('PhD', 'MRes', 'Masters', 'Other')`,
    ),
    check(
      "academic_reviews_dates_check",
      sql`${t.requestedOn} IS NULL OR ${t.dueOn} IS NULL OR ${t.dueOn} >= ${t.requestedOn}`,
    ),
    check(
      "academic_reviews_fields_check",
      sql`(${t.kind} = 'examination' AND ${t.journalName} IS NULL AND ${t.manuscriptReference} IS NULL AND ${t.manuscriptTitle} IS NULL AND ${t.journalRanking} IS NULL) OR (${t.kind} = 'journal' AND ${t.studentName} IS NULL AND ${t.studentNumber} IS NULL AND ${t.supervisorName1} IS NULL AND ${t.supervisorName2} IS NULL AND ${t.universityName} IS NULL AND ${t.school} IS NULL AND ${t.country} IS NULL AND ${t.thesisTitle} IS NULL AND ${t.degreeType} IS NULL AND ${t.fee} IS NULL AND ${t.abstract} IS NULL)`,
    ),
  ],
);

export const academicReviewNotes = pgTable(
  "academic_review_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    reviewId: uuid("review_id").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.reviewId, t.tenantId],
      foreignColumns: [academicReviews.id, academicReviews.tenantId],
    }).onDelete("cascade"),
    index("academic_review_notes_record_created_idx").on(
      t.reviewId,
      t.tenantId,
      t.createdAt,
      t.id,
    ),
    check(
      "academic_review_notes_content_check",
      sql`length(trim(${t.content})) BETWEEN 1 AND 20000`,
    ),
  ],
);
