CREATE TABLE "module_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"module_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"submitted_date" date NOT NULL,
	"journal_name" text NOT NULL,
	"status" text NOT NULL,
	"revision_rounds" integer,
	"decision_date" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "modules" ADD COLUMN "target_journal" text;--> statement-breakpoint
ALTER TABLE "modules" ADD COLUMN "backup_journal" text;--> statement-breakpoint
ALTER TABLE "modules" ADD COLUMN "target_conference" text;--> statement-breakpoint
ALTER TABLE "modules" ADD COLUMN "backup_conference" text;--> statement-breakpoint
ALTER TABLE "module_submissions" ADD CONSTRAINT "module_submissions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_submissions" ADD CONSTRAINT "module_submissions_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_submissions" ADD CONSTRAINT "module_submissions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "module_submissions_tenant_id_module_id_idx" ON "module_submissions" USING btree ("tenant_id","module_id");