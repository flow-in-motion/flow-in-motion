import { authenticatedJson } from "@/api/client";
import { buildResearchMindMaps } from "./research-export-maps";
import { researchExportTarget } from "./research-export-links";

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

  function recordName(record: ExportRecord): string {
    for (const field of [
      "short_title",
      "title",
      "name",
      "funding_body",
      "journal_name",
      "value",
    ]) {
      const value = record[field];
      if (typeof value === "string" && value.trim()) return value;
    }

    return "Untitled";
  }

  function textValue(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (Array.isArray(value)) return value.map(textValue).filter(Boolean).join(", ");
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }
    return "";
  }

  function reportDate(value: unknown): string {
    if (typeof value !== "string" || !value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      ...(value.length === 10 ? { timeZone: "UTC" } : {}),
    });
  }

  type ReportField = readonly [label: string, value: unknown];

  function renderFields(fields: ReportField[]): string {
    const visible = fields
      .map(([label, value]) => [label, textValue(value)] as const)
      .filter(([, value]) => value.trim());

    if (visible.length === 0) return "";

    return `
      <table class="record-details">
        <tbody>
          ${visible
            .map(
              ([label, value]) => `
                <tr>
                  <th scope="row">${escapeHtml(label)}</th>
                  <td>${escapeHtml(value)}</td>
                </tr>`,
            )
            .join("")}
        </tbody>
      </table>`;
  }

  function renderText(label: string, value: unknown): string {
    const text = textValue(value);
    if (!text.trim()) return "";

    return `
      <div class="text-block">
        <h4>${escapeHtml(label)}</h4>
        <p>${escapeHtml(text)}</p>
      </div>`;
  }
  function currentlyWithLabel(record: ExportRecord): string {
    const name = textValue(record.assigned_to_display_name).trim();

    switch (record.currently_with_type) {
      case "me":
        return "Me";
      case "collaborator":
        return name || "Collaborator";
      case "journal":
        return "Journal";
      case "friendly_reviewer":
        return "Friendly reviewer";
      case "others":
        return "Others";
      default:
        return name;
    }
  }

  function projectCollaboratorNames(record: ExportRecord): string {
    if (!Array.isArray(record.collaborators)) return "";

    return record.collaborators
      .map((value: unknown) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          return "";
        }

        const collaborator = value as ExportRecord;
        const name = textValue(collaborator.display_name).trim();
        const role = textValue(collaborator.role).trim();

        if (!name) return "";
        return role ? `${name} · ${role}` : name;
      })
      .filter(Boolean)
      .join("\n");
  }

  export function buildResearchExportHtml(data: ResearchDataExport): string {
    const collections = data.collections;
    const names = new Map<string, string>();
    const references = new Map<string, string>();

    for (const collection of [
      "projects",
      "papers",
      "tasks",
      "notes",
      "conferences",
      "fundings",
    ] as const) {
      for (const record of collections[collection]) {
        if (typeof record.id === "string") {
          names.set(record.id, recordName(record));
        }
      }
    }

    for (const record of collections.referenceValues) {
      if (typeof record.id === "string" && typeof record.value === "string") {
        references.set(record.id, record.value);
      }
    }

    function reference(value: unknown): string {
      return typeof value === "string" ? references.get(value) ?? "" : "";
    }

    function linkedName(value: unknown, fallback: string): string {
      if (typeof value !== "string" || !value) return "";
      return names.get(value) ?? fallback;
    }

    function linkedFields(record: ExportRecord): ReportField[] {
      return [
        ["Project", linkedName(record.project_id, "Linked project unavailable")],
        ["Paper", linkedName(record.module_id, "Linked paper unavailable")],
      ];
    }

    function history(
      record: ExportRecord,
      collection: "noteEntries" | "taskDescriptionEntries",
      parentField: "note_id" | "task_id",
    ): string {
      const entries = collections[collection]
        .filter((entry) => entry[parentField] === record.id)
        .slice()
        .sort((left, right) =>
          textValue(right.created_at).localeCompare(textValue(left.created_at)),
        );

      if (entries.length === 0) {
        return renderText(
          collection === "noteEntries" ? "Content" : "Description",
          collection === "noteEntries" ? record.content : record.description,
        );
      }

      return `
        <div class="history">
          <h4>${collection === "noteEntries" ? "Dated notes" : "Description history"}</h4>
          ${entries
            .map(
              (entry) => `
                <div class="history-entry">
                  <p class="entry-date">${escapeHtml(
                    reportDate(entry.created_at),
                  )}</p>
                  <p class="entry-content">${escapeHtml(textValue(entry.content))}</p>
                </div>`,
            )
            .join("")}
        </div>`;
    }

    function conferencePresentationHistory(paper: ExportRecord): string {
      const presentations = collections.conferencePapers
        .filter(
          (link) =>
            link.module_id === paper.id &&
            typeof link.presented_date === "string" &&
            link.presented_date.length > 0,
        )
        .slice()
        .sort((left, right) =>
          textValue(right.presented_date).localeCompare(
            textValue(left.presented_date),
          ),
        );

      if (presentations.length === 0) return "";

      return `
        <div class="history">
          <h4>Conference presentation history</h4>
          ${presentations
            .map((presentation) => {
              const conference = collections.conferences.find(
                (record) => record.id === presentation.conference_id,
              );

              return `
                <div class="history-entry">
                  <h5>${escapeHtml(
                    linkedName(
                      presentation.conference_id,
                      "Conference unavailable",
                    ),
                  )}</h5>
                  ${renderFields([
                    ["Presented", reportDate(presentation.presented_date)],
                    ["Presentation type", presentation.presentation_type],
                    ["Location", conference?.location],
                    ["Presented title", presentation.paper_title],
                  ])}
                  ${renderText("Presented abstract", presentation.abstract)}
                  ${renderText("Notes", presentation.notes)}
                </div>`;
            })
            .join("")}
        </div>`;
    }

    function submissionHistory(paper: ExportRecord): string {
      const submissions = collections.journalSubmissions
        .filter((submission) => submission.module_id === paper.id)
        .slice()
        .sort(
          (left, right) =>
            textValue(right.submitted_date).localeCompare(
              textValue(left.submitted_date),
            ) ||
            textValue(right.created_at).localeCompare(textValue(left.created_at)),
        );

      if (submissions.length === 0) return "";

      return `
        <div class="history">
          <h4>Journal submission history</h4>
          ${submissions
            .map(
              (submission) => `
                <div class="history-entry">
                  <h5>${escapeHtml(textValue(submission.journal_name) || "Journal submission")}</h5>
                  ${renderFields([
                    ["Submitted", reportDate(submission.submitted_date)],
                    ["Status", submission.status],
                    ["Paper title", submission.paper_title],
                    ["Revision rounds", submission.revision_rounds],
                    ["Decision date", reportDate(submission.decision_date)],
                  ])}
                  ${renderText("Notes", submission.notes)}
                </div>`,
            )
            .join("")}
        </div>`;
    }

    function relationshipNames(
      record: ExportRecord,
      linkCollection:
        | "conferenceProjects"
        | "conferencePapers"
        | "fundingProjects"
        | "fundingPapers"
        | "fundingNotes"
        | "fundingTasks",
      ownerField: "conference_id" | "funding_id",
      targetField: "project_id" | "module_id" | "note_id" | "task_id",
    ): string {
      return Array.from(
        new Set(
          collections[linkCollection]
            .filter((link) => link[ownerField] === record.id)
            .map((link) => linkedName(link[targetField], "Linked item unavailable"))
            .filter(Boolean),
        ),
      ).join(", ");
    }

    function renderRecord(collection: ExportCollection, record: ExportRecord) {
      let fields: ReportField[] = [];
      let content = "";

      switch (collection) {
        case "projects":
          fields = [
            ["Status", reference(record.status_id)],
            ["Importance", reference(record.importance_id)],
            ["Research area", record.research_area],
            ["Scheduled for", reportDate(record.scheduled_for)],
            ["Due date", reportDate(record.due_date)],
            ["Total budget", record.total_budget],
            ["Target journals", record.target_journals],
          ];
          content =
            renderText("Description", record.description) +
            renderText("Collaborators", projectCollaboratorNames(record));
          break;

        case "papers":
          fields = [
            ["Full title", record.title !== record.short_title ? record.title : ""],
            ["Project", linkedName(record.project_id, "Linked project unavailable")],
            ["Status", reference(record.status_id)],
            ["Stage", reference(record.pipeline_stage_id)],
            ["Currently with", currentlyWithLabel(record)],
            ["Priority", reference(record.priority_id)],
            ["Next action date", reportDate(record.due_date)],
            ["Target journals", record.target_journal],
            ["Backup journals", record.backup_journal],
            ["Target conferences", record.target_conference],
            ["Backup conferences", record.backup_conference],
          ];
          content =
            renderText("Description", record.description) +
            renderText("Abstract", record.abstract) +
            submissionHistory(record) +
            conferencePresentationHistory(record);
          break;

        case "tasks":
          fields = [
            ...linkedFields(record),
            ["Status", reference(record.status_id)],
            ["Priority", reference(record.priority_id)],
            ["Due date", reportDate(record.due_date)],
            ["Estimated hours", record.estimated_hours],
            ["Visibility", reference(record.visibility_id)],
          ];
          content = history(record, "taskDescriptionEntries", "task_id");
          break;

        case "notes":
          fields = [
            ...linkedFields(record),
            ["Follow-up date", reportDate(record.follow_up_date)],
            ["Visibility", reference(record.visibility_id)],
          ];
          content = history(record, "noteEntries", "note_id");
          break;

        case "conferences":
          fields = [
            ["Acronym", record.acronym],
            ["Location", record.location],
            ["Submission deadline", reportDate(record.submission_due)],
            ["Start date", reportDate(record.start_date)],
            ["End date", reportDate(record.end_date)],
            ["Submission type", record.submission_type],
            ["Intent", record.intents],
            [
              "Projects",
              relationshipNames(
                record, "conferenceProjects", "conference_id", "project_id",
              ),
            ],
            [
              "Papers",
              relationshipNames(
                record, "conferencePapers", "conference_id", "module_id",
              ),
            ],
          ];
          content = renderText("Notes / abstract", record.notes);
          break;

        case "fundings":
          fields = [
            ["Scheme", record.scheme],
            ["Partners", record.partners],
            [
              "Amount",
              [textValue(record.amount), textValue(record.currency)]
                .filter(Boolean)
                .join(" "),
            ],
            ["Status", record.status],
            ["Application deadline", reportDate(record.application_deadline)],
            ["Follow-up date", reportDate(record.follow_up_date)],
            [
              "Projects",
              relationshipNames(
                record, "fundingProjects", "funding_id", "project_id",
              ),
            ],
            [
              "Papers",
              relationshipNames(
                record, "fundingPapers", "funding_id", "module_id",
              ),
            ],
            [
              "Notes",
              relationshipNames(
                record, "fundingNotes", "funding_id", "note_id",
              ),
            ],
            [
              "Tasks",
              relationshipNames(
                record, "fundingTasks", "funding_id", "task_id",
              ),
            ],
          ];
          content = renderText("Notes", record.notes);
          break;

        case "calendarEvents":
          fields = [["Date", reportDate(record.event_date)]];
          break;
      }
      const target = researchExportTarget(collection, record.id);

      return `
        <article class="record"${target ? ` id="${escapeHtml(target)}"` : ""}>
          <header class="record-heading">
            <h3>${escapeHtml(recordName(record))}</h3>
            ${record.archived_at ? '<span class="archived">Archived</span>' : ""}
          </header>
          ${renderFields(fields)}
          ${content}
        </article>`;
    }

    const reportSections = [
      ["projects", "Projects"],
      ["papers", "Papers"],
      ["tasks", "Tasks"],
      ["notes", "Notes"],
      ["conferences", "Conferences"],
      ["fundings", "Funding"],
      ["calendarEvents", "Calendar events"],
    ] as const;

    const populatedSections = reportSections.filter(
      ([collection]) => collections[collection].length > 0,
    );

    const summary = populatedSections
      .map(
        ([collection, label]) => `
          <div class="summary-item">
            <strong>${collections[collection].length}</strong>
            <span>${escapeHtml(label)}</span>
          </div>`,
      )
      .join("");

    const sections = populatedSections
      .map(
        ([collection, label]) => `
          <section class="report-section">
            <h2>${escapeHtml(label)}
              <span class="section-count">${collections[collection].length}</span>
            </h2>
            ${collections[collection]
              .map((record) => renderRecord(collection, record))
              .join("")}
          </section>`,
      )
      .join("");

    const mindMaps = buildResearchMindMaps(data);
    return `<!doctype html>
  <html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(exportFilename(data, "pdf"))}</title>
    <style>
    @page {
  size: A4;
  margin: 19mm 17mm;
}

* {
  box-sizing: border-box;
}

body {
  max-width: 900px;
  margin: 0 auto;
  padding: 32px;
  background: #fff;
  color: #202838;
  font: 10.5pt/1.55 Arial, sans-serif;
}

h1, h2, h3, h4, h5 {
  break-after: avoid;
  page-break-after: avoid;
}

h1 {
  margin: 10px 0;
  font-size: 27pt;
  line-height: 1.2;
}

h2 {
  margin: 28px 0 18px;
  padding-bottom: 8px;
  border-bottom: 2px solid #ddd6fe;
  font-size: 18pt;
}

h3 {
  margin: 0;
  font-size: 14pt;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

h4 {
  margin: 16px 0 7px;
  color: #475569;
  font-size: 9pt;
  letter-spacing: 0.4px;
  text-transform: uppercase;
}

h5 {
  margin: 0 0 7px;
  font-size: 10.5pt;
}

p {
  margin: 0 0 8px;
  orphans: 3;
  widows: 3;
}

a {
  color: inherit;
}

.report-header {
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 3px solid #6d28d9;
}

.brand {
  color: #6d28d9;
  font-size: 9pt;
  font-weight: bold;
  letter-spacing: 2px;
  text-transform: uppercase;
}

.muted,
.entry-date {
  color: #64748b;
}

.summary {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.summary-item {
  min-width: 100px;
  padding: 10px 14px;
  border: 1px solid #dce1e8;
  border-radius: 7px;
  break-inside: avoid;
}

.summary-item strong {
  display: block;
  font-size: 20pt;
}

.summary-item span {
  color: #64748b;
  font-size: 9pt;
}

.section-count {
  margin-left: 8px;
  color: #64748b;
  font-size: 10pt;
  font-weight: normal;
}

.record {
  margin-bottom: 24px;
  padding-bottom: 18px;
  border-bottom: 1px solid #e2e8f0;
}

.record-heading {
  margin-bottom: 10px;
  break-inside: avoid;
  break-after: avoid;
  page-break-inside: avoid;
  page-break-after: avoid;
}

.archived {
  display: inline-block;
  margin-top: 5px;
  padding: 1px 6px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  color: #64748b;
  font-size: 8pt;
}

.record-details {
  width: 100%;
  margin: 8px 0 14px;
  table-layout: fixed;
  border-collapse: collapse;
}

.record-details th,
.record-details td {
  padding: 6px 0;
  border-bottom: 1px solid #edf0f4;
  text-align: left;
  vertical-align: top;
  overflow-wrap: anywhere;
}

.record-details th {
  width: 30%;
  padding-right: 18px;
  color: #64748b;
  font-size: 9pt;
  font-weight: normal;
}

.record-details td {
  white-space: pre-wrap;
}

.record-details tr:last-child th,
.record-details tr:last-child td {
  border-bottom: 0;
}

.text-block,
.history {
  margin-top: 16px;
}

.text-block p,
.entry-content {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.history-entry {
  margin: 14px 0;
  padding-left: 12px;
  border-left: 2px solid #ddd6fe;
}

.entry-date {
  margin-bottom: 5px;
  font-size: 9pt;
  break-after: avoid;
}

.toolbar {
  margin-bottom: 24px;
  padding: 12px;
  background: #f1f5f9;
}

.export-maps {
  margin-top: 28px;
}

.export-map-tree {
  margin: 16px 0 24px;
}

.export-map-sheet {
  margin: 20px 0;
}

.export-map-tree figcaption,
.export-map-sheet figcaption {
  margin-bottom: 12px;
  color: #475569;
  overflow-wrap: anywhere;
  break-after: avoid;
}

.export-map-sheet svg {
  display: block;
  width: 100%;
  height: auto;
}

.export-tree ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.export-tree li {
  position: relative;
  padding-top: 6px;
}

.export-tree li > ul {
  margin-left: 18px;
  padding-left: 24px;
}

.export-tree li > ul > li::before {
  content: "";
  position: absolute;
  left: -24px;
  top: 0;
  bottom: 0;
  border-left: 1.5px solid #cbd5e1;
}

.export-tree li > ul > li:last-child::before {
  bottom: auto;
  height: 25px;
}

.export-tree li > ul > li::after {
  content: "";
  position: absolute;
  left: -24px;
  top: 25px;
  width: 24px;
  border-top: 1.5px solid #cbd5e1;
}

.export-tree-roots > li + li {
  margin-top: 12px;
}

.export-tree-node {
  display: grid;
  grid-template-columns: 65px minmax(0, 1fr);
  align-items: start;
  gap: 12px;
  padding: 7px 10px;
  border: 1px solid #e2e8f0;
  border-left: 4px solid var(--node-colour);
  border-radius: 7px;
  background: #fff;
  break-inside: avoid;
  page-break-inside: avoid;
}

.export-tree-roots > li > .export-tree-node {
  background: #f8fafc;
}

.export-tree-type {
  display: inline-block;
  padding: 2px 5px;
  border-radius: 4px;
  background: var(--node-background);
  color: var(--node-colour);
  font-size: 8pt;
  font-weight: bold;
  text-align: center;
}

.export-tree-node strong {
  font-size: 10pt;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.export-tree a {
  text-decoration: none;
}

.export-tree a:hover {
  text-decoration: underline;
}

@media print {
  body {
    max-width: none;
    padding: 0;
  }

  .toolbar {
    display: none;
  }

  .report-section + .report-section,
  .export-maps,
  .export-bubble-maps,
  .export-map-sheet + .export-map-sheet {
    break-before: page;
  }

  .record,
  .record-details,
  .record-details tbody,
  .history,
  .history-entry,
  .export-map-tree,
  .export-tree ul,
  .export-tree li {
    break-inside: auto;
  }

  .record-details tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .export-map-sheet svg {
    max-height: 215mm;
  }
}
  </style>
  </head>
  <body>
    <div class="toolbar">
      Use your browser’s Print command and choose “Save as PDF”.
    </div>
    <header class="report-header">
      <p class="brand">Flow in Motion</p>
      <h1>Your research</h1>
      <p class="muted">Exported ${escapeHtml(reportDate(data.exportedAt))}</p>
      <p class="muted">
        Accessible research across your workspaces, including retained archived
        records. Archived projects and papers are marked.
      </p>
    </header>
    <div class="summary">${summary}</div>
    ${sections || '<p>No research records to export yet.</p>'}
    ${mindMaps}
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
