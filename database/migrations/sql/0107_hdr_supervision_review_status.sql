CREATE TABLE "hdr_discussion_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hdr_discussion_notes_content_check" CHECK (length(trim("hdr_discussion_notes"."content")) BETWEEN 1 AND 20000)
);
--> statement-breakpoint
ALTER TABLE "hdr_people" ADD COLUMN "supervision_type" text;--> statement-breakpoint
ALTER TABLE "hdr_people" ADD COLUMN "start_date" date;--> statement-breakpoint
ALTER TABLE "hdr_people" ADD COLUMN "submission_due_date" date;--> statement-breakpoint
ALTER TABLE "hdr_people" ADD COLUMN "conferences" text;--> statement-breakpoint
ALTER TABLE "academic_reviews" ADD COLUMN "status" text DEFAULT 'To do' NOT NULL;--> statement-breakpoint
ALTER TABLE "academic_reviews" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hdr_discussion_notes" ADD CONSTRAINT "hdr_discussion_notes_person_id_tenant_id_hdr_people_id_tenant_id_fk" FOREIGN KEY ("person_id","tenant_id") REFERENCES "public"."hdr_people"("id","tenant_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hdr_discussion_notes_person_created_idx" ON "hdr_discussion_notes" USING btree ("person_id","tenant_id","created_at","id");--> statement-breakpoint
ALTER TABLE "hdr_people" ADD CONSTRAINT "hdr_people_supervision_type_check" CHECK ("hdr_people"."supervision_type" IS NULL OR "hdr_people"."supervision_type" IN ('Primary', 'Associate', 'Co-supervisor', 'Panel', 'Other'));--> statement-breakpoint
ALTER TABLE "hdr_people" ADD CONSTRAINT "hdr_people_dates_check" CHECK ("hdr_people"."start_date" IS NULL OR "hdr_people"."submission_due_date" IS NULL OR "hdr_people"."submission_due_date" >= "hdr_people"."start_date");--> statement-breakpoint
ALTER TABLE "academic_reviews" ADD CONSTRAINT "academic_reviews_status_check" CHECK ("academic_reviews"."status" IN ('To do', 'Underway', 'Waiting', 'Complete'));--> statement-breakpoint
ALTER TABLE "academic_reviews" ADD CONSTRAINT "academic_reviews_completion_check" CHECK (("academic_reviews"."status" = 'Complete' AND "academic_reviews"."completed_at" IS NOT NULL) OR ("academic_reviews"."status" <> 'Complete' AND "academic_reviews"."completed_at" IS NULL));
--> statement-breakpoint
GRANT UPDATE (supervision_type, start_date, submission_due_date, conferences) ON public.hdr_people TO research_tracker_app;
--> statement-breakpoint
GRANT UPDATE (status, completed_at) ON public.academic_reviews TO research_tracker_app;
--> statement-breakpoint
ALTER TABLE public.hdr_discussion_notes ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON public.hdr_discussion_notes FROM PUBLIC, anon, authenticated, service_role, research_tracker_app;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON public.hdr_discussion_notes TO research_tracker_app;
--> statement-breakpoint
GRANT UPDATE (content, updated_at) ON public.hdr_discussion_notes TO research_tracker_app;
--> statement-breakpoint
CREATE POLICY hdr_discussion_notes_select ON public.hdr_discussion_notes FOR SELECT TO research_tracker_app USING (EXISTS (SELECT 1 FROM public.hdr_people h WHERE h.id = hdr_discussion_notes.person_id AND h.tenant_id = hdr_discussion_notes.tenant_id AND h.owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid AND h.tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid));
--> statement-breakpoint
CREATE POLICY hdr_discussion_notes_insert ON public.hdr_discussion_notes FOR INSERT TO research_tracker_app  WITH CHECK (EXISTS (SELECT 1 FROM public.hdr_people h WHERE h.id = hdr_discussion_notes.person_id AND h.tenant_id = hdr_discussion_notes.tenant_id AND h.owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid AND h.tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid));
--> statement-breakpoint
CREATE POLICY hdr_discussion_notes_update ON public.hdr_discussion_notes FOR UPDATE TO research_tracker_app USING (EXISTS (SELECT 1 FROM public.hdr_people h WHERE h.id = hdr_discussion_notes.person_id AND h.tenant_id = hdr_discussion_notes.tenant_id AND h.owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid AND h.tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)) WITH CHECK (EXISTS (SELECT 1 FROM public.hdr_people h WHERE h.id = hdr_discussion_notes.person_id AND h.tenant_id = hdr_discussion_notes.tenant_id AND h.owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid AND h.tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid));
--> statement-breakpoint
CREATE POLICY hdr_discussion_notes_delete ON public.hdr_discussion_notes FOR DELETE TO research_tracker_app USING (EXISTS (SELECT 1 FROM public.hdr_people h WHERE h.id = hdr_discussion_notes.person_id AND h.tenant_id = hdr_discussion_notes.tenant_id AND h.owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid AND h.tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid));
