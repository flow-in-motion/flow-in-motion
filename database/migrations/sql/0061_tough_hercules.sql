ALTER TABLE "conferences" ALTER COLUMN "acronym" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "conferences" ALTER COLUMN "location" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "conferences" ALTER COLUMN "submission_due" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "conferences" ALTER COLUMN "start_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "conferences" ALTER COLUMN "end_date" DROP NOT NULL;