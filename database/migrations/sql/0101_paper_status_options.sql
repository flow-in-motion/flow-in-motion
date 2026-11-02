INSERT INTO public."enum" (
  category,
  value,
  sort_order,
  hidden
)
SELECT
  'paper_status',
  proposed.value,
  proposed.sort_order,
  false
FROM (
  VALUES
    ('Proposed', 0),
    ('Parked', 4),
    ('Closed', 5)
) AS proposed(value, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM public."enum" existing
  WHERE existing.category = 'paper_status'
    AND existing.value = proposed.value
    AND existing.tenant_id IS NULL
    AND existing.project_id IS NULL
    AND existing.module_id IS NULL
);