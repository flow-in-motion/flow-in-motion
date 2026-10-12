CREATE TABLE "task_description_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "task_id" uuid NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "task_description_entries"
  ADD CONSTRAINT "task_description_entries_task_id_tasks_id_fk"
  FOREIGN KEY ("task_id")
  REFERENCES "public"."tasks"("id")
  ON DELETE cascade
  ON UPDATE no action;
--> statement-breakpoint

CREATE INDEX "task_description_entries_task_id_created_at_id_idx"
  ON "task_description_entries"
  USING btree ("task_id", "created_at", "id");
--> statement-breakpoint

-- Fail instead of silently backfilling only RLS-visible tasks.
SET LOCAL row_security = off;
--> statement-breakpoint

-- Preserve each existing non-empty description as an initial entry.
INSERT INTO "task_description_entries" (
  "task_id",
  "content",
  "created_at"
)
SELECT "id", "description", "created_at"
FROM "tasks"
WHERE "description" IS NOT NULL
  AND btrim("description") <> '';
--> statement-breakpoint

ALTER TABLE "task_description_entries" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY task_description_entries_visibility
  ON "task_description_entries"
  FOR SELECT
  TO research_tracker_app
  USING (
    EXISTS (
      SELECT 1
      FROM "tasks"
      WHERE tasks.id = task_description_entries.task_id
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

CREATE POLICY task_description_entries_insert
  ON "task_description_entries"
  FOR INSERT
  TO research_tracker_app
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "tasks"
      WHERE tasks.id = task_description_entries.task_id
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

REVOKE ALL PRIVILEGES ON TABLE "task_description_entries"
  FROM PUBLIC;
--> statement-breakpoint

REVOKE ALL PRIVILEGES ON TABLE "task_description_entries"
  FROM research_tracker_app;
--> statement-breakpoint

GRANT SELECT, INSERT ON TABLE "task_description_entries"
  TO research_tracker_app;