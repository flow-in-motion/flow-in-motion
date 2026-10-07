-- Account deletion (DELETE /api/v1/me) is a cross-tenant operation: a
-- single global user can own funding records in multiple tenants, so the
-- request never sets app.current_tenant_id. The cascading delete from
-- users -> fundings (and fundings -> funding_projects/funding_modules) is
-- still subject to RLS, and the previous policies required a tenant_id
-- match even for the row's own owner, which made the cascade invisible to
-- RLS and left the FK violation re-appearing under a different cause.
-- This lets the owner see/delete their own rows regardless of tenant
-- context, while leaving collaborator access exactly as tenant-scoped as
-- before. WITH CHECK (write-path validation) is left untouched since every
-- normal write already happens inside a tenant-scoped request.

DROP POLICY IF EXISTS fundings_visibility ON fundings;
CREATE POLICY fundings_visibility ON fundings
  USING (
    owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    OR (
      tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
      AND can_access_funding(
        id,
        NULLIF(current_setting('app.current_user_id', true), '')::uuid
      )
    )
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    AND owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
  );
--> statement-breakpoint

DROP POLICY IF EXISTS funding_projects_visibility ON funding_projects;
CREATE POLICY funding_projects_visibility ON funding_projects
  USING (
    EXISTS (
      SELECT 1 FROM fundings
      WHERE fundings.id = funding_projects.funding_id
        AND fundings.owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
    OR (
      tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
      AND can_access_funding(
        funding_id,
        NULLIF(current_setting('app.current_user_id', true), '')::uuid
      )
    )
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM fundings
      WHERE fundings.id = funding_projects.funding_id
        AND fundings.owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
    AND EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = funding_projects.project_id
        AND projects.tenant_id = funding_projects.tenant_id
        AND projects.archived_at IS NULL
        AND (
          projects.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
          OR is_project_collaborator(
            projects.id,
            NULLIF(current_setting('app.current_user_id', true), '')::uuid
          )
        )
    )
  );
--> statement-breakpoint

DROP POLICY IF EXISTS funding_modules_visibility ON funding_modules;
CREATE POLICY funding_modules_visibility ON funding_modules
  USING (
    EXISTS (
      SELECT 1 FROM fundings
      WHERE fundings.id = funding_modules.funding_id
        AND fundings.owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
    OR (
      tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
      AND can_access_funding(
        funding_id,
        NULLIF(current_setting('app.current_user_id', true), '')::uuid
      )
    )
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM fundings
      WHERE fundings.id = funding_modules.funding_id
        AND fundings.owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
    AND EXISTS (
      SELECT 1
      FROM modules
      LEFT JOIN projects ON projects.id = modules.project_id
      WHERE modules.id = funding_modules.module_id
        AND modules.tenant_id = funding_modules.tenant_id
        AND modules.archived_at IS NULL
        AND (projects.id IS NULL OR projects.archived_at IS NULL)
        AND (
          is_module_collaborator(
            modules.id,
            NULLIF(current_setting('app.current_user_id', true), '')::uuid
          )
          OR projects.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
          OR is_project_collaborator(
            projects.id,
            NULLIF(current_setting('app.current_user_id', true), '')::uuid
          )
        )
    )
  );
