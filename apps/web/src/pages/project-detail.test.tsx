import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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
    { id: "task-1", displayId: "TSK-001", title: "Run inhibition assay", status: "To do", priority: "Medium", dueDate: null as string | null, projectId: "PRJ-101" },
    { id: "task-2", displayId: "TSK-002", title: "Independent task", status: "To do", priority: "Medium", dueDate: null as string | null, projectId: null },
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
    researchArea: "Biochemistry" as string | null,
    status: "Active",
    importance: "Medium",
    scheduledFor: "2026-08-06" as string | null,
    dueDate: "2026-08-15" as string | null,
    totalBudget: "5000" as string | null,
    targetJournals: null,
    archivedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    role: null as string | null,
  },
}));

vi.mock("@/api/hooks", () => ({
  useModule: (_tenantId: string, moduleId: string) => ({
    data: fixtures.modules.find((module) => module.id === moduleId),
  }),
  usePaperVenueSuggestions: () => ({
    data: { journals: [], conferences: [] },
    isPending: false,
  }),
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
  useMyProjectArchiveImpact: () => ({
    data: { papers: 0, tasks: 0, notes: 0 },
    isPending: false,
  }),
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

vi.mock("@/components/projects/archive-project-dialog", () => ({
  ArchiveProjectDialog: () => null,
}));

describe("ProjectDetailPage", () => {
  beforeEach(() => {
    fixtures.project.status = "Active";
    fixtures.project.totalBudget = "5000";
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

  function renderProject() {
    return render(
      <MemoryRouter initialEntries={["/projects/PRJ-101"]}>
        <Routes>
          <Route
            path="projects/:projectId"
            element={<ProjectDetailPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("edits project details in place", async () => {
    render(
      <MemoryRouter initialEntries={["/projects/PRJ-101"]}>
        <Routes>
          <Route path="projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit Project" }));

    expect(screen.queryByText("Importance")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Importance" }),
    ).not.toBeInTheDocument();

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

  it("keeps project collaborator management inside Edit Project", () => {
    render(
      <MemoryRouter initialEntries={["/projects/PRJ-101"]}>
        <Routes>
          <Route path="projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("button", { name: "Add collaborator" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit Project" }));
    expect(screen.getByText("Collaborators (optional)")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add collaborator" }),
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

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

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

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

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

  it("shows papers, tasks and notes as separate panels, each of which can be hidden", () => {
    render(
      <MemoryRouter initialEntries={["/projects/PRJ-101"]}>
        <Routes>
          <Route path="projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("heading", { name: "Linked work" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Papers (1)" })).toBeInTheDocument();
    expect(screen.getByText("Run inhibition assay")).toBeInTheDocument();
    expect(screen.getByText("Kickoff notes")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Hide papers" }));
    expect(screen.queryByText("Assay optimization")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show papers" }),
    ).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(screen.getByRole("button", { name: "Hide tasks" }));
    expect(screen.queryByText("Run inhibition assay")).not.toBeInTheDocument();
    expect(screen.getByText("Kickoff notes")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Hide notes" }));
    expect(screen.queryByText("Kickoff notes")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Project collaborators" }),
    ).toBeInTheDocument();
  });

  it("lists the project's active tasks soonest first, three at a time", () => {
    const originalTasks = fixtures.tasks;
    const task = (id: string, title: string, dueDate: string | null, status = "To do") => ({
      ...originalTasks[0],
      id,
      displayId: id.toUpperCase(),
      title,
      dueDate,
      status,
    });
    fixtures.tasks = [
      task("t-late", "Late task", "2026-12-01"),
      task("t-undated", "Undated task", null),
      task("t-soon", "Soon task", "2026-10-20"),
      task("t-done", "Finished task", "2026-10-01", "Complete"),
      task("t-mid", "Middle task", "2026-11-01"),
    ];
    try {
      render(
        <MemoryRouter initialEntries={["/projects/PRJ-101"]}>
          <Routes>
            <Route path="projects/:projectId" element={<ProjectDetailPage />} />
          </Routes>
        </MemoryRouter>,
      );

      expect(
        screen.getByRole("heading", { name: "Tasks (4 active)" }),
      ).toBeInTheDocument();
      expect(screen.queryByText("Finished task")).not.toBeInTheDocument();
      expect(screen.getByText("Soon task")).toBeInTheDocument();
      expect(screen.getByText("Late task")).toBeInTheDocument();
      expect(screen.queryByText("Undated task")).not.toBeInTheDocument();
      expect(screen.getByText(/1 completed task is hidden/)).toBeInTheDocument();

      fireEvent.click(
        screen.getByRole("button", { name: "Show all 4 active tasks" }),
      );
      expect(screen.getByText("Undated task")).toBeInTheDocument();
    } finally {
      fixtures.tasks = originalTasks;
    }
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

  it("changes status directly from the project header", async () => {
    renderProject();

    fireEvent.click(
      screen.getByRole("combobox", {
        name: "Change status for Enzyme Kinetics Inhibition Study",
      }),
    );
    fireEvent.click(screen.getByRole("option", { name: "Stalled" }));

    await waitFor(() =>
      expect(fixtures.updateProject).toHaveBeenCalledWith({
        projectId: "PRJ-101",
        input: { status: "Stalled" },
      }),
    );

    expect(
      screen.queryByRole("heading", { name: "Edit project details" }),
    ).not.toBeInTheDocument();
  });

  it("restores the previous status when a header update fails", async () => {
    fixtures.updateProject.mockRejectedValueOnce(
      new Error("Unable to update status"),
    );
    renderProject();

    fireEvent.click(
      screen.getByRole("combobox", {
        name: "Change status for Enzyme Kinetics Inhibition Study",
      }),
    );
    fireEvent.click(screen.getByRole("option", { name: "Stalled" }));

    expect(await screen.findByRole("alert"))
      .toHaveTextContent("Unable to update status");

    await waitFor(() =>
      expect(
        screen.getByRole("combobox", {
          name: "Change status for Enzyme Kinetics Inhibition Study",
        }),
      ).toHaveTextContent("Active"),
    );
  });

  it.each([
    {
      button: "Change research area",
      label: "Research area",
      role: "textbox" as const,
      field: "researchArea",
      value: "Molecular biology",
    },
    {
      button: "Change budget",
      label: "Budget",
      role: "spinbutton" as const,
      field: "totalBudget",
      value: "7500",
    },
  ])("edits $label from the header", async ({
    button,
    label,
    role,
    field,
    value,
  }) => {
    renderProject();

    fireEvent.click(screen.getByRole("button", { name: button }));

    const dialog = screen.getByRole("dialog");
    fireEvent.change(
      within(dialog).getByRole(role, { name: label }),
      { target: { value } },
    );

    // Typing alone must not save the field.
    expect(fixtures.updateProject).not.toHaveBeenCalled();

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save" }),
    );

    await waitFor(() =>
      expect(fixtures.updateProject).toHaveBeenCalledWith({
        projectId: "PRJ-101",
        input: { [field]: value },
      }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it.each([
    {
      button: "Change research area",
      label: "Research area",
      role: "textbox" as const,
      field: "researchArea",
    },
    {
      button: "Change budget",
      label: "Budget",
      role: "spinbutton" as const,
      field: "totalBudget",
    },
  ])("clears $label from the header", async ({
    button,
    label,
    role,
    field,
  }) => {
    renderProject();

    fireEvent.click(screen.getByRole("button", { name: button }));

    const dialog = screen.getByRole("dialog");
    fireEvent.change(
      within(dialog).getByRole(role, { name: label }),
      { target: { value: "" } },
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save" }),
    );

    await waitFor(() =>
      expect(fixtures.updateProject).toHaveBeenCalledWith({
        projectId: "PRJ-101",
        input: { [field]: null },
      }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("saves a zero budget without treating it as empty", async () => {
    renderProject();

    fireEvent.click(
      screen.getByRole("button", { name: "Change budget" }),
    );

    const dialog = screen.getByRole("dialog");
    fireEvent.change(
      within(dialog).getByRole("spinbutton", { name: "Budget" }),
      { target: { value: "0" } },
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save" }),
    );

    await waitFor(() =>
      expect(fixtures.updateProject).toHaveBeenCalledWith({
        projectId: "PRJ-101",
        input: { totalBudget: "0" },
      }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("discards a research-area draft when cancelled", () => {
    renderProject();

    fireEvent.click(
      screen.getByRole("button", { name: "Change research area" }),
    );

    const dialog = screen.getByRole("dialog");
    fireEvent.change(
      within(dialog).getByRole("textbox", { name: "Research area" }),
      { target: { value: "Unsaved area" } },
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );

    expect(fixtures.updateProject).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Change research area" }),
    );

    expect(
      screen.getByRole("textbox", { name: "Research area" }),
    ).toHaveValue("Biochemistry");
  });

  it("preserves the research-area draft when saving fails", async () => {
    fixtures.updateProject.mockRejectedValueOnce(
      new Error("Unable to update research area"),
    );
    renderProject();

    fireEvent.click(
      screen.getByRole("button", { name: "Change research area" }),
    );

    const dialog = screen.getByRole("dialog");
    fireEvent.change(
      within(dialog).getByRole("textbox", { name: "Research area" }),
      { target: { value: "Keep this draft" } },
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save" }),
    );

    expect(await within(dialog).findByRole("alert"))
      .toHaveTextContent("Unable to update research area");
    expect(
      within(dialog).getByRole("textbox", { name: "Research area" }),
    ).toHaveValue("Keep this draft");
    expect(
      within(dialog).getByRole("button", { name: "Save" }),
    ).toBeEnabled();
  });

  it.each([
    {
      button: "Change scheduled date",
      label: "Scheduled date",
      field: "scheduledFor",
    },
    {
      button: "Change due date",
      label: "Due date",
      field: "dueDate",
    },
  ])("accepts a typed $label from the header", async ({
    button,
    label,
    field,
  }) => {
    renderProject();

    fireEvent.click(screen.getByRole("button", { name: button }));

    fireEvent.change(
      screen.getByRole("textbox", { name: label }),
      { target: { value: "20/11/2026" } },
    );

    await waitFor(() =>
      expect(fixtures.updateProject).toHaveBeenCalledWith({
        projectId: "PRJ-101",
        input: { [field]: "2026-11-20" },
      }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it.each([
    {
      button: "Change scheduled date",
      field: "scheduledFor",
    },
    {
      button: "Change due date",
      field: "dueDate",
    },
  ])("accepts a calendar selection for $field", async ({
    button,
    field,
  }) => {
    renderProject();

    fireEvent.click(screen.getByRole("button", { name: button }));

    const dateInput = screen
      .getByRole("dialog")
      .querySelector<HTMLInputElement>('input[type="date"]');

    expect(dateInput).not.toBeNull();

    fireEvent.change(dateInput!, {
      target: { value: "2026-11-20" },
    });

    await waitFor(() =>
      expect(fixtures.updateProject).toHaveBeenCalledWith({
        projectId: "PRJ-101",
        input: { [field]: "2026-11-20" },
      }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it.each([
    {
      button: "Change scheduled date",
      clearButton: "Clear scheduled date",
      field: "scheduledFor",
    },
    {
      button: "Change due date",
      clearButton: "Clear due date",
      field: "dueDate",
    },
  ])("clears $field from the header", async ({
    button,
    clearButton,
    field,
  }) => {
    renderProject();

    fireEvent.click(screen.getByRole("button", { name: button }));
    fireEvent.click(
      screen.getByRole("button", { name: clearButton }),
    );

    await waitFor(() =>
      expect(fixtures.updateProject).toHaveBeenCalledWith({
        projectId: "PRJ-101",
        input: { [field]: null },
      }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("keeps the previous due date when saving a new date fails", async () => {
    fixtures.updateProject.mockRejectedValueOnce(
      new Error("Unable to update due date"),
    );
    renderProject();

    fireEvent.click(
      screen.getByRole("button", { name: "Change due date" }),
    );

    const dialog = screen.getByRole("dialog");
    fireEvent.change(
      within(dialog).getByRole("textbox", { name: "Due date" }),
      { target: { value: "20/11/2026" } },
    );

    expect(await within(dialog).findByRole("alert"))
      .toHaveTextContent("Unable to update due date");

    expect(
      within(dialog).getByRole("textbox", { name: "Due date" }),
    ).toHaveValue("15/08/2026");
  });
});
