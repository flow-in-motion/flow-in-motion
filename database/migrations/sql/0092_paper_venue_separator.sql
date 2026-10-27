-- Paper journal and conference lists used to be saved with commas between
-- names, which split titles that contain a comma ("Accounting, Organizations
-- and Society") into two entries. Lists are now saved with "; " between names
-- so a name can keep its commas.
--
-- The old input split on every comma, so each comma in these columns is a
-- separator: converting them keeps every paper showing exactly the entries it
-- shows today. The project "Target journal" field is free text and is left
-- as typed.
SET LOCAL row_security = off;
--> statement-breakpoint

UPDATE "modules"
SET "target_journal" = NULLIF(
  array_to_string(
    ARRAY(
      SELECT btrim(entry.name)
      FROM unnest(string_to_array("modules"."target_journal", ',')) WITH ORDINALITY AS entry(name, position)
      WHERE btrim(entry.name) <> ''
      ORDER BY entry.position
    ),
    '; '
  ),
  ''
)
WHERE "target_journal" LIKE '%,%';
--> statement-breakpoint

UPDATE "modules"
SET "backup_journal" = NULLIF(
  array_to_string(
    ARRAY(
      SELECT btrim(entry.name)
      FROM unnest(string_to_array("modules"."backup_journal", ',')) WITH ORDINALITY AS entry(name, position)
      WHERE btrim(entry.name) <> ''
      ORDER BY entry.position
    ),
    '; '
  ),
  ''
)
WHERE "backup_journal" LIKE '%,%';
--> statement-breakpoint

UPDATE "modules"
SET "target_conference" = NULLIF(
  array_to_string(
    ARRAY(
      SELECT btrim(entry.name)
      FROM unnest(string_to_array("modules"."target_conference", ',')) WITH ORDINALITY AS entry(name, position)
      WHERE btrim(entry.name) <> ''
      ORDER BY entry.position
    ),
    '; '
  ),
  ''
)
WHERE "target_conference" LIKE '%,%';
--> statement-breakpoint

UPDATE "modules"
SET "backup_conference" = NULLIF(
  array_to_string(
    ARRAY(
      SELECT btrim(entry.name)
      FROM unnest(string_to_array("modules"."backup_conference", ',')) WITH ORDINALITY AS entry(name, position)
      WHERE btrim(entry.name) <> ''
      ORDER BY entry.position
    ),
    '; '
  ),
  ''
)
WHERE "backup_conference" LIKE '%,%';
