import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildResearchExportHtml,
  fetchResearchDataExport,
  type ExportCollection,
  type ResearchDataExport,
} from "./research-data-export";

const mocks = vi.hoisted(() => ({
  authenticatedJson: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  authenticatedJson: mocks.authenticatedJson,
}));

function makeExport(): ResearchDataExport {
  const collections: ResearchDataExport["collections"] = {
    projects: [],
    papers: [],
    tasks: [],
    taskDescriptionEntries: [],
    notes: [],
    noteEntries: [],
    journalSubmissions: [],
    conferences: [],
    conferenceProjects: [],
    conferencePapers: [],
    fundings: [],
    fundingProjects: [],
    fundingPapers: [],
    fundingNotes: [],
    fundingTasks: [],
    calendarEvents: [],
    referenceValues: [],
  };

  const counts = {} as ResearchDataExport["counts"];
  for (const name of Object.keys(collections) as ExportCollection[]) {
    counts[name] = collections[name].length;
  }

  return {
    formatVersion: 1,
    exportedAt: "2026-10-23T05:00:00.000Z",
    scope: "accessible-research-data",
    includesRetainedArchivedRecords: true,
    collections,
    counts,
  };
}

describe("research data export", () => {
  beforeEach(() => {
    mocks.authenticatedJson.mockReset();
  });

  it("fetches the authenticated export and forwards cancellation", async () => {
    const data = makeExport();
    const controller = new AbortController();
    mocks.authenticatedJson.mockResolvedValue(data);

    expect(
      await fetchResearchDataExport(controller.signal),
    ).toEqual(data);

    expect(mocks.authenticatedJson).toHaveBeenCalledWith(
      "/api/v1/me/data-export",
      { signal: controller.signal },
    );
  });

  it("rejects a response whose counts do not match its records", async () => {
    const data = makeExport();
    data.counts.notes = 1;
    mocks.authenticatedJson.mockResolvedValue(data);

    await expect(fetchResearchDataExport()).rejects.toThrow(
      "The export was incomplete",
    );
  });

  it("rejects an unsupported export format", async () => {
    mocks.authenticatedJson.mockResolvedValue({
      ...makeExport(),
      formatVersion: 99,
    });

    await expect(fetchResearchDataExport()).rejects.toThrow(
      "The export response was invalid",
    );
  });

  it("renders note contents as text rather than executable HTML", () => {
    const data = makeExport();
    const content =
      '</dd><script>window.exportInjected = true</script>' +
      '<img src="x" onerror="alert(1)">';

    data.collections.notes = [{
      id: "note-1",
      title: "Research & notes",
      content,
    }];
    data.counts.notes = 1;

    const html = buildResearchExportHtml(data);
    const document = new DOMParser().parseFromString(html, "text/html");

    expect(document.querySelector("script")).toBeNull();
    expect(document.querySelector("img")).toBeNull();
    expect(document.body.textContent).toContain(content);
    expect(document.body.textContent).toContain("Research & notes");
  });

  it("includes records beyond the first page and preserves full history text", () => {
    const data = makeExport();
    const longContent = "Research findings α 研究\n".repeat(100);

    data.collections.tasks = Array.from({ length: 25 }, (_, index) => ({
      id: `task-${index}`,
      title: `Export task ${index}`,
    }));
    data.collections.noteEntries = [
      {
        id: "entry-new",
        note_id: "note-1",
        content: longContent,
        created_at: "2026-10-23T01:00:00.000Z",
      },
      {
        id: "entry-old",
        note_id: "note-1",
        content: "Original dated entry",
        created_at: "2026-10-22T01:00:00.000Z",
      },
    ];
    data.counts.tasks = 25;
    data.counts.noteEntries = 2;

    const html = buildResearchExportHtml(data);
    const document = new DOMParser().parseFromString(html, "text/html");

    expect(document.querySelectorAll("article")).toHaveLength(27);
    expect(document.body.textContent).toContain("Export task 24");
    expect(document.body.textContent).toContain(longContent);
    expect(document.body.textContent).toContain("Original dated entry");
    expect(document.body.textContent).toContain(
      "2026-10-22T01:00:00.000Z",
    );
  });

  it("resolves reference IDs to readable labels in the report", () => {
    const data = makeExport();

    data.collections.tasks = [{
      id: "task-1",
      title: "Prepare manuscript",
      status_id: "status-waiting",
    }];
    data.collections.referenceValues = [{
      id: "status-waiting",
      category: "task_status",
      value: "Waiting",
    }];
    data.counts.tasks = 1;
    data.counts.referenceValues = 1;

    const html = buildResearchExportHtml(data);

    expect(html).toContain("Waiting (status-waiting)");
  });
});