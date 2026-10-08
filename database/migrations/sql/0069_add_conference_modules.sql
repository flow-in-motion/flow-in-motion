CREATE TABLE "conference_modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"conference_id" uuid NOT NULL,
	"module_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conference_modules" ADD CONSTRAINT "conference_modules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conference_modules" ADD CONSTRAINT "conference_modules_conference_id_conferences_id_fk" FOREIGN KEY ("conference_id") REFERENCES "public"."conferences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conference_modules" ADD CONSTRAINT "conference_modules_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "conference_modules_conference_id_module_id_key" ON "conference_modules" USING btree ("conference_id","module_id");--> statement-breakpoint
CREATE INDEX "conference_modules_module_id_idx" ON "conference_modules" USING btree ("module_id");--> statement-breakpoint
CREATE INDEX "conference_modules_tenant_id_idx" ON "conference_modules" USING btree ("tenant_id");--> statement-breakpoint
ALTER TABLE "conference_modules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.is_conference_module_collaborator(check_conference_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conference_modules
    JOIN public.modules ON modules.id = conference_modules.module_id
    LEFT JOIN public.projects ON projects.id = modules.project_id
    WHERE conference_modules.conference_id = check_conference_id
      AND modules.archived_at IS NULL
      AND (projects.id IS NULL OR projects.archived_at IS NULL)
      AND (
        public.is_module_collaborator(modules.id, check_user_id)
        OR projects.user_id = check_user_id
        OR public.is_project_collaborator(projects.id, check_user_id)
      )
  );
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.is_conference_module_collaborator(uuid, uuid) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.is_conference_module_collaborator(uuid, uuid) TO research_tracker_app;--> statement-breakpoint
ALTER POLICY conferences_visibility ON conferences
  USING (
    owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    OR public.is_conference_project_collaborator(
      id,
      NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
    OR public.is_conference_module_collaborator(
      id,
      NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  );--> statement-breakpoint
CREATE POLICY conference_modules_select ON conference_modules
  FOR SELECT
  TO research_tracker_app
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    AND EXISTS (
      SELECT 1
      FROM conferences
      WHERE conferences.id = conference_modules.conference_id
        AND conferences.tenant_id = conference_modules.tenant_id
        AND (
          conferences.owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
          OR public.is_conference_project_collaborator(
            conferences.id,
            NULLIF(current_setting('app.current_user_id', true), '')::uuid
          )
          OR public.is_conference_module_collaborator(
            conferences.id,
            NULLIF(current_setting('app.current_user_id', true), '')::uuid
          )
        )
    )
  );--> statement-breakpoint
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
      JOIN projects ON projects.id = modules.project_id
      WHERE modules.id = conference_modules.module_id
        AND modules.tenant_id = conference_modules.tenant_id
        AND modules.archived_at IS NULL
        AND projects.archived_at IS NULL
        AND (
          projects.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
          OR public.is_project_collaborator(
            projects.id,
            NULLIF(current_setting('app.current_user_id', true), '')::uuid
          )
          OR public.is_module_collaborator(
            modules.id,
            NULLIF(current_setting('app.current_user_id', true), '')::uuid
          )
        )
    )
  );--> statement-breakpoint
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
      JOIN projects ON projects.id = modules.project_id
      WHERE modules.id = conference_modules.module_id
        AND modules.tenant_id = conference_modules.tenant_id
        AND modules.archived_at IS NULL
        AND projects.archived_at IS NULL
        AND (
          projects.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
          OR public.is_project_collaborator(
            projects.id,
            NULLIF(current_setting('app.current_user_id', true), '')::uuid
          )
          OR public.is_module_collaborator(
            modules.id,
            NULLIF(current_setting('app.current_user_id', true), '')::uuid
          )
        )
    )
  );--> statement-breakpoint
CREATE POLICY conference_modules_delete ON conference_modules
  FOR DELETE
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
  );--> statement-breakpoint
REVOKE ALL ON TABLE "conference_modules" FROM anon, authenticated;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "conference_modules" TO research_tracker_app;
