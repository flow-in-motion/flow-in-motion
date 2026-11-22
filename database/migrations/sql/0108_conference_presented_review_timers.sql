ALTER TABLE "conferences" DROP CONSTRAINT "conferences_intents_check";--> statement-breakpoint
ALTER TABLE "work_time_entries" DROP CONSTRAINT "work_time_one_target";--> statement-breakpoint
ALTER TABLE "work_time_entries" ADD COLUMN "review_id" uuid;--> statement-breakpoint
ALTER TABLE "work_time_entries" ADD COLUMN "examination_id" uuid;--> statement-breakpoint
ALTER TABLE "work_time_entries" ADD CONSTRAINT "work_time_entries_review_id_academic_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."academic_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_time_entries" ADD CONSTRAINT "work_time_entries_examination_id_academic_reviews_id_fk" FOREIGN KEY ("examination_id") REFERENCES "public"."academic_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "work_time_open_review" ON "work_time_entries" USING btree ("user_id","review_id") WHERE "work_time_entries"."ended_at" IS NULL AND "work_time_entries"."review_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "work_time_open_examination" ON "work_time_entries" USING btree ("user_id","examination_id") WHERE "work_time_entries"."ended_at" IS NULL AND "work_time_entries"."examination_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "work_time_review_idx" ON "work_time_entries" USING btree ("review_id");--> statement-breakpoint
CREATE INDEX "work_time_examination_idx" ON "work_time_entries" USING btree ("examination_id");--> statement-breakpoint
ALTER TABLE "conferences" ADD CONSTRAINT "conferences_intents_check" CHECK ("conferences"."intents" <@ ARRAY['Considering', 'Submitting', 'Attending', 'Presented']::text[] AND array_position("conferences"."intents", NULL) IS NULL);--> statement-breakpoint
ALTER TABLE "work_time_entries" ADD CONSTRAINT "work_time_one_target" CHECK (num_nonnulls("work_time_entries"."project_id", "work_time_entries"."note_id", "work_time_entries"."hdr_person_id", "work_time_entries"."review_id", "work_time_entries"."examination_id") = 1);
--> statement-breakpoint
-- The global timer endpoint has an authenticated caller but no tenant context.
-- Resolve only an owned record of the exact requested kind, exposing no notes.
CREATE FUNCTION public.work_time_review_target(record_id uuid, review_kind text)
RETURNS TABLE (id uuid, tenant_id uuid, title text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT r.id, r.tenant_id,
    CASE WHEN r.kind = 'journal' THEN r.manuscript_title ELSE r.student_name END
  FROM public.academic_reviews r
  WHERE r.id = record_id AND r.kind = review_kind
    AND review_kind IN ('journal', 'examination')
    AND r.owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.work_time_review_target(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.work_time_review_target(uuid, text) TO research_tracker_app;
--> statement-breakpoint
DROP POLICY work_time_insert ON public.work_time_entries;
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
    OR (review_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.work_time_review_target(work_time_entries.review_id, 'journal') r WHERE r.tenant_id = work_time_entries.tenant_id))
    OR (examination_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.work_time_review_target(work_time_entries.examination_id, 'examination') r WHERE r.tenant_id = work_time_entries.tenant_id))
  )
);
