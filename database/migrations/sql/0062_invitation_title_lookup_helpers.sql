-- Invitation previews run before the invitee necessarily has access to the
-- target entity. A valid, hashed invitation token authorizes disclosure of
-- only the target's display title.

CREATE OR REPLACE FUNCTION find_project_title_for_invitation(
  target_project_id uuid
)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT title
  FROM projects
  WHERE id = target_project_id;
$$;

CREATE OR REPLACE FUNCTION find_module_title_for_invitation(
  target_module_id uuid
)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    NULLIF(BTRIM(short_title), ''),
    NULLIF(BTRIM(title), ''),
    'Untitled paper'
  )
  FROM modules
  WHERE id = target_module_id;
$$;

REVOKE ALL
ON FUNCTION find_project_title_for_invitation(uuid)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION find_module_title_for_invitation(uuid)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION find_project_title_for_invitation(uuid)
TO research_tracker_app;

GRANT EXECUTE
ON FUNCTION find_module_title_for_invitation(uuid)
TO research_tracker_app;