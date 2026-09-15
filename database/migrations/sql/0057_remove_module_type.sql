ALTER TABLE "modules" DROP CONSTRAINT "modules_tag_id_enum_id_fk";
--> statement-breakpoint
ALTER TABLE "modules" DROP COLUMN "tag_id";
--> statement-breakpoint
DELETE FROM "enum"
WHERE "category" = 'module_type';