-- Projects no longer have a pipeline; the only remaining pipeline is for
-- papers (the "modules" table), and it moves from a freely-editable
-- per-tenant/per-module custom stage pool to one fixed, 15-value catalog
-- that a workspace can only reorder and hide/show (never rename or add to).
--
-- Historical reset/delete operations are intentionally omitted for the new
-- empty deployment. Seed only the final fixed 15-value global catalog.
INSERT INTO "enum" (category, value, sort_order, hidden)
SELECT defaults.category, defaults.value, defaults.sort_order, false
FROM (VALUES
  ('module_pipeline_stage', 'Concept, Ideation', 1),
  ('module_pipeline_stage', 'Lit Review', 2),
  ('module_pipeline_stage', 'Study Design, Protocol', 3),
  ('module_pipeline_stage', 'Ethics, Other Approvals', 4),
  ('module_pipeline_stage', 'Preparation, Setup', 5),
  ('module_pipeline_stage', 'Data Collection', 6),
  ('module_pipeline_stage', 'Data Preparation', 7),
  ('module_pipeline_stage', 'Data Analysis', 8),
  ('module_pipeline_stage', 'Interpretation & Synthesis', 9),
  ('module_pipeline_stage', 'Drafting & Writing', 10),
  ('module_pipeline_stage', 'Submitted, Under Review', 11),
  ('module_pipeline_stage', 'Revisions', 12),
  ('module_pipeline_stage', 'Accepted', 13),
  ('module_pipeline_stage', 'Dissemination', 14),
  ('module_pipeline_stage', 'Complete', 15)
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
