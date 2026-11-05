CREATE TABLE "hdr_papers" (
	"person_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"paper_id" uuid NOT NULL,
	CONSTRAINT "hdr_papers_person_id_paper_id_pk" PRIMARY KEY("person_id","paper_id")
);
--> statement-breakpoint
CREATE TABLE "hdr_people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'PhD' NOT NULL,
	"category" text DEFAULT 'Current' NOT NULL,
	"email" text,
	"research_topic" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hdr_people_id_tenant_key" UNIQUE("id","tenant_id"),
	CONSTRAINT "hdr_people_name_check" CHECK (length(trim("hdr_people"."name")) BETWEEN 1 AND 200),
	CONSTRAINT "hdr_people_type_check" CHECK ("hdr_people"."type" IN ('PhD', 'MRes', 'Visiting scholar')),
	CONSTRAINT "hdr_people_category_check" CHECK ("hdr_people"."category" IN ('Current', 'Potential'))
);
--> statement-breakpoint
CREATE TABLE "hdr_projects" (
	"person_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	CONSTRAINT "hdr_projects_person_id_project_id_pk" PRIMARY KEY("person_id","project_id")
);
--> statement-breakpoint
ALTER TABLE "hdr_papers" ADD CONSTRAINT "hdr_papers_paper_id_modules_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hdr_papers" ADD CONSTRAINT "hdr_papers_person_id_tenant_id_hdr_people_id_tenant_id_fk" FOREIGN KEY ("person_id","tenant_id") REFERENCES "public"."hdr_people"("id","tenant_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hdr_people" ADD CONSTRAINT "hdr_people_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hdr_people" ADD CONSTRAINT "hdr_people_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hdr_projects" ADD CONSTRAINT "hdr_projects_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hdr_projects" ADD CONSTRAINT "hdr_projects_person_id_tenant_id_hdr_people_id_tenant_id_fk" FOREIGN KEY ("person_id","tenant_id") REFERENCES "public"."hdr_people"("id","tenant_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hdr_papers_paper_idx" ON "hdr_papers" USING btree ("paper_id");--> statement-breakpoint
CREATE INDEX "hdr_people_owner_tenant_name_idx" ON "hdr_people" USING btree ("owner_user_id","tenant_id","name");--> statement-breakpoint
CREATE INDEX "hdr_projects_project_idx" ON "hdr_projects" USING btree ("project_id");
--> statement-breakpoint
-- HDR records are private to their creator. No direct Supabase Data API access.
ALTER TABLE public.hdr_people ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY hdr_people_select ON public.hdr_people FOR SELECT TO research_tracker_app USING (owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid AND tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY hdr_people_insert ON public.hdr_people FOR INSERT TO research_tracker_app WITH CHECK (owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid AND tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY hdr_people_update ON public.hdr_people FOR UPDATE TO research_tracker_app USING (owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid AND tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid) WITH CHECK (owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid AND tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY hdr_people_delete ON public.hdr_people FOR DELETE TO research_tracker_app USING (owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid AND tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
--> statement-breakpoint
REVOKE ALL ON public.hdr_people FROM PUBLIC, anon, authenticated, service_role, research_tracker_app;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON public.hdr_people TO research_tracker_app;
--> statement-breakpoint
GRANT UPDATE (name, type, category, email, research_topic, updated_at) ON public.hdr_people TO research_tracker_app;
--> statement-breakpoint
ALTER TABLE public.hdr_projects ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY hdr_projects_select ON public.hdr_projects FOR SELECT TO research_tracker_app USING (EXISTS (SELECT 1 FROM public.hdr_people h WHERE h.id = hdr_projects.person_id AND h.tenant_id = hdr_projects.tenant_id AND h.owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid) AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = hdr_projects.project_id AND p.tenant_id = hdr_projects.tenant_id AND p.archived_at IS NULL AND (p.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid OR public.is_project_collaborator(p.id, NULLIF(current_setting('app.current_user_id', true), '')::uuid))));
--> statement-breakpoint
CREATE POLICY hdr_projects_insert ON public.hdr_projects FOR INSERT TO research_tracker_app WITH CHECK (EXISTS (SELECT 1 FROM public.hdr_people h WHERE h.id = hdr_projects.person_id AND h.tenant_id = hdr_projects.tenant_id AND h.owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid) AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = hdr_projects.project_id AND p.tenant_id = hdr_projects.tenant_id AND p.archived_at IS NULL AND (p.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid OR public.is_project_collaborator(p.id, NULLIF(current_setting('app.current_user_id', true), '')::uuid))));
--> statement-breakpoint
CREATE POLICY hdr_projects_delete ON public.hdr_projects FOR DELETE TO research_tracker_app USING (EXISTS (SELECT 1 FROM public.hdr_people h WHERE h.id = hdr_projects.person_id AND h.tenant_id = hdr_projects.tenant_id AND h.owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid));
--> statement-breakpoint
REVOKE ALL ON public.hdr_projects FROM PUBLIC, anon, authenticated, service_role, research_tracker_app;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON public.hdr_projects TO research_tracker_app;
--> statement-breakpoint
ALTER TABLE public.hdr_papers ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY hdr_papers_select ON public.hdr_papers FOR SELECT TO research_tracker_app USING (EXISTS (SELECT 1 FROM public.hdr_people h WHERE h.id = hdr_papers.person_id AND h.tenant_id = hdr_papers.tenant_id AND h.owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid) AND EXISTS (SELECT 1 FROM public.modules m WHERE m.id = hdr_papers.paper_id AND m.tenant_id = hdr_papers.tenant_id AND m.archived_at IS NULL AND (m.project_id IS NULL OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = m.project_id AND p.tenant_id = m.tenant_id AND p.archived_at IS NULL)) AND public.check_module_access(m.tenant_id, m.id, NULLIF(current_setting('app.current_user_id', true), '')::uuid)));
--> statement-breakpoint
CREATE POLICY hdr_papers_insert ON public.hdr_papers FOR INSERT TO research_tracker_app WITH CHECK (EXISTS (SELECT 1 FROM public.hdr_people h WHERE h.id = hdr_papers.person_id AND h.tenant_id = hdr_papers.tenant_id AND h.owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid) AND EXISTS (SELECT 1 FROM public.modules m WHERE m.id = hdr_papers.paper_id AND m.tenant_id = hdr_papers.tenant_id AND m.archived_at IS NULL AND (m.project_id IS NULL OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = m.project_id AND p.tenant_id = m.tenant_id AND p.archived_at IS NULL)) AND public.check_module_access(m.tenant_id, m.id, NULLIF(current_setting('app.current_user_id', true), '')::uuid)));
--> statement-breakpoint
CREATE POLICY hdr_papers_delete ON public.hdr_papers FOR DELETE TO research_tracker_app USING (EXISTS (SELECT 1 FROM public.hdr_people h WHERE h.id = hdr_papers.person_id AND h.tenant_id = hdr_papers.tenant_id AND h.owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid));
--> statement-breakpoint
REVOKE ALL ON public.hdr_papers FROM PUBLIC, anon, authenticated, service_role, research_tracker_app;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON public.hdr_papers TO research_tracker_app;
