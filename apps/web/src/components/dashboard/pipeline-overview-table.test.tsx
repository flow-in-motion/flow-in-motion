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

vi.mock("@/api/hooks", () => ({
  useCurrentWorkspace: () => ({ data: { id: "workspace-1" } }),
  useModules: () => ({ data: { data: [
    { id: "paper-1", title: "Example paper", shortTitle: null, pipelineStage: "Drafting & Writing" },
  ] } }),
  useTasks: () => ({ data: { data: [
    { id: "task-1", moduleId: "paper-1", status: "Complete" },
    { id: "task-2", moduleId: "paper-1", status: "In Progress" },
  ] } }),
  useModulePipelineStagePool: () => ({ data: stages.map((value, sortOrder) => ({
    id: String(sortOrder), value, sortOrder, hidden: false,
  })) }),
}));

describe("PipelineOverviewTable popup", () => {
  beforeEach(() => window.localStorage.clear());

  it("preserves every stage, the Columns control, and the Progress percentage column", async () => {
    render(<MemoryRouter><PipelineOverviewTable /></MemoryRouter>);
    expect(screen.getByRole("columnheader", { name: "Progress" })).toBeVisible();
    expect(screen.getByRole("cell", { name: "50%" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Columns" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Enlarge pipeline" }));
    const popup = within(screen.getByRole("dialog"));
    expect(popup.getByRole("columnheader", { name: "Paper" })).toBeVisible();
    expect(popup.getByRole("columnheader", { name: "Progress" })).toBeVisible();
    expect(popup.getByRole("cell", { name: "50%" })).toBeVisible();
    expect(popup.getByRole("button", { name: "Columns" })).toBeVisible();
    const stageHeader = popup.getByRole("columnheader", { name: /Concept, Ideation/ });
    expect(Array.from(stageHeader.querySelectorAll("span"), (label) => label.textContent)).toEqual(stages);
    expect(popup.getByRole("link", { name: "Example paper" })).toHaveAttribute("href", "/modules/paper-1");

    fireEvent.click(popup.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("columnheader", { name: "Progress" })).toBeVisible();
    expect(screen.getByRole("cell", { name: "50%" })).toBeVisible();
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
