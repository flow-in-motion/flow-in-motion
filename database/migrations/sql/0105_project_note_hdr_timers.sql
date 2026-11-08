CREATE TABLE "work_time_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid,
	"note_id" uuid,
	"hdr_person_id" uuid,
	"source" text DEFAULT 'timer' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"running_since" timestamp with time zone,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_time_one_target" CHECK (num_nonnulls("work_time_entries"."project_id", "work_time_entries"."note_id", "work_time_entries"."hdr_person_id") = 1),
	CONSTRAINT "work_time_source" CHECK ("work_time_entries"."source" IN ('timer', 'manual')),
	CONSTRAINT "work_time_duration" CHECK ("work_time_entries"."duration_seconds" >= 0),
	CONSTRAINT "work_time_dates" CHECK ("work_time_entries"."ended_at" IS NULL OR ("work_time_entries"."running_since" IS NULL AND "work_time_entries"."ended_at" >= "work_time_entries"."started_at")),
	CONSTRAINT "work_time_manual" CHECK ("work_time_entries"."source" <> 'manual' OR ("work_time_entries"."ended_at" IS NOT NULL AND "work_time_entries"."duration_seconds" BETWEEN 60 AND 86400)),
	CONSTRAINT "work_time_note" CHECK ("work_time_entries"."note" IS NULL OR length("work_time_entries"."note") <= 2000)
);
--> statement-breakpoint
ALTER TABLE "work_time_entries" ADD CONSTRAINT "work_time_entries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_time_entries" ADD CONSTRAINT "work_time_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_time_entries" ADD CONSTRAINT "work_time_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_time_entries" ADD CONSTRAINT "work_time_entries_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_time_entries" ADD CONSTRAINT "work_time_entries_hdr_person_id_hdr_people_id_fk" FOREIGN KEY ("hdr_person_id") REFERENCES "public"."hdr_people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "work_time_open_project" ON "work_time_entries" USING btree ("user_id","project_id") WHERE "work_time_entries"."ended_at" IS NULL AND "work_time_entries"."project_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "work_time_open_note" ON "work_time_entries" USING btree ("user_id","note_id") WHERE "work_time_entries"."ended_at" IS NULL AND "work_time_entries"."note_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "work_time_open_hdr" ON "work_time_entries" USING btree ("user_id","hdr_person_id") WHERE "work_time_entries"."ended_at" IS NULL AND "work_time_entries"."hdr_person_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "work_time_user_started_idx" ON "work_time_entries" USING btree ("user_id","started_at","id");--> statement-breakpoint
CREATE INDEX "work_time_project_idx" ON "work_time_entries" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "work_time_note_idx" ON "work_time_entries" USING btree ("note_id");--> statement-breakpoint
CREATE INDEX "work_time_hdr_idx" ON "work_time_entries" USING btree ("hdr_person_id");
--> statement-breakpoint
-- Only the app role may resolve an owned HDR timer across workspaces. This
-- does not change HDR page policies, collaboration, or access for other users.
CREATE FUNCTION public.work_time_hdr_target(person_id uuid)
RETURNS TABLE (id uuid, tenant_id uuid, title text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT h.id, h.tenant_id, h.name FROM public.hdr_people h
  WHERE h.id = person_id
    AND h.owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.work_time_hdr_target(uuid) FROM PUBLIC, anon, authenticated, service_role;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.work_time_hdr_target(uuid) TO research_tracker_app;
--> statement-breakpoint
ALTER TABLE public.work_time_entries ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY work_time_select ON public.work_time_entries FOR SELECT TO research_tracker_app
USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY work_time_insert ON public.work_time_entries FOR INSERT TO research_tracker_app
WITH CHECK (
  user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
  AND (
    (project_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = work_time_entries.project_id AND p.tenant_id = work_time_entries.tenant_id AND p.archived_at IS NULL AND (p.user_id = work_time_entries.user_id OR public.is_project_collaborator(p.id, work_time_entries.user_id))))
    OR (note_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.notes n WHERE n.id = work_time_entries.note_id AND n.tenant_id = work_time_entries.tenant_id
      AND (n.project_id IS NULL OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = n.project_id AND p.archived_at IS NULL))
      AND (n.module_id IS NULL OR EXISTS (SELECT 1 FROM public.modules m WHERE m.id = n.module_id AND m.archived_at IS NULL AND (m.project_id IS NULL OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = m.project_id AND p.archived_at IS NULL))))))
    OR (hdr_person_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.work_time_hdr_target(work_time_entries.hdr_person_id) h WHERE h.tenant_id = work_time_entries.tenant_id))
  )
);
--> statement-breakpoint
-- Own entries remain stoppable if a parent is archived or sharing is revoked.
-- Parent/tenant/user/source cannot be reassigned through UPDATE privileges.
CREATE POLICY work_time_update ON public.work_time_entries FOR UPDATE TO research_tracker_app
USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY work_time_delete ON public.work_time_entries FOR DELETE TO research_tracker_app
USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);
--> statement-breakpoint
REVOKE ALL ON public.work_time_entries FROM PUBLIC, anon, authenticated, service_role, research_tracker_app;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON public.work_time_entries TO research_tracker_app;
--> statement-breakpoint
GRANT UPDATE (started_at, ended_at, running_since, duration_seconds, note, updated_at) ON public.work_time_entries TO research_tracker_app;
--> statement-breakpoint
SET LOCAL row_security = off;
--> statement-breakpoint
-- Match the six Paper statuses while keeping internal archive status intact.
INSERT INTO public."enum" (category, value, sort_order, hidden)
SELECT 'project_status', v.value, v.sort_order, false
FROM (VALUES ('Proposed', 0), ('Active', 1), ('Stalled', 2), ('Complete', 3), ('Parked', 4), ('Closed', 5)) v(value, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public."enum" e WHERE e.category = 'project_status' AND e.value = v.value AND e.tenant_id IS NULL AND e.project_id IS NULL AND e.module_id IS NULL);
--> statement-breakpoint
-- Review retired on Projects only. Paper stages/submissions are unaffected.
UPDATE public.projects p SET status_id = active.id
FROM public."enum" review, public."enum" active
WHERE p.status_id = review.id AND review.category = 'project_status' AND review.value = 'Review'
AND active.category = 'project_status' AND active.value = 'Active'
AND active.tenant_id IS NULL AND active.project_id IS NULL AND active.module_id IS NULL;
--> statement-breakpoint
UPDATE public."enum" SET hidden = true WHERE category = 'project_status' AND value = 'Review';
