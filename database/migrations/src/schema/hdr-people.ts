import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";
import { projects } from "./projects";
import { modules } from "./modules";

export const hdrPeople = pgTable(
  "hdr_people",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull().default("PhD"),
    category: text("category").notNull().default("Current"),
    email: text("email"),
    researchTopic: text("research_topic"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("hdr_people_owner_tenant_name_idx").on(
      t.ownerUserId,
      t.tenantId,
      t.name,
    ),
    unique("hdr_people_id_tenant_key").on(t.id, t.tenantId),
    check(
      "hdr_people_name_check",
      sql`length(trim(${t.name})) BETWEEN 1 AND 200`,
    ),
    check(
      "hdr_people_type_check",
      sql`${t.type} IN ('PhD', 'MRes', 'Visiting scholar')`,
    ),
    check(
      "hdr_people_category_check",
      sql`${t.category} IN ('Current', 'Potential')`,
    ),
  ],
);

export const hdrProjects = pgTable(
  "hdr_projects",
  {
    personId: uuid("person_id").notNull(),
    tenantId: uuid("tenant_id").notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.personId, t.projectId] }),
    foreignKey({
      columns: [t.personId, t.tenantId],
      foreignColumns: [hdrPeople.id, hdrPeople.tenantId],
    }).onDelete("cascade"),
    index("hdr_projects_project_idx").on(t.projectId),
  ],
);

export const hdrPapers = pgTable(
  "hdr_papers",
  {
    personId: uuid("person_id").notNull(),
    tenantId: uuid("tenant_id").notNull(),
    paperId: uuid("paper_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.personId, t.paperId] }),
    foreignKey({
      columns: [t.personId, t.tenantId],
      foreignColumns: [hdrPeople.id, hdrPeople.tenantId],
    }).onDelete("cascade"),
    index("hdr_papers_paper_idx").on(t.paperId),
  ],
);
