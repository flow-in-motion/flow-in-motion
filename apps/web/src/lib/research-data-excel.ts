import type ExcelJS from "exceljs";

import type {
  ExportCollection,
  ExportRecord,
  ResearchDataExport,
} from "./research-data-export";

type LinkValue = {
  collection: ExportCollection;
  id: string;
  text: string;
};

type Value = string | number | boolean | Date | LinkValue | null;

interface Column {
  label: string;
  width: number;
  value: (record: ExportRecord) => Value;
}

interface SheetDefinition {
  collection?: ExportCollection;
  name: string;
  records: ExportRecord[];
  columns: Column[];
}

interface PreparedRecord {
  record: ExportRecord;
  values: Value[][];
  row: number;
}

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(", ");
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return "";
}

function recordTitle(record: ExportRecord): string {
  return (
    text(record.short_title) ||
    text(record.title) ||
    text(record.name) ||
    text(record.funding_body) ||
    text(record.journal_name) ||
    "Untitled"
  );
}

function dateValue(value: unknown): Date | null {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function numericValue(value: unknown): number | string | null {
  if (value === null || value === undefined || value === "") return null;

  const number = Number(value);
  return Number.isFinite(number) ? number : text(value);
}

function collaboratorNames(record: ExportRecord): string {
  if (!Array.isArray(record.collaborators)) return "";

  return record.collaborators
    .map((value: unknown) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return "";
      const collaborator = value as ExportRecord;
      const name = text(collaborator.display_name);
      const role = text(collaborator.role);

      return name ? `${name}${role ? ` (${role})` : ""}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

function currentlyWith(record: ExportRecord): string {
  const name = text(record.assigned_to_display_name);

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

/**
 * Keep long content readable without exceeding Excel's cell/row limits.
 * Continuation rows preserve all characters, including line breaks.
 */
function splitText(value: string): string[] {
  const parts: string[] = [];
  let part = "";
  let newlines = 0;

  for (const character of value) {
    if (
      part &&
      (part.length + character.length > 250 ||
        (character === "\n" && newlines >= 8))
    ) {
      parts.push(part);
      part = "";
      newlines = 0;
    }

    part += character;
    if (character === "\n") newlines += 1;
  }

  if (part || parts.length === 0) parts.push(part);
  return parts;
}

function isLink(value: Value): value is LinkValue {
  return typeof value === "object" && value !== null && !(value instanceof Date);
}

function splitValue(value: Value): Value[] {
  if (typeof value === "string") return splitText(value);

  if (isLink(value)) {
    return splitText(value.text).map((part) => ({ ...value, text: part }));
  }

  return [value];
}

function targetKey(collection: ExportCollection, id: string): string {
  return JSON.stringify([collection, id]);
}

export async function buildResearchExcel(data: ResearchDataExport) {
  const { default: Excel } = await import("exceljs");
  const workbook = new Excel.Workbook();

  workbook.creator = "Flow in Motion";
  workbook.created = new Date(data.exportedAt);
  workbook.modified = new Date(data.exportedAt);

  const recordsByKey = new Map<string, ExportRecord>();

  for (const collection of Object.keys(data.collections) as ExportCollection[]) {
    for (const record of data.collections[collection]) {
      if (typeof record.id === "string") {
        recordsByKey.set(targetKey(collection, record.id), record);
      }
    }
  }

  function link(collection: ExportCollection, id: unknown): Value {
    if (typeof id !== "string" || !id) return "";

    const record = recordsByKey.get(targetKey(collection, id));
    if (!record) return "Linked record unavailable";

    return { collection, id, text: recordTitle(record) };
  }

  function reference(value: unknown): string {
    if (typeof value !== "string") return "";
    return text(recordsByKey.get(targetKey("referenceValues", value))?.value);
  }

  function field(label: string, key: string, width = 32): Column {
    return { label, width, value: (record) => text(record[key]) };
  }

  function date(label: string, key: string): Column {
    return { label, width: 18, value: (record) => dateValue(record[key]) };
  }

  function ref(label: string, key: string): Column {
    return { label, width: 28, value: (record) => reference(record[key]) };
  }

  function parent(
    label: string,
    collection: ExportCollection,
    key: string,
  ): Column {
    return { label, width: 38, value: (record) => link(collection, record[key]) };
  }

  const name: Column = {
    label: "Name",
    width: 42,
    value: recordTitle,
  };

  const archived: Column = {
    label: "Archived",
    width: 14,
    value: (record) => (record.archived_at ? "Yes" : "No"),
  };

  const definitions: SheetDefinition[] = [
    {
      collection: "projects",
      name: "Projects",
      records: data.collections.projects,
      columns: [
        name,
        ref("Status", "status_id"),
        ref("Importance", "importance_id"),
        field("Research area", "research_area"),
        field("Description", "description", 65),
        date("Scheduled for", "scheduled_for"),
        date("Due date", "due_date"),
        {
          label: "Total budget",
          width: 20,
          value: (record) => numericValue(record.total_budget),
        },
        field("Target journals", "target_journals", 45),
        { label: "Collaborators", width: 45, value: collaboratorNames },
        archived,
      ],
    },
    {
      collection: "papers",
      name: "Papers",
      records: data.collections.papers,
      columns: [
        name,
        field("Full title", "title", 55),
        parent("Project", "projects", "project_id"),
        ref("Status", "status_id"),
        ref("Stage", "pipeline_stage_id"),
        { label: "Currently with", width: 32, value: currentlyWith },
        ref("Priority", "priority_id"),
        date("Next action date", "due_date"),
        field("Description", "description", 65),
        field("Abstract", "abstract", 65),
        field("Target journals", "target_journal", 40),
        field("Backup journals", "backup_journal", 40),
        field("Target conferences", "target_conference", 40),
        field("Backup conferences", "backup_conference", 40),
        archived,
      ],
    },
    {
      collection: "tasks",
      name: "Tasks",
      records: data.collections.tasks,
      columns: [
        name,
        parent("Project", "projects", "project_id"),
        parent("Paper", "papers", "module_id"),
        ref("Status", "status_id"),
        ref("Priority", "priority_id"),
        date("Due date", "due_date"),
        {
          label: "Estimated hours",
          width: 20,
          value: (record) => numericValue(record.estimated_hours),
        },
        ref("Visibility", "visibility_id"),
        field("Description", "description", 65),
      ],
    },
    {
      collection: "notes",
      name: "Notes",
      records: data.collections.notes,
      columns: [
        name,
        parent("Project", "projects", "project_id"),
        parent("Paper", "papers", "module_id"),
        date("Follow-up date", "follow_up_date"),
        ref("Visibility", "visibility_id"),
        field("Content", "content", 65),
      ],
    },
    {
      collection: "conferences",
      name: "Conferences",
      records: data.collections.conferences,
      columns: [
        name,
        field("Acronym", "acronym"),
        field("Location", "location"),
        date("Submission deadline", "submission_due"),
        date("Start date", "start_date"),
        date("End date", "end_date"),
        field("Submission type", "submission_type"),
        field("Intent", "intents"),
        field("Notes / abstract", "notes", 75),
        field("Website", "website_url", 55),
      ],
    },
    {
      collection: "fundings",
      name: "Funding",
      records: data.collections.fundings,
      columns: [
        name,
        field("Scheme", "scheme"),
        field("Partners", "partners", 45),
        {
          label: "Amount",
          width: 20,
          value: (record) => numericValue(record.amount),
        },
        field("Currency", "currency", 14),
        field("Status", "status"),
        date("Application deadline", "application_deadline"),
        date("Follow-up date", "follow_up_date"),
        field("Notes", "notes", 65),
      ],
    },
    {
      collection: "calendarEvents",
      name: "Calendar",
      records: data.collections.calendarEvents,
      columns: [name, date("Date", "event_date")],
    },
    {
      collection: "noteEntries",
      name: "Note history",
      records: data.collections.noteEntries,
      columns: [
        parent("Note", "notes", "note_id"),
        date("Entry date", "created_at"),
        date("Last edited", "updated_at"),
        field("Content", "content", 75),
      ],
    },
    {
      collection: "taskDescriptionEntries",
      name: "Task history",
      records: data.collections.taskDescriptionEntries,
      columns: [
        parent("Task", "tasks", "task_id"),
        date("Entry date", "created_at"),
        date("Last edited", "updated_at"),
        field("Content", "content", 75),
      ],
    },
    {
      collection: "conferencePapers",
      name: "Conference presentations",
      records: data.collections.conferencePapers.filter(
        (record) =>
          typeof record.presented_date === "string" &&
          record.presented_date.length > 0,
      ),
      columns: [
        parent("Paper", "papers", "module_id"),
        parent("Conference", "conferences", "conference_id"),
        date("Presented", "presented_date"),
        field("Presentation type", "presentation_type"),
        field("Presented title", "paper_title", 55),
        field("Presented abstract", "abstract", 75),
        field("Notes", "notes", 65),
      ],
    },
    {
      collection: "journalSubmissions",
      name: "Journal submissions",
      records: data.collections.journalSubmissions,
      columns: [
        parent("Paper", "papers", "module_id"),
        field("Journal", "journal_name", 40),
        field("Submitted title", "paper_title", 55),
        date("Submitted", "submitted_date"),
        field("Status", "status"),
        {
          label: "Revision rounds",
          width: 20,
          value: (record) => numericValue(record.revision_rounds),
        },
        date("Decision date", "decision_date"),
        field("Notes", "notes", 65),
      ],
    },
  ];

  const connections: ExportRecord[] = [];

  function connect(
    sourceCollection: ExportCollection,
    sourceId: unknown,
    targetCollection: ExportCollection,
    targetId: unknown,
  ) {
    if (typeof sourceId !== "string" || typeof targetId !== "string") return;

    if (
      !recordsByKey.has(targetKey(sourceCollection, sourceId)) ||
      !recordsByKey.has(targetKey(targetCollection, targetId))
    ) {
      return;
    }

    connections.push({
      source_collection: sourceCollection,
      source_id: sourceId,
      target_collection: targetCollection,
      target_id: targetId,
    });
  }

  for (const paper of data.collections.papers) {
    connect("projects", paper.project_id, "papers", paper.id);
  }

  for (const collection of ["tasks", "notes"] as const) {
    for (const record of data.collections[collection]) {
      connect("projects", record.project_id, collection, record.id);
      connect("papers", record.module_id, collection, record.id);
    }
  }

  for (const [collection, source, sourceKey, target, targetField] of [
    ["conferenceProjects", "conferences", "conference_id", "projects", "project_id"],
    ["conferencePapers", "conferences", "conference_id", "papers", "module_id"],
    ["fundingProjects", "fundings", "funding_id", "projects", "project_id"],
    ["fundingPapers", "fundings", "funding_id", "papers", "module_id"],
    ["fundingNotes", "fundings", "funding_id", "notes", "note_id"],
    ["fundingTasks", "fundings", "funding_id", "tasks", "task_id"],
  ] as const) {
    for (const record of data.collections[collection]) {
      connect(source, record[sourceKey], target, record[targetField]);
    }
  }

  const collectionLabels = new Map(
    definitions.map((definition) => [definition.collection, definition.name]),
  );

  definitions.push({
    name: "Connections",
    records: connections,
    columns: [
      {
        label: "From type",
        width: 22,
        value: (record) =>
          collectionLabels.get(record.source_collection as ExportCollection) ?? "",
      },
      {
        label: "From",
        width: 42,
        value: (record) =>
          link(record.source_collection as ExportCollection, record.source_id),
      },
      {
        label: "To type",
        width: 22,
        value: (record) =>
          collectionLabels.get(record.target_collection as ExportCollection) ?? "",
      },
      {
        label: "To",
        width: 42,
        value: (record) =>
          link(record.target_collection as ExportCollection, record.target_id),
      },
    ],
  });

  // Reserve destinations before writing links, including continuation rows.
  const targets = new Map<string, { sheet: string; row: number }>();
  const prepared = new Map<SheetDefinition, PreparedRecord[]>();

  for (const definition of definitions) {
    let nextRow = 4;

    const records = definition.records.map((record) => {
      const values = definition.columns.map((column) =>
        splitValue(column.value(record)),
      );

      const row = nextRow;
      nextRow += Math.max(1, ...values.map((parts) => parts.length));

      if (definition.collection && typeof record.id === "string") {
        targets.set(targetKey(definition.collection, record.id), {
          sheet: definition.name,
          row,
        });
      }

      return { record, values, row };
    });

    if (nextRow > 1_048_577) {
      throw new Error(`The ${definition.name} export exceeds Excel's row limit.`);
    }

    prepared.set(definition, records);
  }

  const overview = workbook.addWorksheet("Overview");
  overview.columns = [{ width: 34 }, { width: 28 }];
  overview.addRow(["Your research", "Flow in Motion"]);
  overview.addRow(["Exported", new Date(data.exportedAt)]);
  overview.getCell("B2").numFmt = "dd mmm yyyy hh:mm";
  overview.addRow(["Sheet", "Records"]);

  function setValue(cell: ExcelJS.Cell, value: Value) {
    if (!isLink(value)) {
      cell.value = value;
      if (value instanceof Date) cell.numFmt = "dd mmm yyyy";
      return;
    }

    const target = targets.get(targetKey(value.collection, value.id));
    if (!target) {
      cell.value = value.text;
      return;
    }

    cell.value = {
      text: value.text,
      hyperlink: `#'${target.sheet}'!B${target.row}`,
      tooltip: "Open linked record",
    };
    cell.font = {
      name: "Calibri",
      size: 11,
      color: { argb: "FF6D28D9" },
      underline: true,
    };
  }

  for (const definition of definitions) {
    const sheet = workbook.addWorksheet(definition.name);

    // Hidden keys keep technical identifiers out of the user-facing columns.
    sheet.columns = [
      { width: 18, hidden: true },
      ...definition.columns.map((column) => ({ width: column.width })),
    ];

    sheet.getCell("B1").value = {
      text: "Back to overview",
      hyperlink: "#'Overview'!A1",
    };
    sheet.getCell("B2").value = definition.name;

    sheet.getRow(3).values = [
      "Internal key",
      ...definition.columns.map((column) => column.label),
    ];

    for (const item of prepared.get(definition) ?? []) {
      const partCount = Math.max(
        1,
        ...item.values.map((parts) => parts.length),
      );

      for (let part = 0; part < partCount; part += 1) {
        const row = sheet.getRow(item.row + part);
        row.font = { name: "Calibri", size: 11 };
        row.alignment = { vertical: "top", wrapText: true };

        if (part === 0) row.getCell(1).value = text(item.record.id);

        let lineCount = 1;

        definition.columns.forEach((column, index) => {
          const value = item.values[index][part] ?? null;
          const cell = row.getCell(index + 2);
          setValue(cell, value);

          const visibleText = isLink(value) ? value.text : text(value);
          const lines = visibleText.split("\n").reduce(
            (sum, line) =>
              sum + Math.max(1, Math.ceil(line.length / (column.width - 3))),
            0,
          );

          lineCount = Math.max(lineCount, lines);
        });

        row.height = Math.max(24, lineCount * 15 + 8);

        if (part % 2 === 1) {
          row.eachCell((cell) => {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF8FAFC" },
            };
          });
        }
      }
    }

    sheet.views = [{ state: "frozen", ySplit: 3, xSplit: 2 }];
    sheet.autoFilter = {
      from: { row: 3, column: 1 },
      to: {
        row: Math.max(3, sheet.rowCount),
        column: definition.columns.length + 1,
      },
    };

    const header = sheet.getRow(3);
    header.height = 32;
    header.font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    header.alignment = { vertical: "middle", wrapText: true };
    header.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF5B21B6" },
      };
    });

    sheet.getCell("B2").font = {
      name: "Calibri",
      size: 16,
      bold: true,
    };

    overview.addRow([
      { text: definition.name, hyperlink: `#'${definition.name}'!B3` },
      definition.records.length,
    ]);
  }

  overview.views = [{ state: "frozen", ySplit: 3 }];
  overview.getRow(1).font = { name: "Calibri", size: 18, bold: true };
  overview.getRow(1).height = 30;
  overview.getRow(3).font = { name: "Calibri", size: 11, bold: true };

  overview.addRow([]);
  overview.addRow([
    "Long content",
    "Continues on following rows. Record counts exclude continuation rows.",
  ]);
  overview.addRow([
    "Connections",
    "Open the Connections sheet to navigate between related records.",
  ]);
  overview.getColumn(2).alignment = { wrapText: true, vertical: "top" };
  overview.getRow(overview.rowCount - 1).height = 58;
  overview.getRow(overview.rowCount).height = 58;

  return workbook;
}

export async function downloadResearchDataExcel(
  data: ResearchDataExport,
  signal?: AbortSignal,
): Promise<void> {
  const workbook = await buildResearchExcel(data);
  if (signal?.aborted) return;

  const buffer = await workbook.xlsx.writeBuffer();
  if (signal?.aborted) return;

  const bytes = new Uint8Array(buffer);
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download =
    `flow-in-motion-research-data-${data.exportedAt.slice(0, 10)}.xlsx`;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
