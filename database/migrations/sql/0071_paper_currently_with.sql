ALTER TABLE "modules" ADD COLUMN "currently_with_type" text;--> statement-breakpoint
UPDATE "modules"
SET "currently_with_type" = CASE
	WHEN EXISTS (
		SELECT 1
		FROM "module_collaborators"
		INNER JOIN "enum" ON "enum"."id" = "module_collaborators"."role_id"
		WHERE "module_collaborators"."module_id" = "modules"."id"
			AND "module_collaborators"."user_id" = "modules"."assigned_to_user_id"
			AND "enum"."category" = 'project_role'
			AND "enum"."value" = 'Owner'
	)
	THEN 'me'
	ELSE 'collaborator'
END
WHERE "assigned_to_user_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "modules" ADD CONSTRAINT "modules_currently_with_type_check" CHECK ("modules"."currently_with_type" IS NULL OR "modules"."currently_with_type" IN ('me', 'collaborator', 'journal', 'friendly_reviewer'));
