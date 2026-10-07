CREATE TABLE "fundings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"funding_body" text NOT NULL,
	"scheme" text,
	"partners" text,
	"amount" numeric(14, 2),
	"currency" text,
	"application_deadline" date,
	"status" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funding_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"funding_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funding_modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"funding_id" uuid NOT NULL,
	"module_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fundings" ADD CONSTRAINT "fundings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fundings" ADD CONSTRAINT "fundings_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding_projects" ADD CONSTRAINT "funding_projects_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding_projects" ADD CONSTRAINT "funding_projects_funding_id_fundings_id_fk" FOREIGN KEY ("funding_id") REFERENCES "public"."fundings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding_projects" ADD CONSTRAINT "funding_projects_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding_modules" ADD CONSTRAINT "funding_modules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding_modules" ADD CONSTRAINT "funding_modules_funding_id_fundings_id_fk" FOREIGN KEY ("funding_id") REFERENCES "public"."fundings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding_modules" ADD CONSTRAINT "funding_modules_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fundings_tenant_id_idx" ON "fundings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "fundings_application_deadline_idx" ON "fundings" USING btree ("application_deadline");--> statement-breakpoint
CREATE UNIQUE INDEX "funding_projects_funding_id_project_id_key" ON "funding_projects" USING btree ("funding_id","project_id");--> statement-breakpoint
CREATE INDEX "funding_projects_project_id_idx" ON "funding_projects" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "funding_projects_tenant_id_idx" ON "funding_projects" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "funding_modules_funding_id_module_id_key" ON "funding_modules" USING btree ("funding_id","module_id");--> statement-breakpoint
CREATE INDEX "funding_modules_module_id_idx" ON "funding_modules" USING btree ("module_id");--> statement-breakpoint
CREATE INDEX "funding_modules_tenant_id_idx" ON "funding_modules" USING btree ("tenant_id");--> statement-breakpoint
ALTER TABLE "fundings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "funding_projects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "funding_modules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE OR REPLACE FUNCTION can_access_funding(check_funding_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM fundings
    WHERE fundings.id = check_funding_id
      AND (
        fundings.owner_user_id = check_user_id
        OR EXISTS (
          SELECT 1
          FROM funding_projects
          JOIN projects ON projects.id = funding_projects.project_id
          WHERE funding_projects.funding_id = fundings.id
            AND projects.archived_at IS NULL
            AND (
              projects.user_id = check_user_id
              OR is_project_collaborator(projects.id, check_user_id)
            )
        )
        OR EXISTS (
          SELECT 1
          FROM funding_modules
          JOIN modules ON modules.id = funding_modules.module_id
          LEFT JOIN projects ON projects.id = modules.project_id
          WHERE funding_modules.funding_id = fundings.id
            AND modules.archived_at IS NULL
            AND (projects.id IS NULL OR projects.archived_at IS NULL)
            AND (
              is_module_collaborator(modules.id, check_user_id)
              OR projects.user_id = check_user_id
              OR is_project_collaborator(projects.id, check_user_id)
            )
        )
      )
  );
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION can_access_funding(uuid, uuid) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION can_access_funding(uuid, uuid) TO research_tracker_app;--> statement-breakpoint
CREATE POLICY fundings_visibility ON fundings
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    AND can_access_funding(
      id,
      NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    AND owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
  );--> statement-breakpoint
CREATE POLICY funding_projects_visibility ON funding_projects
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    AND can_access_funding(
      funding_id,
      NULLIF(current_setting('app.current_user_id', true), '')::uuid
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
  );--> statement-breakpoint
CREATE POLICY funding_modules_visibility ON funding_modules
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    AND can_access_funding(
      funding_id,
      NULLIF(current_setting('app.current_user_id', true), '')::uuid
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
  );--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "fundings" TO research_tracker_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "funding_projects" TO research_tracker_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "funding_modules" TO research_tracker_app;
