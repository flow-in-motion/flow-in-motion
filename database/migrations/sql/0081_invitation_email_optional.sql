ALTER TABLE "project_invitations" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "module_invitations" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "task_invitations" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "note_invitations" ALTER COLUMN "email" DROP NOT NULL;