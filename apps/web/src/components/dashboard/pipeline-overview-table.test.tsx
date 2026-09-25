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
}));

vi.mock("@/api/hooks", () => ({
  useCurrentWorkspace: () => ({ data: { id: "workspace-1" } }),
  useModules: () => ({ data: { data: [
    { id: "paper-1", title: "Example paper", shortTitle: null, pipelineStage: fixtures.currentStage },
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
