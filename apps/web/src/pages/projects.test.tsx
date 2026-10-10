import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ProjectsPage from "@/pages/projects";

const fixtures = vi.hoisted(() => ({
  tenantId: "workspace-1",
  projects: [] as Record<string, unknown>[],
  modules: [] as Record<string, unknown>[],
  project: {
    id: "PRJ-101",
    displayId: "PRJ-101",
    userId: "user-owner",
    tenantId: "workspace-1",
    title: "Enzyme Kinetics Inhibition Study Across Temperature Gradients",
    description: "A study of enzyme kinetics under varying temperature.",
    researchArea: "Biochemistry",
    status: "Active",
    importance: "Low",
    scheduledFor: "2026-07-01",
    dueDate: "2026-08-01",
    totalBudget: "5000",
    targetJournals: "Nature Communications",
    archivedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    role: "Owner",
  },
  module: {
    id: "module-1",
    displayId: "MOD-1",
    tenantId: "workspace-1",
    projectId: "PRJ-101",
    title: "Assay setup",
    description: null,
    tag: null,
    status: "Active",
    assignedToUserId: null,
    archivedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  task: {
    id: "task-1",
    displayId: "TSK-1",
    tenantId: "workspace-1",
    projectId: "PRJ-101",
    moduleId: null,
    createdBy: "user-owner",
    title: "Calibrate spectrophotometer",
    description: null,
    status: "In Progress",
    priority: "Medium",
    visibility: "Shared",
    workingWith: null,
    estimatedHours: null,
    dueDate: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  note: {
    id: "note-1",
    displayId: "NTE-1",
    tenantId: "workspace-1",
    projectId: "PRJ-101",
    moduleId: null,
    createdBy: "user-owner",
    title: "Initial observations",
    content: null,
    visibility: "Shared",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
}));
const hookMocks = vi.hoisted(() => ({
  useProjects: vi.fn(),
  updateProject: vi.fn(),
  updateProjectRole: vi.fn(),
  pagination: {
    totalItems: 1,
    totalPages: 1,
  },
}));

vi.mock("@/api/client", () => ({
  apiClient: {
    POST: vi
      .fn()
      .mockResolvedValue({
        data: {},
        error: undefined,
        response: new Response(),
      }),
  },
}));

vi.mock("@/api/hooks", () => ({
  useModule: () => ({ data: undefined }),
  apiKeys: {
    projectCollaborators: (tenantId: string, projectId: string) => [
      "api",
      "tenant",
      tenantId,
      "projects",
      projectId,
      "collaborators",
    ],
  },
  useMe: () => ({
    data: {
      id: "user-owner",
      email: "owner@example.com",
      displayName: "Avi Researcher",
    },
  }),
  useCurrentWorkspace: () => ({
    data: { id: fixtures.tenantId },
    isPending: false,
  }),
  useProjects: (tenantId: string, page = 1) => {
    hookMocks.useProjects(tenantId, page);

    return {
      data: {
        generalProject: {
          ...fixtures.project,
          id: "PRJ-GENERAL",
          displayId: "PRJ-0001",
          title: "General",
          description: null,
          researchArea: null,
          status: null,
          importance: null,
          scheduledFor: null,
          dueDate: null,
        },
        data: fixtures.projects,
        meta: {
          page,
          pageSize: 20,
          totalItems: hookMocks.pagination.totalItems,
          totalPages: hookMocks.pagination.totalPages,
        },
      },
      isPending: false,
      isFetching: false,
      isError: false,
      error: undefined,
      refetch: vi.fn(),
    };
  },
  useMembers: () => ({
    data: {
      data: [],
      meta: {
        page: 1,
        pageSize: 20,
        totalItems: 0,
        totalPages: 1,
      },
    },
    isPending: false,
  }),
  useCreateProject: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateProject: () => ({
    mutateAsync: hookMocks.updateProject,
    isPending: false,
  }),
  useUpdateProjectCollaboratorRole: () => ({
    mutateAsync: hookMocks.updateProjectRole,
    isPending: false,
  }),
  useArchiveProject: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useProjectArchiveImpact: () => ({
    data: { papers: 0, tasks: 0, notes: 0 },
    isPending: false,
  }),
  useTrackEvent: () => vi.fn(),
  useModules: () => ({
    data: {
      data: fixtures.modules,
      meta: {
        page: 1,
        pageSize: 20,
        totalItems: fixtures.modules.length,
        totalPages: 1,
      },
    },
  }),
  useTasks: () => ({
    data: {
      data: [fixtures.task],
      meta: {
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
      },
    },
  }),
  useNotes: () => ({
    data: {
      data: [fixtures.note],
      meta: {
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
      },
    },
  }),
  useUpdateModule: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateTask: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateNote: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUserSearch: () => ({ data: [], isPending: false, isError: false }),
  createDraftInvitation: vi.fn(),
}));

vi.mock("@/components/projects/project-collaborators", () => ({
  ProjectCollaborators: ({ entityTitle }: { entityTitle: string }) => (
    <div>Collaborators for {entityTitle}</div>
  ),
}));

vi.mock("@/components/projects/archive-project-dialog", () => ({
  ArchiveProjectDialog: () => null,
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ProjectsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ProjectsPage", () => {
  beforeEach(() => {
    window.localStorage?.clear();
    fixtures.projects = [fixtures.project];
    fixtures.modules = [fixtures.module];
    hookMocks.useProjects.mockClear();
    hookMocks.updateProject.mockReset();
    hookMocks.updateProject.mockResolvedValue(fixtures.project);
    hookMocks.updateProjectRole.mockReset();
    hookMocks.updateProjectRole.mockResolvedValue({
      userId: "user-owner",
      role: "Lead",
    });
    hookMocks.pagination.totalItems = 1;
    hookMocks.pagination.totalPages = 1;
  });
  it("requests the next projects page when Next is clicked", () => {
    hookMocks.pagination.totalItems = 21;
    hookMocks.pagination.totalPages = 2;

    renderPage();

    expect(hookMocks.useProjects).toHaveBeenCalledWith(fixtures.tenantId, 1);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(hookMocks.useProjects).toHaveBeenLastCalledWith(
      fixtures.tenantId,
      2,
    );

    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
  });
  it("provides a direct edit action for each project row", () => {
    renderPage();

    const editLink = screen.getByRole("link", {
      name: "Edit Enzyme Kinetics Inhibition Study Across Temperature Gradients",
    });

    expect(editLink).toHaveAttribute("href", "/projects/PRJ-101?edit=true");
    expect(
      screen.queryByRole("combobox", { name: /Change importance/ }),
    ).not.toBeInTheDocument();
  });

  it("changes a project status directly from its list row", async () => {
    renderPage();

    fireEvent.click(
      screen.getByRole("combobox", {
        name: "Change status for Enzyme Kinetics Inhibition Study Across Temperature Gradients",
      }),
    );
    fireEvent.click(screen.getByRole("option", { name: "Review" }));

    await waitFor(() =>
      expect(hookMocks.updateProject).toHaveBeenCalledWith({
        projectId: "PRJ-101",
        input: { status: "Review" },
      }),
    );
  });

  it("does not show project importance in the list", () => {
    renderPage();

    expect(screen.queryByText("Importance")).not.toBeInTheDocument();
    expect(screen.queryByText("Low")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Sort by Importance/ }),
    ).not.toBeInTheDocument();
  });

  it("changes the current user's role directly from a project row", async () => {
    renderPage();

    fireEvent.click(
      screen.getByRole("combobox", {
        name: "Change role for Enzyme Kinetics Inhibition Study Across Temperature Gradients",
      }),
    );
    fireEvent.click(screen.getByRole("option", { name: "Lead" }));

    await waitFor(() =>
      expect(hookMocks.updateProjectRole).toHaveBeenCalledWith({
        projectId: "PRJ-101",
        userId: "user-owner",
        role: "Lead",
      }),
    );
  });

  it("shows General together with the other projects", () => {
    renderPage();

    expect(screen.queryByText("General workspace")).not.toBeInTheDocument();

    const generalLink = screen.getByRole("link", {
      name: "General",
    });

    expect(generalLink).toHaveAttribute("href", "/projects/PRJ-GENERAL");

    expect(
      screen.getByText(
        "Enzyme Kinetics Inhibition Study Across Temperature Gradients",
      ),
    ).toBeInTheDocument();
  });

  it("opens collaborator management directly from the project row", () => {
    renderPage();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Manage collaborators for Enzyme Kinetics Inhibition Study Across Temperature Gradients",
      }),
    );

    expect(
      screen.getByRole("heading", { name: "Project collaborators" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Collaborators for Enzyme Kinetics Inhibition Study Across Temperature Gradients",
      ),
    ).toBeInTheDocument();
  });

  it("shows scheduled dates in the table and new-project form", () => {
    renderPage();

    expect(screen.getAllByText("Scheduled For").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "New Project" }));

    const scheduledFor = screen.getByLabelText(/Scheduled for/);
    const dueDate = screen.getByLabelText(/Due date/);

    expect(scheduledFor).toHaveAttribute("placeholder", "DD/MM/YYYY");
    expect(scheduledFor).not.toBeRequired();
    expect(dueDate).toHaveAttribute("placeholder", "DD/MM/YYYY");
    expect(dueDate).not.toBeRequired();
    expect(
      screen.getByRole("button", { name: "Choose scheduled for date" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Choose due date" }),
    ).toBeInTheDocument();
  });

  it("offers optional collaborator entry during project creation", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "New Project" }));
    expect(screen.getByText("Collaborators (optional)")).toBeInTheDocument();
    expect(screen.getByLabelText("Collaborator email")).not.toBeRequired();
  });

  it("shows linked paper/note counts and a description line directly in the row, without needing to expand", () => {
    renderPage();

    const projectLink = screen.getByRole("link", {
      name: "Enzyme Kinetics Inhibition Study Across Temperature Gradients",
    });
    expect(projectLink).toHaveAttribute("href", "/projects/PRJ-101");
    expect(
      screen.queryByRole("button", { name: /expand/i }),
    ).not.toBeInTheDocument();

    const projectRow = projectLink.closest(".grid") as HTMLElement;
    expect(
      within(projectRow).getByText(
        "A study of enzyme kinetics under varying temperature.",
      ),
    ).toBeInTheDocument();

    const columnValues = within(projectRow).getAllByText("1");
    expect(columnValues.length).toBeGreaterThanOrEqual(2);
  });

  it("shows a Papers column with the linked paper count, and no Progress column", () => {
    fixtures.modules = [
      fixtures.module,
      {
        ...fixtures.module,
        id: "module-2",
        displayId: "MOD-2",
        title: "Second paper",
      },
    ];
    renderPage();

    expect(
      screen.getByRole("button", { name: "Sort by Papers" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Sort by Progress" }),
    ).not.toBeInTheDocument();

    const projectLink = screen.getByRole("link", {
      name: "Enzyme Kinetics Inhibition Study Across Temperature Gradients",
    });
    const projectRow = projectLink.closest(".grid") as HTMLElement;
    expect(within(projectRow).getByText("2")).toBeInTheDocument();
  });

  it("sorts by column, toggling direction on repeated clicks", () => {
    fixtures.projects = [
      {
        ...fixtures.project,
        id: "PRJ-C",
        displayId: "PRJ-C",
        title: "Charlie project",
        dueDate: "2026-08-03",
      },
      {
        ...fixtures.project,
        id: "PRJ-A",
        displayId: "PRJ-A",
        title: "Alpha project",
        dueDate: "2026-08-01",
      },
      {
        ...fixtures.project,
        id: "PRJ-B",
        displayId: "PRJ-B",
        title: "Bravo project",
        dueDate: "2026-08-02",
      },
    ];
    renderPage();

    const titleOrder = () =>
      screen
        .getAllByRole("link")
        .map((el) => el.textContent)
        .filter((text): text is string =>
          ["Alpha project", "Bravo project", "Charlie project"].includes(
            text ?? "",
          ),
        );

    // Default sort is by Due Date, ascending.
    expect(titleOrder()).toEqual([
      "Alpha project",
      "Bravo project",
      "Charlie project",
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Sort by Project" }));
    expect(titleOrder()).toEqual([
      "Alpha project",
      "Bravo project",
      "Charlie project",
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Sort by Project" }));
    expect(titleOrder()).toEqual([
      "Charlie project",
      "Bravo project",
      "Alpha project",
    ]);
  });
});
