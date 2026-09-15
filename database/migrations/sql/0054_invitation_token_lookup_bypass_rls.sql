-- Custom SQL migration file, put your code below! --
-- preview/accept-by-token need to look up an invitation before the caller
-- is necessarily authenticated (preview is explicitly unauthenticated) or
-- before app.current_user_id matches anything an RLS policy checks (the
-- invitee may not be logged in as themselves yet at preview time). The
-- token itself (long, cryptographically random, single-use, hashed) is the
-- real security boundary here, not RLS — so these SECURITY DEFINER
-- functions deliberately bypass RLS for a token-based lookup only.
--
-- find_project_invitation_by_token/find_module_invitation_by_token already
-- exist (owned by a different role than this migration runs as) — only
-- task_invitations/note_invitations need new functions here.

CREATE OR REPLACE FUNCTION find_task_invitation_by_token(token_hash text)
RETURNS task_invitations
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT * FROM task_invitations WHERE token = token_hash;
$$;

CREATE OR REPLACE FUNCTION find_note_invitation_by_token(token_hash text)
RETURNS note_invitations
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT * FROM note_invitations WHERE token = token_hash;
$$;

-- Preview needs to show the task/note title, but at that point the caller
-- may not have access to it yet (that's the whole point of the invitation),
-- so normal RLS correctly hides it. The invitation's own existence (a valid
-- token) is the real authorization for seeing just the title.

CREATE OR REPLACE FUNCTION find_task_title_for_invitation(target_task_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT title FROM tasks WHERE id = target_task_id;
$$;

CREATE OR REPLACE FUNCTION find_note_title_for_invitation(target_note_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT title FROM notes WHERE id = target_note_id;
$$;
