-- Custom SQL migration file, put your code below! --
-- 0050 created module_submissions but missed the per-table DML grant the
-- runtime role needs (see bootstrap/001_roles.sql — the runtime role gets
-- no table privileges until a migration grants them; same fix as 0039 for
-- analytics_events and 0045 for calendar_events).
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "module_submissions" TO research_tracker_app;
