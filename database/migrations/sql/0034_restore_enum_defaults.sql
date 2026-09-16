-- Restore the shared enum defaults omitted when the migration history was reset.
-- This is intentionally idempotent so it also repairs existing databases that
-- have only some of the defaults.
INSERT INTO "enum" (category, value, sort_order)
SELECT defaults.category, defaults.value, defaults.sort_order
FROM (VALUES
  ('project_status', 'Active', 1),
  ('project_status', 'Review', 2),
  ('project_status', 'Complete', 3),
  ('project_status', 'Archived', 4),
  ('project_status', 'Stalled', 5),
  ('importance', 'Low', 1),
  ('importance', 'Medium', 2),
  ('importance', 'High', 3),
  ('importance', 'Critical', 4),
  ('project_role', 'Owner', 1),
  ('project_role', 'Collaborator', 2),
  ('project_role', 'Supervisor', 3),
  ('project_role', 'Lead', 4),
  ('task_status', 'To do', 1),
  ('task_status', 'Underway', 2),
  ('task_status', 'Waiting', 3),
  ('task_status', 'Complete', 4),
  ('visibility', 'Private', 1),
  ('visibility', 'Shared', 2)
) AS defaults(category, value, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM "enum" existing
  WHERE existing.tenant_id IS NULL
    AND existing.project_id IS NULL
    AND existing.module_id IS NULL
    AND existing.category = defaults.category
    AND existing.value = defaults.value
);
