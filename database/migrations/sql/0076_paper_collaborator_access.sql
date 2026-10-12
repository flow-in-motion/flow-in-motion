-- Paper access: explicit paper membership or parent project ownership.
-- Ordinary project collaborators no longer inherit paper access.

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
      )
  );
$$;
--> statement-breakpoint

-- Management access: explicit paper Owner or parent project owner.
-- This check does not create paper memberships.

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
      )
  );
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.check_module_manage_access(uuid, uuid, uuid)
FROM PUBLIC;
--> statement-breakpoint

GRANT EXECUTE ON FUNCTION public.check_module_manage_access(uuid, uuid, uuid)
TO research_tracker_app;
--> statement-breakpoint

DROP POLICY IF EXISTS modules_visibility ON public.modules;
--> statement-breakpoint

CREATE POLICY modules_visibility ON public.modules
  USING (
    public.check_module_access(
      tenant_id,
      id,
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
  );
--> statement-breakpoint

-- Separate collaborator read and write policies.
DROP POLICY IF EXISTS module_collaborators_visibility
ON public.module_collaborators;
--> statement-breakpoint

CREATE POLICY module_collaborators_select ON public.module_collaborators
  FOR SELECT
  USING (
    public.check_module_access(
      tenant_id,
      module_id,
      NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
    OR (
      user_id =
        NULLIF(current_setting('app.current_user_id', true), '')::uuid
      AND EXISTS (
        SELECT 1
        FROM public.module_invitations i
        JOIN public.users u ON lower(u.email) = lower(i.email)
        JOIN public."enum" e ON e.value = i.role
        WHERE i.module_id = module_collaborators.module_id
          AND i.status = 'pending'
          AND i.expires_at > now()
          AND u.id =
            NULLIF(current_setting('app.current_user_id', true), '')::uuid
          AND e.category = 'project_role'
          AND e.id = module_collaborators.role_id
      )
    )
  );
--> statement-breakpoint

CREATE POLICY module_collaborators_insert ON public.module_collaborators
  FOR INSERT
  WITH CHECK (
    public.check_module_manage_access(
      tenant_id,
      module_id,
      NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
    OR (
      user_id =
        NULLIF(current_setting('app.current_user_id', true), '')::uuid
      AND EXISTS (
        SELECT 1
        FROM public.module_invitations i
        JOIN public.users u ON lower(u.email) = lower(i.email)
        JOIN public."enum" e ON e.value = i.role
        WHERE i.module_id = module_collaborators.module_id
          AND i.status = 'pending'
          AND i.expires_at > now()
          AND u.id =
            NULLIF(current_setting('app.current_user_id', true), '')::uuid
          AND e.category = 'project_role'
          AND e.id = module_collaborators.role_id
      )
    )
  );
--> statement-breakpoint

CREATE POLICY module_collaborators_update ON public.module_collaborators
  FOR UPDATE
  USING (
    public.check_module_manage_access(
      tenant_id,
      module_id,
      NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  )
  WITH CHECK (
    public.check_module_manage_access(
      tenant_id,
      module_id,
      NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  );
--> statement-breakpoint

CREATE POLICY module_collaborators_delete ON public.module_collaborators
  FOR DELETE
  USING (
    public.check_module_manage_access(
      tenant_id,
      module_id,
      NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  );
--> statement-breakpoint

-- Both owners can see and manage invitations, regardless of who sent them.
-- Recipients retain access to their own invitations for acceptance.

DROP POLICY IF EXISTS module_invitations_visibility
ON public.module_invitations;
--> statement-breakpoint

CREATE POLICY module_invitations_select ON public.module_invitations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.modules m
      WHERE m.id = module_invitations.module_id
        AND public.check_module_manage_access(
          m.tenant_id,
          m.id,
          NULLIF(current_setting('app.current_user_id', true), '')::uuid
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id =
        NULLIF(current_setting('app.current_user_id', true), '')::uuid
        AND lower(u.email) = lower(module_invitations.email)
    )
  );
--> statement-breakpoint

CREATE POLICY module_invitations_insert ON public.module_invitations
  FOR INSERT
  WITH CHECK (
    invited_by =
      NULLIF(current_setting('app.current_user_id', true), '')::uuid
    AND EXISTS (
      SELECT 1
      FROM public.modules m
      WHERE m.id = module_invitations.module_id
        AND public.check_module_manage_access(
          m.tenant_id,
          m.id,
          NULLIF(current_setting('app.current_user_id', true), '')::uuid
        )
    )
  );
--> statement-breakpoint

CREATE POLICY module_invitations_update ON public.module_invitations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.modules m
      WHERE m.id = module_invitations.module_id
        AND public.check_module_manage_access(
          m.tenant_id,
          m.id,
          NULLIF(current_setting('app.current_user_id', true), '')::uuid
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id =
        NULLIF(current_setting('app.current_user_id', true), '')::uuid
        AND lower(u.email) = lower(module_invitations.email)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.modules m
      WHERE m.id = module_invitations.module_id
        AND public.check_module_manage_access(
          m.tenant_id,
          m.id,
          NULLIF(current_setting('app.current_user_id', true), '')::uuid
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id =
        NULLIF(current_setting('app.current_user_id', true), '')::uuid
        AND lower(u.email) = lower(module_invitations.email)
    )
  );
--> statement-breakpoint

CREATE POLICY module_invitations_delete ON public.module_invitations
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.modules m
      WHERE m.id = module_invitations.module_id
        AND public.check_module_manage_access(
          m.tenant_id,
          m.id,
          NULLIF(current_setting('app.current_user_id', true), '')::uuid
        )
    )
  );