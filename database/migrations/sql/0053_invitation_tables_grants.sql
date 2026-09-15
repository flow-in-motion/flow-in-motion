-- Custom SQL migration file, put your code below! --
-- task_invitations/note_invitations are new tables (0052) and, like every new
-- table in this repo, need an explicit per-table DML grant for the runtime
-- role — see bootstrap/001_roles.sql and the same fix in 0039/0045/0051.
-- project_invitations/module_invitations are included too: neither ever
-- received this grant in earlier migrations, which would otherwise leave the
-- new draft/send invitation flow unable to read or write them at runtime.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "project_invitations" TO research_tracker_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "module_invitations" TO research_tracker_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "task_invitations" TO research_tracker_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "note_invitations" TO research_tracker_app;
