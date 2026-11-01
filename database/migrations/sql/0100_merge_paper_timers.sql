-- Support databases with either migration history.
ALTER TABLE public.task_time_entries
  ALTER COLUMN task_id DROP NOT NULL;
--> statement-breakpoint

ALTER TABLE public.task_time_entries
  ADD COLUMN IF NOT EXISTS module_id uuid;
--> statement-breakpoint

DROP INDEX IF EXISTS public.task_time_entries_one_open_per_user_key;
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.task_time_entries'::regclass
      AND conname = 'task_time_entries_module_id_modules_id_fk'
  ) THEN
    ALTER TABLE public.task_time_entries
      ADD CONSTRAINT task_time_entries_module_id_modules_id_fk
      FOREIGN KEY (module_id)
      REFERENCES public.modules(id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.task_time_entries'::regclass
      AND conname = 'task_time_entries_target_check'
  ) THEN
    ALTER TABLE public.task_time_entries
      ADD CONSTRAINT task_time_entries_target_check
      CHECK (num_nonnulls(task_id, module_id) = 1);
  END IF;
END;
$$;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS
  task_time_entries_one_open_per_user_task_key
  ON public.task_time_entries (user_id, task_id)
  WHERE ended_at IS NULL AND task_id IS NOT NULL;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS
  task_time_entries_one_open_per_user_module_key
  ON public.task_time_entries (user_id, module_id)
  WHERE ended_at IS NULL AND module_id IS NOT NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS
  task_time_entries_module_id_started_at_idx
  ON public.task_time_entries (module_id, started_at);
--> statement-breakpoint

-- Extend the existing task policies to paper entries.
DROP POLICY IF EXISTS task_time_entries_paper_select
  ON public.task_time_entries;
--> statement-breakpoint

CREATE POLICY task_time_entries_paper_select
  ON public.task_time_entries
  FOR SELECT
  TO research_tracker_app
  USING (
    EXISTS (
      SELECT 1
      FROM public.modules m
      WHERE m.id = task_time_entries.module_id
        AND m.tenant_id = task_time_entries.tenant_id
        AND public.check_module_access(
          m.tenant_id,
          m.id,
          NULLIF(current_setting('app.current_user_id', true), '')::uuid
        )
    )
  );
--> statement-breakpoint

DROP POLICY IF EXISTS task_time_entries_paper_insert
  ON public.task_time_entries;
--> statement-breakpoint

CREATE POLICY task_time_entries_paper_insert
  ON public.task_time_entries
  FOR INSERT
  TO research_tracker_app
  WITH CHECK (
    user_id =
      NULLIF(current_setting('app.current_user_id', true), '')::uuid
    AND EXISTS (
      SELECT 1
      FROM public.modules m
      WHERE m.id = task_time_entries.module_id
        AND m.tenant_id = task_time_entries.tenant_id
        AND m.archived_at IS NULL
        AND (
          m.project_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.projects p
            WHERE p.id = m.project_id
              AND p.tenant_id = m.tenant_id
              AND p.archived_at IS NULL
          )
        )
        AND public.check_module_access(
          m.tenant_id,
          m.id,
          NULLIF(current_setting('app.current_user_id', true), '')::uuid
        )
    )
  );
--> statement-breakpoint

-- Prevent writes while comparing and copying the histories.
LOCK TABLE public.task_time_entries, public.paper_time_entries
  IN SHARE ROW EXCLUSIVE MODE;
--> statement-breakpoint

-- Refuse ambiguous ID collisions rather than overwrite another record.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.paper_time_entries p
    JOIN public.task_time_entries t ON t.id = p.id
    WHERE t.task_id IS NOT NULL
      OR t.module_id IS DISTINCT FROM p.paper_id
      OR t.user_id IS DISTINCT FROM p.user_id
      OR t.tenant_id IS DISTINCT FROM p.tenant_id
  ) THEN
    RAISE EXCEPTION
      'Paper time migration stopped: matching IDs have different owners or targets';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.paper_time_entries p
    JOIN public.task_time_entries t ON t.id = p.id
    WHERE p.updated_at = t.updated_at
      AND ROW(
        p.source,
        p.started_at,
        p.ended_at,
        p.running_since,
        p.duration_seconds,
        p.note
      ) IS DISTINCT FROM ROW(
        t.source,
        t.started_at,
        t.ended_at,
        t.running_since,
        t.duration_seconds,
        t.note
      )
  ) THEN
    RAISE EXCEPTION
      'Paper time migration stopped: matching timestamps have different entry contents';
  END IF;
END;
$$;
--> statement-breakpoint

-- First reconcile existing IDs. This also closes any older shared copy
-- when its newer separate copy has already been stopped.
UPDATE public.task_time_entries t
SET
  source = p.source,
  started_at = p.started_at,
  ended_at = p.ended_at,
  running_since = p.running_since,
  duration_seconds = p.duration_seconds,
  note = p.note,
  updated_at = p.updated_at
FROM public.paper_time_entries p
WHERE t.id = p.id
  AND p.updated_at > t.updated_at;
--> statement-breakpoint

-- Copy missing entries, including any currently open paper timer.
-- Preserve IDs, timestamps, notes and recorded duration.
INSERT INTO public.task_time_entries (
  id,
  tenant_id,
  task_id,
  module_id,
  user_id,
  source,
  started_at,
  ended_at,
  running_since,
  duration_seconds,
  note,
  created_at,
  updated_at
)
SELECT
  p.id,
  p.tenant_id,
  NULL,
  p.paper_id,
  p.user_id,
  p.source,
  p.started_at,
  p.ended_at,
  p.running_since,
  p.duration_seconds,
  p.note,
  p.created_at,
  p.updated_at
FROM public.paper_time_entries p
WHERE NOT EXISTS (
  SELECT 1
  FROM public.task_time_entries t
  WHERE t.id = p.id
);