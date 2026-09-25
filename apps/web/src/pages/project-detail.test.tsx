import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ProjectDetailPage from "@/pages/project-detail";

const fixtures = vi.hoisted(() => ({
  updateProject: vi.fn(),
  updateModule: vi.fn(),
  updateTask: vi.fn(),
  updateNote: vi.fn(),
  modules: [
    { id: "module-1", displayId: "MOD-001", title: "Assay optimization", status: "Active", projectId: "PRJ-101" },
    { id: "module-2", displayId: "MOD-002", title: "Independent paper", status: "Active", projectId: null },
  ],
  tasks: [
    { id: "task-1", displayId: "TSK-001", title: "Run inhibition assay", status: "To do", priority: "Medium", dueDate: null, projectId: "PRJ-101" },
    { id: "task-2", displayId: "TSK-002", title: "Independent task", status: "To do", priority: "Medium", dueDate: null, projectId: null },
  ],
  notes: [
    { id: "note-1", title: "Kickoff notes", content: "Discussed scope", projectId: "PRJ-101" },
    { id: "note-2", title: "Independent note", content: "Unrelated", projectId: null },
  ],
  project: {
    id: "PRJ-101",
    displayId: "PRJ-101",
    userId: "user-owner",
    tenantId: "workspace-1",
    title: "Enzyme Kinetics Inhibition Study",
    description: null,
    researchArea: "Biochemistry",
    status: "Active",
    importance: "Medium",
    scheduledFor: "2026-08-06",
    dueDate: "2026-08-15",
    totalBudget: "5000",
    targetJournals: null,
    archivedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    role: null as string | null,
  },
}));

vi.mock("@/api/hooks", () => ({
  useProjects: () => ({
    data: {
      generalProject: {
        id: "project-general",
        tenantId: "workspace-1",
        userId: "user-owner",
        title: "General",
      },
      data: [],
      meta: {
        page: 1,
        pageSize: 20,
        totalItems: 0,
        totalPages: 1,
      },
    },
    isPending: false,
    isError: false,
  }),
  useMe: () => ({
    data: {
      id: "user-owner",
      email: "owner@example.com",
      displayName: "Avi Researcher",
    },
  }),
  useCurrentWorkspace: () => ({
    data: { id: "workspace-1" },
    isPending: false,
  }),
  useMembers: () => ({
    data: {
      data: [
        {
          id: "membership-owner",
          userId: "user-owner",
          displayName: "Avi Researcher",
          email: "owner@example.com",
          role: "owner",
        },
      ],
      meta: {
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
      },
    },
    isPending: false,
  }),
  useMyProject: () => ({
    data: fixtures.project,
    isPending: false,
    isError: false,
    error: undefined,
    refetch: vi.fn(),
  }),
  useUpdateMyProject: () => ({
    mutateAsync: fixtures.updateProject,
    isPending: false,
  }),
  useArchiveMyProject: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateTask: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateModule: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateModule: () => ({ mutateAsync: fixtures.updateModule, isPending: false }),
  useUpdateTask: () => ({ mutateAsync: fixtures.updateTask, isPending: false }),
  useUpdateNote: () => ({ mutateAsync: fixtures.updateNote, isPending: false }),
  useTrackEvent: () => vi.fn(),
  useEnumValues: () => ({ data: [], isPending: false }),
  useModulePipelineStagePool: () => ({ data: [], isPending: false, isError: false }),
  useModules: (_tenantId: string, projectId?: string) => ({
    data: {
      data: projectId
        ? fixtures.modules.filter((module) => module.projectId === projectId)
        : fixtures.modules,
      meta: {
        page: 1,
        pageSize: 20,
        totalItems: fixtures.modules.length,
        totalPages: 1,
      },
    },
  }),
  useTasks: (_tenantId: string, projectId?: string) => ({
    data: {
      data: projectId
        ? fixtures.tasks.filter((task) => task.projectId === projectId)
        : fixtures.tasks,
      meta: {
        page: 1,
        pageSize: 20,
        totalItems: fixtures.tasks.length,
        totalPages: 1,
      },
    },
  }),
  useNotes: (_tenantId: string, projectId?: string) => ({
    data: {
      data: projectId
        ? fixtures.notes.filter((note) => note.projectId === projectId)
        : fixtures.notes,
      meta: {
        page: 1,
        pageSize: 20,
        totalItems: fixtures.notes.length,
        totalPages: 1,
      },
    },
  }),
  useProjectCollaborators: () => ({ data: [], isPending: false }),
  useRemoveProjectCollaborator: () => ({ mutate: vi.fn(), isPending: false }),
  useCollaboratorInvitations: () => ({ data: [], isPending: false, isError: false }),
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
}));

describe("ProjectDetailPage", () => {
  beforeEach(() => {
    fixtures.project.title = "Enzyme Kinetics Inhibition Study";
    fixtures.project.researchArea = "Biochemistry";
    fixtures.project.scheduledFor = "2026-08-06";
    fixtures.project.dueDate = "2026-08-15";
    fixtures.updateProject.mockReset();
    fixtures.updateProject.mockImplementation(
      async ({ input }: { input: Record<string, unknown> }) => {
        Object.assign(fixtures.project, input);
        return fixtures.project;
      },
    );
    fixtures.updateModule.mockReset();
    fixtures.updateModule.mockResolvedValue(fixtures.modules[0]);
    fixtures.updateTask.mockReset();
    fixtures.updateTask.mockResolvedValue(fixtures.tasks[0]);
    fixtures.updateNote.mockReset();
    fixtures.updateNote.mockResolvedValue(fixtures.notes[0]);
  });

  it("edits project details in place", async () => {
    render(
      <MemoryRouter initialEntries={["/projects/PRJ-101"]}>
        <Routes>
          <Route path="projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit Project" }));

    const scheduledFor = screen.getByLabelText(/Scheduled for/);
    const dueDate = screen.getByLabelText(/Due date/);
    expect(scheduledFor).toHaveValue("06/08/2026");
    expect(scheduledFor).not.toBeRequired();
    expect(dueDate).toHaveValue("15/08/2026");
    expect(dueDate).not.toBeRequired();

    fireEvent.change(screen.getByRole("textbox", { name: /Project title/ }), {
      target: { value: "Updated research project" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Research area" }), {
      target: { value: "Updated research area" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Updated research project" }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText("Updated research area")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit Project" }),
    ).toBeInTheDocument();
  });

  it("opens directly in edit mode from a project-table edit link", () => {
    render(
      <MemoryRouter initialEntries={["/projects/PRJ-101?edit=true"]}>
        <Routes>
          <Route path="projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "Edit project details" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Save Changes" }),
    ).toBeInTheDocument();
  });

  it("returns to whatever page linked into edit mode when editing is cancelled", () => {
    render(
      <MemoryRouter
        initialEntries={["/pipeline", "/projects/PRJ-101?edit=true"]}
        initialIndex={1}
      >
        <Routes>
          <Route path="projects/:projectId" element={<ProjectDetailPage />} />
          <Route path="pipeline" element={<h1>Pipeline</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel Editing" }));

    expect(
      screen.getByRole("heading", { name: "Pipeline" }),
    ).toBeInTheDocument();
  });

  it("falls back to the read-only project view when there is no previous page to return to", () => {
    render(
      <MemoryRouter initialEntries={["/projects/PRJ-101?edit=true"]}>
        <Routes>
          <Route path="projects/:projectId" element={<ProjectDetailPage />} />
          <Route path="pipeline" element={<h1>Pipeline</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel Editing" }));

    expect(
      screen.getByRole("button", { name: "Edit Project" }),
    ).toBeInTheDocument();
  });

  it("shows collaborators expanded by default, with an option to hide them", () => {
    render(
      <MemoryRouter initialEntries={["/projects/PRJ-101"]}>
        <Routes>
          <Route path="projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "Project collaborators" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Papers (1)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Hide collaborators" }),
    ).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByRole("button", { name: "Hide collaborators" }));

    expect(
      screen.queryByRole("heading", { name: "Project collaborators" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Papers (1)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show collaborators" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("shows linked work expanded by default, with an option to hide it", () => {
    render(
      <MemoryRouter initialEntries={["/projects/PRJ-101"]}>
        <Routes>
          <Route path="projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "Papers (1)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Hide linked work" }),
    ).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByRole("button", { name: "Hide linked work" }));

    expect(
      screen.queryByRole("heading", { name: "Papers (1)" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Project collaborators" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show linked work" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("moves a module from this project into General", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <MemoryRouter initialEntries={["/projects/PRJ-101"]}>
        <Routes>
          <Route path="projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Unlink Assay optimization from this project" }),
    );

    await waitFor(() =>
      expect(fixtures.updateModule).toHaveBeenCalledWith({
        moduleId: "module-1",
        input: { projectId: "project-general" },
      }),
    );
  });

  it("unlinks a task from this project", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <MemoryRouter initialEntries={["/projects/PRJ-101"]}>
        <Routes>
          <Route path="projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Unlink Run inhibition assay from this project" }),
    );

    await waitFor(() =>
      expect(fixtures.updateTask).toHaveBeenCalledWith({
        taskId: "task-1",
        input: { projectId: null },
      }),
    );
  });

  it("unlinks a note from this project", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <MemoryRouter initialEntries={["/projects/PRJ-101"]}>
        <Routes>
          <Route path="projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Unlink Kickoff notes from this project" }),
    );

    await waitFor(() =>
      expect(fixtures.updateNote).toHaveBeenCalledWith({
        noteId: "note-1",
        input: { projectId: null },
      }),
    );
  });

  it("links an existing paper to this project", async () => {
    render(
      <MemoryRouter initialEntries={["/projects/PRJ-101"]}>
        <Routes>
          <Route path="projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Link existing" })[0]);

    const searchInput = await screen.findByPlaceholderText("Search papers by title");
    fireEvent.click(searchInput);
    fireEvent.click(await screen.findByText("Independent paper"));
    fireEvent.click(screen.getByRole("button", { name: "Link papers" }));

    await waitFor(() =>
      expect(fixtures.updateModule).toHaveBeenCalledWith({
        moduleId: "module-2",
        input: { projectId: "PRJ-101" },
      }),
    );
  });

  it("links an existing task to this project", async () => {
    render(
      <MemoryRouter initialEntries={["/projects/PRJ-101"]}>
        <Routes>
          <Route path="projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Link existing" })[1]);

    const searchInput = await screen.findByPlaceholderText("Search tasks by title");
    fireEvent.click(searchInput);
    fireEvent.click(await screen.findByText("Independent task"));
    fireEvent.click(screen.getByRole("button", { name: "Link tasks" }));

    await waitFor(() =>
      expect(fixtures.updateTask).toHaveBeenCalledWith({
        taskId: "task-2",
        input: { projectId: "PRJ-101" },
      }),
    );
  });

  it("links an existing note to this project", async () => {
    render(
      <MemoryRouter initialEntries={["/projects/PRJ-101"]}>
        <Routes>
          <Route path="projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Link existing" })[2]);

    const searchInput = await screen.findByPlaceholderText("Search notes by title");
    fireEvent.click(searchInput);
    fireEvent.click(await screen.findByText("Independent note"));
    fireEvent.click(screen.getByRole("button", { name: "Link notes" }));

    await waitFor(() =>
      expect(fixtures.updateNote).toHaveBeenCalledWith({
        noteId: "note-2",
        input: { projectId: "PRJ-101" },
      }),
    );
  });
});
