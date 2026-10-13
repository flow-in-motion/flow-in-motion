-- "Review" is no longer a paper status: being under review is the
-- "Submitted, Under Review" pipeline stage. Papers were previously forced to
-- "Review" when they entered that stage, so move every paper still on "Review"
-- back to "Active". Projects keep their "Review" status untouched.
SET LOCAL row_security = off;
--> statement-breakpoint

UPDATE "modules"
SET "status_id" = active."id"
FROM "enum" active
WHERE active."category" = 'project_status'
  AND active."value" = 'Active'
  AND active."tenant_id" IS NULL
  AND "modules"."status_id" IN (
    SELECT review."id"
    FROM "enum" review
    WHERE review."category" = 'project_status'
      AND review."value" = 'Review'
  );
