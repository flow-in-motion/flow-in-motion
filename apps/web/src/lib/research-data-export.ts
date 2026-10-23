import { authenticatedJson } from "@/api/client";

export const EXPORT_COLLECTION_LABELS = {
  projects: "Projects",
  papers: "Papers",
  tasks: "Tasks",
  taskDescriptionEntries: "Task description history",
  notes: "Notes",
  noteEntries: "Dated note history",
  journalSubmissions: "Journal submission history",
  conferences: "Conferences",
  conferenceProjects: "Conference–project links",
  conferencePapers: "Conference–paper links",
  fundings: "Funding",
  fundingProjects: "Funding–project links",
  fundingPapers: "Funding–paper links",
  fundingNotes: "Funding–note links",
  fundingTasks: "Funding–task links",
  calendarEvents: "Calendar events",
  referenceValues: "Status, priority, and stage definitions",
} as const;

export type ExportCollection = keyof typeof EXPORT_COLLECTION_LABELS;
export type ExportRecord = Record<string, unknown>;

export interface ResearchDataExport {
  formatVersion: 1;
  exportedAt: string;
  scope: "accessible-research-data";
  includesRetainedArchivedRecords: true;
  collections: Record<ExportCollection, ExportRecord[]>;
  counts: Record<ExportCollection, number>;
}

const collectionNames = Object.keys(
  EXPORT_COLLECTION_LABELS,
) as ExportCollection[];

export async function fetchResearchDataExport(
    signal?: AbortSignal,
  ): Promise<ResearchDataExport> {
    const data = await authenticatedJson<ResearchDataExport>(
      "/api/v1/me/data-export",
      { signal },
    );

  if (
    data?.formatVersion !== 1 ||
    data.scope !== "accessible-research-data" ||
    !data.collections ||
    !data.counts ||
    Number.isNaN(Date.parse(data.exportedAt))
  ) {
    throw new Error("The export response was invalid. Please try again.");
  }

  for (const collection of collectionNames) {
    const rows = data.collections[collection];

    if (
      !Array.isArray(rows) ||
      rows.length !== data.counts[collection]
    ) {
      throw new Error(
        "The export was incomplete. Please try again before saving it.",
      );
    }
  }

  return data;
}

function exportFilename(data: ResearchDataExport, extension: string) {
  const date = new Date(data.exportedAt).toISOString().slice(0, 10);
  return `flow-in-motion-research-data-${date}.${extension}`;
}

export function downloadResearchDataJson(data: ResearchDataExport) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = exportFilename(data, "json");
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Allow the browser time to start reading the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function escapeHtml(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

function recordName(record: ExportRecord) {
  for (const field of [
    "short_title",
    "title",
    "name",
    "funding_body",
    "journal_name",
    "value",
    "display_id",
    "id",
  ]) {
    const value = record[field];
    if (typeof value === "string" && value.trim()) return value;
  }

  return "Record";
}

function fieldLabel(field: string) {
    return field
      .replace(/_/g, " ")
      .replace(/^\w/, (letter: string) => letter.toUpperCase());
  }

function displayValue(value: unknown) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

export function buildResearchExportHtml(data: ResearchDataExport): string {
  const namesById = new Map<string, string>();

  for (const collection of collectionNames) {
    for (const record of data.collections[collection]) {
      if (typeof record.id === "string") {
        namesById.set(record.id, recordName(record));
      }
    }
  }

  function readableValue(field: string, value: unknown) {
    if (
      field.endsWith("_id") &&
      typeof value === "string" &&
      namesById.has(value)
    ) {
      return `${namesById.get(value)} (${value})`;
    }

    return displayValue(value);
  }

  const summary = collectionNames
    .map(
      (collection) => `
        <tr>
          <td>${escapeHtml(EXPORT_COLLECTION_LABELS[collection])}</td>
          <td>${data.counts[collection]}</td>
        </tr>
      `,
    )
    .join("");

  const sections = collectionNames
    .map((collection) => {
      const records = data.collections[collection]
        .map((record, index) => {
          const fields = Object.entries(record)
            .map(
              ([field, value]) => `
                <div class="field">
                  <dt>${escapeHtml(fieldLabel(field))}</dt>
                  <dd>${escapeHtml(readableValue(field, value))}</dd>
                </div>
              `,
            )
            .join("");

          return `
            <article>
              <h3>${index + 1}. ${escapeHtml(recordName(record))}</h3>
              <dl>${fields}</dl>
            </article>
          `;
        })
        .join("");

      return `
        <section>
          <h2>
            ${escapeHtml(EXPORT_COLLECTION_LABELS[collection])}
            (${data.counts[collection]})
          </h2>
          ${records || "<p>No records.</p>"}
        </section>
      `;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(exportFilename(data, "pdf"))}</title>
  <style>
    @page { size: A4; margin: 16mm; }
    * { box-sizing: border-box; }
    body {
      max-width: 900px;
      margin: 0 auto;
      padding: 24px;
      color: #172033;
      background: white;
      font: 10pt/1.5 Arial, sans-serif;
    }
    h1 { font-size: 24pt; margin-bottom: 8px; }
    h2 {
      font-size: 16pt;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 6px;
      margin-top: 28px;
    }
    h3 { font-size: 12pt; margin-bottom: 10px; }
    h1, h2, h3 { break-after: avoid; }
    article { margin: 18px 0 24px; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; }
    td:last-child { text-align: right; }
    dl { margin: 0; }
    .field { margin-bottom: 9px; }
    dt { font-weight: bold; color: #475569; }
    dd {
      margin: 2px 0 0;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .intro { color: #475569; }
    .toolbar {
      padding: 12px;
      margin-bottom: 24px;
      background: #f1f5f9;
    }
    button { padding: 8px 14px; cursor: pointer; }
    @media print {
      body { max-width: none; padding: 0; }
      .toolbar { display: none; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    Use your browser’s Print command and choose “Save as PDF”.
  </div>
  <h1>Research data export</h1>
  <p class="intro">
    Exported: ${escapeHtml(data.exportedAt)}<br>
    Includes accessible research records across workspaces and retained
    archived records. Permanently deleted records are unavailable.
  </p>
  <h2>Export contents</h2>
  <table><tbody>${summary}</tbody></table>
  ${sections}
</body>
</html>`;
}

export async function printResearchData(
  data: ResearchDataExport,
  preview: Window,
): Promise<void> {
  if (preview.closed) {
    throw new Error("The PDF preview was closed. Please try again.");
  }

  preview.document.open();
  preview.document.write(buildResearchExportHtml(data));
  preview.document.close();

  if (preview.document.fonts) {
    await preview.document.fonts.ready;
  }

  if (!preview.closed) {
    preview.focus();
    preview.print();
  }
}
