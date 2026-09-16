-- Final security baseline for a fresh Supabase deployment.
-- The frontend uses Supabase Auth only; all application data access goes
-- through NestJS using the restricted research_tracker_app role.

CREATE OR REPLACE FUNCTION is_project_collaborator(check_project_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_collaborators
    WHERE project_id = check_project_id AND user_id = check_user_id
  );
$$;

CREATE OR REPLACE FUNCTION is_module_collaborator(check_module_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM module_collaborators
    WHERE module_id = check_module_id AND user_id = check_user_id
  );
$$;

CREATE OR REPLACE FUNCTION is_task_member(check_task_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM task_members
    WHERE task_id = check_task_id AND user_id = check_user_id
  );
$$;

CREATE OR REPLACE FUNCTION is_note_member(check_note_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM note_members
    WHERE note_id = check_note_id AND user_id = check_user_id
  );
$$;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE "enum" ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE conference_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_workspace_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invitations_visibility ON invitations;
CREATE POLICY invitations_visibility ON invitations
  USING (
    invited_by = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    OR email = (
      SELECT users.email FROM users
      WHERE users.id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenants
      WHERE tenants.id = invitations.tenant_id
        AND tenants.owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
    OR email = (
      SELECT users.email FROM users
      WHERE users.id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  );

DROP POLICY IF EXISTS workspace_contexts_owner ON workspace_contexts;
CREATE POLICY workspace_contexts_owner ON workspace_contexts
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

DROP POLICY IF EXISTS projects_visibility ON projects;
CREATE POLICY projects_visibility ON projects
  USING (
    user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    OR is_project_collaborator(id, NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  )
  WITH CHECK (
    user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    OR is_project_collaborator(id, NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  );

DROP POLICY IF EXISTS project_collaborators_visibility ON project_collaborators;
CREATE POLICY project_collaborators_visibility ON project_collaborators
  USING (
    is_project_collaborator(project_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    OR EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_collaborators.project_id
        AND projects.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
    OR (
      user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      AND EXISTS (
        SELECT 1 FROM project_invitations
        WHERE project_invitations.project_id = project_collaborators.project_id
          AND project_invitations.status = 'pending'
          AND EXISTS (
            SELECT 1 FROM users
            WHERE users.id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
              AND lower(users.email) = lower(project_invitations.email)
          )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_collaborators.project_id
        AND projects.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
    OR (
      user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      AND EXISTS (
        SELECT 1 FROM project_invitations
        WHERE project_invitations.project_id = project_collaborators.project_id
          AND project_invitations.status = 'pending'
          AND EXISTS (
            SELECT 1 FROM users
            WHERE users.id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
              AND lower(users.email) = lower(project_invitations.email)
          )
      )
    )
  );

DROP POLICY IF EXISTS modules_visibility ON modules;
CREATE POLICY modules_visibility ON modules
  USING (
    (project_id IS NOT NULL AND EXISTS (SELECT 1 FROM projects WHERE projects.id = modules.project_id))
    OR (
      project_id IS NULL
      AND EXISTS (
        SELECT 1 FROM tenants
        WHERE tenants.id = modules.tenant_id
          AND tenants.owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      )
    )
    OR is_module_collaborator(id, NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  )
  WITH CHECK (
    (project_id IS NOT NULL AND EXISTS (SELECT 1 FROM projects WHERE projects.id = modules.project_id))
    OR (
      project_id IS NULL
      AND EXISTS (
        SELECT 1 FROM tenants
        WHERE tenants.id = modules.tenant_id
          AND tenants.owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      )
    )
    OR is_module_collaborator(id, NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  );

DROP POLICY IF EXISTS module_collaborators_visibility ON module_collaborators;
CREATE POLICY module_collaborators_visibility ON module_collaborators
  USING (
    is_module_collaborator(module_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    OR EXISTS (SELECT 1 FROM modules WHERE modules.id = module_collaborators.module_id)
    OR (
      user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      AND EXISTS (
        SELECT 1 FROM module_invitations
        WHERE module_invitations.module_id = module_collaborators.module_id
          AND module_invitations.status = 'pending'
          AND EXISTS (
            SELECT 1 FROM users
            WHERE users.id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
              AND lower(users.email) = lower(module_invitations.email)
          )
      )
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM modules WHERE modules.id = module_collaborators.module_id)
    OR (
      user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      AND EXISTS (
        SELECT 1 FROM module_invitations
        WHERE module_invitations.module_id = module_collaborators.module_id
          AND module_invitations.status = 'pending'
          AND EXISTS (
            SELECT 1 FROM users
            WHERE users.id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
              AND lower(users.email) = lower(module_invitations.email)
          )
      )
    )
  );

DROP POLICY IF EXISTS tasks_visibility ON tasks;
CREATE POLICY tasks_visibility ON tasks
  USING (
    created_by = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    OR is_task_member(id, NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  )
  WITH CHECK (
    created_by = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    OR is_task_member(id, NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  );

DROP POLICY IF EXISTS notes_visibility ON notes;
CREATE POLICY notes_visibility ON notes
  USING (
    created_by = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    OR is_note_member(id, NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  )
  WITH CHECK (
    created_by = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    OR is_note_member(id, NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  );

DROP POLICY IF EXISTS task_members_visibility ON task_members;
CREATE POLICY task_members_visibility ON task_members
  USING (
    is_task_member(task_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    OR EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = task_members.task_id
        AND tasks.created_by = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
    OR (
      user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      AND EXISTS (
        SELECT 1 FROM task_invitations
        WHERE task_invitations.task_id = task_members.task_id
          AND task_invitations.status = 'pending'
          AND EXISTS (
            SELECT 1 FROM users
            WHERE users.id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
              AND lower(users.email) = lower(task_invitations.email)
          )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = task_members.task_id
        AND tasks.created_by = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
    OR (
      user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      AND EXISTS (
        SELECT 1 FROM task_invitations
        WHERE task_invitations.task_id = task_members.task_id
          AND task_invitations.status = 'pending'
          AND EXISTS (
            SELECT 1 FROM users
            WHERE users.id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
              AND lower(users.email) = lower(task_invitations.email)
          )
      )
    )
  );

DROP POLICY IF EXISTS note_members_visibility ON note_members;
CREATE POLICY note_members_visibility ON note_members
  USING (
    is_note_member(note_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    OR EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = note_members.note_id
        AND notes.created_by = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
    OR (
      user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      AND EXISTS (
        SELECT 1 FROM note_invitations
        WHERE note_invitations.note_id = note_members.note_id
          AND note_invitations.status = 'pending'
          AND EXISTS (
            SELECT 1 FROM users
            WHERE users.id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
              AND lower(users.email) = lower(note_invitations.email)
          )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = note_members.note_id
        AND notes.created_by = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
    OR (
      user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      AND EXISTS (
        SELECT 1 FROM note_invitations
        WHERE note_invitations.note_id = note_members.note_id
          AND note_invitations.status = 'pending'
          AND EXISTS (
            SELECT 1 FROM users
            WHERE users.id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
              AND lower(users.email) = lower(note_invitations.email)
          )
      )
    )
  );

DROP POLICY IF EXISTS project_invitations_visibility ON project_invitations;
CREATE POLICY project_invitations_visibility ON project_invitations
  USING (
    invited_by = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        AND lower(users.email) = lower(project_invitations.email)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_invitations.project_id
        AND projects.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        AND lower(users.email) = lower(project_invitations.email)
    )
  );

DROP POLICY IF EXISTS module_invitations_visibility ON module_invitations;
CREATE POLICY module_invitations_visibility ON module_invitations
  USING (
    invited_by = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        AND lower(users.email) = lower(module_invitations.email)
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM modules WHERE modules.id = module_invitations.module_id)
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        AND lower(users.email) = lower(module_invitations.email)
    )
  );

DROP POLICY IF EXISTS task_invitations_visibility ON task_invitations;
CREATE POLICY task_invitations_visibility ON task_invitations
  USING (
    invited_by = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        AND lower(users.email) = lower(task_invitations.email)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = task_invitations.task_id
        AND tasks.created_by = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        AND lower(users.email) = lower(task_invitations.email)
    )
  );

DROP POLICY IF EXISTS note_invitations_visibility ON note_invitations;
CREATE POLICY note_invitations_visibility ON note_invitations
  USING (
    invited_by = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        AND lower(users.email) = lower(note_invitations.email)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = note_invitations.note_id
        AND notes.created_by = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        AND lower(users.email) = lower(note_invitations.email)
    )
  );

DROP POLICY IF EXISTS calendar_events_visibility ON calendar_events;
CREATE POLICY calendar_events_visibility ON calendar_events
  USING (is_tenant_member(tenant_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid))
  WITH CHECK (
    created_by = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    AND is_tenant_member(tenant_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  );

DROP POLICY IF EXISTS module_submissions_visibility ON module_submissions;
CREATE POLICY module_submissions_visibility ON module_submissions
  USING (
    check_module_access(
      tenant_id,
      module_id,
      NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  )
  WITH CHECK (
    check_module_access(
      tenant_id,
      module_id,
      NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  );

-- SECURITY DEFINER functions must not inherit a caller-controlled search path.
DO $$
DECLARE
  function_signature text;
BEGIN
  FOR function_signature IN
    SELECT format(
      '%I.%I(%s)',
      namespace.nspname,
      procedure.proname,
      pg_get_function_identity_arguments(procedure.oid)
    )
    FROM pg_proc AS procedure
    INNER JOIN pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.prosecdef
      AND procedure.proowner = current_user::regrole
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %s SET search_path = public, pg_temp',
      function_signature
    );
  END LOOP;
END
$$;

-- Lock application data behind the NestJS runtime role. Supabase Auth roles
-- intentionally receive no direct table, sequence, or function access.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM research_tracker_app;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM research_tracker_app;
GRANT USAGE ON SCHEMA public TO research_tracker_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO research_tracker_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO research_tracker_app;
REVOKE CREATE ON SCHEMA public FROM research_tracker_app;

DO $$
DECLARE
  function_signature text;
BEGIN
  FOR function_signature IN
    SELECT format(
      '%I.%I(%s)',
      namespace.nspname,
      procedure.proname,
      pg_get_function_identity_arguments(procedure.oid)
    )
    FROM pg_proc AS procedure
    INNER JOIN pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.proowner = current_user::regrole
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', function_signature);
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %s TO research_tracker_app',
      function_signature
    );
  END LOOP;
END
$$;

ALTER DEFAULT PRIVILEGES FOR ROLE research_tracker_migration IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE research_tracker_migration IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO research_tracker_app;
ALTER DEFAULT PRIVILEGES FOR ROLE research_tracker_migration IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO research_tracker_app;
ALTER DEFAULT PRIVILEGES FOR ROLE research_tracker_migration IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO research_tracker_app;

DO $$
DECLARE
  api_role text;
  function_signature text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM %I', api_role);
      EXECUTE format('REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM %I', api_role);
      EXECUTE format('REVOKE USAGE, CREATE ON SCHEMA public FROM %I', api_role);
      FOR function_signature IN
        SELECT format(
          '%I.%I(%s)',
          namespace.nspname,
          procedure.proname,
          pg_get_function_identity_arguments(procedure.oid)
        )
        FROM pg_proc AS procedure
        INNER JOIN pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
        WHERE namespace.nspname = 'public'
          AND procedure.proowner = current_user::regrole
      LOOP
        EXECUTE format(
          'REVOKE EXECUTE ON FUNCTION %s FROM %I',
          function_signature,
          api_role
        );
      END LOOP;
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE research_tracker_migration IN SCHEMA public REVOKE ALL ON TABLES FROM %I',
        api_role
      );
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE research_tracker_migration IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I',
        api_role
      );
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE research_tracker_migration IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM %I',
        api_role
      );
    END IF;
  END LOOP;
END
$$;
