ALTER TABLE "task_time_entries" ALTER COLUMN "task_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "task_time_entries" ADD COLUMN "module_id" uuid;--> statement-breakpoint
ALTER TABLE "task_time_entries" ADD CONSTRAINT "task_time_entries_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_time_entries_module_id_started_at_idx" ON "task_time_entries" USING btree ("module_id","started_at");--> statement-breakpoint
ALTER TABLE "task_time_entries" ADD CONSTRAINT "task_time_entries_target_check" CHECK (num_nonnulls("task_time_entries"."task_id", "task_time_entries"."module_id") = 1);

--> statement-breakpoint

-- People who can access a paper can read its logged time.
-- The modules table applies its existing row-level security.
CREATE POLICY task_time_entries_paper_select
  ON public.task_time_entries
  FOR SELECT
  TO research_tracker_app
  USING (
    EXISTS (
      SELECT 1
      FROM public.modules m
      WHERE m.id = task_time_entries.module_id
        AND m.tenant_id = task_time_entries.tenant_id
    )
  );
--> statement-breakpoint

-- People can log only their own time, against an accessible,
-- unarchived paper in that paper's workspace.
CREATE POLICY task_time_entries_paper_insert
  ON public.task_time_entries
  FOR INSERT
  TO research_tracker_app
  WITH CHECK (
    user_id =
      NULLIF(current_setting('app.current_user_id', true), '')::uuid
    AND EXISTS (
      SELECT 1
      FROM public.modules m
      WHERE m.id = task_time_entries.module_id
        AND m.tenant_id = task_time_entries.tenant_id
        AND m.archived_at IS NULL
        AND (
          m.project_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.projects p
            WHERE p.id = m.project_id
              AND p.tenant_id = m.tenant_id
              AND p.archived_at IS NULL
          )
        )
    )
  );