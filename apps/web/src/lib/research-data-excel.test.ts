import { describe, expect, it } from "vitest";

import { buildResearchExcel } from "./research-data-excel";
import type {
  ExportCollection,
  ResearchDataExport,
} from "./research-data-export";

function makeExport(): ResearchDataExport {
  const collections: ResearchDataExport["collections"] = {
    projects: [{
      id: "project-1",
      title: "Genome project",
      collaborators: [{ display_name: "Sam Coauthor", role: "Editor" }],
    }],
    papers: [{
      id: "paper-1",
      project_id: "project-1",
      short_title: "Genome manuscript",
      currently_with_type: "collaborator",
      assigned_to_display_name: "Sam Coauthor",
    }],
    tasks: [{
      id: "task-1",
      module_id: "paper-1",
      title: "Prepare manuscript",
    }],
    taskDescriptionEntries: [],
    notes: [{
      id: "note-1",
      module_id: "paper-1",
      title: "Research notes",
    }],
    noteEntries: [{
      id: "entry-1",
      note_id: "note-1",
      content: "Original findings",
      created_at: "2026-10-26T00:00:00.000Z",
    }],
    journalSubmissions: [{
      id: "submission-1",
      module_id: "paper-1",
      journal_name: "Nature",
      submitted_date: "2026-10-26",
    }],
    conferences: [{
      id: "conference-1",
      name: "Research conference",
    }],
    conferenceProjects: [],
    conferencePapers: [{
      id: "conference-link-1",
      conference_id: "conference-1",
      module_id: "paper-1",
    }],
    fundings: [{
      id: "funding-1",
      funding_body: "Research fund",
    }],
    fundingProjects: [],
    fundingPapers: [],
    fundingNotes: [],
    fundingTasks: [{
      id: "funding-link-1",
      funding_id: "funding-1",
      task_id: "task-1",
    }],
    calendarEvents: [],
    referenceValues: [],
  };

  const counts = {} as ResearchDataExport["counts"];

  for (const collection of Object.keys(collections) as ExportCollection[]) {
    counts[collection] = collections[collection].length;
  }

  return {
    formatVersion: 1,
    exportedAt: "2026-10-26T00:00:00.000Z",
    scope: "accessible-research-data",
    includesRetainedArchivedRecords: true,
    collections,
    counts,
  };
}

describe("research Excel export", () => {
  it("connects papers, tasks, histories, conferences, and funding", async () => {
    const workbook = await buildResearchExcel(makeExport());

    expect(workbook.getWorksheet("Papers")?.getCell("D4").value).toEqual(
      expect.objectContaining({
        text: "Genome project",
        hyperlink: "#'Projects'!B4",
      }),
    );

    expect(workbook.getWorksheet("Tasks")?.getCell("D4").value).toEqual(
      expect.objectContaining({
        text: "Genome manuscript",
        hyperlink: "#'Papers'!B4",
      }),
    );

    expect(workbook.getWorksheet("Note history")?.getCell("B4").value).toEqual(
      expect.objectContaining({
        text: "Research notes",
        hyperlink: "#'Notes'!B4",
      }),
    );

    expect(
      workbook.getWorksheet("Journal submissions")?.getCell("B4").value,
    ).toEqual(
      expect.objectContaining({
        text: "Genome manuscript",
        hyperlink: "#'Papers'!B4",
      }),
    );

    const pairs: string[][] = [];

    workbook.getWorksheet("Connections")?.eachRow((row, number) => {
      if (number >= 4) {
        pairs.push([row.getCell("C").text, row.getCell("E").text]);
      }
    });

    expect(pairs).toContainEqual([
      "Research conference",
      "Genome manuscript",
    ]);
    expect(pairs).toContainEqual(["Research fund", "Prepare manuscript"]);
  });

  it("preserves long Unicode history across continuation rows", async () => {
    const data = makeExport();
    const content = "Research findings α 研究\n".repeat(2000);
    data.collections.noteEntries[0].content = content;

    const workbook = await buildResearchExcel(data);
    const parts: string[] = [];

    workbook.getWorksheet("Note history")?.eachRow((row, number) => {
      if (number >= 4) parts.push(row.getCell("E").text);
    });

    expect(parts.length).toBeGreaterThan(1);
    expect(parts.join("")).toBe(content);
  });

  it("exports names, assignments, real dates, and literal user text", async () => {
    const data = makeExport();
    data.collections.tasks[0].title = "=1+1";

    const workbook = await buildResearchExcel(data);

    expect(workbook.getWorksheet("Projects")?.getCell("K4").text).toBe(
      "Sam Coauthor (Editor)",
    );
    expect(workbook.getWorksheet("Papers")?.getCell("G4").text).toBe(
      "Sam Coauthor",
    );
    expect(workbook.getWorksheet("Tasks")?.getCell("B4").value).toBe("=1+1");
    expect(
      workbook.getWorksheet("Journal submissions")?.getCell("E4").value,
    ).toBeInstanceOf(Date);

    expect(workbook.getWorksheet("Papers")?.getColumn(1).hidden).toBe(true);
  });

  it("writes a workbook that can be opened again", async () => {
    const workbook = await buildResearchExcel(makeExport());
    const buffer = await workbook.xlsx.writeBuffer();

    const { default: Excel } = await import("exceljs");
    const restored = new Excel.Workbook();
    await restored.xlsx.load(buffer);

    expect(restored.getWorksheet("Projects")?.getCell("B4").text).toBe(
      "Genome project",
    );
    expect(restored.getWorksheet("Note history")?.getCell("E4").text).toBe(
      "Original findings",
    );
  });
});
