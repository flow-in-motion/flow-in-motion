import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import HdrStudentsPage from "@/pages/hdr-students";

const fixture = vi.hoisted(() => ({
  list: vi.fn(),
  save: vi.fn(),
  remove: vi.fn(),
  projects: vi.fn(),
  papers: vi.fn(),
  person: {
    id: "person",
    name: "Sample Student",
    type: "PhD",
    category: "Current",
    email: "sample@example.org",
    researchTopic: "Research topic",
    projects: [{ id: "project", title: "Existing project" }],
    papers: [
      {
        id: "paper",
        title: "Full paper title",
        shortTitle: "Existing paper",
        displayId: "P-24",
      },
    ],
  },
}));
vi.mock("@/api/hooks", () => ({
  useMe: () => ({ data: { id: "supervisor" }, isPending: false }),
  useCurrentWorkspace: () => ({ data: { id: "workspace" }, isPending: false }),
  useProjects: (...args: unknown[]) => fixture.projects(...args),
  useModules: (...args: unknown[]) => fixture.papers(...args),
}));
vi.mock("@/api/hdr", () => ({
  useHdrPeople: (...args: unknown[]) => {
    fixture.list(...args);
    return {
      data: {
        data: [fixture.person],
        counts: {
          currentStudents: 37,
          potentialStudents: 9,
          visitingScholars: 4,
        },
        meta: { page: 1, pageSize: 20, totalItems: 50, totalPages: 3 },
      },
      isPending: false,
      isError: false,
      isFetching: false,
    };
  },
  useSaveHdrPerson: () => ({ mutateAsync: fixture.save }),
  useDeleteHdrPerson: () => ({ mutateAsync: fixture.remove }),
}));

function showPage() {
  return render(
    <MemoryRouter>
      <HdrStudentsPage />
    </MemoryRouter>,
  );
}

describe("HDR basics", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.clearAllMocks();
    fixture.save.mockResolvedValue({});
    fixture.remove.mockResolvedValue({});
    fixture.projects.mockReturnValue({
      data: {
        data: [],
        generalProject: null,
        meta: { page: 1, totalPages: 1 },
      },
      isFetching: false,
      isError: false,
    });
    fixture.papers.mockReturnValue({
      data: { data: [], meta: { page: 1, totalPages: 1 } },
      isFetching: false,
      isError: false,
    });
  });
  it("shows server-wide counts and real existing work links", () => {
    showPage();
    expect(screen.getByText("37")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Existing project" }),
    ).toHaveAttribute("href", "/projects/project");
    expect(
      screen.getByRole("link", { name: "Existing paper" }),
    ).toHaveAttribute("href", "/modules/paper");
    expect(screen.queryByText("Reviews waiting on me")).not.toBeInTheDocument();
  });
  it("creates with only a name, leaving links and optional fields blank", async () => {
    showPage();
    fireEvent.click(
      screen.getByRole("button", { name: "Add student / scholar" }),
    );
    fireEvent.change(screen.getByLabelText(/Name/), {
      target: { value: "New student" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add record" }));
    await waitFor(() =>
      expect(fixture.save).toHaveBeenCalledWith({
        personId: undefined,
        input: {
          name: "New student",
          type: "PhD",
          category: "Current",
          email: null,
          researchTopic: null,
          paperIds: [],
          projectIds: [],
        },
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });
  it("preserves existing selected links while changing category", async () => {
    showPage();
    fireEvent.click(
      screen.getByRole("button", { name: "Edit Sample Student" }),
    );
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText("Existing project")).toBeInTheDocument();
    expect(dialog.getByText("Existing paper")).toBeInTheDocument();
    fireEvent.change(dialog.getByLabelText("Category"), {
      target: { value: "Potential" },
    });
    fireEvent.click(dialog.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(fixture.save).toHaveBeenCalledWith({
        personId: "person",
        input: expect.objectContaining({
          category: "Potential",
          paperIds: ["paper"],
          projectIds: ["project"],
        }),
      }),
    );
  });
  it("searches papers on the server and can select one beyond the first page", async () => {
    fixture.papers.mockImplementation((_tenant, _project, page, enabled) => ({
      data: {
        data: enabled
          ? [
              {
                id: "paper-24",
                title: "Rare paper number 24",
                shortTitle: null,
              },
            ]
          : [],
        meta: { page, totalPages: 2 },
      },
      isFetching: false,
      isError: false,
    }));
    showPage();
    fireEvent.click(
      screen.getByRole("button", { name: "Add student / scholar" }),
    );
    fireEvent.change(screen.getByLabelText("Linked papers"), {
      target: { value: "Rare paper" },
    });
    await waitFor(() =>
      expect(fixture.papers).toHaveBeenLastCalledWith(
        "workspace",
        undefined,
        1,
        true,
        { pageSize: 20, search: "Rare paper" },
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Next results" }));
    await waitFor(() =>
      expect(fixture.papers).toHaveBeenLastCalledWith(
        "workspace",
        undefined,
        2,
        true,
        { pageSize: 20, search: "Rare paper" },
      ),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Rare paper number 24" }),
    );
    fireEvent.change(screen.getByLabelText(/Name/), {
      target: { value: "Student" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add record" }));
    await waitFor(() =>
      expect(fixture.save).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({ paperIds: ["paper-24"] }),
        }),
      ),
    );
  });
  it("searches projects only while requested, and can select and detach a result", async () => {
    fixture.projects.mockImplementation((_tenant, page, enabled) => ({
      data: {
        data: enabled ? [{ id: "project-24", title: "Rare project" }] : [],
        generalProject: null,
        meta: { page, totalPages: 1 },
      },
      isFetching: false,
      isError: false,
    }));
    showPage();
    expect(fixture.projects).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Add student / scholar" }),
    );
    expect(fixture.projects).toHaveBeenLastCalledWith(
      "workspace",
      1,
      false,
      expect.any(Object),
    );
    fireEvent.change(screen.getByLabelText("Linked projects"), {
      target: { value: "Rare" },
    });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Rare project" }),
      ).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Rare project" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Remove Rare project" }),
    );
    expect(
      screen.queryByRole("button", { name: "Remove Rare project" }),
    ).not.toBeInTheDocument();
  });
  it("sends list filters and clears a search without changing existing work", async () => {
    showPage();
    fireEvent.change(screen.getByRole("combobox", { name: "Filter by type" }), {
      target: { value: "Visiting scholar" },
    });
    fireEvent.change(
      screen.getByRole("combobox", { name: "Filter by category" }),
      { target: { value: "Potential" } },
    );
    fireEvent.change(
      screen.getByRole("textbox", { name: "Search students and scholars" }),
      { target: { value: "Sam" } },
    );
    await waitFor(() =>
      expect(fixture.list).toHaveBeenLastCalledWith(
        "workspace",
        expect.objectContaining({
          type: "Visiting scholar",
          category: "Potential",
          search: "Sam",
          page: 1,
        }),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Clear HDR search" }));
    await waitFor(() =>
      expect(fixture.list).toHaveBeenLastCalledWith(
        "workspace",
        expect.objectContaining({ search: "" }),
      ),
    );
    expect(fixture.save).not.toHaveBeenCalled();
  });
  it("retains entered values when a save fails", async () => {
    fixture.save.mockRejectedValue(new Error("Please try again"));
    showPage();
    fireEvent.click(
      screen.getByRole("button", { name: "Add student / scholar" }),
    );
    fireEvent.change(screen.getByLabelText(/Name/), {
      target: { value: "Student" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add record" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Please try again",
    );
    expect(screen.getByLabelText(/Name/)).toHaveValue("Student");
  });
  it("requires confirmation before deleting an HDR record", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    showPage();
    fireEvent.click(
      screen.getByRole("button", { name: "Delete Sample Student" }),
    );
    expect(fixture.remove).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(
      screen.getByRole("button", { name: "Delete Sample Student" }),
    );
    await waitFor(() => expect(fixture.remove).toHaveBeenCalledWith("person"));
    expect(confirm).toHaveBeenLastCalledWith(
      expect.stringContaining("Linked papers and projects will not be deleted"),
    );
    confirm.mockRestore();
  });
});
