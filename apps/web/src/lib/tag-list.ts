// Journal and conference lists are saved as one piece of text with "; "
// between names. A semicolon (not a comma) separates them because many
// journal titles contain commas, e.g. "Accounting, Organizations and Society".
export const TAG_LIST_SEPARATOR = "; ";

export function splitTagList(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(";")
    .map((name) => name.trim())
    .filter(Boolean);
}

export function joinTagList(names: string[]): string {
  return names.join(TAG_LIST_SEPARATOR);
}
