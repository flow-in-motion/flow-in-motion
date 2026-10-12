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