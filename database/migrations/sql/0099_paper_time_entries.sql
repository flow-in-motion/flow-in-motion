CREATE TABLE "paper_time_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"paper_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"source" text DEFAULT 'timer' NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"running_since" timestamp with time zone,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "paper_time_entries_source_check" CHECK ("paper_time_entries"."source" IN ('timer', 'manual')),
	CONSTRAINT "paper_time_entries_duration_check" CHECK ("paper_time_entries"."duration_seconds" >= 0),
	CONSTRAINT "paper_time_entries_ended_check" CHECK ("paper_time_entries"."ended_at" IS NULL OR ("paper_time_entries"."running_since" IS NULL AND "paper_time_entries"."ended_at" >= "paper_time_entries"."started_at")),
	CONSTRAINT "paper_time_entries_manual_check" CHECK ("paper_time_entries"."source" = 'timer' OR ("paper_time_entries"."ended_at" IS NOT NULL AND "paper_time_entries"."duration_seconds" > 0))
);
--> statement-breakpoint
ALTER TABLE "paper_time_entries" ADD CONSTRAINT "paper_time_entries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paper_time_entries" ADD CONSTRAINT "paper_time_entries_paper_id_modules_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paper_time_entries" ADD CONSTRAINT "paper_time_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "paper_time_entries_paper_id_started_at_idx" ON "paper_time_entries" USING btree ("paper_id","started_at");--> statement-breakpoint
CREATE INDEX "paper_time_entries_user_id_started_at_idx" ON "paper_time_entries" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "paper_time_entries_one_open_per_user_key" ON "paper_time_entries" USING btree ("user_id") WHERE "paper_time_entries"."ended_at" IS NULL;
--> statement-breakpoint
ALTER TABLE public.paper_time_entries ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY paper_time_entries_select ON public.paper_time_entries FOR SELECT TO research_tracker_app
USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
  OR check_module_access(tenant_id, paper_id, NULLIF(current_setting('app.current_user_id', true), '')::uuid));
--> statement-breakpoint
CREATE POLICY paper_time_entries_insert ON public.paper_time_entries FOR INSERT TO research_tracker_app
WITH CHECK (
  user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
  AND EXISTS (
    SELECT 1 FROM public.modules m WHERE m.id = paper_time_entries.paper_id
      AND m.tenant_id = paper_time_entries.tenant_id AND m.archived_at IS NULL
      AND (m.project_id IS NULL OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = m.project_id AND p.archived_at IS NULL))
      AND check_module_access(m.tenant_id, m.id, NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  )
);
--> statement-breakpoint
CREATE POLICY paper_time_entries_update ON public.paper_time_entries FOR UPDATE TO research_tracker_app
USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY paper_time_entries_delete ON public.paper_time_entries FOR DELETE TO research_tracker_app
USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);
--> statement-breakpoint
REVOKE ALL ON public.paper_time_entries FROM PUBLIC, anon, authenticated, service_role, research_tracker_app;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON public.paper_time_entries TO research_tracker_app;
--> statement-breakpoint
GRANT UPDATE (started_at, ended_at, running_since, duration_seconds, note, updated_at)
ON public.paper_time_entries TO research_tracker_app;

--> statement-breakpoint
-- Some installations already stored paper-only time in task_time_entries.
-- Preserve that paper history without updating or removing any task records.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'task_time_entries'
      AND column_name = 'module_id'
  ) THEN
    INSERT INTO public.paper_time_entries (
      id, tenant_id, paper_id, user_id, source, started_at, ended_at,
      running_since, duration_seconds, note, created_at, updated_at
    )
    SELECT id, tenant_id, module_id, user_id, source, started_at, ended_at,
      running_since, duration_seconds, note, created_at, updated_at
    FROM public.task_time_entries
    WHERE module_id IS NOT NULL AND task_id IS NULL
    ON CONFLICT (id) DO NOTHING;
  END IF;
END;
$$;
