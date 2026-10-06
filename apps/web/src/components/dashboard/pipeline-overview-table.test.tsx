import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PipelineOverviewTable } from "@/components/dashboard/pipeline-overview-table";

const stages = vi.hoisted(() => [
  "Concept, Ideation", "Lit Review", "Study Design, Protocol",
  "Ethics, Other Approvals", "Preparation, Setup", "Data Collection",
  "Data Preparation", "Data Analysis", "Interpretation & Synthesis",
  "Drafting & Writing", "Submitted, Under Review", "Revisions",
  "Accepted", "Dissemination", "Complete",
]);

const fixtures = vi.hoisted(() => ({
  hidden: [] as string[],
  reversed: false,
  currentStage: "Drafting & Writing" as string | null,
  papers: null as null | Array<{
    id: string;
    title: string;
    shortTitle: string | null;
    status?: string | null;
    pipelineStage: string | null;
    createdAt: string;
  }>,
}));

vi.mock("@/api/hooks", () => ({
  useCurrentWorkspace: () => ({ data: { id: "workspace-1" } }),
  useModules: () => ({ data: { data: fixtures.papers ?? [
    {
      id: "paper-1",
      title: "Example paper",
      shortTitle: null,
      status: "Active",
      pipelineStage: fixtures.currentStage,
      createdAt: "2026-09-01T00:00:00.000Z",
    },
  ] } }),
  useTasks: () => ({ data: { data: [
    { id: "task-1", moduleId: "paper-1", status: "Complete" },
    { id: "task-2", moduleId: "paper-1", status: "In Progress" },
  ] } }),
  useModulePipelineStagePool: () => ({ data: stages.map((value, sortOrder) => ({
    id: String(sortOrder), value,
    sortOrder: fixtures.reversed ? stages.length - sortOrder : sortOrder,
    hidden: fixtures.hidden.includes(value),
  })) }),
}));

describe("PipelineOverviewTable popup", () => {
  beforeEach(() => {
    window.localStorage.clear();
    fixtures.hidden = [];
    fixtures.reversed = false;
    fixtures.currentStage = "Drafting & Writing";
    fixtures.papers = null;
  });

  it("sorts by date, alphabet, or progress and reverses the selected order", () => {
    fixtures.papers = [
      {
        id: "paper-c",
        title: "Charlie",
        shortTitle: null,
        pipelineStage: "Concept, Ideation",
        createdAt: "2026-09-01T00:00:00.000Z",
      },
      {
        id: "paper-a",
        title: "Alpha",
        shortTitle: null,
        pipelineStage: "Complete",
        createdAt: "2026-09-03T00:00:00.000Z",
      },
      {
        id: "paper-b",
        title: "Beta",
        shortTitle: null,
        pipelineStage: "Data Analysis",
        createdAt: "2026-09-02T00:00:00.000Z",
      },
    ];

    render(<MemoryRouter><PipelineOverviewTable /></MemoryRouter>);
    const paperNames = () => screen.getAllByRole("link")
      .filter((link) => link.getAttribute("href")?.startsWith("/modules/"))
      .map((link) => link.textContent);

    expect(paperNames()).toEqual(["Alpha", "Beta", "Charlie"]);

    fireEvent.click(screen.getByRole("combobox", { name: "Sort papers by" }));
    fireEvent.click(screen.getByRole("option", { name: "Alphabetical" }));
    expect(paperNames()).toEqual(["Alpha", "Beta", "Charlie"]);

    fireEvent.click(screen.getByRole("button", { name: /Reverse sort order/ }));
    expect(paperNames()).toEqual(["Charlie", "Beta", "Alpha"]);

    fireEvent.click(screen.getByRole("combobox", { name: "Sort papers by" }));
    fireEvent.click(screen.getByRole("option", { name: "Progress" }));
    expect(paperNames()).toEqual(["Alpha", "Beta", "Charlie"]);
  });

  it("filters by multiple stages and statuses in both pipeline views", async () => {
    fixtures.papers = [
      {
        id: "paper-active-drafting",
        title: "Active drafting paper",
        shortTitle: null,
        status: "Active",
        pipelineStage: "Drafting & Writing",
        createdAt: "2026-09-05T00:00:00.000Z",
      },
      {
        id: "paper-stalled-analysis",
        title: "Stalled analysis paper",
        shortTitle: null,
        status: "Stalled",
        pipelineStage: "Data Analysis",
        createdAt: "2026-09-04T00:00:00.000Z",
      },
      {
        id: "paper-review-analysis",
        title: "Review analysis paper",
        shortTitle: null,
        status: "Review",
        pipelineStage: "Data Analysis",
        createdAt: "2026-09-03T00:00:00.000Z",
      },
      {
        id: "paper-stalled-review",
        title: "Stalled review-stage paper",
        shortTitle: null,
        status: "Stalled",
        pipelineStage: "Submitted, Under Review",
        createdAt: "2026-09-02T00:00:00.000Z",
      },
      {
        id: "paper-active-concept",
        title: "Active concept paper",
        shortTitle: null,
        status: "Active",
        pipelineStage: "Concept, Ideation",
        createdAt: "2026-09-01T00:00:00.000Z",
      },
    ];

    render(<MemoryRouter><PipelineOverviewTable /></MemoryRouter>);

    fireEvent.keyDown(screen.getByRole("button", { name: "Filter by stages" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Data Analysis" }));
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Drafting & Writing" }));
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());

    fireEvent.keyDown(screen.getByRole("button", { name: "Filter by statuses" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Active" }));
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Stalled" }));
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());

    expect(screen.getByRole("link", { name: "Active drafting paper" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Stalled analysis paper" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Review analysis paper" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Stalled review-stage paper" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Active concept paper" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filter by stages" })).toHaveTextContent("2 stages");
    expect(screen.getByRole("button", { name: "Filter by statuses" })).toHaveTextContent("2 statuses");

    fireEvent.click(screen.getByRole("button", { name: "Enlarge pipeline" }));
    const popup = within(screen.getByRole("dialog"));
    expect(popup.getByRole("link", { name: "Active drafting paper" })).toBeVisible();
    expect(popup.getByRole("link", { name: "Stalled analysis paper" })).toBeVisible();
    expect(popup.queryByRole("link", { name: "Review analysis paper" })).not.toBeInTheDocument();

    fireEvent.click(popup.getByRole("button", { name: "Clear filters" }));
    expect(popup.getAllByRole("link").filter((link) =>
      link.getAttribute("href")?.startsWith("/modules/")
    )).toHaveLength(5);
  });

  it("preserves every stage, the Columns control, and the Progress percentage column", async () => {
    render(<MemoryRouter><PipelineOverviewTable /></MemoryRouter>);
    expect(screen.getByRole("columnheader", { name: "Progress" })).toBeVisible();
    expect(screen.getByRole("cell", { name: "67%" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Columns" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Enlarge pipeline" }));
    const popup = within(screen.getByRole("dialog"));
    expect(popup.getByRole("columnheader", { name: "Paper" })).toBeVisible();
    expect(popup.getByRole("columnheader", { name: "Progress" })).toBeVisible();
    expect(popup.getByRole("cell", { name: "67%" })).toBeVisible();
    expect(popup.getByRole("button", { name: "Columns" })).toBeVisible();
    const stageHeader = popup.getByRole("columnheader", { name: /Concept, Ideation/ });
    expect(Array.from(stageHeader.querySelectorAll("span"), (label) => label.textContent)).toEqual(stages);
    expect(popup.getByRole("link", { name: "Example paper" })).toHaveAttribute("href", "/modules/paper-1");

    fireEvent.click(popup.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("columnheader", { name: "Progress" })).toBeVisible();
    expect(screen.getByRole("cell", { name: "67%" })).toBeVisible();
  });

  it("keeps dashboard and popup percentages in sync with paper and stage settings", () => {
    fixtures.hidden = stages.slice(0, 5);
    fixtures.currentStage = "Data Analysis";
    const { rerender } = render(<MemoryRouter><PipelineOverviewTable /></MemoryRouter>);
    expect(screen.getByRole("cell", { name: "30%" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Enlarge pipeline" }));
    const popup = within(screen.getByRole("dialog"));
    expect(popup.getByRole("cell", { name: "30%" })).toBeVisible();

    fixtures.reversed = true;
    rerender(<MemoryRouter><PipelineOverviewTable /></MemoryRouter>);
    expect(popup.getByRole("cell", { name: "80%" })).toBeVisible();

    fixtures.reversed = false;
    fixtures.currentStage = "Complete";
    rerender(<MemoryRouter><PipelineOverviewTable /></MemoryRouter>);
    expect(popup.getByRole("cell", { name: "100%" })).toBeVisible();

    fixtures.currentStage = null;
    rerender(<MemoryRouter><PipelineOverviewTable /></MemoryRouter>);
    expect(popup.getByRole("cell", { name: "0%" })).toBeVisible();
  });

  it("shares the existing column preferences between normal and enlarged views", async () => {
    render(<MemoryRouter><PipelineOverviewTable /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Enlarge pipeline" }));
    const popup = within(screen.getByRole("dialog"));
    fireEvent.keyDown(popup.getByRole("button", { name: "Columns" }), { key: "Enter" });
    const progressToggle = await screen.findByRole("menuitemcheckbox", { name: "Progress" });
    fireEvent.click(progressToggle);
    expect(popup.queryByRole("columnheader", { name: "Progress" })).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    fireEvent.click(popup.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.queryByRole("columnheader", { name: "Progress" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Example paper" })).toBeVisible();
  });
});
