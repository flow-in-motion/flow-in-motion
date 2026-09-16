-- The notes table used "note_date" for its creation timestamp while every
-- other entity (projects, tasks, modules, ...) uses "created_at" — the API
-- and frontend both expect "createdAt", so this column was silently never
-- populated on the response. A plain column rename is a metadata-only
-- operation in Postgres: no table rewrite, no data loss, existing values are
-- preserved as-is.
ALTER TABLE "notes" RENAME COLUMN "note_date" TO "created_at";
