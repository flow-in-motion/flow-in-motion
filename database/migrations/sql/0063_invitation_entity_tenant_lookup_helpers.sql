-- Invitation acceptance must resolve the target tenant before the invitee is
-- already a collaborator/member. Return only the tenant ID required for the
-- membership insert, while bypassing RLS with the migration-owned function.

CREATE OR REPLACE FUNCTION find_project_tenant_for_invitation(
  target_project_id uuid
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT tenant_id
  FROM projects
  WHERE id = target_project_id
    AND archived_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION find_module_tenant_for_invitation(
  target_module_id uuid
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT module.tenant_id
  FROM modules AS module
  WHERE module.id = target_module_id
    AND module.archived_at IS NULL
    AND (
      module.project_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM projects AS project
        WHERE project.id = module.project_id
          AND project.archived_at IS NULL
      )
    );
$$;

CREATE OR REPLACE FUNCTION find_task_tenant_for_invitation(
  target_task_id uuid
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT task.tenant_id
  FROM tasks AS task
  WHERE task.id = target_task_id
    AND (
      task.project_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM projects AS project
        WHERE project.id = task.project_id
          AND project.archived_at IS NULL
      )
    )
    AND (
      task.module_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM modules AS module
        WHERE module.id = task.module_id
          AND module.archived_at IS NULL
          AND (
            module.project_id IS NULL
            OR EXISTS (
              SELECT 1
              FROM projects AS project
              WHERE project.id = module.project_id
                AND project.archived_at IS NULL
            )
          )
      )
    );
$$;

CREATE OR REPLACE FUNCTION find_note_tenant_for_invitation(
  target_note_id uuid
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT note.tenant_id
  FROM notes AS note
  WHERE note.id = target_note_id
    AND (
      note.project_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM projects AS project
        WHERE project.id = note.project_id
          AND project.archived_at IS NULL
      )
    )
    AND (
      note.module_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM modules AS module
        WHERE module.id = note.module_id
          AND module.archived_at IS NULL
          AND (
            module.project_id IS NULL
            OR EXISTS (
              SELECT 1
              FROM projects AS project
              WHERE project.id = module.project_id
                AND project.archived_at IS NULL
            )
          )
      )
    );
$$;

REVOKE ALL
ON FUNCTION find_project_tenant_for_invitation(uuid)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION find_module_tenant_for_invitation(uuid)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION find_task_tenant_for_invitation(uuid)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION find_note_tenant_for_invitation(uuid)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION find_project_tenant_for_invitation(uuid)
TO research_tracker_app;

GRANT EXECUTE
ON FUNCTION find_module_tenant_for_invitation(uuid)
TO research_tracker_app;

GRANT EXECUTE
ON FUNCTION find_task_tenant_for_invitation(uuid)
TO research_tracker_app;

GRANT EXECUTE
ON FUNCTION find_note_tenant_for_invitation(uuid)
TO research_tracker_app;