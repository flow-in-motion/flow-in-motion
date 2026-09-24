import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ModulesPage from "@/pages/modules";

type ModuleFixture = {
  id: string;
  displayId: string | null;
  tenantId: string;
  projectId: string | null;
  shortTitle: string | null;
  title: string | null;
  description: string | null;
  status: string | null;
  pipelineStage: string | null;
  dueDate: string | null;
  assignedToUserId: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

// A minimal reactive store standing in for react-query's cache subscription:
// mutating fixtures.modules in the real app always yields a fresh array from
// a refetch, which react-query then pushes to every subscribed component.
// Plain mock functions can't replicate that push, so components here
// subscribe via useSyncExternalStore and get notified on every mutation.
const store = vi.hoisted(() => {
  let modules: ModuleFixture[] = [];
  const listeners = new Set<() => void>();
  return {
    useMe: () => ({
      data: { id: "user-owner", displayName: "Avi Researcher", email: "owner@example.com" },
    }),
    getModules: () => modules,
    setModules: (next: ModuleFixture[]) => {
      modules = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
});
const hookMocks = vi.hoisted(() => ({
  useModules: vi.fn(),
  pagination: {
    totalItems: 1,
    totalPages: 1,
  },
}));

const fixtures = vi.hoisted(() => ({
  tenantId: "workspace-1",
  projects: [] as Array<{
    id: string;
    userId: string;
    title: string;
  }>,
  tasks: [] as Array<{ id: string; moduleId: string | null; status: string | null }>,
  members: [
    {
      id: "membership-owner",
      userId: "user-owner",
      displayName: "Avi Researcher",
      email: "owner@example.com",
      role: "owner",
    },
  ],
  stageValues: [
    { id: "stage-1", tenantId: null, category: "module_pipeline_stage", value: "Concept & Ideation", sortOrder: 1, hidden: false, createdAt: "", updatedAt: "" },
    { id: "stage-2", tenantId: null, category: "module_pipeline_stage", value: "Literature Review", sortOrder: 2, hidden: false, createdAt: "", updatedAt: "" },
  ],
}));

vi.mock("@/api/client", () => ({
  apiClient: {
    POST: vi.fn().mockResolvedValue({ data: {}, error: undefined, response: new Response() }),
  },
}));

vi.mock("@/api/hooks", async () => {
  const { useSyncExternalStore: useStore } = await import("react");
  return {
    useCurrentWorkspace: () => ({ data: { id: fixtures.tenantId }, isPending: false }),
    useTrackEvent: () => vi.fn(),
    useMe: store.useMe,
    useMembers: () => ({
      data: {
        data: fixtures.members,
        meta: {
          page: 1,
          pageSize: 20,
          totalItems: fixtures.members.length,
          totalPages: 1,
        },
      },
      isPending: false,
    }),
    useProjects: () => ({
      data: {
        generalProject: {
          id: "project-general",
          displayId: "PRJ-0001",
          tenantId: fixtures.tenantId,
          userId: "user-owner",
          title: "General",
          description: null,
          researchArea: null,
          status: null,
          importance: null,
          scheduledFor: null,
          dueDate: null,
          totalBudget: null,
          targetJournals: null,
          archivedAt: null,
          role: "Owner",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        data: fixtures.projects,
        meta: {
          page: 1,
          pageSize: 20,
          totalItems: fixtures.projects.length,
          totalPages: 1,
        },
      },
      isPending: false,
      isError: false,
    }),
    useTasks: () => ({
      data: {
        data: fixtures.tasks,
        meta: { page: 1, pageSize: 20, totalItems: fixtures.tasks.length, totalPages: 1 },
      },
      isPending: false,
    }),
    useNotes: () => ({
      data: { data: [], meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 } },
      isPending: false,
    }),
    useUpdateTask: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useUpdateNote: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useModules: (
      tenantId: string,
      projectId?: string,
      page = 1,
    ) => {
      hookMocks.useModules(tenantId, projectId, page);

      const moduleRows = useStore(
        store.subscribe,
        store.getModules,
      );
    
      return {
        data: {
          data: moduleRows,
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
    useEnumValues: (category: string) => ({
      data:
        category === "project_role"
          ? [{ id: "role-owner", value: "Owner" }]
          : [],
    }),
    useModulePipelineStagePool: () => ({ data: fixtures.stageValues, isPending: false, isError: false }),
    useCreateModule: () => ({
      mutateAsync: vi.fn(async (input: Record<string, unknown>) => {
        const modules = store.getModules();
        const module: ModuleFixture = {
          id: `module-${modules.length + 1}`,
          displayId: `MOD-${String(modules.length + 1).padStart(3, "0")}`,
          tenantId: fixtures.tenantId,
          projectId: (input.projectId as string | undefined) ?? null,
          shortTitle: (input.shortTitle as string | undefined) ?? null,
          title: (input.title as string | undefined) ?? null,
          description: (input.description as string | undefined) ?? null,
          status: (input.status as string | undefined) ?? "Active",
          pipelineStage: (input.pipelineStage as string | undefined) ?? null,
          dueDate: (input.dueDate as string | undefined) ?? null,
          assignedToUserId: (input.assignedToUserId as string | undefined) ?? null,
          archivedAt: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        };
        store.setModules([...modules, module]);
        return module;
      }),
    }),
    useUpdateModule: () => ({
      mutateAsync: vi.fn(
        async ({ moduleId, input }: { moduleId: string; input: Record<string, unknown> }) => {
          const updated = store.getModules().map((item) =>
            item.id === moduleId ? { ...item, ...input } : item,
          );
          store.setModules(updated);
          return updated.find((item) => item.id === moduleId);
        },
      ),
    }),
    useArchiveModule: () => ({
      mutateAsync: vi.fn(async (moduleId: string) => {
        store.setModules(store.getModules().filter((item) => item.id !== moduleId));
      }),
    }),
    useModuleCollaborators: () => ({
      data: [{
        id: "collaborator-owner",
        tenantId: fixtures.tenantId,
        userId: "user-owner",
        roleId: "role-owner",
        role: "Owner",
        displayName: "Avi Researcher",
        email: "owner@example.com",
        createdAt: "",
        updatedAt: "",
      }],
      isPending: false,
    }),
    useRemoveModuleCollaborator: () => ({ mutate: vi.fn(), isPending: false }),
    useCollaboratorInvitations: () => ({ data: [], isPending: false, isError: false }),
    useCreateDraftInvitation: () => ({ mutateAsync: vi.fn(), isPending: false, isError: false }),
    useSendInvitation: () => ({ mutateAsync: vi.fn(), isPending: false, isError: false }),
    useRevokeCollaboratorInvitation: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
    useUserSearch: () => ({ data: [], isPending: false, isError: false }),
  };
});

describe("ModulesPage", () => {
  beforeEach(() => {
    store.setModules([
      {
        id: "module-1",
        displayId: "MOD-001",
        tenantId: fixtures.tenantId,
        projectId: null,
        shortTitle: "Literature synthesis",
        title: "Literature synthesis",
        description: "",
        status: "Active",
        pipelineStage: "Concept & Ideation",
        dueDate: "2026-09-15",
        assignedToUserId: null,
        archivedAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    fixtures.projects = [];
    fixtures.tasks = [];
    hookMocks.useModules.mockClear();
    hookMocks.pagination.totalItems = 1;
    hookMocks.pagination.totalPages = 1;
  });
  it.each([
    { count: 10, current: "Stage 3", hidden: [] as number[], expected: 30 },
    { count: 10, current: "Stage 3", hidden: [1, 2, 8, 9, 10], expected: 20 },
    { count: 10, current: "Stage 10", hidden: [1, 2], expected: 100 },
    { count: 1, current: "Stage 1", hidden: [], expected: 100 },
    { count: 0, current: null, hidden: [], expected: 0 },
    { count: 3, current: "Stage 2", hidden: [2], expected: 0 },
  ])("uses selected stages for progress: $current, $expected%", ({ count, current, hidden, expected }) => {
    const originalStages = fixtures.stageValues;
    try {
      fixtures.stageValues = Array.from({ length: count }, (_, index) => ({
        ...originalStages[0],
        id: `stage-${index + 1}`,
        value: `Stage ${index + 1}`,
        sortOrder: index + 1,
        hidden: hidden.includes(index + 1),
      })).reverse();
      store.setModules(store.getModules().map((module) => ({ ...module, pipelineStage: current })));
      render(<MemoryRouter><ModulesPage /></MemoryRouter>);

      const percentage = screen.getByText(`${expected}%`);
      expect(percentage.parentElement?.querySelector(".bg-primary")).toHaveStyle({ width: `${expected}%` });
    } finally {
      fixtures.stageValues = originalStages;
    }
  });

  it("updates progress when selected stages are reordered", () => {
    const originalStages = fixtures.stageValues;
    try {
      const { rerender } = render(<MemoryRouter><ModulesPage /></MemoryRouter>);
      expect(screen.getByText("50%")).toBeInTheDocument();

      fixtures.stageValues = originalStages.map((stage) => ({ ...stage, sortOrder: 3 - stage.sortOrder }));
      rerender(<MemoryRouter><ModulesPage /></MemoryRouter>);
      expect(screen.getByText("100%")).toBeInTheDocument();
    } finally {
      fixtures.stageValues = originalStages;
    }
  });

  it("requests the next modules page when Next is clicked", () => {
    hookMocks.pagination.totalItems = 21;
    hookMocks.pagination.totalPages = 2;
  
    render(
      <MemoryRouter>
        <ModulesPage />
      </MemoryRouter>,
    );
  
    expect(hookMocks.useModules).toHaveBeenCalledWith(
      fixtures.tenantId,
      undefined,
      1,
    );
  
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
  
    expect(hookMocks.useModules).toHaveBeenLastCalledWith(
      fixtures.tenantId,
      undefined,
      2,
    );
  
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
  });
  
  it("creates an independent module and shows it in the table", async () => {
    render(
      <MemoryRouter>
        <ModulesPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "New Paper" }));
    expect(screen.getByRole("textbox", { name: /Description/ })).not.toBeRequired();
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: /Pipeline stage/ })).toHaveTextContent(
        "Concept & Ideation",
      ),
    );
    fireEvent.change(screen.getByRole("textbox", { name: /Short title/ }), {
      target: { value: "Independent literature synthesis" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Paper" }));

    await waitFor(() =>
      expect(screen.getByText("Independent literature synthesis")).toBeInTheDocument(),
    );
    expect(screen.getAllByText("Independent paper").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Concept & Ideation").length).toBeGreaterThan(0);
  });

  it("includes an optional due date in the module form", () => {
    render(
      <MemoryRouter>
        <ModulesPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "New Paper" }));
    const dueDate = screen.getByLabelText(/Due date/);
    expect(dueDate).toHaveAttribute("placeholder", "DD/MM/YYYY");
    expect(dueDate).not.toBeRequired();
  });

  it("routes editing to the module page", () => {
    render(
      <MemoryRouter>
        <ModulesPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Edit Literature synthesis" }))
      .toHaveAttribute("href", "/modules/module-1?edit=true");
  });

  it("archives a module", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <MemoryRouter>
        <ModulesPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Archive Literature synthesis" }));
    expect(confirm).toHaveBeenCalled();

    await waitFor(() =>
      expect(screen.queryByText("Literature synthesis")).not.toBeInTheDocument(),
    );
  });

  it("allows a module to be linked to a project", async () => {
    fixtures.projects = [{ id: "project-1", userId: "user-owner", title: "Genome Project" }];
    render(
      <MemoryRouter>
        <ModulesPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "New Paper" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Short title/ }), {
      target: { value: "Linked paper" },
    });

    const projectSearch = screen.getByPlaceholderText("Search projects by title");
    fireEvent.click(projectSearch);
    fireEvent.click(await screen.findByText("Genome Project"));

    fireEvent.click(screen.getByRole("button", { name: "Create Paper" }));

    await waitFor(() => expect(screen.getByText("Linked paper")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Genome Project" })).toBeInTheDocument();
  });

  it("opens collaborator management directly from the modules table", () => {
    render(
      <MemoryRouter>
        <ModulesPage />
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Manage collaborators for Literature synthesis" }),
    );

    expect(screen.getByRole("heading", { name: "Paper collaborators" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Collaborator email" })).toBeInTheDocument();
  });

  it("filters the table by pipeline stage", () => {
    store.setModules([
      ...store.getModules(),
      {
        id: "module-2",
        displayId: "MOD-002",
        tenantId: fixtures.tenantId,
        projectId: null,
        shortTitle: "Review-stage paper",
        title: "Review-stage paper",
        description: "",
        status: "Active",
        pipelineStage: "Literature Review",
        dueDate: null,
        assignedToUserId: null,
        archivedAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    render(
      <MemoryRouter>
        <ModulesPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Literature synthesis")).toBeInTheDocument();
    expect(screen.getByText("Review-stage paper")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("combobox", { name: "Stage" }));
    fireEvent.click(screen.getByRole("option", { name: "Literature Review" }));

    expect(screen.queryByText("Literature synthesis")).not.toBeInTheDocument();
    expect(screen.getByText("Review-stage paper")).toBeInTheDocument();
  });

  it("shows a Progress column based on the paper's linked task completion", () => {
    fixtures.tasks = [
      { id: "task-1", moduleId: "module-1", status: "Complete" },
      { id: "task-2", moduleId: "module-1", status: "To do" },
      { id: "task-3", moduleId: "module-1", status: "Complete" },
      { id: "task-4", moduleId: "module-1", status: "Complete" },
    ];
    render(
      <MemoryRouter>
        <ModulesPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Sort by Progress" })).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  it("sorts by column, toggling direction on repeated clicks", () => {
    store.setModules([
      {
        id: "module-1",
        displayId: "MOD-001",
        tenantId: fixtures.tenantId,
        projectId: null,
        shortTitle: "Charlie module",
        title: "Charlie module",
        description: "",
        status: "Active",
        pipelineStage: null,
        dueDate: null,
        assignedToUserId: null,
        archivedAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "module-2",
        displayId: "MOD-002",
        tenantId: fixtures.tenantId,
        projectId: null,
        shortTitle: "Alpha module",
        title: "Alpha module",
        description: "",
        status: "Active",
        pipelineStage: null,
        dueDate: null,
        assignedToUserId: null,
        archivedAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "module-3",
        displayId: "MOD-003",
        tenantId: fixtures.tenantId,
        projectId: null,
        shortTitle: "Bravo module",
        title: "Bravo module",
        description: "",
        status: "Active",
        pipelineStage: null,
        dueDate: null,
        assignedToUserId: null,
        archivedAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    render(
      <MemoryRouter>
        <ModulesPage />
      </MemoryRouter>,
    );

    const titleOrder = () =>
      screen
        .getAllByRole("link")
        .map((el) => el.textContent)
        .filter((text): text is string =>
          ["Alpha module", "Bravo module", "Charlie module"].includes(text ?? ""),
        );

    expect(titleOrder()).toEqual(["Alpha module", "Bravo module", "Charlie module"]);

    fireEvent.click(screen.getByRole("button", { name: "Sort by Paper" }));
    expect(titleOrder()).toEqual(["Charlie module", "Bravo module", "Alpha module"]);
  });

  it("points to inviting collaborators after the paper is created, instead of staging them", () => {
    render(
      <MemoryRouter>
        <ModulesPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "New Paper" }));

    expect(screen.queryByLabelText("Collaborator email")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "After creating the paper, open it to invite collaborators by email using a secure acceptance link.",
      ),
    ).toBeInTheDocument();
  });
});
