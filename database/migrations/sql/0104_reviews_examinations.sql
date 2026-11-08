CREATE TABLE "academic_review_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"review_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "academic_review_notes_content_check" CHECK (length(trim("academic_review_notes"."content")) BETWEEN 1 AND 20000)
);
--> statement-breakpoint
CREATE TABLE "academic_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"student_name" text,
	"student_number" text,
	"supervisor_name_1" text,
	"supervisor_name_2" text,
	"university_name" text,
	"school" text,
	"country" text,
	"thesis_title" text,
	"degree_type" text,
	"fee" text,
	"abstract" text,
	"journal_name" text,
	"manuscript_reference" text,
	"manuscript_title" text,
	"journal_ranking" text,
	"requested_on" date,
	"due_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "academic_reviews_id_tenant_key" UNIQUE("id","tenant_id"),
	CONSTRAINT "academic_reviews_kind_check" CHECK ("academic_reviews"."kind" IN ('journal', 'examination')),
	CONSTRAINT "academic_reviews_required_name_check" CHECK (("academic_reviews"."kind" = 'examination' AND "academic_reviews"."student_name" IS NOT NULL AND length(trim("academic_reviews"."student_name")) BETWEEN 1 AND 300) OR ("academic_reviews"."kind" = 'journal' AND "academic_reviews"."manuscript_title" IS NOT NULL AND length(trim("academic_reviews"."manuscript_title")) BETWEEN 1 AND 1000)),
	CONSTRAINT "academic_reviews_degree_check" CHECK ("academic_reviews"."degree_type" IS NULL OR "academic_reviews"."degree_type" IN ('PhD', 'MRes', 'Masters', 'Other')),
	CONSTRAINT "academic_reviews_dates_check" CHECK ("academic_reviews"."requested_on" IS NULL OR "academic_reviews"."due_on" IS NULL OR "academic_reviews"."due_on" >= "academic_reviews"."requested_on"),
	CONSTRAINT "academic_reviews_fields_check" CHECK (("academic_reviews"."kind" = 'examination' AND "academic_reviews"."journal_name" IS NULL AND "academic_reviews"."manuscript_reference" IS NULL AND "academic_reviews"."manuscript_title" IS NULL AND "academic_reviews"."journal_ranking" IS NULL) OR ("academic_reviews"."kind" = 'journal' AND "academic_reviews"."student_name" IS NULL AND "academic_reviews"."student_number" IS NULL AND "academic_reviews"."supervisor_name_1" IS NULL AND "academic_reviews"."supervisor_name_2" IS NULL AND "academic_reviews"."university_name" IS NULL AND "academic_reviews"."school" IS NULL AND "academic_reviews"."country" IS NULL AND "academic_reviews"."thesis_title" IS NULL AND "academic_reviews"."degree_type" IS NULL AND "academic_reviews"."fee" IS NULL AND "academic_reviews"."abstract" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "academic_review_notes" ADD CONSTRAINT "academic_review_notes_review_id_tenant_id_academic_reviews_id_tenant_id_fk" FOREIGN KEY ("review_id","tenant_id") REFERENCES "public"."academic_reviews"("id","tenant_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_reviews" ADD CONSTRAINT "academic_reviews_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_reviews" ADD CONSTRAINT "academic_reviews_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "academic_review_notes_record_created_idx" ON "academic_review_notes" USING btree ("review_id","tenant_id","created_at","id");--> statement-breakpoint
CREATE INDEX "academic_reviews_owner_tenant_kind_created_idx" ON "academic_reviews" USING btree ("owner_user_id","tenant_id","kind","created_at","id");
--> statement-breakpoint
-- Creator-private records, independent of HDR students and all existing work.
ALTER TABLE public.academic_reviews ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY academic_reviews_select ON public.academic_reviews FOR SELECT TO research_tracker_app USING (owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid AND tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY academic_reviews_insert ON public.academic_reviews FOR INSERT TO research_tracker_app WITH CHECK (owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid AND tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY academic_reviews_update ON public.academic_reviews FOR UPDATE TO research_tracker_app USING (owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid AND tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid) WITH CHECK (owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid AND tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY academic_reviews_delete ON public.academic_reviews FOR DELETE TO research_tracker_app USING (owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid AND tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
--> statement-breakpoint
REVOKE ALL ON public.academic_reviews FROM PUBLIC, anon, authenticated, service_role, research_tracker_app;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON public.academic_reviews TO research_tracker_app;
--> statement-breakpoint
GRANT UPDATE (student_name, student_number, supervisor_name_1, supervisor_name_2, university_name, school, country, thesis_title, degree_type, fee, abstract, journal_name, manuscript_reference, manuscript_title, journal_ranking, requested_on, due_on, updated_at) ON public.academic_reviews TO research_tracker_app;
--> statement-breakpoint
ALTER TABLE public.academic_review_notes ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY academic_review_notes_select ON public.academic_review_notes FOR SELECT TO research_tracker_app USING (EXISTS (SELECT 1 FROM public.academic_reviews r WHERE r.id = academic_review_notes.review_id AND r.tenant_id = academic_review_notes.tenant_id));
--> statement-breakpoint
CREATE POLICY academic_review_notes_insert ON public.academic_review_notes FOR INSERT TO research_tracker_app WITH CHECK (EXISTS (SELECT 1 FROM public.academic_reviews r WHERE r.id = academic_review_notes.review_id AND r.tenant_id = academic_review_notes.tenant_id));
--> statement-breakpoint
CREATE POLICY academic_review_notes_update ON public.academic_review_notes FOR UPDATE TO research_tracker_app USING (EXISTS (SELECT 1 FROM public.academic_reviews r WHERE r.id = academic_review_notes.review_id AND r.tenant_id = academic_review_notes.tenant_id)) WITH CHECK (EXISTS (SELECT 1 FROM public.academic_reviews r WHERE r.id = academic_review_notes.review_id AND r.tenant_id = academic_review_notes.tenant_id));
--> statement-breakpoint
CREATE POLICY academic_review_notes_delete ON public.academic_review_notes FOR DELETE TO research_tracker_app USING (EXISTS (SELECT 1 FROM public.academic_reviews r WHERE r.id = academic_review_notes.review_id AND r.tenant_id = academic_review_notes.tenant_id));
--> statement-breakpoint
REVOKE ALL ON public.academic_review_notes FROM PUBLIC, anon, authenticated, service_role, research_tracker_app;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON public.academic_review_notes TO research_tracker_app;
--> statement-breakpoint
GRANT UPDATE (content, updated_at) ON public.academic_review_notes TO research_tracker_app;
