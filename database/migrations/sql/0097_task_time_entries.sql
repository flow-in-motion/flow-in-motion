CREATE TABLE "task_time_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"source" text DEFAULT 'timer' NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"running_since" timestamp with time zone,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_time_entries_source_check" CHECK ("task_time_entries"."source" IN ('timer', 'manual')),
	CONSTRAINT "task_time_entries_duration_check" CHECK ("task_time_entries"."duration_seconds" >= 0),
	CONSTRAINT "task_time_entries_ended_check" CHECK ("task_time_entries"."ended_at" IS NULL OR ("task_time_entries"."running_since" IS NULL AND "task_time_entries"."ended_at" >= "task_time_entries"."started_at")),
	CONSTRAINT "task_time_entries_manual_check" CHECK ("task_time_entries"."source" = 'timer' OR ("task_time_entries"."ended_at" IS NOT NULL AND "task_time_entries"."duration_seconds" > 0))
);
--> statement-breakpoint
ALTER TABLE "task_time_entries" ADD CONSTRAINT "task_time_entries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_time_entries" ADD CONSTRAINT "task_time_entries_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_time_entries" ADD CONSTRAINT "task_time_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_time_entries_task_id_started_at_idx" ON "task_time_entries" USING btree ("task_id","started_at");--> statement-breakpoint
CREATE INDEX "task_time_entries_user_id_started_at_idx" ON "task_time_entries" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "task_time_entries_one_open_per_user_key" ON "task_time_entries" USING btree ("user_id") WHERE "task_time_entries"."ended_at" IS NULL;--> statement-breakpoint

-- Time logged on tasks. Each person writes only their own entries. Everyone
-- who can see a task can read its entries, so a shared task can show its
-- total; the app only lists a person's own entries.
ALTER TABLE "task_time_entries" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY task_time_entries_select
  ON "task_time_entries"
  FOR SELECT
  TO research_tracker_app
  USING (
    user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    OR EXISTS (
      SELECT 1
      FROM "tasks"
      WHERE tasks.id = task_time_entries.task_id
        AND (
          tasks.created_by =
            NULLIF(current_setting('app.current_user_id', true), '')::uuid
          OR is_task_member(
            tasks.id,
            NULLIF(current_setting('app.current_user_id', true), '')::uuid
          )
        )
    )
  );
--> statement-breakpoint

-- Time can only be logged on a task the person can see, in that task's
-- workspace.
CREATE POLICY task_time_entries_insert
  ON "task_time_entries"
  FOR INSERT
  TO research_tracker_app
  WITH CHECK (
    user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    AND EXISTS (
      SELECT 1
      FROM "tasks"
      WHERE tasks.id = task_time_entries.task_id
        AND tasks.tenant_id = task_time_entries.tenant_id
        AND (
          tasks.created_by =
            NULLIF(current_setting('app.current_user_id', true), '')::uuid
          OR is_task_member(
            tasks.id,
            NULLIF(current_setting('app.current_user_id', true), '')::uuid
          )
        )
    )
  );
--> statement-breakpoint

-- People can always stop, edit or delete their own time, even after losing
-- access to the task. The task, workspace and person can't be changed (see
-- the column grants below).
CREATE POLICY task_time_entries_update
  ON "task_time_entries"
  FOR UPDATE
  TO research_tracker_app
  USING (
    user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
  )
  WITH CHECK (
    user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
  );
--> statement-breakpoint

CREATE POLICY task_time_entries_delete
  ON "task_time_entries"
  FOR DELETE
  TO research_tracker_app
  USING (
    user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
  );
--> statement-breakpoint

REVOKE ALL PRIVILEGES ON TABLE "task_time_entries" FROM PUBLIC;
--> statement-breakpoint

REVOKE ALL PRIVILEGES ON TABLE "task_time_entries"
  FROM anon, authenticated, service_role;
--> statement-breakpoint

REVOKE ALL PRIVILEGES ON TABLE "task_time_entries" FROM research_tracker_app;
--> statement-breakpoint

GRANT SELECT, INSERT, DELETE ON TABLE "task_time_entries"
  TO research_tracker_app;
--> statement-breakpoint

GRANT UPDATE (
  "started_at",
  "ended_at",
  "running_since",
  "duration_seconds",
  "note",
  "updated_at"
) ON TABLE "task_time_entries" TO research_tracker_app;
