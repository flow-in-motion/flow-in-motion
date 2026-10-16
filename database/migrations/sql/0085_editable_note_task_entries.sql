DROP INDEX "note_entries_note_id_created_at_id_idx";
--> statement-breakpoint

DROP INDEX "task_description_entries_task_id_created_at_id_idx";
--> statement-breakpoint

ALTER TABLE "note_entries"
  ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint

ALTER TABLE "task_description_entries"
  ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint

-- Fail rather than silently backfilling only RLS-visible entries.
SET LOCAL row_security = off;
--> statement-breakpoint

UPDATE "note_entries"
SET "updated_at" = "created_at";
--> statement-breakpoint

UPDATE "task_description_entries"
SET "updated_at" = "created_at";
--> statement-breakpoint

CREATE INDEX "note_entries_note_id_updated_at_id_idx"
  ON "note_entries" USING btree ("note_id", "updated_at", "id");
--> statement-breakpoint

CREATE INDEX "task_description_entries_task_id_updated_at_id_idx"
  ON "task_description_entries"
  USING btree ("task_id", "updated_at", "id");
--> statement-breakpoint

CREATE POLICY note_entries_update ON "note_entries"
  FOR UPDATE
  TO research_tracker_app
  USING (
    EXISTS (
      SELECT 1 FROM "notes"
      WHERE notes.id = note_entries.note_id
        AND (
          notes.created_by =
            NULLIF(current_setting('app.current_user_id', true), '')::uuid
          OR is_note_member(
            notes.id,
            NULLIF(current_setting('app.current_user_id', true), '')::uuid
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "notes"
      WHERE notes.id = note_entries.note_id
        AND (
          notes.created_by =
            NULLIF(current_setting('app.current_user_id', true), '')::uuid
          OR is_note_member(
            notes.id,
            NULLIF(current_setting('app.current_user_id', true), '')::uuid
          )
        )
    )
  );
--> statement-breakpoint

CREATE POLICY note_entries_delete ON "note_entries"
  FOR DELETE
  TO research_tracker_app
  USING (
    EXISTS (
      SELECT 1 FROM "notes"
      WHERE notes.id = note_entries.note_id
        AND (
          notes.created_by =
            NULLIF(current_setting('app.current_user_id', true), '')::uuid
          OR is_note_member(
            notes.id,
            NULLIF(current_setting('app.current_user_id', true), '')::uuid
          )
        )
    )
  );
--> statement-breakpoint

CREATE POLICY task_description_entries_update
  ON "task_description_entries"
  FOR UPDATE
  TO research_tracker_app
  USING (
    EXISTS (
      SELECT 1 FROM "tasks"
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
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "tasks"
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

CREATE POLICY task_description_entries_delete
  ON "task_description_entries"
  FOR DELETE
  TO research_tracker_app
  USING (
    EXISTS (
      SELECT 1 FROM "tasks"
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

-- Allow content edits while protecting parent IDs and creation timestamps.
GRANT UPDATE ("content", "updated_at"), DELETE
  ON TABLE "note_entries"
  TO research_tracker_app;
--> statement-breakpoint

GRANT UPDATE ("content", "updated_at"), DELETE
  ON TABLE "task_description_entries"
  TO research_tracker_app;