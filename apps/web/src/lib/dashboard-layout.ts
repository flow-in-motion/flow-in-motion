/**
 * Lays dashboard widgets out in rows of `columns`, keeping the user's order,
 * and widens the last widget of each row to fill whatever space is left. This
 * stops a narrow widget followed by one that doesn't fit beside it from
 * leaving an empty gap at the end of the row.
 *
 * Returns the column span to use for each widget, in the same order.
 */
export function fillRowGaps(widths: readonly number[], columns: number): number[] {
  const spans = widths.map((width) => Math.min(Math.max(1, width), columns));
  let rowStart = 0;
  let used = 0;

  spans.forEach((span, index) => {
    if (used + span > columns) {
      spans[index - 1] += columns - used;
      rowStart = index;
      used = 0;
    }
    used += span;
  });

  if (spans.length > rowStart) {
    spans[spans.length - 1] += columns - used;
  }

  return spans;
}
interface DashboardWidthWidget {
  id: string;
  span: number;
}

/** Valid saved widths are whole percentages between 25 and 100. */
export function normalizeDashboardWidths(
  value: unknown,
  widgetIds: readonly string[],
): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const allowedIds = new Set(widgetIds);
  const entries: Array<[string, number]> = [];

  for (const [id, width] of Object.entries(value)) {
    if (
      allowedIds.has(id) &&
      typeof width === "number" &&
      Number.isFinite(width) &&
      width >= 25 &&
      width <= 100
    ) {
      entries.push([id, Math.round(width)]);
    }
  }

  return Object.fromEntries(entries);
}

/**
 * Preserves the existing five-column defaults, but keeps explicitly
 * resized widgets at their chosen percentage.
 */
export function getDashboardWidgetWidths(
  widgets: readonly DashboardWidthWidget[],
  savedWidths: Readonly<Record<string, number>> = {},
): number[] {
  const customWidths = normalizeDashboardWidths(
    savedWidths,
    widgets.map((widget) => widget.id),
  );

  const widths = widgets.map(
    (widget) => customWidths[widget.id] ?? widget.span * 20,
  );

  let used = 0;
  let lastIndex = -1;

  function finishRow() {
    if (
      lastIndex >= 0 &&
      customWidths[widgets[lastIndex].id] === undefined
    ) {
      widths[lastIndex] += 100 - used;
    }
  }

  widths.forEach((width, index) => {
    if (used + width > 100) {
      finishRow();
      used = 0;
    }

    used += width;
    lastIndex = index;
  });

  finishRow();

  return widths;
}
