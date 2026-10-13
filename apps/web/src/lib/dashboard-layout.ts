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
