import { describe, expect, it } from "vitest";

import { buildResearchMindMaps } from "./research-export-maps";
import type { ResearchDataExport } from "./research-data-export";

function makeExport(): ResearchDataExport {
  return {
    formatVersion: 1,
    exportedAt: "2026-10-25T00:00:00.000Z",
    scope: "accessible-research-data",
    includesRetainedArchivedRecords: true,
    collections: {
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
    },
    counts: {
      projects: 0,
      papers: 0,
      tasks: 0,
      taskDescriptionEntries: 0,
      notes: 0,
      noteEntries: 0,
      journalSubmissions: 0,
      conferences: 0,
      conferenceProjects: 0,
      conferencePapers: 0,
      fundings: 0,
      fundingProjects: 0,
      fundingPapers: 0,
      fundingNotes: 0,
      fundingTasks: 0,
      calendarEvents: 0,
      referenceValues: 0,
    },
  };
}

describe("research export mind maps", () => {
  it("includes both views, paginates all records, and hides internal IDs", () => {
    const data = makeExport();

    data.collections.projects = [{
      id: "private-project-id",
      tenant_id: "private-tenant-id",
      title: "Genome project",
    }];
    data.collections.papers = [{
      id: "private-paper-id",
      tenant_id: "private-tenant-id",
      project_id: "private-project-id",
      short_title: "Draft manuscript",
    }];
    data.collections.tasks = Array.from({ length: 25 }, (_, index) => ({
      id: `private-task-id-${index}`,
      tenant_id: "private-tenant-id",
      module_id: "private-paper-id",
      title: `Research task ${index}`,
    }));

    const document = new DOMParser().parseFromString(
      buildResearchMindMaps(data),
      "text/html",
    );

    expect(document.body.textContent).toContain("Tree map");
    expect(document.body.textContent).toContain("Bubble map");
    expect(document.body.textContent).toContain("Research task 24");
    expect(document.body.textContent).not.toContain("private-");
    expect(document.querySelectorAll("svg").length).toBeGreaterThan(1);

    for (const sheet of document.querySelectorAll("figure")) {
      expect(sheet.textContent).toContain("Genome project");
      expect(sheet.textContent).toContain("Draft manuscript");
    }
    expect(
        document.querySelector(
          '.export-tree a[href="#research-papers-private-paper-id"]',
        ),
      ).not.toBeNull();
      
      expect(
        document.querySelector(
          'svg a[href="#research-papers-private-paper-id"]',
        ),
      ).not.toBeNull();
  });

  it("preserves accessible items when their parents are unavailable", () => {
    const data = makeExport();
    data.collections.notes = [{
      id: "note-id",
      module_id: "unavailable-paper-id",
      title: "Independent research notes",
    }];

    const document = new DOMParser().parseFromString(
      buildResearchMindMaps(data),
      "text/html",
    );

    expect(document.body.textContent).toContain("Other accessible research");
    expect(document.body.textContent).toContain("Independent research notes");
    expect(document.body.textContent).not.toContain("unavailable-paper-id");
  });

  it("escapes map titles instead of rendering executable markup", () => {
    const data = makeExport();
    data.collections.projects = [{
      id: "project-id",
      title: '<img src="x" onerror="alert(1)">',
    }];

    const document = new DOMParser().parseFromString(
      buildResearchMindMaps(data),
      "text/html",
    );

    expect(document.querySelector("img")).toBeNull();
    expect(document.querySelector("script")).toBeNull();
    expect(document.body.textContent).toContain('<img src="x"');
  });
  it("places multiple projects together when there is room", () => {
    const data = makeExport();
  
    data.collections.projects = [
      { id: "project-a", title: "Genome project" },
      { id: "project-b", title: "Climate project" },
      { id: "project-c", title: "Health project" },
    ];
  
    const document = new DOMParser().parseFromString(
      buildResearchMindMaps(data),
      "text/html",
    );
  
    expect(document.querySelectorAll("svg")).toHaveLength(1);
    expect(document.querySelectorAll("figure")).toHaveLength(2);
  
    for (const sheet of document.querySelectorAll("figure")) {
      expect(sheet.textContent).toContain("Genome project");
      expect(sheet.textContent).toContain("Climate project");
      expect(sheet.textContent).toContain("Health project");
    }
  });

  it("omits maps when there are no projects, papers, tasks, or notes", () => {
    expect(buildResearchMindMaps(makeExport())).toBe("");
  });
});
