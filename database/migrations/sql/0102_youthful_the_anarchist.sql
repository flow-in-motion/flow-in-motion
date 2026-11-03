ALTER TABLE "funding_notes" ADD COLUMN "pinned" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
GRANT UPDATE (pinned) ON TABLE public.funding_notes
TO research_tracker_app;