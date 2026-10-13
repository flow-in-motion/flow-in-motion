CREATE TABLE "note_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "note_id" uuid NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "note_entries"
  ADD CONSTRAINT "note_entries_note_id_notes_id_fk"
  FOREIGN KEY ("note_id")
  REFERENCES "public"."notes"("id")
  ON DELETE cascade
  ON UPDATE no action;
--> statement-breakpoint

CREATE INDEX "note_entries_note_id_created_at_id_idx"
  ON "note_entries" USING btree ("note_id", "created_at", "id");
--> statement-breakpoint

-- Fail instead of silently copying only a subset if the migration
-- connection cannot bypass the notes table's RLS.
SET LOCAL row_security = off;
--> statement-breakpoint

-- Preserve existing content without modifying the notes table.
INSERT INTO "note_entries" ("note_id", "content", "created_at")
SELECT "id", "content", "created_at"
FROM "notes"
WHERE "content" IS NOT NULL
  AND btrim("content") <> '';
--> statement-breakpoint

ALTER TABLE "note_entries" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY note_entries_visibility ON "note_entries"
  FOR SELECT
  TO research_tracker_app
  USING (
    EXISTS (
      SELECT 1
      FROM "notes"
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

CREATE POLICY note_entries_insert ON "note_entries"
  FOR INSERT
  TO research_tracker_app
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "notes"
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

-- Override any default grants: dated entries are append-only.
REVOKE ALL PRIVILEGES ON TABLE "note_entries" FROM PUBLIC;
--> statement-breakpoint

REVOKE ALL PRIVILEGES ON TABLE "note_entries"
  FROM research_tracker_app;
--> statement-breakpoint

GRANT SELECT, INSERT ON TABLE "note_entries"
  TO research_tracker_app;