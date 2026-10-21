-- Allow papers without a project ("independent papers").
-- The creator of a paper that has no project can see and manage it. This lets
-- the paper be created and its first Owner added; after that its collaborators
-- get access exactly as for any other paper. Papers inside a project are
-- unchanged.

CREATE OR REPLACE FUNCTION public.check_module_access(
  check_tenant_id uuid,
  check_module_id uuid,
  check_user_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.modules m
    WHERE m.id = check_module_id
      AND m.tenant_id = check_tenant_id
      AND (
        EXISTS (
          SELECT 1
          FROM public.module_collaborators mc
          WHERE mc.module_id = m.id
            AND mc.tenant_id = m.tenant_id
            AND mc.user_id = check_user_id
        )
        OR EXISTS (
          SELECT 1
          FROM public.projects p
          WHERE p.id = m.project_id
            AND p.tenant_id = m.tenant_id
            AND p.user_id = check_user_id
        )
        OR (m.project_id IS NULL AND m.created_by = check_user_id)
      )
  );
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.check_module_manage_access(
  check_tenant_id uuid,
  check_module_id uuid,
  check_user_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.modules m
    WHERE m.id = check_module_id
      AND m.tenant_id = check_tenant_id
      AND (
        EXISTS (
          SELECT 1
          FROM public.module_collaborators mc
          JOIN public."enum" e ON e.id = mc.role_id
          WHERE mc.module_id = m.id
            AND mc.tenant_id = m.tenant_id
            AND mc.user_id = check_user_id
            AND e.category = 'project_role'
            AND e.value = 'Owner'
        )
        OR EXISTS (
          SELECT 1
          FROM public.projects p
          WHERE p.id = m.project_id
            AND p.tenant_id = m.tenant_id
            AND p.user_id = check_user_id
        )
        OR (m.project_id IS NULL AND m.created_by = check_user_id)
      )
  );
$$;
--> statement-breakpoint

DROP POLICY IF EXISTS modules_visibility ON public.modules;
--> statement-breakpoint

CREATE POLICY modules_visibility ON public.modules
  USING (
    public.is_module_collaborator(
      id,
      NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
    OR EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = modules.project_id
        AND p.tenant_id = modules.tenant_id
        AND p.user_id =
          NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
    OR (
      modules.project_id IS NULL
      AND modules.created_by =
        NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  )
  WITH CHECK (
    public.is_module_collaborator(
      id,
      NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
    OR EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = modules.project_id
        AND p.tenant_id = modules.tenant_id
        AND p.user_id =
          NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
    OR (
      modules.project_id IS NULL
      AND modules.created_by =
        NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  );
--> statement-breakpoint

-- Conference links: a paper without a project can be linked too.
DROP POLICY IF EXISTS conference_modules_insert ON conference_modules;
--> statement-breakpoint

CREATE POLICY conference_modules_insert ON conference_modules
  FOR INSERT
  TO research_tracker_app
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    AND EXISTS (
      SELECT 1
      FROM conferences
      WHERE conferences.id = conference_modules.conference_id
        AND conferences.tenant_id = conference_modules.tenant_id
        AND conferences.owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
    AND EXISTS (
      SELECT 1
      FROM modules
      LEFT JOIN projects ON projects.id = modules.project_id
      WHERE modules.id = conference_modules.module_id
        AND modules.tenant_id = conference_modules.tenant_id
        AND modules.archived_at IS NULL
        AND (modules.project_id IS NULL OR projects.archived_at IS NULL)
        AND (
          projects.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
          OR (
            projects.id IS NOT NULL
            AND public.is_project_collaborator(
              projects.id,
              NULLIF(current_setting('app.current_user_id', true), '')::uuid
            )
          )
          OR public.is_module_collaborator(
            modules.id,
            NULLIF(current_setting('app.current_user_id', true), '')::uuid
          )
        )
    )
  );
--> statement-breakpoint

DROP POLICY IF EXISTS conference_modules_update ON conference_modules;
--> statement-breakpoint

CREATE POLICY conference_modules_update ON conference_modules
  FOR UPDATE
  TO research_tracker_app
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    AND EXISTS (
      SELECT 1
      FROM conferences
      WHERE conferences.id = conference_modules.conference_id
        AND conferences.tenant_id = conference_modules.tenant_id
        AND conferences.owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    AND EXISTS (
      SELECT 1
      FROM conferences
      WHERE conferences.id = conference_modules.conference_id
        AND conferences.tenant_id = conference_modules.tenant_id
        AND conferences.owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
    AND EXISTS (
      SELECT 1
      FROM modules
      LEFT JOIN projects ON projects.id = modules.project_id
      WHERE modules.id = conference_modules.module_id
        AND modules.tenant_id = conference_modules.tenant_id
        AND modules.archived_at IS NULL
        AND (modules.project_id IS NULL OR projects.archived_at IS NULL)
        AND (
          projects.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
          OR (
            projects.id IS NOT NULL
            AND public.is_project_collaborator(
              projects.id,
              NULLIF(current_setting('app.current_user_id', true), '')::uuid
            )
          )
          OR public.is_module_collaborator(
            modules.id,
            NULLIF(current_setting('app.current_user_id', true), '')::uuid
          )
        )
    )
  );
