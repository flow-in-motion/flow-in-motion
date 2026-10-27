ALTER TABLE "conference_modules" ALTER COLUMN "module_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "conference_modules" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "conference_modules" ADD COLUMN "submission_type" text;--> statement-breakpoint
ALTER TABLE "conference_modules" ADD COLUMN "status" text;--> statement-breakpoint
ALTER TABLE "conference_modules" ADD COLUMN "submission_due" date;--> statement-breakpoint
ALTER TABLE "conference_modules" ADD CONSTRAINT "conference_modules_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conference_modules_project_id_idx" ON "conference_modules" USING btree ("project_id");--> statement-breakpoint
ALTER TABLE "conference_modules" ADD CONSTRAINT "conference_modules_subject_check" CHECK (num_nonnulls("conference_modules"."module_id", "conference_modules"."project_id") <= 1 AND ("conference_modules"."module_id" IS NOT NULL OR "conference_modules"."project_id" IS NOT NULL OR nullif(btrim("conference_modules"."paper_title"), '') IS NOT NULL));--> statement-breakpoint
ALTER TABLE "conference_modules" ADD CONSTRAINT "conference_modules_status_check" CHECK ("conference_modules"."status" IS NULL OR "conference_modules"."status" IN ('Planning', 'Submitted', 'Accepted', 'Rejected', 'Withdrawn', 'Presented'));--> statement-breakpoint

-- A conference submission can now be a paper, a project, or just a typed
-- title (for example a PDW). Only the conference owner adds submissions; a
-- paper or project being submitted must be one the owner can work on.
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
    AND (
      conference_modules.module_id IS NULL
      OR EXISTS (
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
    )
    AND (
      conference_modules.project_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM projects
        WHERE projects.id = conference_modules.project_id
          AND projects.tenant_id = conference_modules.tenant_id
          AND projects.archived_at IS NULL
          AND (
            projects.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
            OR public.is_project_collaborator(
              projects.id,
              NULLIF(current_setting('app.current_user_id', true), '')::uuid
            )
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
    AND (
      conference_modules.module_id IS NULL
      OR EXISTS (
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
    )
    AND (
      conference_modules.project_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM projects
        WHERE projects.id = conference_modules.project_id
          AND projects.tenant_id = conference_modules.tenant_id
          AND projects.archived_at IS NULL
          AND (
            projects.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
            OR public.is_project_collaborator(
              projects.id,
              NULLIF(current_setting('app.current_user_id', true), '')::uuid
            )
          )
      )
    )
  );
