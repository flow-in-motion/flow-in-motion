import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import TasksPage from "@/pages/tasks";
const hookMocks = vi.hoisted(() => ({
  useTasks: vi.fn(),
  pagination: {
    totalItems: 1,
    totalPages: 1,
  },
}));

type TaskFixture = {
  id: string;
  displayId: string | null;
  tenantId: string;
  projectId: string | null;
  moduleId: string | null;
  createdBy: string;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  visibility: string | null;
  workingWith: string | null;
  estimatedHours: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
};

// Mirrors react-query's cache-subscription behaviour so hand-written mocks
// still trigger a re-render when the underlying fixture data changes.
const store = vi.hoisted(() => {
  let tasks: TaskFixture[] = [];
  const listeners = new Set<() => void>();
  return {
    getTasks: () => tasks,
    setTasks: (next: TaskFixture[]) => {
      tasks = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
});

const fixtures = vi.hoisted(() => ({
  tenantId: "workspace-1",
  projects: [] as Array<{ id: string; title: string }>,
  modules: [] as Array<{ id: string; title: string }>,
  members: [
    {
      id: "membership-owner",
      userId: "user-owner",
      displayName: "Avi Researcher",
      email: "owner@example.com",
      role: "owner",
    },
  ],
}));

const sharingMutations = vi.hoisted(() => ({
  addTaskMember: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  apiClient: {
    POST: vi.fn().mockResolvedValue({ data: {}, error: undefined, response: new Response() }),
  },
}));

vi.mock("@/api/hooks", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    useCurrentWorkspace: () => ({ data: { id: fixtures.tenantId }, isPending: false }),
    useTrackEvent: () => vi.fn(),
    useMe: () => ({ data: { id: "user-owner" }, isPending: false }),
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
    useProjects: () => ({ data: { data: fixtures.projects, meta: { page: 1, pageSize: 20, totalItems: fixtures.projects.length, totalPages: 1 } }, isPending: false, isError: false }),
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
    useTasks: (
      tenantId: string,
      projectId?: string,
      page = 1,
    ) => {
      hookMocks.useTasks(tenantId, projectId, page);
    
      const tasks = useSyncExternalStore(
        store.subscribe,
        store.getTasks,
      );
    
      return {
        data: {
          data: tasks,
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
    useCreateTask: () => ({
      mutateAsync: vi.fn(async (input: Record<string, unknown>) => {
        const tasks = store.getTasks();
        const task: TaskFixture = {
          id: `task-${tasks.length + 1}`,
          displayId: `TSK-${String(tasks.length + 1).padStart(4, "0")}`,
          tenantId: fixtures.tenantId,
          projectId: (input.projectId as string | undefined) ?? null,
          moduleId: (input.moduleId as string | undefined) ?? null,
          createdBy: "user-owner",
          title: input.title as string,
          description: (input.description as string | undefined) ?? null,
          status: (input.status as string | undefined) ?? "To do",
          priority: (input.priority as string | undefined) ?? "Medium",
          visibility: (input.visibility as string | undefined) ?? "Private",
          workingWith: (input.workingWith as string | undefined) ?? null,
          estimatedHours: (input.estimatedHours as string | undefined) ?? null,
          dueDate: (input.dueDate as string | undefined) ?? null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        };
        store.setTasks([task, ...tasks]);
        return task;
      }),
    }),
    useUpdateTask: () => ({
      mutateAsync: vi.fn(
        async ({ taskId, input }: { taskId: string; input: Record<string, unknown> }) => {
          const updated = store.getTasks().map((item) =>
            item.id === taskId ? { ...item, ...input } : item,
          );
          store.setTasks(updated);
          return updated.find((item) => item.id === taskId);
        },
      ),
    }),
    useDeleteTask: () => ({
      mutateAsync: vi.fn(async (taskId: string) => {
        store.setTasks(store.getTasks().filter((item) => item.id !== taskId));
      }),
    }),
    useTaskMembers: () => ({ data: [], isPending: false }),
    useAddTaskMember: () => ({ mutate: sharingMutations.addTaskMember }),
    useRemoveTaskMember: () => ({ mutate: vi.fn() }),
    useCollaboratorInvitations: () => ({ data: [], isPending: false, isError: false }),
    useCreateDraftInvitation: () => ({ mutateAsync: vi.fn(), isPending: false, isError: false }),
    useSendInvitation: () => ({ mutateAsync: vi.fn(), isPending: false, isError: false }),
    useRevokeCollaboratorInvitation: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
    useUserSearch: () => ({ data: [], isPending: false, isError: false }),
  };
});

describe("TasksPage", () => {
  beforeEach(() => {
    sharingMutations.addTaskMember.mockClear();
    store.setTasks([
      {
        id: "task-1",
        displayId: "TSK-0441",
        tenantId: fixtures.tenantId,
        projectId: null,
        moduleId: null,
        createdBy: "user-owner",
        title: "Submit interim safety report to IRB",
        description: "Compile interim safety findings and submit the approved report package.",
        status: "To do",
        priority: "Critical",
        visibility: "Private",
        workingWith: null,
        estimatedHours: "3",
        dueDate: "2026-08-01",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    fixtures.projects = [];
    fixtures.modules = [];
    hookMocks.useTasks.mockClear();
    hookMocks.pagination.totalItems = 1;
    hookMocks.pagination.totalPages = 1;
  });
  it("returns to page 1 when the search changes", async () => {
    hookMocks.pagination.totalItems = 21;
    hookMocks.pagination.totalPages = 2;
  
    render(
      <MemoryRouter>
        <TasksPage />
      </MemoryRouter>,
    );
  
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
  
    expect(hookMocks.useTasks).toHaveBeenLastCalledWith(
      fixtures.tenantId,
      undefined,
      2,
    );
  
    fireEvent.change(screen.getByPlaceholderText("Search tasks…"), {
      target: { value: "safety" },
    });
  
    await waitFor(() => {
      expect(hookMocks.useTasks).toHaveBeenLastCalledWith(
        fixtures.tenantId,
        undefined,
        1,
      );
    });
  });
  
  it("requests the next page when Next is clicked", () => {
    hookMocks.pagination.totalItems = 21;
    hookMocks.pagination.totalPages = 2;
  
    render(
      <MemoryRouter>
        <TasksPage />
      </MemoryRouter>,
    );
  
    expect(hookMocks.useTasks).toHaveBeenCalledWith(
      fixtures.tenantId,
      undefined,
      1,
    );
  
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
  
    expect(hookMocks.useTasks).toHaveBeenLastCalledWith(
      fixtures.tenantId,
      undefined,
      2,
    );
  
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
  });
  it("shows the due date in the table and new-task form", () => {
    render(
      <MemoryRouter>
        <TasksPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Sort by Due" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "New Task" }));

    const dueDate = screen.getByLabelText(/Due date/);
    expect(dueDate).toHaveAttribute("placeholder", "DD/MM/YYYY");
    expect(dueDate).not.toBeRequired();
    expect(screen.getByRole("button", { name: "Choose due date" })).toBeInTheDocument();
  });

  it("links a task attached to a project-linked paper to the paper, not its parent project", () => {
    // The backend denormalizes a module-linked task's projectId to the
    // module's parent project, so both fields are set here — the "Linked
    // to" cell must still route to the paper, matching its own label.
    fixtures.projects = [{ id: "project-1", title: "Genome Sequencing Study" }];
    fixtures.modules = [{ id: "module-1", title: "Assay optimization" }];
    store.setTasks([
      ...store.getTasks(),
      {
        id: "task-2",
        displayId: "TSK-0442",
        tenantId: fixtures.tenantId,
        projectId: "project-1",
        moduleId: "module-1",
        createdBy: "user-owner",
        title: "Run inhibition assay",
        description: null,
        status: "To do",
        priority: "Medium",
        visibility: "Private",
        workingWith: null,
        estimatedHours: null,
        dueDate: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    render(
      <MemoryRouter>
        <TasksPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("link", { name: "Assay optimization" }),
    ).toHaveAttribute("href", "/modules/module-1");
  });

  it("points to inviting collaborators after the task is created, instead of staging them", () => {
    render(
      <MemoryRouter>
        <TasksPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "New Task" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Visibility" }));
    fireEvent.click(screen.getByRole("option", { name: "Shared" }));

    expect(screen.queryByRole("combobox", { name: /Share with/ })).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "After creating the task, open it to invite collaborators by email using a secure acceptance link.",
      ),
    ).toBeInTheDocument();
  });

  it("shows the collaborators icon only for shared tasks the current user owns", () => {
    store.setTasks(store.getTasks().map((task) => ({ ...task, visibility: "Shared" })));

    render(
      <MemoryRouter>
        <TasksPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("button", {
        name: "Manage collaborators for Submit interim safety report to IRB",
      }),
    ).toBeInTheDocument();
  });

  it("hides the collaborators icon for private tasks", () => {
    render(
      <MemoryRouter>
        <TasksPage />
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("button", { name: /Manage collaborators/ }),
    ).not.toBeInTheDocument();
  });

  it("routes table-row editing to the task page", () => {
    render(
      <MemoryRouter>
        <TasksPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("link", { name: "Edit Submit interim safety report to IRB" }),
    ).toHaveAttribute("href", "/tasks/task-1?edit=true");
  });

  it("deletes a task after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <MemoryRouter>
        <TasksPage />
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Delete Submit interim safety report to IRB" }),
    );

    await waitFor(() =>
      expect(screen.getByText("No tasks match the current filters.")).toBeInTheDocument(),
    );
  });
});
