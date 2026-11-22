import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { ApiModule } from "@/api/hooks";
import { ProjectPapersPanel } from "./project-papers-panel";

vi.mock("@/api/hooks", () => ({
  useModulePipelineStagePool: () => ({
    data: [
      { value: "Hidden", hidden: true, sortOrder: 0 },
      { value: "Planning", hidden: false, sortOrder: 1 },
      { value: "Writing", hidden: false, sortOrder: 2 },
      { value: "Submitted, Under Review", hidden: false, sortOrder: 3 },
      { value: "Accepted", hidden: false, sortOrder: 4 },
    ],
  }),
}));
vi.mock("@/components/time-tracking/paper-logged-time", () => ({
  PaperLoggedTime: ({ paper }: { paper: ApiModule }) => (
    <span>{paper.loggedSeconds ?? 0}s</span>
  ),
}));
const makePaper = (id: string, title: string, extra = {}) =>
  ({
    id,
    title,
    shortTitle: null,
    displayId: null,
    description: null,
    status: "Active",
    pipelineStage: "Writing",
    priority: "Medium",
    dueDate: "2027-01-20",
    currentlyWithType: "me",
    loggedSeconds: 0,
    ...extra,
  }) as ApiModule;
function show(modules: ApiModule[], extra = {}) {
  const actions = {
    onToggleVisible: vi.fn(),
    onAddModule: vi.fn(),
    onLinkExisting: vi.fn(),
    onUnlinkModule: vi.fn(),
  };
  render(
    <MemoryRouter>
      <ProjectPapersPanel
        tenantId="workspace"
        currentUserId="owner"
        modules={modules}
        visible
        {...actions}
        {...extra}
      />
    </MemoryRouter>,
  );
  return actions;
}
function titles() {
  return within(screen.getByRole("table", { name: "Project papers" }))
    .getAllByRole("link")
    .map((link) => link.textContent);
}
describe("project paper table", () => {
  it("shows every paper in A–Z order and reverses the order without altering links", () => {
    const papers = Array.from({ length: 26 }, (_, i) =>
      makePaper(String(i), `Paper ${26 - i}`),
    );
    const actions = show(papers);
    expect(titles()).toHaveLength(26);
    expect(titles()[0]).toBe("Paper 1");
    expect(titles()[25]).toBe("Paper 26");
    fireEvent.click(screen.getByRole("button", { name: "Sort by Paper" }));
    expect(titles()[0]).toBe("Paper 26");
    expect(screen.getByRole("link", { name: "Paper 1" })).toHaveAttribute(
      "href",
      "/modules/25",
    );
    expect(papers[0].title).toBe("Paper 26");
    expect(actions.onUnlinkModule).not.toHaveBeenCalled();
  });
  it("shows the existing paper metadata and progress from the selected stages", () => {
    show([
      makePaper("a", "Alpha", {
        priority: "High",
        currentlyWithType: "collaborator",
        assignedToDisplayName: "Named Coauthor",
        assignedToUserId: "coauthor",
      }),
    ]);
    const row = screen.getByRole("link", { name: "Alpha" }).closest("tr")!;
    for (const text of [
      "Active",
      "High",
      "50%",
      "Writing",
      "Named Coauthor",
      "20/01/2027",
    ])
      expect(row).toHaveTextContent(text);
    for (const heading of [
      "Status",
      "Priority",
      "Progress",
      "Stage",
      "Submitted to",
      "Logged",
      "Next Action Date",
      "Currently With",
    ])
      expect(
        screen.getByRole("button", { name: `Sort by ${heading}` }),
      ).toBeInTheDocument();
  });
  it("sorts metadata columns and retains add/link/unlink actions", () => {
    const alpha = makePaper("a", "Alpha", {
      priority: "High",
      dueDate: "2027-02-01",
      loggedSeconds: 3600,
    });
    const beta = makePaper("b", "Beta", {
      priority: "Low",
      dueDate: "2027-01-01",
      pipelineStage: "Planning",
      loggedSeconds: 60,
    });
    const actions = show([alpha, beta]);
    for (const column of [
      "Priority",
      "Next Action Date",
      "Progress",
      "Logged",
    ]) {
      fireEvent.click(
        screen.getByRole("button", { name: `Sort by ${column}` }),
      );
      expect(titles()).toEqual(["Beta", "Alpha"]);
      fireEvent.click(
        screen.getByRole("button", { name: `Sort by ${column}` }),
      );
      expect(titles()).toEqual(["Alpha", "Beta"]);
    }
    fireEvent.click(screen.getByRole("button", { name: "Add paper" }));
    fireEvent.click(screen.getByRole("button", { name: "Link existing" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Unlink Alpha from this project" }),
    );
    expect(actions.onAddModule).toHaveBeenCalledOnce();
    expect(actions.onLinkExisting).toHaveBeenCalledOnce();
    expect(actions.onUnlinkModule).toHaveBeenCalledWith(alpha);
  });
});
