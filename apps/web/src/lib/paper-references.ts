import { splitTagList } from "@/lib/tag-list";

export interface JournalPublisher {
  journalName: string;
  publisher: string;
}

export interface PaperReferenceForm {
  workingDate: string;
  plannedHours: string;
  manuscriptUrl: string;
  dataUrl: string;
  otherFilesUrl: string;
  journalPublishers: JournalPublisher[];
}

export function journalPublisherFor(
  entries: JournalPublisher[] | undefined,
  name: string,
) {
  return (
    entries?.find(
      (entry) =>
        entry.journalName.trim().toLowerCase() === name.trim().toLowerCase(),
    )?.publisher ?? ""
  );
}

export function savedJournalPublishers(
  entries: JournalPublisher[],
  target: string,
  backup: string,
) {
  return journalNames(target, backup).flatMap((journalName) => {
    const publisher = journalPublisherFor(entries, journalName).trim();
    return publisher ? [{ journalName, publisher }] : [];
  });
}

export function journalNames(target: string, backup: string) {
  const names = new Map<string, string>();
  for (const name of [...splitTagList(target), ...splitTagList(backup)]) {
    if (!names.has(name.toLowerCase())) names.set(name.toLowerCase(), name);
  }
  return [...names.values()];
}

/** Ignore unsafe legacy values rather than making them clickable. */
export function safePaperUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? value
      : null;
  } catch {
    return null;
  }
}

export function paperReferenceInput(
  form: PaperReferenceForm & { targetJournal?: string; backupJournal?: string },
) {
  return {
    workingDate: form.workingDate || null,
    plannedHours: form.plannedHours ? Number(form.plannedHours) : null,
    manuscriptUrl: form.manuscriptUrl?.trim() || null,
    dataUrl: form.dataUrl?.trim() || null,
    otherFilesUrl: form.otherFilesUrl?.trim() || null,
    journalPublishers: savedJournalPublishers(
      form.journalPublishers ?? [],
      form.targetJournal ?? "",
      form.backupJournal ?? "",
    ),
  };
}
