CREATE TABLE "usage_weekly_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"project_count" integer NOT NULL,
	"paper_count" integer NOT NULL,
	"task_count" integer NOT NULL,
	"note_count" integer NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "modules" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD COLUMN "session_id" uuid;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD COLUMN "page_key" text;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD COLUMN "feature_key" text;--> statement-breakpoint
ALTER TABLE "usage_weekly_snapshots" ADD CONSTRAINT "usage_weekly_snapshots_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_weekly_snapshots" ADD CONSTRAINT "usage_weekly_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "usage_weekly_snapshots_tenant_user_week_key" ON "usage_weekly_snapshots" USING btree ("tenant_id","user_id","week_start");--> statement-breakpoint
CREATE INDEX "usage_weekly_snapshots_user_id_idx" ON "usage_weekly_snapshots" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "usage_weekly_snapshots_week_start_idx" ON "usage_weekly_snapshots" USING btree ("week_start");--> statement-breakpoint
ALTER TABLE "modules" ADD CONSTRAINT "modules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "modules_created_by_idx" ON "modules" USING btree ("created_by") WHERE "modules"."created_by" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "analytics_events_user_id_created_at_idx" ON "analytics_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "analytics_events_tenant_id_page_key_created_at_idx" ON "analytics_events" USING btree ("tenant_id","page_key","created_at");--> statement-breakpoint

-- Research snapshots are deliberately unavailable through the application or
-- Supabase Data API. Only the migration/admin role can read them directly.
ALTER TABLE "usage_weekly_snapshots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "usage_weekly_snapshots" FROM PUBLIC;--> statement-breakpoint

-- Reuse the existing daily cleanup Lambda for weekly capture. The function is
-- internal, idempotent, and inserts the previous completed Sydney week only.
CREATE SCHEMA IF NOT EXISTS internal;--> statement-breakpoint
REVOKE ALL ON SCHEMA internal FROM PUBLIC;--> statement-breakpoint
GRANT USAGE ON SCHEMA internal TO research_tracker_app;--> statement-breakpoint

CREATE OR REPLACE FUNCTION internal.capture_weekly_usage_snapshots()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_week date := (
    date_trunc('week', timezone('Australia/Sydney', now()))::date - 7
  );
  captured integer := 0;
BEGIN
  -- The cleanup Lambda runs daily. Avoid scanning application tables again
  -- once every eligible membership has its row for the completed week.
  IF NOT EXISTS (
    SELECT 1
    FROM tenant_memberships membership
    INNER JOIN users app_user ON app_user.id = membership.user_id
    WHERE membership.status = 'active'
      AND membership.joined_at IS NOT NULL
      AND membership.joined_at < target_week + 7
      AND app_user.external_auth_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM usage_weekly_snapshots snapshot
        WHERE snapshot.tenant_id = membership.tenant_id
          AND snapshot.user_id = membership.user_id
          AND snapshot.week_start = target_week
      )
  ) THEN
    RETURN 0;
  END IF;

  WITH eligible_memberships AS (
    SELECT membership.tenant_id, membership.user_id
    FROM tenant_memberships membership
    INNER JOIN users app_user ON app_user.id = membership.user_id
    WHERE membership.status = 'active'
      AND membership.joined_at IS NOT NULL
      AND membership.joined_at < target_week + 7
      AND app_user.external_auth_id IS NOT NULL
  ),
  project_counts AS (
    SELECT project.tenant_id, project.user_id, count(*)::integer AS item_count
    FROM projects project
    WHERE project.archived_at IS NULL
    GROUP BY project.tenant_id, project.user_id
  ),
  paper_counts AS (
    SELECT paper.tenant_id, paper.created_by AS user_id,
      count(*)::integer AS item_count
    FROM modules paper
    LEFT JOIN projects parent_project ON parent_project.id = paper.project_id
    WHERE paper.created_by IS NOT NULL
      AND paper.archived_at IS NULL
      AND (paper.project_id IS NULL OR parent_project.archived_at IS NULL)
    GROUP BY paper.tenant_id, paper.created_by
  ),
  task_counts AS (
    SELECT task.tenant_id, task.created_by AS user_id,
      count(*)::integer AS item_count
    FROM tasks task
    LEFT JOIN projects task_project ON task_project.id = task.project_id
    LEFT JOIN modules task_paper ON task_paper.id = task.module_id
    LEFT JOIN projects task_paper_project
      ON task_paper_project.id = task_paper.project_id
    WHERE (task.project_id IS NULL OR task_project.archived_at IS NULL)
      AND (
        task.module_id IS NULL
        OR (
          task_paper.archived_at IS NULL
          AND (
            task_paper.project_id IS NULL
            OR task_paper_project.archived_at IS NULL
          )
        )
      )
    GROUP BY task.tenant_id, task.created_by
  ),
  note_counts AS (
    SELECT note.tenant_id, note.created_by AS user_id,
      count(*)::integer AS item_count
    FROM notes note
    LEFT JOIN projects note_project ON note_project.id = note.project_id
    LEFT JOIN modules note_paper ON note_paper.id = note.module_id
    LEFT JOIN projects note_paper_project
      ON note_paper_project.id = note_paper.project_id
    WHERE (note.project_id IS NULL OR note_project.archived_at IS NULL)
      AND (
        note.module_id IS NULL
        OR (
          note_paper.archived_at IS NULL
          AND (
            note_paper.project_id IS NULL
            OR note_paper_project.archived_at IS NULL
          )
        )
      )
    GROUP BY note.tenant_id, note.created_by
  )
  INSERT INTO usage_weekly_snapshots (
    tenant_id,
    user_id,
    week_start,
    project_count,
    paper_count,
    task_count,
    note_count
  )
  SELECT
    membership.tenant_id,
    membership.user_id,
    target_week,
    coalesce(project_count.item_count, 0),
    coalesce(paper_count.item_count, 0),
    coalesce(task_count.item_count, 0),
    coalesce(note_count.item_count, 0)
  FROM eligible_memberships membership
  LEFT JOIN project_counts project_count
    ON project_count.tenant_id = membership.tenant_id
    AND project_count.user_id = membership.user_id
  LEFT JOIN paper_counts paper_count
    ON paper_count.tenant_id = membership.tenant_id
    AND paper_count.user_id = membership.user_id
  LEFT JOIN task_counts task_count
    ON task_count.tenant_id = membership.tenant_id
    AND task_count.user_id = membership.user_id
  LEFT JOIN note_counts note_count
    ON note_count.tenant_id = membership.tenant_id
    AND note_count.user_id = membership.user_id
  ON CONFLICT (tenant_id, user_id, week_start) DO NOTHING;

  GET DIAGNOSTICS captured = ROW_COUNT;
  RETURN captured;
END;
$$;--> statement-breakpoint

REVOKE ALL ON FUNCTION internal.capture_weekly_usage_snapshots() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION internal.capture_weekly_usage_snapshots() TO research_tracker_app;
