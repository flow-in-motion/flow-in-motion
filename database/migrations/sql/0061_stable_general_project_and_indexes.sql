ALTER TABLE "projects" ADD COLUMN "is_general" boolean DEFAULT false NOT NULL;--> statement-breakpoint

-- Give the existing built-in General project a stable identity that survives
-- user renames. If legacy data contains duplicate projects named General,
-- only the oldest active one is treated as the built-in project.
WITH general_candidates AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY tenant_id
      ORDER BY created_at ASC, id ASC
    ) AS candidate_rank
  FROM projects
  WHERE archived_at IS NULL
    AND lower(btrim(title)) = 'general'
)
UPDATE projects AS project
SET is_general = true
FROM general_candidates AS candidate
WHERE project.id = candidate.id
  AND candidate.candidate_rank = 1;--> statement-breakpoint

-- Repair any workspace whose original General project was renamed or removed.
-- The fallback remains owner-controlled and can be renamed after this migration.
INSERT INTO projects (user_id, tenant_id, title, is_general)
SELECT tenant.owner_user_id, tenant.id, 'General', true
FROM tenants AS tenant
WHERE NOT EXISTS (
  SELECT 1
  FROM projects AS project
  WHERE project.tenant_id = tenant.id
    AND project.is_general = true
);--> statement-breakpoint

-- A built-in project behaves like an ordinary active project. Preserve any
-- status already chosen for an existing General project and fill only blanks.
UPDATE projects AS project
SET status_id = (
      SELECT enum_value.id
      FROM enum AS enum_value
      WHERE enum_value.category = 'project_status'
        AND lower(enum_value.value) = 'active'
        AND (enum_value.tenant_id IS NULL OR enum_value.tenant_id = project.tenant_id)
      ORDER BY enum_value.tenant_id NULLS LAST
      LIMIT 1
    ),
    updated_at = now()
WHERE project.is_general = true
  AND project.status_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM enum AS enum_value
    WHERE enum_value.category = 'project_status'
      AND lower(enum_value.value) = 'active'
      AND (enum_value.tenant_id IS NULL OR enum_value.tenant_id = project.tenant_id)
  );--> statement-breakpoint

-- Ensure the fallback project participates in the same collaboration model as
-- every other project. Prefer a tenant-specific Owner role, then the global one.
INSERT INTO project_collaborators (tenant_id, project_id, user_id, role_id)
SELECT
  project.tenant_id,
  project.id,
  project.user_id,
  owner_role.id
FROM projects AS project
JOIN LATERAL (
  SELECT enum_value.id
  FROM enum AS enum_value
  WHERE enum_value.category = 'project_role'
    AND lower(enum_value.value) = 'owner'
    AND (enum_value.tenant_id IS NULL OR enum_value.tenant_id = project.tenant_id)
  ORDER BY enum_value.tenant_id NULLS LAST
  LIMIT 1
) AS owner_role ON true
WHERE project.is_general = true
  AND NOT EXISTS (
    SELECT 1
    FROM project_collaborators AS collaborator
    WHERE collaborator.project_id = project.id
      AND collaborator.user_id = project.user_id
  );--> statement-breakpoint

-- Every paper must belong to a project. Move legacy unassigned papers to the
-- built-in project before enforcing the constraint.
UPDATE modules AS module
SET project_id = project.id,
    updated_at = now()
FROM projects AS project
WHERE module.project_id IS NULL
  AND project.tenant_id = module.tenant_id
  AND project.is_general = true;--> statement-breakpoint

ALTER TABLE "modules" ALTER COLUMN "project_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "projects_one_general_per_tenant_key" ON "projects" USING btree ("tenant_id") WHERE "projects"."is_general" = true;--> statement-breakpoint
CREATE INDEX "projects_tenant_active_created_idx" ON "projects" USING btree ("tenant_id","archived_at","created_at");--> statement-breakpoint
CREATE INDEX "modules_tenant_project_active_idx" ON "modules" USING btree ("tenant_id","project_id","archived_at");--> statement-breakpoint
CREATE INDEX "notes_tenant_project_id_idx" ON "notes" USING btree ("tenant_id","project_id");--> statement-breakpoint
CREATE INDEX "notes_tenant_module_id_idx" ON "notes" USING btree ("tenant_id","module_id");--> statement-breakpoint
CREATE INDEX "tasks_tenant_project_id_idx" ON "tasks" USING btree ("tenant_id","project_id");--> statement-breakpoint
CREATE INDEX "tasks_tenant_module_id_idx" ON "tasks" USING btree ("tenant_id","module_id");
