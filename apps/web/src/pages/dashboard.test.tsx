import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardPage from "@/pages/dashboard";
import { PreferencesContext } from "@/preferences/preferences-context";

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div role="menu">{children}</div>,
  DropdownMenuItem: ({
    children,
    onSelect,
  }: {
    children: ReactNode;
    onSelect?: (event: { preventDefault: () => void }) => void;
  }) => (
    <button type="button" role="menuitem" onClick={(event) => onSelect?.(event)}>
      {children}
    </button>
  ),
}));

const queryState = vi.hoisted(() => ({
  projectsPending: false,
  tasksPending: false,
  stagesPending: false,
  projectsError: null as Error | null,
  tasksError: null as Error | null,
  stagesError: null as Error | null,
  projectsRefetch: vi.fn(),
  tasksRefetch: vi.fn(),
  stagesRefetch: vi.fn(),
}));

vi.mock("@/api/hooks", () => ({
  useCurrentWorkspace: () => ({
    data: {
      id: "workspace-1",
      name: "Research Operations",
      membershipRole: "owner",
    },
    isPending: false,
  }),
  useModulePipelineStagePool: () => ({
    data: [
      { id: "stage-1", value: "Concept, Ideation", sortOrder: 1, hidden: false },
      { id: "stage-2", value: "Lit Review, Study Design, Protocol", sortOrder: 2, hidden: false },
    ],
    isPending: queryState.stagesPending,
    isError: queryState.stagesError !== null,
    error: queryState.stagesError,
    refetch: queryState.stagesRefetch,
  }),
  useProjects: () => ({
    data: { data: [], meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 } },
    isPending: queryState.projectsPending,
    isError: queryState.projectsError !== null,
    error: queryState.projectsError,
    refetch: queryState.projectsRefetch,
  }),
  useTasks: () => ({
    data: {
      summary: { open: 61 },
      data: [],
      meta: {
        page: 1,
        pageSize: 20,
        totalItems: 85,
        totalPages: 5,
      },
    },
    isPending: queryState.tasksPending,
    isError: queryState.tasksError !== null,
    error: queryState.tasksError,
    refetch: queryState.tasksRefetch,
  }),
  useModules: () => ({
    data: { data: [], meta: { page: 1, pageSize: 20, totalItems: 47, totalPages: 3 }, summary: { active: 34, review: 25 } },
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useNotes: () => ({
    data: { data: [], meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 } },
    isPending: false,
  }),
  useMe: () => ({ data: { id: "user-1" }, isPending: false }),
  useMembers: () => ({
    data: { data: [], meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 } },
    isPending: false,
  }),
  useEnumValues: () => ({ data: [], isPending: false }),
  useCreateProject: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateTask: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateModule: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateNote: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateConference: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateModule: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateTask: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateNote: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useTrackEvent: () => vi.fn(),
  useUserSearch: () => ({ data: [], isPending: false, isError: false }),
}));

vi.mock("@/components/dashboard/priority-tasks-table", () => ({
  PriorityTasksTable: () => <div data-testid="dashboard-table-tasks">Tasks table</div>,
}));
vi.mock("@/components/dashboard/pipeline-overview-table", () => ({
  PipelineOverviewTable: () => <div data-testid="dashboard-table-pipeline">Pipeline table</div>,
}));
vi.mock("@/components/dashboard/conference-submissions-table", () => ({
  ConferenceSubmissionsTable: () => (
    <div data-testid="dashboard-table-conferences">Conferences table</div>
  ),
}));

describe("DashboardPage", () => {
  it("uses server totals even when the loaded page is empty", () => {
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(screen.getByText("34 of 47")).toBeInTheDocument();
    expect(screen.getByText("61 of 85")).toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument();
  });

  beforeEach(() => {
    window.localStorage.clear();
    queryState.projectsPending = false;
    queryState.tasksPending = false;
    queryState.stagesPending = false;
    queryState.projectsError = null;
    queryState.tasksError = null;
    queryState.stagesError = null;
    queryState.projectsRefetch.mockReset();
    queryState.tasksRefetch.mockReset();
    queryState.stagesRefetch.mockReset();
  });

  it("shows a loading state while dashboard data is pending", () => {
    queryState.projectsPending = true;
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Loading dashboard");
    expect(screen.queryByRole("heading", { name: "Stalled papers" })).not.toBeInTheDocument();
  });

  it("shows an error state and retries when dashboard data fails to load", () => {
    queryState.tasksError = new Error("Tasks endpoint is down");
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Tasks endpoint is down")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(queryState.tasksRefetch).toHaveBeenCalledOnce();
  });

  it("shows only the pipeline and conference tables by default, with insight cards hidden", () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("dashboard-table-pipeline")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-table-conferences")).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-table-tasks")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Stalled papers" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Task health" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Priority workload" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Project progress" })).not.toBeInTheDocument();
  });

  it("lets you create a paper or a note from the Create menu", () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("menuitem", { name: /^Paper$/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /^Note$/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: /^Paper$/ }));
    expect(screen.getByRole("dialog", { name: "Create a new paper" })).toBeInTheDocument();
  });

  it("adds a hidden-by-default insight card back via Customise dashboard", () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Customise dashboard" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Task health/ }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(screen.getByRole("heading", { name: "Task health" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /tasks completed/ })).toBeInTheDocument();
  });

  it("customises widget visibility and preserves the layout across remounts", () => {
    const view = render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Customise dashboard" }));
    expect(screen.getByRole("heading", { name: "Dashboard widgets" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /Task health/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Upcoming conference submissions/ }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(screen.getByRole("heading", { name: "Task health" })).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-table-conferences")).not.toBeInTheDocument();
    expect(screen.getAllByTestId(/dashboard-table-/).map((table) => table.textContent)).toEqual([
      "Pipeline table",
    ]);

    view.unmount();
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Task health" })).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-table-conferences")).not.toBeInTheDocument();
    expect(screen.getAllByTestId(/dashboard-table-/).map((table) => table.textContent)).toEqual([
      "Pipeline table",
    ]);
  });

  it("saves the first dashboard change after hydrating a default server layout", async () => {
    const updateDashboardLayout = vi.fn();
    render(
      <MemoryRouter>
        <PreferencesContext.Provider
          value={{
            workspaceId: "workspace-1",
            workspacePreferences: {
              dashboardLayout: {
                order: [
                  "stalled-papers",
                  "task-health",
                  "priority-workload",
                  "project-progress",
                  "tasks",
                  "pipeline",
                  "conferences",
                ],
                hidden: [],
              },
            },
            updateDashboardLayout,
            updateTableColumns: vi.fn(),
            updatePipelineHiddenStages: vi.fn(),
          }}
        >
          <DashboardPage />
        </PreferencesContext.Provider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Customise dashboard" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Task health/ }));

    await waitFor(() => expect(updateDashboardLayout).toHaveBeenCalledTimes(1));
    expect(updateDashboardLayout.mock.calls[0]?.[0].hidden).toContain("task-health");
  });

  it("debounces a burst of reorder clicks into a single save with the final order", async () => {
    const updateDashboardLayout = vi.fn();
    render(
      <MemoryRouter>
        <PreferencesContext.Provider
          value={{
            workspaceId: "workspace-1",
            workspacePreferences: {
              dashboardLayout: {
                order: [
                  "stalled-papers",
                  "task-health",
                  "priority-workload",
                  "project-progress",
                  "tasks",
                  "pipeline",
                  "conferences",
                ],
                hidden: [],
              },
            },
            updateDashboardLayout,
            updateTableColumns: vi.fn(),
            updatePipelineHiddenStages: vi.fn(),
          }}
        >
          <DashboardPage />
        </PreferencesContext.Provider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Customise dashboard" }));

    // Move "Stalled papers" (first row) down three times in quick succession —
    // this used to fire one save request per click; each carried its own
    // snapshot of the order, and an earlier request settling after a later
    // one could stomp the final order back to an intermediate step.
    const moveDown = screen.getByRole("button", { name: "Move Stalled papers down" });
    fireEvent.click(moveDown);
    fireEvent.click(moveDown);
    fireEvent.click(moveDown);

    await waitFor(() => expect(updateDashboardLayout).toHaveBeenCalledTimes(1));
    expect(updateDashboardLayout.mock.calls[0]?.[0].order).toEqual([
      "task-health",
      "priority-workload",
      "project-progress",
      "stalled-papers",
      "tasks",
      "pipeline",
      "conferences",
    ]);
  });
});
