CREATE TABLE "task_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"affiliation" text,
	"invited_by" uuid NOT NULL,
	"token" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "note_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_id" uuid NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"affiliation" text,
	"invited_by" uuid NOT NULL,
	"token" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "note_invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "project_invitations" ALTER COLUMN "token" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "project_invitations" ALTER COLUMN "status" SET DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE "project_invitations" ALTER COLUMN "expires_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "module_invitations" ALTER COLUMN "token" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "module_invitations" ALTER COLUMN "status" SET DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE "module_invitations" ALTER COLUMN "expires_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "project_invitations" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "project_invitations" ADD COLUMN "affiliation" text;--> statement-breakpoint
ALTER TABLE "module_invitations" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "module_invitations" ADD COLUMN "affiliation" text;--> statement-breakpoint
ALTER TABLE "task_invitations" ADD CONSTRAINT "task_invitations_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_invitations" ADD CONSTRAINT "task_invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_invitations" ADD CONSTRAINT "note_invitations_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_invitations" ADD CONSTRAINT "note_invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;