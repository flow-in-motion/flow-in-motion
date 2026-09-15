import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import TaskDetailPage from "@/pages/task-detail";

const fixtures = vi.hoisted(() => ({
  updateTask: vi.fn(),
  task: {
    id: "task-1",
    displayId: "TSK-001",
    tenantId: "workspace-1",
    projectId: null as string | null,
    moduleId: null as string | null,
    createdBy: "user-owner",
    title: "Draft literature review",
    description: null,
    status: "To do",
    priority: "Medium",
    dueDate: null,
    estimatedHours: null,
    visibility: "Private" as string,
    workingWith: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  projects: [{ id: "project-1", title: "Genome Sequencing Study" }],
  modules: [{ id: "module-1", title: "Assay optimization" }],
  members: [
    {
      id: "membership-owner",
      userId: "user-owner",
      displayName: "Avi Researcher",
      email: "owner@example.com",
      affiliation: null as string | null,
      role: "owner",
    },
  ],
}));

vi.mock("@/api/hooks", () => ({
  useCurrentWorkspace: () => ({ data: { id: "workspace-1" }, isPending: false }),
  useMyTask: () => ({
    data: fixtures.task,
    isPending: false,
    isError: false,
    error: undefined,
    refetch: vi.fn(),
  }),
  useProjects: () => ({
    data: { data: fixtures.projects, meta: { page: 1, pageSize: 20, totalItems: fixtures.projects.length, totalPages: 1 } },
  }),
  useModules: () => ({
    data: { data: fixtures.modules, meta: { page: 1, pageSize: 20, totalItems: fixtures.modules.length, totalPages: 1 } },
  }),
  useUpdateMyTask: () => ({ mutateAsync: fixtures.updateTask, isPending: false }),
  useTrackEvent: () => vi.fn(),
  useProject: (_tenantId: string, projectId?: string) => ({
    data: projectId === "project-1" ? { title: "Genome Sequencing Study" } : undefined,
    isError: false,
  }),
  useMembers: () => ({
    data: { data: fixtures.members, meta: { page: 1, pageSize: 20, totalItems: fixtures.members.length, totalPages: 1 } },
    isPending: false,
  }),
  useTaskMembers: () => ({ data: [], isPending: false }),
  useAddTaskMember: () => ({ mutate: vi.fn() }),
  useRemoveTaskMember: () => ({ mutate: vi.fn(), isPending: false }),
  useUserSearch: () => ({ data: [], isPending: false }),
  useMe: () => ({ data: { id: "user-owner" }, isPending: false }),
  useCollaboratorInvitations: () => ({ data: [], isPending: false, isError: false }),
  useCreateDraftInvitation: () => ({ mutateAsync: vi.fn(), isPending: false, isError: false }),
  useSendInvitation: () => ({ mutateAsync: vi.fn(), isPending: false, isError: false }),
  useRevokeCollaboratorInvitation: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
}));

describe("TaskDetailPage", () => {
  beforeEach(() => {
    fixtures.task.projectId = null;
    fixtures.task.moduleId = null;
    fixtures.task.visibility = "Private";
    fixtures.updateTask.mockReset();
    fixtures.updateTask.mockResolvedValue(fixtures.task);
  });

  it("returns to whatever page linked into edit mode when editing is cancelled", () => {
    render(
      <MemoryRouter
        initialEntries={["/tasks", "/tasks/task-1?edit=true"]}
        initialIndex={1}
      >
        <Routes>
          <Route path="tasks/:taskId" element={<TaskDetailPage />} />
          <Route path="tasks" element={<h1>Tasks</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel Editing" }));

    expect(screen.getByRole("heading", { name: "Tasks" })).toBeInTheDocument();
  });

  it("falls back to the read-only task view when there is no previous page to return to", () => {
    render(
      <MemoryRouter initialEntries={["/tasks/task-1?edit=true"]}>
        <Routes>
          <Route path="tasks/:taskId" element={<TaskDetailPage />} />
          <Route path="tasks" element={<h1>Tasks</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel Editing" }));

    expect(
      screen.getByRole("button", { name: "Edit Task" }),
    ).toBeInTheDocument();
  });

  it("unlinks a task from its project via the Unlink button", async () => {
    fixtures.task.projectId = "project-1";
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <MemoryRouter initialEntries={["/tasks/task-1"]}>
        <Routes>
          <Route path="tasks/:taskId" element={<TaskDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Unlink" }));

    await waitFor(() =>
      expect(fixtures.updateTask).toHaveBeenCalledWith({
        taskId: "task-1",
        input: { projectId: null, moduleId: null },
      }),
    );
  });

  it("shows the paper (not the project) when linked to a project-linked paper, alongside its parent project", () => {
    // The backend denormalizes a module-linked task's projectId to the
    // module's parent project, so a task linked to a paper still has both
    // moduleId and projectId set — the UI must not mistake that for a
    // direct project link.
    fixtures.task.moduleId = "module-1";
    fixtures.task.projectId = "project-1";
    render(
      <MemoryRouter initialEntries={["/tasks/task-1"]}>
        <Routes>
          <Route path="tasks/:taskId" element={<TaskDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Paper")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Paper Assay optimization/ }),
    ).toHaveAttribute("href", "/modules/module-1");

    expect(screen.getByText("Parent project")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Parent project Genome Sequencing Study/ }),
    ).toHaveAttribute("href", "/projects/project-1");
  });

  it("blocks saving a new link until a project is actually picked", () => {
    render(
      <MemoryRouter initialEntries={["/tasks/task-1"]}>
        <Routes>
          <Route path="tasks/:taskId" element={<TaskDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Change link" }));
    fireEvent.click(screen.getByRole("button", { name: "Project" }));

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("shows the task overview expanded by default at the top, with an option to hide it", () => {
    render(
      <MemoryRouter initialEntries={["/tasks/task-1"]}>
        <Routes>
          <Route path="tasks/:taskId" element={<TaskDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "Task overview" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Hide overview" }),
    ).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByRole("button", { name: "Hide overview" }));

    expect(
      screen.queryByRole("heading", { name: "Task overview" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show overview" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("shows linked work expanded by default, with an option to hide it", () => {
    fixtures.task.projectId = "project-1";
    render(
      <MemoryRouter initialEntries={["/tasks/task-1"]}>
        <Routes>
          <Route path="tasks/:taskId" element={<TaskDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Genome Sequencing Study")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Hide linked work" }),
    ).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByRole("button", { name: "Hide linked work" }));

    expect(screen.queryByText("Genome Sequencing Study")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show linked work" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("shows task members expanded by default, with an option to hide them", () => {
    render(
      <MemoryRouter initialEntries={["/tasks/task-1"]}>
        <Routes>
          <Route path="tasks/:taskId" element={<TaskDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "Manage task members" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Hide task members" }),
    ).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByRole("button", { name: "Hide task members" }));

    expect(
      screen.queryByRole("heading", { name: "Manage task members" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show task members" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("shows the task's creator as Owner in the members list, even though they aren't an explicit member", () => {
    fixtures.task.visibility = "Shared";
    render(
      <MemoryRouter initialEntries={["/tasks/task-1"]}>
        <Routes>
          <Route path="tasks/:taskId" element={<TaskDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Avi Researcher")).toBeInTheDocument();
    expect(screen.getByText("Owner")).toBeInTheDocument();
  });
});
