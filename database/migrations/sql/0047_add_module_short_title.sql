ALTER TABLE "modules" ALTER COLUMN "title" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "modules" ADD COLUMN "short_title" text;
