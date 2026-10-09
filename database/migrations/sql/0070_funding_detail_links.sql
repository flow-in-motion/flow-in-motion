CREATE TABLE "funding_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"funding_id" uuid NOT NULL,
	"note_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funding_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"funding_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fundings" ADD COLUMN "follow_up_date" date;--> statement-breakpoint
ALTER TABLE "funding_notes" ADD CONSTRAINT "funding_notes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding_notes" ADD CONSTRAINT "funding_notes_funding_id_fundings_id_fk" FOREIGN KEY ("funding_id") REFERENCES "public"."fundings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding_notes" ADD CONSTRAINT "funding_notes_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding_tasks" ADD CONSTRAINT "funding_tasks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding_tasks" ADD CONSTRAINT "funding_tasks_funding_id_fundings_id_fk" FOREIGN KEY ("funding_id") REFERENCES "public"."fundings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding_tasks" ADD CONSTRAINT "funding_tasks_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "funding_notes_funding_id_note_id_key" ON "funding_notes" USING btree ("funding_id","note_id");--> statement-breakpoint
CREATE INDEX "funding_notes_note_id_idx" ON "funding_notes" USING btree ("note_id");--> statement-breakpoint
CREATE INDEX "funding_notes_tenant_id_idx" ON "funding_notes" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "funding_tasks_funding_id_task_id_key" ON "funding_tasks" USING btree ("funding_id","task_id");--> statement-breakpoint
CREATE INDEX "funding_tasks_task_id_idx" ON "funding_tasks" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "funding_tasks_tenant_id_idx" ON "funding_tasks" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "fundings_follow_up_date_idx" ON "fundings" USING btree ("follow_up_date");--> statement-breakpoint
ALTER TABLE "funding_notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "funding_tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY funding_notes_visibility ON funding_notes
  USING (
    EXISTS (
      SELECT 1 FROM fundings
      WHERE fundings.id = funding_notes.funding_id
        AND fundings.owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
    OR (
      funding_notes.tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
      AND can_access_funding(
        funding_notes.funding_id,
        NULLIF(current_setting('app.current_user_id', true), '')::uuid
      )
      AND EXISTS (
        SELECT 1 FROM notes
        WHERE notes.id = funding_notes.note_id
          AND notes.tenant_id = funding_notes.tenant_id
          AND (
            notes.created_by = NULLIF(current_setting('app.current_user_id', true), '')::uuid
            OR is_note_member(
              notes.id,
              NULLIF(current_setting('app.current_user_id', true), '')::uuid
            )
          )
      )
    )
  )
  WITH CHECK (
    funding_notes.tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM fundings
      WHERE fundings.id = funding_notes.funding_id
        AND fundings.tenant_id = funding_notes.tenant_id
        AND fundings.owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
    AND EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = funding_notes.note_id
        AND notes.tenant_id = funding_notes.tenant_id
        AND (
          notes.created_by = NULLIF(current_setting('app.current_user_id', true), '')::uuid
          OR is_note_member(
            notes.id,
            NULLIF(current_setting('app.current_user_id', true), '')::uuid
          )
        )
    )
  );--> statement-breakpoint
CREATE POLICY funding_tasks_visibility ON funding_tasks
  USING (
    EXISTS (
      SELECT 1 FROM fundings
      WHERE fundings.id = funding_tasks.funding_id
        AND fundings.owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
    OR (
      funding_tasks.tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
      AND can_access_funding(
        funding_tasks.funding_id,
        NULLIF(current_setting('app.current_user_id', true), '')::uuid
      )
      AND EXISTS (
        SELECT 1 FROM tasks
        WHERE tasks.id = funding_tasks.task_id
          AND tasks.tenant_id = funding_tasks.tenant_id
          AND (
            tasks.created_by = NULLIF(current_setting('app.current_user_id', true), '')::uuid
            OR is_task_member(
              tasks.id,
              NULLIF(current_setting('app.current_user_id', true), '')::uuid
            )
          )
      )
    )
  )
  WITH CHECK (
    funding_tasks.tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM fundings
      WHERE fundings.id = funding_tasks.funding_id
        AND fundings.tenant_id = funding_tasks.tenant_id
        AND fundings.owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
    AND EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = funding_tasks.task_id
        AND tasks.tenant_id = funding_tasks.tenant_id
        AND (
          tasks.created_by = NULLIF(current_setting('app.current_user_id', true), '')::uuid
          OR is_task_member(
            tasks.id,
            NULLIF(current_setting('app.current_user_id', true), '')::uuid
          )
        )
    )
  );--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON TABLE "funding_notes" TO research_tracker_app;--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON TABLE "funding_tasks" TO research_tracker_app;
