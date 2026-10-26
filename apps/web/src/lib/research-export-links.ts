export function researchExportTarget(
    collection: string,
    id: unknown,
  ): string | undefined {
    if (typeof id !== "string" || !id) return undefined;
    return `research-${collection}-${encodeURIComponent(id)}`;
  }