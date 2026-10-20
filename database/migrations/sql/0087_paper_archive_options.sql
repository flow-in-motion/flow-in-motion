CREATE OR REPLACE FUNCTION internal.paper_archive_operation(
  p_tenant_id uuid,
  p_module_id uuid,
  p_mode text DEFAULT 'impact',
  p_destination_module_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
SET row_security = off
AS $function$
DECLARE
  caller_id uuid :=
    NULLIF(current_setting('app.current_user_id', true), '')::uuid;
  request_tenant_id uuid :=
    NULLIF(current_setting('app.current_tenant_id', true), '')::uuid;
  destination_project_id uuid;
  task_count integer;
  note_count integer;
  archived_id uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF request_tenant_id IS NOT NULL
     AND request_tenant_id <> p_tenant_id THEN
    RAISE EXCEPTION 'Workspace mismatch'
      USING ERRCODE = '42501';
  END IF;

  IF p_mode IS NULL OR p_mode NOT IN (
    'impact',
    'archive_contents',
    'move_contents'
  ) THEN
    RAISE EXCEPTION 'Unknown paper archive mode'
      USING ERRCODE = '22023';
  END IF;

  IF p_mode = 'move_contents' THEN
    IF p_destination_module_id IS NULL
       OR p_destination_module_id = p_module_id THEN
      RAISE EXCEPTION 'Choose a different destination paper'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  -- Lock source and destination in a consistent order for write operations.
  -- Child rows referencing these papers cannot be inserted concurrently
  -- while the papers are being moved/archived.
  IF p_mode <> 'impact' THEN
    PERFORM paper.id
    FROM public.modules AS paper
    WHERE paper.tenant_id = p_tenant_id
      AND (
        paper.id = p_module_id
        OR (
          p_mode = 'move_contents'
          AND paper.id = p_destination_module_id
        )
      )
    ORDER BY paper.id
    FOR UPDATE;
  END IF;

  -- Authorize using the paper's explicit Owner role.
  IF NOT EXISTS (
    SELECT 1
    FROM public.modules AS paper
    INNER JOIN public.module_collaborators AS collaborator
      ON collaborator.module_id = paper.id
      AND collaborator.tenant_id = paper.tenant_id
    INNER JOIN public."enum" AS role
      ON role.id = collaborator.role_id
    WHERE paper.id = p_module_id
      AND paper.tenant_id = p_tenant_id
      AND paper.archived_at IS NULL
      AND collaborator.user_id = caller_id
      AND role.category = 'project_role'
      AND role.value = 'Owner'
      AND (
        paper.project_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.projects AS parent
          WHERE parent.id = paper.project_id
            AND parent.tenant_id = p_tenant_id
            AND parent.archived_at IS NULL
        )
      )
  ) THEN
    RAISE EXCEPTION 'Only the owner of an active paper can archive it'
      USING ERRCODE = '42501';
  END IF;

  IF p_mode = 'impact' THEN
    SELECT count(*)::integer
    INTO task_count
    FROM public.tasks AS task
    WHERE task.tenant_id = p_tenant_id
      AND task.module_id = p_module_id;

    SELECT count(*)::integer
    INTO note_count
    FROM public.notes AS note
    WHERE note.tenant_id = p_tenant_id
      AND note.module_id = p_module_id;

    RETURN jsonb_build_object(
      'tasks', task_count,
      'notes', note_count
    );
  END IF;

  IF p_mode = 'move_contents' THEN
    SELECT paper.project_id
    INTO destination_project_id
    FROM public.modules AS paper
    INNER JOIN public.module_collaborators AS collaborator
      ON collaborator.module_id = paper.id
      AND collaborator.tenant_id = paper.tenant_id
    INNER JOIN public."enum" AS role
      ON role.id = collaborator.role_id
    WHERE paper.id = p_destination_module_id
      AND paper.tenant_id = p_tenant_id
      AND paper.archived_at IS NULL
      AND collaborator.user_id = caller_id
      AND role.category = 'project_role'
      AND role.value = 'Owner'
      AND (
        paper.project_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.projects AS parent
          WHERE parent.id = paper.project_id
            AND parent.tenant_id = p_tenant_id
            AND parent.archived_at IS NULL
        )
      );

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Choose another active paper that you own'
        USING ERRCODE = '22023';
    END IF;

    UPDATE public.tasks
    SET module_id = p_destination_module_id,
        project_id = destination_project_id,
        updated_at = now()
    WHERE tenant_id = p_tenant_id
      AND module_id = p_module_id;

    UPDATE public.notes
    SET module_id = p_destination_module_id,
        project_id = destination_project_id,
        module_pinned = false,
        updated_at = now()
    WHERE tenant_id = p_tenant_id
      AND module_id = p_module_id;
  END IF;

  -- In archive_contents mode, leave the links in place.
  -- Existing archived-parent filtering hides the tasks and notes.
  UPDATE public.modules
  SET archived_at = now(),
      updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND id = p_module_id
    AND archived_at IS NULL
  RETURNING id INTO archived_id;

  IF archived_id IS NULL THEN
    RAISE EXCEPTION 'Paper could not be archived'
      USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object('id', archived_id);
END;
$function$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION internal.paper_archive_operation(
  uuid, uuid, text, uuid
) FROM PUBLIC, anon, authenticated, service_role;
--> statement-breakpoint

GRANT EXECUTE ON FUNCTION internal.paper_archive_operation(
  uuid, uuid, text, uuid
) TO research_tracker_app;