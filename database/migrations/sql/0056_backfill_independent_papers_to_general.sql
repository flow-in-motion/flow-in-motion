-- Existing independent papers used project_id = NULL.
-- Independent papers now belong to the workspace's General project.

WITH general_projects AS MATERIALIZED (
  SELECT DISTINCT ON (project.tenant_id)
    project.tenant_id,
    project.id AS project_id
  FROM projects AS project
  WHERE project.archived_at IS NULL
    AND lower(btrim(project.title)) = 'general'
  ORDER BY
    project.tenant_id,
    project.created_at,
    project.id
)
UPDATE modules AS module
SET
  project_id = general_project.project_id,
  updated_at = now()
FROM general_projects AS general_project
WHERE module.tenant_id = general_project.tenant_id
  AND module.project_id IS NULL;

-- Fail visibly if an active workspace still contains an independent paper
-- that could not be connected to General.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM modules AS module
    INNER JOIN tenants AS tenant
      ON tenant.id = module.tenant_id
    WHERE tenant.status = 'active'
      AND module.project_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'Cannot backfill independent papers: an active workspace is missing its General project';
  END IF;
END
$$;