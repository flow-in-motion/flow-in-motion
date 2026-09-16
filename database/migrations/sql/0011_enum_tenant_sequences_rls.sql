-- Custom SQL migration file, put your code below! --
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
--> statement-breakpoint
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
--> statement-breakpoint
ALTER TABLE tenant_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE "enum" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_sequences_visibility ON tenant_sequences
  USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_memberships.tenant_id = tenant_sequences.tenant_id
        AND tenant_memberships.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        AND tenant_memberships.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_memberships.tenant_id = tenant_sequences.tenant_id
        AND tenant_memberships.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        AND tenant_memberships.status = 'active'
    )
  );
--> statement-breakpoint
CREATE POLICY enum_visibility ON "enum"
  USING (
    -- base values: always visible to everyone
    (tenant_id IS NULL AND project_id IS NULL AND module_id IS NULL)
    -- tenant-scoped custom values: visible to members of that tenant
    OR (tenant_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_memberships.tenant_id = "enum".tenant_id
        AND tenant_memberships.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        AND tenant_memberships.status = 'active'
    ))
    -- project-scoped custom values: visible to anyone who can access that project
    OR (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = "enum".project_id
        AND (
          projects.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
          OR is_project_collaborator(projects.id, NULLIF(current_setting('app.current_user_id', true), '')::uuid)
        )
    ))
    -- module-scoped custom values: visible to anyone who can access that module
    OR (module_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM modules
      WHERE modules.id = "enum".module_id
        AND (
          (
            modules.project_id IS NOT NULL
            AND (
              EXISTS (SELECT 1 FROM projects WHERE projects.id = modules.project_id AND projects.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
              OR is_project_collaborator(modules.project_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid)
            )
          )
          OR is_module_collaborator(modules.id, NULLIF(current_setting('app.current_user_id', true), '')::uuid)
        )
    ))
  )
  WITH CHECK (
    -- writes only ever create tenant/project/module-scoped custom values,
    -- never base values, so WITH CHECK mirrors the same three scoped paths
    (tenant_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_memberships.tenant_id = "enum".tenant_id
        AND tenant_memberships.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        AND tenant_memberships.status = 'active'
    ))
    OR (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = "enum".project_id
        AND projects.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    ))
    OR (module_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM module_collaborators
      WHERE module_collaborators.module_id = "enum".module_id
        AND module_collaborators.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        AND module_collaborators.role_id = (SELECT id FROM "enum" e2 WHERE e2.category = 'project_role' AND e2.value = 'Owner')
    ))
  );
