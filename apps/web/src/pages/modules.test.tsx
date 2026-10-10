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
  currentlyWithType?: "me" | "collaborator" | "journal" | "friendly_reviewer" | null;
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
      data: {
        id: "user-owner",
        displayName: "Avi Researcher",
        email: "owner@example.com",
      },
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
  useModulesOptions: vi.fn(),
  updateModule: vi.fn(),
  createDraftInvitation: vi.fn(),
  useModuleCollaborators: vi.fn(),
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
  tasks: [] as Array<{
    id: string;
    moduleId: string | null;
    status: string | null;
  }>,
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
    {
      id: "stage-1",
      tenantId: null,
      category: "module_pipeline_stage",
      value: "Concept & Ideation",
      sortOrder: 1,
      hidden: false,
      createdAt: "",
      updatedAt: "",
    },
    {
      id: "stage-2",
      tenantId: null,
      category: "module_pipeline_stage",
      value: "Literature Review",
      sortOrder: 2,
      hidden: false,
      createdAt: "",
      updatedAt: "",
    },
  ],
}));

vi.mock("@/api/client", () => ({
  apiClient: {
    POST: vi.fn().mockResolvedValue({
      data: {},
      error: undefined,
      response: new Response(),
    }),
  },
}));

vi.mock("@/api/hooks", async () => {
  const { useSyncExternalStore: useStore } = await import("react");
  return {
    usePaperVenueSuggestions: () => ({
      data: { journals: [], conferences: [] },
      isPending: false,
    }),
    useCurrentWorkspace: () => ({
      data: { id: fixtures.tenantId },
      isPending: false,
    }),
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
        meta: {
          page: 1,
          pageSize: 20,
          totalItems: fixtures.tasks.length,
          totalPages: 1,
        },
      },
      isPending: false,
    }),
    useNotes: () => ({
      data: {
        data: [],
        meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 },
      },
      isPending: false,
    }),
    useUpdateTask: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useUpdateNote: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useModules: (
      tenantId: string,
      projectId?: string,
      page = 1,
      _enabled = true,
      options?: Record<string, unknown>,
    ) => {
      void _enabled;
      hookMocks.useModules(tenantId, projectId, page);
      hookMocks.useModulesOptions(options);

      const moduleRows = useStore(store.subscribe, store.getModules);

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
    useModulePipelineStagePool: () => ({
      data: fixtures.stageValues,
      isPending: false,
      isError: false,
    }),
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
          assignedToUserId:
            (input.assignedToUserId as string | undefined) ?? null,
          archivedAt: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        };
        store.setModules([...modules, module]);
        return module;
      }),
    }),
    useUpdateModule: () => ({
      mutateAsync: hookMocks.updateModule,
      isPending: false,
    }),
    useArchiveModule: () => ({
      mutateAsync: vi.fn(async (moduleId: string) => {
        store.setModules(
          store.getModules().filter((item) => item.id !== moduleId),
        );
      }),
    }),
    useModuleCollaborators: (
      tenantId: string,
      moduleId: string,
      enabled: boolean,
    ) => {
      hookMocks.useModuleCollaborators(tenantId, moduleId, enabled);
      return {
        data: [
        {
          id: "collaborator-owner",
          tenantId: fixtures.tenantId,
          userId: "user-owner",
          roleId: "role-owner",
          role: "Owner",
          displayName: "Avi Researcher",
          email: "owner@example.com",
          createdAt: "",
          updatedAt: "",
        },
        ],
        isPending: false,
      };
    },
    useRemoveModuleCollaborator: () => ({ mutate: vi.fn(), isPending: false }),
    useCollaboratorInvitations: () => ({
      data: [],
      isPending: false,
      isError: false,
    }),
    useCreateDraftInvitation: () => ({
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
    }),
    useSendInvitation: () => ({
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
    }),
    useRevokeCollaboratorInvitation: () => ({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
    }),
    useUserSearch: () => ({ data: [], isPending: false, isError: false }),
    createDraftInvitation: hookMocks.createDraftInvitation,
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
        currentlyWithType: "me",
        archivedAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    fixtures.projects = [];
    fixtures.tasks = [];
    hookMocks.useModules.mockClear();
    hookMocks.useModulesOptions.mockClear();
    hookMocks.updateModule.mockReset();
    hookMocks.createDraftInvitation.mockReset();
    hookMocks.useModuleCollaborators.mockClear();
    hookMocks.updateModule.mockImplementation(
      async ({
        moduleId,
        input,
      }: {
        moduleId: string;
        input: Record<string, unknown>;
      }) => {
        const updated = store
          .getModules()
          .map((item) =>
            item.id === moduleId ? { ...item, ...input } : item,
          );
        store.setModules(updated);
        return updated.find((item) => item.id === moduleId);
      },
    );
    hookMocks.pagination.totalItems = 1;
    hookMocks.pagination.totalPages = 1;
  });
  it.each<{
    count: number;
    current: string | null;
    hidden: number[];
    expected: number;
  }>([
    { count: 10, current: "Stage 3", hidden: [], expected: 30 },
    { count: 10, current: "Stage 3", hidden: [1, 2, 8, 9, 10], expected: 20 },
    { count: 10, current: "Stage 10", hidden: [1, 2], expected: 100 },
    { count: 1, current: "Stage 1", hidden: [], expected: 100 },
    { count: 0, current: null, hidden: [], expected: 0 },
    { count: 3, current: "Stage 2", hidden: [2], expected: 0 },
  ])(
    "uses selected stages for progress: $current, $expected%",
    ({ count, current, hidden, expected }) => {
      const originalStages = fixtures.stageValues;
      try {
        fixtures.stageValues = Array.from({ length: count }, (_, index) => ({
          ...originalStages[0],
          id: `stage-${index + 1}`,
          value: `Stage ${index + 1}`,
          sortOrder: index + 1,
          hidden: hidden.includes(index + 1),
        })).reverse();
        store.setModules(
          store
            .getModules()
            .map((module) => ({ ...module, pipelineStage: current })),
        );
        render(
          <MemoryRouter>
            <ModulesPage />
          </MemoryRouter>,
        );

        const percentage = screen.getByText(`${expected}%`);
        expect(
          percentage.parentElement?.querySelector(".bg-primary"),
        ).toHaveStyle({ width: `${expected}%` });
      } finally {
        fixtures.stageValues = originalStages;
      }
    },
  );

  it("updates progress when selected stages are reordered", () => {
    const originalStages = fixtures.stageValues;
    try {
      const { rerender } = render(
        <MemoryRouter>
          <ModulesPage />
        </MemoryRouter>,
      );
      expect(screen.getByText("50%")).toBeInTheDocument();

      fixtures.stageValues = originalStages.map((stage) => ({
        ...stage,
        sortOrder: 3 - stage.sortOrder,
      }));
      rerender(
        <MemoryRouter>
          <ModulesPage />
        </MemoryRouter>,
      );
      expect(screen.getByText("100%")).toBeInTheDocument();
    } finally {
      fixtures.stageValues = originalStages;
    }
  });

  it("labels the paper date column as Follow up or due date", () => {
    render(
      <MemoryRouter>
        <ModulesPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Follow up or Due Date")).toBeInTheDocument();
  });

  it("changes a paper status directly from its list row", async () => {
    render(
      <MemoryRouter>
        <ModulesPage />
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole("combobox", {
        name: "Change status for Literature synthesis",
      }),
    );
    fireEvent.click(screen.getByRole("option", { name: "Review" }));

    await waitFor(() =>
      expect(hookMocks.updateModule).toHaveBeenCalledWith({
        moduleId: "module-1",
        input: { status: "Review" },
      }),
    );
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

  it("shows General for a paper assigned to the General project", () => {
    store.setModules(
      store.getModules().map((module) => ({
        ...module,
        projectId: "project-general",
      })),
    );

    render(
      <MemoryRouter>
        <ModulesPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("General")).toBeInTheDocument();
    expect(screen.queryByText("Unknown project")).not.toBeInTheDocument();
  });

  it("creates an independent module and shows it in the table", async () => {
    render(
      <MemoryRouter>
        <ModulesPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "New Paper" }));
    expect(
      screen.getByRole("textbox", { name: /Description/ }),
    ).not.toBeRequired();
    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: /Pipeline stage/ }),
      ).toHaveTextContent("Concept & Ideation"),
    );
    fireEvent.change(screen.getByRole("textbox", { name: /Short title/ }), {
      target: { value: "Independent literature synthesis" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Paper" }));

    await waitFor(() =>
      expect(
        screen.getByText("Independent literature synthesis"),
      ).toBeInTheDocument(),
    );
    expect(screen.getAllByText("Independent paper").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Concept & Ideation").length).toBeGreaterThan(0);
    expect(hookMocks.createDraftInvitation).not.toHaveBeenCalled();
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

    expect(
      screen.getByRole("link", { name: "Edit Literature synthesis" }),
    ).toHaveAttribute("href", "/modules/module-1?edit=true");
  });

  it("deletes a module", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <MemoryRouter>
        <ModulesPage />
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Delete Literature synthesis" }),
    );
    expect(confirm).toHaveBeenCalled();

    await waitFor(() =>
      expect(
        screen.queryByText("Literature synthesis"),
      ).not.toBeInTheDocument(),
    );
  });

  it("allows a module to be linked to a project", async () => {
    fixtures.projects = [
      { id: "project-1", userId: "user-owner", title: "Genome Project" },
    ];
    render(
      <MemoryRouter>
        <ModulesPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "New Paper" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Short title/ }), {
      target: { value: "Linked paper" },
    });

    const projectSearch = screen.getByPlaceholderText(
      "Search projects by title",
    );
    fireEvent.click(projectSearch);
    fireEvent.click(await screen.findByText("Genome Project"));

    fireEvent.click(screen.getByRole("button", { name: "Create Paper" }));

    await waitFor(() =>
      expect(screen.getByText("Linked paper")).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("link", { name: "Genome Project" }),
    ).toBeInTheDocument();
  });

  it("keeps collaborator management inside the paper edit page", () => {
    render(
      <MemoryRouter>
        <ModulesPage />
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("button", {
        name: "Manage collaborators for Literature synthesis",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Edit Literature synthesis" }),
    ).toHaveAttribute("href", "/modules/module-1?edit=true");
  });

  it("filters by multiple statuses and stages before pagination", async () => {
    const originalStages = fixtures.stageValues;
    fixtures.stageValues = [
      ...originalStages,
      {
        ...originalStages[0],
        id: "stage-3",
        value: "Submitted, Under Review",
        sortOrder: 3,
      },
    ];
    store.setModules([
      {
        ...store.getModules()[0],
        status: "Complete",
        pipelineStage: "Literature Review",
      },
      {
        id: "module-2",
        displayId: "MOD-002",
        tenantId: fixtures.tenantId,
        projectId: null,
        shortTitle: "Stalled concept paper",
        title: "Stalled concept paper",
        description: "",
        status: "Stalled",
        pipelineStage: "Concept & Ideation",
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
        shortTitle: "Review literature paper",
        title: "Review literature paper",
        description: "",
        status: "Review",
        pipelineStage: "Literature Review",
        dueDate: null,
        assignedToUserId: null,
        archivedAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "module-4",
        displayId: "MOD-004",
        tenantId: fixtures.tenantId,
        projectId: null,
        shortTitle: "Stalled submitted paper",
        title: "Stalled submitted paper",
        description: "",
        status: "Stalled",
        pipelineStage: "Submitted, Under Review",
        dueDate: null,
        assignedToUserId: null,
        archivedAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    try {
      render(
        <MemoryRouter>
          <ModulesPage />
        </MemoryRouter>,
      );

      fireEvent.keyDown(
        screen.getByRole("button", { name: "Filter by statuses" }),
        { key: "Enter" },
      );
      fireEvent.click(
        screen.getByRole("menuitemcheckbox", { name: "Complete" }),
      );
      fireEvent.click(
        screen.getByRole("menuitemcheckbox", { name: "Stalled" }),
      );
      fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
      await waitFor(() =>
        expect(screen.queryByRole("menu")).not.toBeInTheDocument(),
      );

      fireEvent.keyDown(
        screen.getByRole("button", { name: "Filter by stages" }),
        { key: "Enter" },
      );
      fireEvent.click(
        screen.getByRole("menuitemcheckbox", { name: "Literature Review" }),
      );
      fireEvent.click(
        screen.getByRole("menuitemcheckbox", { name: "Concept & Ideation" }),
      );
      fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });

      expect(screen.getByText("Literature synthesis")).toBeInTheDocument();
      expect(screen.getByText("Stalled concept paper")).toBeInTheDocument();
      expect(screen.queryByText("Review literature paper")).not.toBeInTheDocument();
      expect(screen.queryByText("Stalled submitted paper")).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Filter by statuses" }),
      ).toHaveTextContent("2 statuses");
      expect(
        screen.getByRole("button", { name: "Filter by stages" }),
      ).toHaveTextContent("2 stages");

      await waitFor(() =>
        expect(hookMocks.useModulesOptions).toHaveBeenLastCalledWith(
          expect.objectContaining({
            statuses: expect.arrayContaining(["Complete", "Stalled"]),
            stages: expect.arrayContaining([
              "Literature Review",
              "Concept & Ideation",
            ]),
          }),
        ),
      );
    } finally {
      fixtures.stageValues = originalStages;
    }
  });

  it("shows selected-stage progress even when linked task completion differs", () => {
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

    expect(
      screen.getByRole("button", { name: "Sort by Progress" }),
    ).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.queryByText("75%")).not.toBeInTheDocument();
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
          ["Alpha module", "Bravo module", "Charlie module"].includes(
            text ?? "",
          ),
        );

    expect(titleOrder()).toEqual([
      "Alpha module",
      "Bravo module",
      "Charlie module",
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Sort by Paper" }));
    expect(titleOrder()).toEqual([
      "Charlie module",
      "Bravo module",
      "Alpha module",
    ]);
  });

  it("offers optional collaborator entry while creating a paper", () => {
    render(
      <MemoryRouter>
        <ModulesPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "New Paper" }));

    expect(screen.getByLabelText("Collaborator email")).not.toBeRequired();
    expect(screen.getByText("Collaborators (optional)")).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Currently With" }),
    ).toHaveTextContent("Me");
  });

  it("saves an entered paper collaborator as an invitation draft", async () => {
    render(
      <MemoryRouter>
        <ModulesPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "New Paper" }));
    fireEvent.change(screen.getByLabelText("Collaborator email"), {
      target: { value: "sam@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add collaborator" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Short title/ }), {
      target: { value: "Collaborative paper" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Paper" }));

    await waitFor(() =>
      expect(hookMocks.createDraftInvitation).toHaveBeenCalledWith(
        "module",
        fixtures.tenantId,
        "module-2",
        { email: "sam@example.com", name: undefined, affiliation: undefined },
      ),
    );
  });

  it("updates Currently With directly from the paper list", async () => {
    render(
      <MemoryRouter>
        <ModulesPage />
      </MemoryRouter>,
    );

    expect(hookMocks.useModuleCollaborators).toHaveBeenCalledWith(
      fixtures.tenantId,
      "module-1",
      false,
    );
    fireEvent.keyDown(
      screen.getByRole("combobox", {
        name: "Change Currently With for Literature synthesis",
      }),
      { key: "Enter" },
    );
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Journal" }),
    );

    await waitFor(() =>
      expect(hookMocks.updateModule).toHaveBeenCalledWith({
        moduleId: "module-1",
        input: { currentlyWithType: "journal" },
      }),
    );
  });

  it("filters by multiple Currently With categories before pagination", async () => {
    store.setModules([
      {
        ...store.getModules()[0],
        currentlyWithType: "journal",
      },
      {
        ...store.getModules()[0],
        id: "module-2",
        displayId: "MOD-002",
        shortTitle: "Friendly review paper",
        title: "Friendly review paper",
        currentlyWithType: "friendly_reviewer",
      },
      {
        ...store.getModules()[0],
        id: "module-3",
        displayId: "MOD-003",
        shortTitle: "Paper with me",
        title: "Paper with me",
        currentlyWithType: "me",
      },
    ]);

    render(
      <MemoryRouter>
        <ModulesPage />
      </MemoryRouter>,
    );

    fireEvent.keyDown(
      screen.getByRole("button", { name: "Filter by current holders" }),
      { key: "Enter" },
    );
    fireEvent.click(
      screen.getByRole("menuitemcheckbox", { name: "Journal" }),
    );
    fireEvent.click(
      screen.getByRole("menuitemcheckbox", { name: "Friendly reviewer" }),
    );

    expect(screen.getByText("Literature synthesis")).toBeInTheDocument();
    expect(screen.getByText("Friendly review paper")).toBeInTheDocument();
    expect(screen.queryByText("Paper with me")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(hookMocks.useModulesOptions).toHaveBeenLastCalledWith(
        expect.objectContaining({
          currentlyWithTypes: expect.arrayContaining([
            "journal",
            "friendly_reviewer",
          ]),
        }),
      ),
    );
  });
});
