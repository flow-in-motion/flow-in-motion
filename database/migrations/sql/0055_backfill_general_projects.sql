-- Backfill one active "General" project for every active workspace that does
-- not already have one.
--
-- This migration runs only once. If a user later archives/deletes their
-- General project, runtime code will not recreate it.

WITH eligible_workspaces AS MATERIALIZED (
  SELECT
    tenant.id AS tenant_id,
    tenant.owner_user_id
  FROM tenants AS tenant
  WHERE tenant.status = 'active'
    AND NOT EXISTS (
      SELECT 1
      FROM projects AS existing_project
      WHERE existing_project.tenant_id = tenant.id
        AND existing_project.archived_at IS NULL
        AND lower(btrim(existing_project.title)) = 'general'
    )
),

-- Reserve the next normal PRJ-#### display ID for each eligible workspace.
-- If a sequence row is missing, initialise it from the largest existing
-- project display ID in that workspace.
reserved_sequences AS (
  INSERT INTO tenant_sequences (
    tenant_id,
    entity_type,
    last_value,
    updated_at
  )
  SELECT
    workspace.tenant_id,
    'project',
    COALESCE(
      (
        SELECT max(
          substring(project.display_id FROM '^PRJ-([0-9]+)$')::integer
        )
        FROM projects AS project
        WHERE project.tenant_id = workspace.tenant_id
          AND project.display_id ~ '^PRJ-[0-9]+$'
      ),
      0
    ) + 1,
    now()
  FROM eligible_workspaces AS workspace
  ON CONFLICT (tenant_id, entity_type)
  DO UPDATE SET
    last_value = greatest(
      tenant_sequences.last_value + 1,
      excluded.last_value
    ),
    updated_at = now()
  RETURNING tenant_id, last_value
),

inserted_projects AS (
  INSERT INTO projects (
    user_id,
    tenant_id,
    title,
    display_id,
    created_at,
    updated_at
  )
  SELECT
    workspace.owner_user_id,
    workspace.tenant_id,
    'General',
    'PRJ-' || lpad(sequence.last_value::text, 4, '0'),
    now(),
    now()
  FROM eligible_workspaces AS workspace
  INNER JOIN reserved_sequences AS sequence
    ON sequence.tenant_id = workspace.tenant_id
  RETURNING id, tenant_id, user_id
)

-- Add the same Owner collaborator record produced by ProjectsService.create().
INSERT INTO project_collaborators (
  tenant_id,
  project_id,
  user_id,
  role_id,
  created_at,
  updated_at
)
SELECT
  project.tenant_id,
  project.id,
  project.user_id,
  (
    SELECT role.id
    FROM "enum" AS role
    WHERE role.tenant_id IS NULL
      AND role.project_id IS NULL
      AND role.module_id IS NULL
      AND role.category = 'project_role'
      AND role.value = 'Owner'
    ORDER BY role.created_at, role.id
    LIMIT 1
  ),
  now(),
  now()
FROM inserted_projects AS project;