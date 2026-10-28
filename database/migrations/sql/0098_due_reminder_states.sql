CREATE TABLE "due_reminder_states" (
	"user_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"item_type" text NOT NULL,
	"item_id" uuid NOT NULL,
	"due_date" date NOT NULL,
	"seen_stage" integer,
	"dismissed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "due_reminder_states_user_id_item_type_item_id_due_date_pk" PRIMARY KEY("user_id","item_type","item_id","due_date"),
	CONSTRAINT "due_reminder_states_item_type_check" CHECK ("due_reminder_states"."item_type" IN ('task', 'paper', 'project', 'conference', 'conference_submission', 'funding_deadline', 'funding_follow_up', 'note')),
	CONSTRAINT "due_reminder_states_seen_stage_check" CHECK ("due_reminder_states"."seen_stage" IS NULL OR "due_reminder_states"."seen_stage" >= -1)
);
--> statement-breakpoint
ALTER TABLE "due_reminder_states" ADD CONSTRAINT "due_reminder_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "due_reminder_states" ADD CONSTRAINT "due_reminder_states_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Each person's own record of which due-date reminders they have seen or
-- dismissed, in the workspace they are using.
ALTER TABLE "due_reminder_states" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY due_reminder_states_own
  ON "due_reminder_states"
  FOR ALL
  TO research_tracker_app
  USING (
    user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    AND tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    AND tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );
--> statement-breakpoint

REVOKE ALL PRIVILEGES ON TABLE "due_reminder_states" FROM PUBLIC;
--> statement-breakpoint

REVOKE ALL PRIVILEGES ON TABLE "due_reminder_states"
  FROM anon, authenticated, service_role;
--> statement-breakpoint

REVOKE ALL PRIVILEGES ON TABLE "due_reminder_states" FROM research_tracker_app;
--> statement-breakpoint

GRANT SELECT, INSERT, DELETE ON TABLE "due_reminder_states"
  TO research_tracker_app;
--> statement-breakpoint

GRANT UPDATE ("seen_stage", "dismissed_at", "updated_at")
  ON TABLE "due_reminder_states" TO research_tracker_app;
