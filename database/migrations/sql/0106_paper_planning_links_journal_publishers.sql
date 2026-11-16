ALTER TABLE "modules" ADD COLUMN "working_date" date;--> statement-breakpoint
ALTER TABLE "modules" ADD COLUMN "planned_hours" numeric(4, 2);--> statement-breakpoint
ALTER TABLE "modules" ADD COLUMN "manuscript_url" text;--> statement-breakpoint
ALTER TABLE "modules" ADD COLUMN "data_url" text;--> statement-breakpoint
ALTER TABLE "modules" ADD COLUMN "other_files_url" text;--> statement-breakpoint
ALTER TABLE "modules" ADD COLUMN "journal_publishers" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "module_submissions" ADD COLUMN "journal_publisher" text;--> statement-breakpoint
ALTER TABLE "modules" ADD CONSTRAINT "modules_planned_hours_check" CHECK ("modules"."planned_hours" IS NULL OR ("modules"."planned_hours" > 0 AND "modules"."planned_hours" <= 24));