-- The cleanup functions predate the Supabase security baseline and may be
-- owned by a different migration role, so grant their permissions explicitly.

ALTER FUNCTION public.cleanup_archived_projects(timestamptz)
  SET search_path = pg_catalog, public, pg_temp;
--> statement-breakpoint

ALTER FUNCTION public.cleanup_archived_modules(timestamptz)
  SET search_path = pg_catalog, public, pg_temp;
--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION public.cleanup_archived_projects(timestamptz)
  FROM PUBLIC;
--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION public.cleanup_archived_modules(timestamptz)
  FROM PUBLIC;
--> statement-breakpoint

GRANT EXECUTE ON FUNCTION public.cleanup_archived_projects(timestamptz)
  TO research_tracker_app;
--> statement-breakpoint

GRANT EXECUTE ON FUNCTION public.cleanup_archived_modules(timestamptz)
  TO research_tracker_app;
