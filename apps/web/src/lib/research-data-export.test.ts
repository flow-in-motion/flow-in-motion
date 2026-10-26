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
    data.collections.notes = [{
      id: "note-1",
      title: "Research notes",
    }];
    data.counts.notes = 1;
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

    expect(document.querySelectorAll("article")).toHaveLength(26);
    expect(document.body.textContent).toContain("Export task 24");
    expect(document.body.textContent).toContain(longContent);
    expect(document.body.textContent).toContain("Original dated entry");
    expect(document.body.textContent).toContain("22 Oct 2026");

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

    const document = new DOMParser().parseFromString(html, "text/html");

    expect(document.body.textContent).toContain("Waiting");
    expect(document.body.textContent).not.toContain("status-waiting");
    expect(document.body.textContent).not.toContain("task-1");
    expect(document.body.textContent).not.toContain("Reference values");
  });

  it("shows paper assignments and project collaborators without technical IDs", () => {
    const data = makeExport();

    data.collections.projects = [{
      id: "project-private-id",
      title: "Genome project",
      collaborators: [
        { display_name: "Sam Coauthor", role: "Editor" },
        { display_name: "Dana Researcher", role: "Viewer" },
      ],
    }];

    data.collections.papers = [{
      id: "paper-private-id",
      short_title: "Genome manuscript",
      project_id: "project-private-id",
      currently_with_type: "collaborator",
      assigned_to_user_id: "user-private-id",
      assigned_to_display_name: "Sam Coauthor",
    }];

    data.counts.projects = 1;
    data.counts.papers = 1;

    const document = new DOMParser().parseFromString(
      buildResearchExportHtml(data),
      "text/html",
    );

    const project = document.getElementById(
      "research-projects-project-private-id",
    );
    const paper = document.getElementById(
      "research-papers-paper-private-id",
    );

    expect(project?.textContent).toContain("Collaborators");
    expect(project?.textContent).toContain("Sam Coauthor · Editor");
    expect(project?.textContent).toContain("Dana Researcher · Viewer");

    const assignmentRow = Array.from(
      paper?.querySelectorAll("tr") ?? [],
    ).find((row) => row.querySelector("th")?.textContent === "Currently with");

    expect(assignmentRow?.querySelector("td")?.textContent).toBe(
      "Sam Coauthor",
    );
    expect(document.body.textContent).not.toContain("private-id");
  });
});