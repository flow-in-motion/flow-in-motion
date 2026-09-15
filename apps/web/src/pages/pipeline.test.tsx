import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PipelinePage from "@/pages/pipeline";

type StageFixture = {
  id: string;
  tenantId: string | null;
  category: string;
  value: string;
  sortOrder: number;
  hidden: boolean;
  createdAt: string;
  updatedAt: string;
};

type ModuleFixture = {
  id: string;
  displayId: string | null;
  tenantId: string;
  projectId: string | null;
  shortTitle: string | null;
  title: string | null;
  description: string | null;
  tag: string | null;
  status: string | null;
  pipelineStage: string | null;
  assignedToUserId: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type ProjectFixture = {
  id: string;
  title: string;
};

// Mirrors react-query's cache-subscription behaviour so hand-written mocks
// still trigger a re-render when the underlying fixture data changes.
const modules = vi.hoisted(() => {
  let items: ModuleFixture[] = [];
  const listeners = new Set<() => void>();
  return {
    get: () => items,
    set: (next: ModuleFixture[]) => {
      items = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
});

const stages = vi.hoisted(() => {
  let items: StageFixture[] = [];
  const listeners = new Set<() => void>();
  return {
    get: () => items,
    set: (next: StageFixture[]) => {
      items = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
});

const fixtures = vi.hoisted(() => ({
  confetti: vi.fn(),
  tenantId: "workspace-1",
  projects: [] as ProjectFixture[],
}));

vi.mock("canvas-confetti", () => ({
  default: fixtures.confetti,
}));

vi.mock("@/api/hooks", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    useCurrentWorkspace: () => ({ data: { id: fixtures.tenantId }, isPending: false }),
    useMe: () => ({ data: { id: "user-owner", email: "owner@example.com", displayName: "Avi Researcher" } }),
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
        data: [],
        meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 },
      },
    }),
    useNotes: () => ({
      data: {
        data: [],
        meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 },
      },
    }),
    useUpdateTask: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useUpdateNote: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useMembers: () => ({
      data: {
        data: [],
        meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 },
      },
    }),
    useModules: () => {
      const moduleRows = useSyncExternalStore(modules.subscribe, modules.get);
      return {
        data: {
          data: moduleRows,
          meta: {
            page: 1,
            pageSize: 20,
            totalItems: moduleRows.length,
            totalPages: Math.max(1, Math.ceil(moduleRows.length / 20)),
          },
        },
        isPending: false,
        isError: false,
        error: undefined,
        refetch: vi.fn(),
      };
    },
    useModulePipelineStagePool: () => ({
      data: useSyncExternalStore(stages.subscribe, stages.get),
      isPending: false,
      isError: false,
    }),
    useUpdateModule: () => ({
      mutateAsync: vi.fn(
        async ({ moduleId, input }: { moduleId: string; input: Record<string, unknown> }) => {
          modules.set(
            modules.get().map((item) => (item.id === moduleId ? { ...item, ...input } : item)),
          );
        },
      ),
    }),
    useCreateModule: () => ({
      mutateAsync: vi.fn(async (input: Record<string, unknown>) => {
        const current = modules.get();
        const module: ModuleFixture = {
          id: `module-${current.length + 1}`,
          displayId: `MOD-${String(current.length + 1).padStart(3, "0")}`,
          tenantId: fixtures.tenantId,
          projectId: (input.projectId as string | undefined) ?? null,
          shortTitle: (input.shortTitle as string | undefined) ?? null,
          title: (input.title as string | undefined) ?? null,
          description: (input.description as string | undefined) ?? null,
          tag: (input.tag as string | undefined) ?? null,
          status: (input.status as string | undefined) ?? "Active",
          pipelineStage: (input.pipelineStage as string | undefined) ?? null,
          assignedToUserId: (input.assignedToUserId as string | undefined) ?? null,
          archivedAt: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        };
        modules.set([...current, module]);
        return module;
      }),
    }),
    useTrackEvent: () => vi.fn(),
    useEnumValues: () => ({ data: [], isPending: false }),
  };
});

function baseStages(): StageFixture[] {
  return [
    {
      id: "stage-1",
      tenantId: "workspace-1",
      category: "module_pipeline_stage",
      value: "Concept, Ideation",
      sortOrder: 1,
      hidden: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "stage-2",
      tenantId: "workspace-1",
      category: "module_pipeline_stage",
      value: "Data Collection",
      sortOrder: 2,
      hidden: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "stage-3",
      tenantId: "workspace-1",
      category: "module_pipeline_stage",
      value: "Submitted, Under Review",
      sortOrder: 3,
      hidden: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "stage-4",
      tenantId: "workspace-1",
      category: "module_pipeline_stage",
      value: "Complete",
      sortOrder: 4,
      hidden: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ];
}

function baseModules(): ModuleFixture[] {
  return [
    {
      id: "MOD-201",
      displayId: "MOD-201",
      tenantId: "workspace-1",
      projectId: null,
      shortTitle: "Sample Preparation Protocol",
      title: "Sample Preparation Protocol",
      description: null,
      tag: null,
      status: "Active",
      pipelineStage: "Concept, Ideation",
      assignedToUserId: null,
      archivedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ];
}

describe("PipelinePage", () => {
  beforeEach(() => {
    stages.set(baseStages());
    modules.set(baseModules());
    fixtures.projects = [];
    fixtures.confetti.mockReset();
  });

  it("provides a paper edit action in both flow and column views", () => {
    render(
      <MemoryRouter>
        <PipelinePage />
      </MemoryRouter>,
    );

    const editLinkName = "Edit Sample Preparation Protocol";

    expect(screen.getByRole("link", { name: editLinkName })).toHaveAttribute(
      "href",
      "/modules/MOD-201?edit=true&from=pipeline",
    );

    fireEvent.click(screen.getByRole("button", { name: "Columns" }));

    expect(screen.getByRole("link", { name: editLinkName })).toHaveAttribute(
      "href",
      "/modules/MOD-201?edit=true&from=pipeline",
    );
  });

  it("creates a new paper from the New Paper button", async () => {
    render(
      <MemoryRouter>
        <PipelinePage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "New Paper" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Short title/ }), {
      target: { value: "New pipeline paper" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Paper" }));

    await waitFor(() =>
      expect(screen.getByText("New pipeline paper")).toBeInTheDocument(),
    );
  });

  it("groups papers by their pipeline stage", () => {
    render(
      <MemoryRouter>
        <PipelinePage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("group", { name: "Concept, Ideation stage drop zone" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Sample Preparation Protocol")).toBeInTheDocument();
  });

  it("shows papers without a matching stage in the Unassigned column", () => {
    modules.set([
      { ...baseModules()[0]!, pipelineStage: null },
    ]);
    render(
      <MemoryRouter>
        <PipelinePage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/without a/)).toBeInTheDocument();
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
  });

  it("links Manage stages to the settings page", () => {
    render(
      <MemoryRouter>
        <PipelinePage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Manage stages" })).toHaveAttribute(
      "href",
      "/settings#paper-pipeline-stages",
    );
  });

  it("moves a paper to another stage with drag and drop", async () => {
    render(
      <MemoryRouter>
        <PipelinePage />
      </MemoryRouter>,
    );

    const title = "Sample Preparation Protocol";
    const card = screen.getByText(title).closest('[draggable="true"]');
    const targetStage = screen.getByRole("group", {
      name: "Data Collection stage drop zone",
    });
    const data = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: "none",
      dropEffect: "none",
      setData: (type: string, value: string) => data.set(type, value),
      getData: (type: string) => data.get(type) ?? "",
    };

    expect(card).not.toBeNull();
    fireEvent.dragStart(card!, { dataTransfer });
    fireEvent.dragOver(targetStage, { dataTransfer });
    fireEvent.drop(targetStage, { dataTransfer });

    await waitFor(() =>
      expect(within(targetStage).getByText(title)).toBeInTheDocument(),
    );
  });

  it("also allows a paper's stage to be changed without dragging", async () => {
    render(
      <MemoryRouter>
        <PipelinePage />
      </MemoryRouter>,
    );

    const title = "Sample Preparation Protocol";
    fireEvent.change(
      screen.getByRole("combobox", { name: `Move ${title} to stage` }),
      { target: { value: "3" } },
    );

    const targetStage = screen.getByRole("group", {
      name: "Complete stage drop zone",
    });
    await waitFor(() =>
      expect(within(targetStage).getByText(title)).toBeInTheDocument(),
    );
  });

  it("filters papers by project", () => {
    fixtures.projects = [{ id: "project-1", title: "Genome Project" }];
    modules.set([
      ...baseModules(),
      {
        id: "MOD-202",
        displayId: "MOD-202",
        tenantId: "workspace-1",
        projectId: "project-1",
        shortTitle: "Reagent Calibration",
        title: "Reagent Calibration",
        description: null,
        tag: null,
        status: "Active",
        pipelineStage: "Concept, Ideation",
        assignedToUserId: null,
        archivedAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    render(
      <MemoryRouter>
        <PipelinePage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Sample Preparation Protocol")).toBeInTheDocument();
    expect(screen.getByText("Reagent Calibration")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("combobox", { name: "Filter by project" }));
    fireEvent.click(screen.getByRole("option", { name: "Genome Project" }));

    expect(screen.getByText("Reagent Calibration")).toBeInTheDocument();
    expect(screen.queryByText("Sample Preparation Protocol")).not.toBeInTheDocument();
  });
  it("celebrates when a paper is dragged into Submitted, Under Review", async () => {
    render(
      <MemoryRouter>
        <PipelinePage />
      </MemoryRouter>,
    );
  
    const title = "Sample Preparation Protocol";
    const card = screen.getByText(title).closest('[draggable="true"]');
    const targetStage = screen.getByRole("group", {
      name: "Submitted, Under Review stage drop zone",
    });
  
    const data = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: "none",
      dropEffect: "none",
      setData: (type: string, value: string) => data.set(type, value),
      getData: (type: string) => data.get(type) ?? "",
    };
  
    expect(card).not.toBeNull();
  
    fireEvent.dragStart(card!, { dataTransfer });
    fireEvent.dragOver(targetStage, { dataTransfer });
    fireEvent.drop(targetStage, { dataTransfer });
  
    await waitFor(() =>
      expect(within(targetStage).getByText(title)).toBeInTheDocument(),
    );
  
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Paper submitted — congratulations!",
    );
    expect(screen.getByRole("status")).toHaveTextContent(title);
    expect(fixtures.confetti).toHaveBeenCalledOnce();
  });
  it("hides stages the workspace has marked hidden", () => {
    stages.set([
      ...baseStages().map((stage) =>
        stage.value === "Complete" ? { ...stage, hidden: true } : stage,
      ),
    ]);

    render(
      <MemoryRouter>
        <PipelinePage />
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("group", { name: "Complete stage drop zone" }),
    ).not.toBeInTheDocument();
  });
});
