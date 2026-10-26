export type ExportValue =
  string | number | boolean | null | ExportRecord | ExportValue[];

export interface ExportRecord {
  [key: string]: ExportValue;
}

export const EXPORT_COLLECTIONS = [
  'projects',
  'papers',
  'tasks',
  'taskDescriptionEntries',
  'notes',
  'noteEntries',
  'journalSubmissions',
  'conferences',
  'conferenceProjects',
  'conferencePapers',
  'fundings',
  'fundingProjects',
  'fundingPapers',
  'fundingNotes',
  'fundingTasks',
  'calendarEvents',
  'referenceValues',
] as const;

export type ExportCollection = (typeof EXPORT_COLLECTIONS)[number];

export type ExportCollections = Record<ExportCollection, ExportRecord[]>;

export interface ResearchDataExport {
  formatVersion: 1;
  exportedAt: string;
  scope: 'accessible-research-data';
  includesRetainedArchivedRecords: true;
  collections: ExportCollections;
  counts: Record<ExportCollection, number>;
}
