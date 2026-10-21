import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ModuleDetailPage from "@/pages/module-detail";

interface FixtureTask {
  id: string;
  displayId: string;
  moduleId: string | null;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
}

const fixtures = vi.hoisted(() => ({
  taskRequests: vi.fn(),
  noteRequests: vi.fn(),
  updateModule: vi.fn(),
  archiveModule: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  updateNote: vi.fn(),
  createSubmission: vi.fn(),
  updateSubmission: vi.fn(),
  deleteSubmission: vi.fn(),
  collaborators: [
    {
      id: "collaborator-owner",
      tenantId: "workspace-1",
      userId: "user-owner",
      role: "Owner",
      displayName: "Avi Researcher",
      email: "owner@example.com",
      affiliation: "University of Melbourne",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "collaborator-editor",
      tenantId: "workspace-1",
      userId: "user-editor",
      role: "Editor",
      displayName: "Sam Lee",
      email: "sam@example.com",
      affiliation: "CSIRO",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  submissions: [] as Array<{
    id: string;
    tenantId: string;
    moduleId: string;
    createdBy: string;
    submittedDate: string;
    journalName: string;
    paperTitle?: string | null;
    status: string;
    revisionRounds: number | null;
    decisionDate: string | null;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
  }>,
  tasks: [
    {
      id: "task-1",
      displayId: "TSK-001",
      moduleId: "module-1",
      title: "Extract references",
      status: "To do",
      priority: "Medium",
      dueDate: null,
    },
    {
      id: "task-2",
      displayId: "TSK-002",
      moduleId: null,
      title: "Independent task",
      status: "To do",
      priority: "Medium",
      dueDate: null,
    },
  ] as FixtureTask[],
  notes: [
    {
      id: "note-1",
      moduleId: "module-1",
      title: "Meeting notes",
      content: "Discussed scope",
      updatedAt: "2026-09-02T00:00:00.000Z",
      modulePinned: false,
    },
    {
      id: "note-2",
      moduleId: null as string | null,
      title: "Independent note",
      content: "Unrelated",
      updatedAt: "2026-09-01T00:00:00.000Z",
      modulePinned: false,
    },
  ],
  module: {
    id: "module-1",
    displayId: "MOD-001",
    tenantId: "workspace-1",
    projectId: null as string | null,
    shortTitle: "Literature synthesis",
    title: "Literature synthesis",
    description: null,
    abstract: null as string | null,
    targetJournal: null as string | null,
    backupJournal: null as string | null,
    targetConference: null as string | null,
    backupConference: null as string | null,
    tag: "Research Paper",
    status: "Active",
    priority: "High" as string | null,
    pipelineStage: "Concept",
    dueDate: "2026-09-15" as string | null,
    assignedToUserId: null,
    currentlyWithType: null,
    archivedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  projects: [
    {
      id: "project-1",
      userId: "user-owner",
      title: "Genome Sequencing Study",
    },
    {
      id: "project-2",
      userId: "user-owner",
      title: "Protein Folding Analysis",
    },
  ],
  stages: [
    {
      id: "stage-1",
      tenantId: null,
      category: "module_pipeline_stage",
      value: "Concept",
      sortOrder: 1,
      hidden: false,
      createdAt: "",
      updatedAt: "",
    },
    {
      id: "stage-2",
      tenantId: null,
      category: "module_pipeline_stage",
      value: "Submitted, Under Review",
      sortOrder: 2,
      hidden: false,
      createdAt: "",
      updatedAt: "",
    },
    {
      id: "stage-3",
      tenantId: null,
      category: "module_pipeline_stage",
      value: "Publication",
      sortOrder: 3,
      hidden: false,
      createdAt: "",
      updatedAt: "",
    },
  ],
}));
vi.mock("@/api/hooks", () => ({
  useMyModuleArchiveImpact: () => ({
    data: { tasks: 3, notes: 2 },
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useMyModuleArchiveDestinations: () => ({
    data: [
      {
        id: "destination-paper",
        shortTitle: "Destination paper",
        title: null,
        displayId: "MOD-0099",
      },
    ],
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useArchiveMyModuleWithOptions: () => ({
    mutateAsync: fixtures.archiveModule,
    isPending: false,
  }),
  useModule: () => ({ data: fixtures.module }),
  useModules: () => ({
    data: {
      data: [fixtures.module],
      meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
    },
    isFetching: false,
  }),
  usePaperVenueSuggestions: () => ({
    data: { journals: [], conferences: [] },
    isPending: false,
  }),
  useCurrentWorkspace: () => ({
    data: { id: "workspace-1" },
    isPending: false,
  }),
  useMe: () => ({
    data: {
      id: "user-owner",
      displayName: "Avi Researcher",
      email: "owner@example.com",
    },
  }),
  useMyModule: () => ({
    data: fixtures.module,
    isPending: false,
    isError: false,
    error: undefined,
    refetch: vi.fn(),
  }),
  useModulePipelineStagePool: () => ({
    data: fixtures.stages,
    isPending: false,
    isError: false,
  }),
  useUpdateMyModule: () => ({
    mutateAsync: fixtures.updateModule,
    isPending: false,
  }),
  useArchiveMyModule: () => ({
    mutateAsync: fixtures.archiveModule,
    isPending: false,
  }),
  useCreateTask: () => ({ mutateAsync: fixtures.createTask, isPending: false }),
  useUpdateTask: () => ({ mutateAsync: fixtures.updateTask, isPending: false }),
  useUpdateNote: () => ({ mutateAsync: fixtures.updateNote, isPending: false }),
  useModuleSubmissions: () => ({
    data: fixtures.submissions,
    isPending: false,
  }),
  useCreateModuleSubmission: () => ({
    mutateAsync: fixtures.createSubmission,
    isPending: false,
  }),
  useUpdateModuleSubmission: () => ({
    mutateAsync: fixtures.updateSubmission,
    isPending: false,
  }),
  useDeleteModuleSubmission: () => ({
    mutateAsync: fixtures.deleteSubmission,
    isPending: false,
  }),
  useTrackEvent: () => vi.fn(),
  useTasks: (...args: unknown[]) => {
    fixtures.taskRequests(...args);
    return ({
    data: {
      data: fixtures.tasks,
      meta: {
        page: 1,
        pageSize: 20,
        totalItems: fixtures.tasks.length,
        totalPages: 1,
      },
    },
  }); },
  useNotes: (...args: unknown[]) => {
    fixtures.noteRequests(...args);
    return ({
    data: {
      data: fixtures.notes,
      meta: {
        page: 1,
        pageSize: 20,
        totalItems: fixtures.notes.length,
        totalPages: 1,
      },
    },
  }); },
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
  useEnumValues: () => ({ data: [] }),
  useMyProject: (projectId: string) => ({
    data: fixtures.projects.find((project) => project.id === projectId),
    isError: false,
  }),
  useProjects: () => ({
    data: {
      generalProject: {
        id: "project-general",
        tenantId: "workspace-1",
        userId: "user-owner",
        title: "General",
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
  }),
  useModuleCollaborators: () => ({
    data: fixtures.collaborators,
    isPending: false,
  }),
  useModuleCollaboratorContacts: () => ({
    data: [
      ...fixtures.collaborators.map((collaborator) => ({
        id: `user:${collaborator.userId}`,
        userId: collaborator.userId,
        invitationId: null,
        displayName: collaborator.displayName,
        affiliation: collaborator.affiliation,
      })),
      {
        id: "invitation:draft-1",
        userId: null,
        invitationId: "draft-1",
        displayName: "Dana Draft",
        affiliation: "Monash University",
      },
    ],
    isPending: false,
  }),
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
}));

describe("ModuleDetailPage", () => {
  beforeEach(() => {
    fixtures.taskRequests.mockClear();
    fixtures.noteRequests.mockClear();
    fixtures.notes.forEach((note) => {
      note.modulePinned = false;
    });
    fixtures.module.dueDate = "2026-09-15";
    fixtures.module.status = "Active";
    fixtures.module.pipelineStage = "Concept";
    fixtures.module.priority = "High";
    fixtures.module.projectId = "project-general";
    fixtures.module.abstract = null;
    fixtures.module.targetJournal = null;
    fixtures.module.backupJournal = null;
    fixtures.module.targetConference = null;
    fixtures.module.backupConference = null;
    fixtures.updateModule.mockReset();
    fixtures.updateModule.mockImplementation(
      async ({ input }: { input: Record<string, unknown> }) => {
        Object.assign(fixtures.module, input);
        return fixtures.module;
      },
    );
    fixtures.archiveModule.mockReset();
    fixtures.archiveModule.mockResolvedValue({ module: fixtures.module, warning: "" });
    fixtures.createTask.mockReset();
    fixtures.createTask.mockResolvedValue({ id: "task-new" });
    fixtures.updateTask.mockReset();
    fixtures.updateTask.mockResolvedValue(fixtures.tasks[0]);
    fixtures.updateNote.mockReset();
    fixtures.updateNote.mockResolvedValue(fixtures.notes[0]);
    fixtures.submissions = [];
    fixtures.createSubmission.mockReset();
    fixtures.createSubmission.mockResolvedValue({ id: "submission-1" });
    fixtures.updateSubmission.mockReset();
    fixtures.updateSubmission.mockResolvedValue({ id: "submission-1" });
    fixtures.deleteSubmission.mockReset();
    fixtures.deleteSubmission.mockResolvedValue({
      message: "Submission deleted successfully",
    });
  });

  function nativeDateInputFor(textInputId: string) {
    const textInput = document.getElementById(textInputId)!;
    return textInput
      .closest(".relative")!
      .querySelector<HTMLInputElement>('input[type="date"]')!;
  }

  function renderPage() {
    render(
      <MemoryRouter initialEntries={["/modules/module-1"]}>
        <Routes>
          <Route path="modules/:moduleId" element={<ModuleDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("requests only this paper's linked work without restricting it to the first 20 rows", () => {
    renderPage();
    expect(fixtures.taskRequests).toHaveBeenCalledWith(
      "workspace-1", undefined, 1, true, { moduleId: "module-1", pageSize: "all" },
    );
    expect(fixtures.noteRequests).toHaveBeenCalledWith(
      "workspace-1", undefined, 1, true, { moduleId: "module-1", pageSize: "all" },
    );
    expect(screen.queryByText("Independent task")).not.toBeInTheDocument();
    expect(screen.queryByText("Independent note")).not.toBeInTheDocument();
  });

  it("returns to Papers after deleting through the linked-work dialog", async () => {
    render(
      <MemoryRouter initialEntries={["/modules/module-1"]}>
        <Routes>
          <Route
            path="modules/:moduleId"
            element={<ModuleDetailPage />}
          />
          <Route path="modules" element={<h1>Papers list</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Delete Paper" }),
    );

    const dialog = within(await screen.findByRole("dialog"));

    expect(fixtures.archiveModule).not.toHaveBeenCalled();

    fireEvent.click(
      dialog.getByRole("button", { name: "Delete Paper" }),
    );

    await waitFor(() =>
      expect(fixtures.archiveModule).toHaveBeenCalledWith({
        moduleId: "module-1",
        mode: "archive_contents",
      }),
    );

    expect(
      await screen.findByRole("heading", { name: "Papers list" }),
    ).toBeInTheDocument();
  });

  it("cancels paper deletion without sending an archive request", async () => {
    renderPage();

    fireEvent.click(
      screen.getByRole("button", { name: "Delete Paper" }),
    );

    const dialog = within(await screen.findByRole("dialog"));

    fireEvent.click(dialog.getByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    expect(fixtures.archiveModule).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Edit Paper" }),
    ).toBeInTheDocument();
  });

  it("keeps the deletion dialog open when archiving fails", async () => {
    fixtures.archiveModule.mockRejectedValueOnce(
      new Error("Unable to delete paper"),
    );

    renderPage();

    fireEvent.click(
      screen.getByRole("button", { name: "Delete Paper" }),
    );

    const dialog = within(await screen.findByRole("dialog"));

    fireEvent.click(
      dialog.getByRole("button", { name: "Delete Paper" }),
    );

    expect(
      await dialog.findByRole("alert"),
    ).toHaveTextContent("Unable to delete paper");

    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await waitFor(() =>
      expect(
        dialog.getByRole("button", { name: "Delete Paper" }),
      ).toBeEnabled(),
    );
  });

  it("accepts a typed next due date from the header", async () => {
    renderPage();

    fireEvent.click(
      screen.getByRole("button", { name: "Change next due date" }),
    );

    fireEvent.change(
      screen.getByRole("textbox", { name: "Next Due Date" }),
      { target: { value: "20/11/2026" } },
    );

    await waitFor(() =>
      expect(fixtures.updateModule).toHaveBeenCalledWith({
        moduleId: "module-1",
        input: { dueDate: "2026-11-20" },
      }),
    );
  });

  it("changes the next due date from the header", async () => {
    renderPage();

    fireEvent.click(
      screen.getByRole("button", { name: "Change next due date" }),
    );

    expect(
      screen.getByRole("button", { name: "Choose next due date" }),
    ).toBeInTheDocument();

    fireEvent.change(nativeDateInputFor("header-module-due"), {
      target: { value: "2026-11-20" },
    });

    await waitFor(() =>
      expect(fixtures.updateModule).toHaveBeenCalledWith({
        moduleId: "module-1",
        input: { dueDate: "2026-11-20" },
      }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    expect(
      screen.getByRole("button", { name: "Change next due date" }),
    ).toHaveTextContent("20/11/2026");
  });

  it("clears the next due date from the header", async () => {
    renderPage();

    fireEvent.click(
      screen.getByRole("button", { name: "Change next due date" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Clear next due date" }),
    );

    await waitFor(() =>
      expect(fixtures.updateModule).toHaveBeenCalledWith({
        moduleId: "module-1",
        input: { dueDate: null },
      }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    expect(
      screen.getByRole("button", { name: "Change next due date" }),
    ).toHaveTextContent("—");
  });

  it("keeps the previous date and picker open when saving fails", async () => {
    fixtures.updateModule.mockRejectedValueOnce(
      new Error("Unable to update date"),
    );
    renderPage();

    fireEvent.click(
      screen.getByRole("button", { name: "Change next due date" }),
    );
    fireEvent.change(nativeDateInputFor("header-module-due"), {
      target: { value: "2026-11-20" },
    });

    await waitFor(() =>
      expect(screen.getByRole("dialog"))
        .toHaveTextContent("Unable to update date"),
    );

    expect(
      screen.getByRole("textbox", { name: "Next Due Date" }),
    ).toHaveValue("15/09/2026");
  });

  it("shows and edits paper priority", async () => {
    renderPage();

    expect(screen.getByText("Priority")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit Paper" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Priority" }));
    fireEvent.click(screen.getByRole("option", { name: "Critical" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(fixtures.updateModule).toHaveBeenCalledWith(
        expect.objectContaining({
          moduleId: "module-1",
          input: expect.objectContaining({ priority: "Critical" }),
        }),
      ),
    );
  });

  it("celebrates after moving the paper into Submitted, Under Review", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Edit Paper" }));

    fireEvent.click(screen.getByRole("combobox", { name: "Pipeline stage" }));

    fireEvent.click(
      screen.getByRole("option", {
        name: "Submitted, Under Review",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(fixtures.updateModule).toHaveBeenCalledWith(
        expect.objectContaining({
          moduleId: "module-1",
          input: expect.objectContaining({
            pipelineStage: "Submitted, Under Review",
          }),
        }),
      ),
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Paper submitted — congratulations!",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Literature synthesis",
    );
    expect(screen.getByTestId("celebration-video")).toBeInTheDocument();
  });
  it("returns to whatever page linked into edit mode when editing is cancelled", () => {
    render(
      <MemoryRouter
        initialEntries={["/pipeline", "/modules/module-1?edit=true"]}
        initialIndex={1}
      >
        <Routes>
          <Route path="modules/:moduleId" element={<ModuleDetailPage />} />
          <Route path="pipeline" element={<h1>Pipeline</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(
      screen.getByRole("heading", { name: "Pipeline" }),
    ).toBeInTheDocument();
  });

  it("falls back to the read-only module view when there is no previous page to return to", () => {
    render(
      <MemoryRouter initialEntries={["/modules/module-1?edit=true"]}>
        <Routes>
          <Route path="modules/:moduleId" element={<ModuleDetailPage />} />
          <Route path="pipeline" element={<h1>Pipeline</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(
      screen.getByRole("button", { name: "Edit Paper" }),
    ).toBeInTheDocument();
  });

  it("allows the linked project to be changed inside Edit Paper", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Edit Paper" }));
    const projectSearch = screen.getByRole("combobox", {
      name: "Linked project",
    });
    fireEvent.click(projectSearch);
    fireEvent.click(
      screen.getByRole("option", { name: /Genome Sequencing Study/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(fixtures.updateModule).toHaveBeenCalledWith(
        expect.objectContaining({
          moduleId: "module-1",
          input: expect.objectContaining({ projectId: "project-1" }),
        }),
      ),
    );
  });

  it("also offers collaborator management inside Edit Paper", () => {
    renderPage();

    expect(
      screen.queryByRole("button", { name: "Add collaborator" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit Paper" }));

    expect(
      screen.getByRole("button", { name: "Add collaborator" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Collaborator email" }),
    ).toBeInTheDocument();
  });

  it("opens paper collaborators to the right for Currently With", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Edit Paper" }));
    fireEvent.keyDown(
      screen.getByRole("combobox", { name: "Currently With" }),
      {
        key: "Enter",
      },
    );
    expect(screen.getByRole("menuitem", { name: "Me" })).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Journal" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Friendly reviewer" }),
    ).toBeInTheDocument();
    fireEvent.pointerMove(await screen.findByText("Collaborators/Coauthors"));

    const collaborator = await screen.findByText("Sam Lee");
    expect(collaborator).toBeInTheDocument();
    expect(screen.queryByText("Avi Researcher")).not.toBeInTheDocument();
  });

  it("opens the Add task dialog pre-linked to this module and creates the task", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Add task" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Task title/ }), {
      target: { value: "Draft outline" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Task" }));

    await waitFor(() =>
      expect(fixtures.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Draft outline",
          moduleId: "module-1",
        }),
      ),
    );
  });

  it("links the Add note button to the daily notes composer pre-linked to this module", () => {
    renderPage();

    expect(screen.getByRole("link", { name: /Add note/ })).toHaveAttribute(
      "href",
      "/daily-notes?moduleId=module-1&new=true",
    );
  });

  it("shows the linked project in the top panel", () => {
    fixtures.module.projectId = "project-1";
    renderPage();

    expect(screen.getByText("Linked project")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Genome Sequencing Study" }),
    ).toHaveAttribute("href", "/projects/project-1");
  });

  it("unlinks a task from this module", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Unlink Extract references from this module",
      }),
    );

    await waitFor(() =>
      expect(fixtures.updateTask).toHaveBeenCalledWith({
        taskId: "task-1",
        input: { moduleId: null },
      }),
    );
  });

  it("unlinks a note from this module", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Unlink Meeting notes from this module",
      }),
    );

    await waitFor(() =>
      expect(fixtures.updateNote).toHaveBeenCalledWith({
        noteId: "note-1",
        input: { moduleId: null },
      }),
    );
  });

  it("links an existing task to this paper", async () => {
    renderPage();

    fireEvent.click(
      screen.getAllByRole("button", { name: "Link existing" })[0],
    );

    const searchInput = await screen.findByPlaceholderText(
      "Search tasks by title",
    );
    fireEvent.click(searchInput);
    fireEvent.click(await screen.findByText("Independent task"));
    fireEvent.click(screen.getByRole("button", { name: "Link tasks" }));

    await waitFor(() =>
      expect(fixtures.updateTask).toHaveBeenCalledWith({
        taskId: "task-2",
        input: { moduleId: "module-1" },
      }),
    );
  });

  it("links an existing note to this paper", async () => {
    renderPage();

    fireEvent.click(
      screen.getAllByRole("button", { name: "Link existing" })[1],
    );

    const searchInput = await screen.findByPlaceholderText(
      "Search notes by title",
    );
    fireEvent.click(searchInput);
    fireEvent.click(await screen.findByText("Independent note"));
    fireEvent.click(screen.getByRole("button", { name: "Link notes" }));

    await waitFor(() =>
      expect(fixtures.updateNote).toHaveBeenCalledWith({
        noteId: "note-2",
        input: { moduleId: "module-1" },
      }),
    );
  });

  it("logs a new submission for this paper", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Log submission" }));

    fireEvent.change(nativeDateInputFor("submission-submitted-date"), {
      target: { value: "2026-03-01" },
    });
    fireEvent.change(
      screen.getByRole("textbox", { name: /Journal \/ venue/ }),
      {
        target: { value: "Nature Communications" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Save submission" }));

    await waitFor(() =>
      expect(fixtures.createSubmission).toHaveBeenCalledWith(
        expect.objectContaining({
          submittedDate: "2026-03-01",
          journalName: "Nature Communications",
          paperTitle: "Literature synthesis",
          status: "Submitted",
        }),
      ),
    );
  });

  it("starts a new submission with the paper's current title, which can be changed", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Log submission" }));

    const titleField = screen.getByRole("textbox", {
      name: "Paper title (as submitted)",
    });
    expect(titleField).toHaveValue("Literature synthesis");

    fireEvent.change(titleField, {
      target: { value: "  A shorter title for this journal  " },
    });
    fireEvent.change(nativeDateInputFor("submission-submitted-date"), {
      target: { value: "2026-03-01" },
    });
    fireEvent.change(
      screen.getByRole("textbox", { name: /Journal \/ venue/ }),
      { target: { value: "PLOS ONE" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Save submission" }));

    await waitFor(() =>
      expect(fixtures.createSubmission).toHaveBeenCalledWith(
        expect.objectContaining({
          journalName: "PLOS ONE",
          paperTitle: "A shorter title for this journal",
        }),
      ),
    );
  });

  it("shows the submitted title and lets it be cleared when editing", async () => {
    fixtures.submissions = [
      {
        id: "submission-1",
        tenantId: "workspace-1",
        moduleId: "module-1",
        createdBy: "user-owner",
        submittedDate: "2026-03-01",
        journalName: "Nature Communications",
        paperTitle: "An earlier working title",
        status: "Submitted",
        revisionRounds: null,
        decisionDate: null,
        notes: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    renderPage();

    expect(screen.getByText("“An earlier working title”")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Edit submission to Nature Communications",
      }),
    );
    const titleField = screen.getByRole("textbox", {
      name: "Paper title (as submitted)",
    });
    expect(titleField).toHaveValue("An earlier working title");

    fireEvent.change(titleField, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(fixtures.updateSubmission).toHaveBeenCalledWith({
        submissionId: "submission-1",
        input: expect.objectContaining({ paperTitle: null }),
      }),
    );
  });

  it("edits an existing submission", async () => {
    fixtures.submissions = [
      {
        id: "submission-1",
        tenantId: "workspace-1",
        moduleId: "module-1",
        createdBy: "user-owner",
        submittedDate: "2026-03-01",
        journalName: "Nature Communications",
        status: "Submitted",
        revisionRounds: null,
        decisionDate: null,
        notes: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    renderPage();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Edit submission to Nature Communications",
      }),
    );
    fireEvent.click(screen.getByRole("combobox", { name: "Status" }));
    fireEvent.click(screen.getByRole("option", { name: "Accepted" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(fixtures.updateSubmission).toHaveBeenCalledWith({
        submissionId: "submission-1",
        input: expect.objectContaining({ status: "Accepted" }),
      }),
    );
  });

  it("deletes a submission after confirmation", async () => {
    fixtures.submissions = [
      {
        id: "submission-1",
        tenantId: "workspace-1",
        moduleId: "module-1",
        createdBy: "user-owner",
        submittedDate: "2026-03-01",
        journalName: "Nature Communications",
        status: "Submitted",
        revisionRounds: null,
        decisionDate: null,
        notes: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Delete submission to Nature Communications",
      }),
    );

    await waitFor(() =>
      expect(fixtures.deleteSubmission).toHaveBeenCalledWith("submission-1"),
    );
  });

  it("shows a compact collaborator summary in the header", () => {
    renderPage();

    expect(
      screen.queryByText("Avi Researcher · University of Melbourne"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Sam Lee · CSIRO")).toBeInTheDocument();
    expect(
      screen.getByText("Dana Draft · Monash University"),
    ).toBeInTheDocument();
  });

  it("keeps Abstract collapsed by default and expands it on request", () => {
    fixtures.module.abstract = "A focused summary of the paper.";
    renderPage();

    expect(
      screen.getByRole("heading", { name: "Abstract" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("A focused summary of the paper."),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show abstract" }));

    expect(
      screen.getByText("A focused summary of the paper."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Hide abstract" }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps Journals & conferences collapsed by default and expands it on request", () => {
    fixtures.module.targetJournal = "Nature Communications";
    renderPage();

    expect(
      screen.getByRole("heading", { name: "Journals & conferences" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Nature Communications")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Show journals & conferences" }),
    );

    expect(screen.getByText("Nature Communications")).toBeInTheDocument();
  });

  it("shows tasks and notes as separate panels, each of which can be hidden", () => {
    renderPage();

    expect(
      screen.queryByRole("heading", { name: "Linked work" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Extract references")).toBeInTheDocument();
    expect(screen.getByText("Meeting notes")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Hide tasks" }));
    expect(screen.queryByText("Extract references")).not.toBeInTheDocument();
    expect(screen.getByText("Meeting notes")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show tasks" }),
    ).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(screen.getByRole("button", { name: "Hide notes" }));
    expect(screen.queryByText("Meeting notes")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show notes" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Sam Lee · CSIRO")).toBeInTheDocument();
  });

  it("lists the paper's active tasks first, three at a time", () => {
    const originalTasks = fixtures.tasks;
    const task = (
      id: string,
      title: string,
      dueDate: string | null,
      status = "To do",
    ) => ({
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
      renderPage();

      expect(
        screen.getByRole("heading", { name: "Tasks (4 active)" }),
      ).toBeInTheDocument();
      expect(screen.queryByText("Finished task")).not.toBeInTheDocument();
      expect(screen.getByText("Soon task")).toBeInTheDocument();
      expect(screen.getByText("Middle task")).toBeInTheDocument();
      expect(screen.getByText("Late task")).toBeInTheDocument();
      expect(screen.queryByText("Undated task")).not.toBeInTheDocument();

      fireEvent.click(
        screen.getByRole("button", { name: "Show all 4 active tasks" }),
      );
      expect(screen.getByText("Undated task")).toBeInTheDocument();
      expect(screen.queryByText("Finished task")).not.toBeInTheDocument();
    } finally {
      fixtures.tasks = originalTasks;
    }
  });

  it("shows submission history expanded by default, with an option to hide it", () => {
    renderPage();

    expect(
      screen.getAllByRole("heading", { name: /^Submission history/ }),
    ).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "Hide submission history" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByText("No submissions logged yet for this paper."),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Hide submission history" }),
    );

    expect(
      screen.queryByText("No submissions logged yet for this paper."),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Submission history (0)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show submission history" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("changes status directly from the paper header", async () => {
    renderPage();

    fireEvent.click(
      screen.getByRole("combobox", {
        name: "Change status for Literature synthesis",
      }),
    );
    fireEvent.click(screen.getByRole("option", { name: "Stalled" }));

    await waitFor(() =>
      expect(fixtures.updateModule).toHaveBeenCalledWith({
        moduleId: "module-1",
        input: { status: "Stalled" },
      }),
    );

    expect(
      screen.queryByRole("heading", { name: "Edit paper details" }),
    ).not.toBeInTheDocument();
  });

  it("changes priority directly from the paper header", async () => {
    renderPage();

    fireEvent.click(
      screen.getByRole("combobox", {
        name: "Change priority for Literature synthesis",
      }),
    );
    fireEvent.click(screen.getByRole("option", { name: "Critical" }));

    await waitFor(() =>
      expect(fixtures.updateModule).toHaveBeenCalledWith({
        moduleId: "module-1",
        input: { priority: "Critical" },
      }),
    );
  });

  it("celebrates a successful submission-stage change from the header", async () => {
    renderPage();

    fireEvent.click(
      screen.getByRole("combobox", {
        name: "Change pipeline stage for Literature synthesis",
      }),
    );
    fireEvent.click(
      screen.getByRole("option", {
        name: "Submitted, Under Review",
      }),
    );

    await waitFor(() =>
      expect(fixtures.updateModule).toHaveBeenCalledWith({
        moduleId: "module-1",
        input: { pipelineStage: "Submitted, Under Review" },
      }),
    );

    expect(await screen.findByRole("status"))
      .toHaveTextContent("Paper submitted — congratulations!");
    expect(screen.getByTestId("celebration-video")).toBeInTheDocument();
  });

  it("restores the previous header value when saving fails", async () => {
    fixtures.updateModule.mockRejectedValueOnce(
      new Error("Unable to update priority"),
    );
    renderPage();

    fireEvent.click(
      screen.getByRole("combobox", {
        name: "Change priority for Literature synthesis",
      }),
    );
    fireEvent.click(screen.getByRole("option", { name: "Critical" }));

    expect(await screen.findByRole("alert"))
      .toHaveTextContent("Unable to update priority");

    await waitFor(() =>
      expect(
        screen.getByRole("combobox", {
          name: "Change priority for Literature synthesis",
        }),
      ).toHaveTextContent("High"),
    );
  });

  it("changes Currently With directly from the header", async () => {
    renderPage();

    fireEvent.keyDown(
      screen.getByRole("combobox", {
        name: "Change currently with for Literature synthesis",
      }),
      { key: "Enter" },
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Journal" }));

    await waitFor(() =>
      expect(fixtures.updateModule).toHaveBeenCalledWith({
        moduleId: "module-1",
        input: {
          currentlyWithType: "journal",
          assignedToUserId: null,
          assignedToInvitationId: null,
        },
      }),
    );
  });

  it("opens collaborator management directly from the header", async () => {
    renderPage();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Manage paper collaborators",
      }),
    );

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add collaborator" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Edit paper details" }),
    ).not.toBeInTheDocument();
  });

  it("makes a paper independent (no project) from the header", async () => {
    fixtures.module.projectId = "project-1";
    renderPage();

    fireEvent.click(
      screen.getByRole("button", { name: "Change linked project" }),
    );
    const search = await screen.findByRole("combobox", {
      name: "Linked project",
    });
    fireEvent.change(search, { target: { value: "Independent" } });
    fireEvent.click(
      screen.getByRole("option", { name: /Independent paper/ }),
    );

    await waitFor(() =>
      expect(fixtures.updateModule).toHaveBeenCalledWith({
        moduleId: "module-1",
        input: { projectId: null },
      }),
    );
  });

  it("shows a paper with no project as an independent paper", () => {
    fixtures.module.projectId = null;
    renderPage();

    expect(screen.getByText("Independent paper")).toBeInTheDocument();
  });

  it("changes the linked project directly from the header", async () => {
    renderPage();

    fireEvent.click(
      screen.getByRole("button", { name: "Change linked project" }),
    );

    const search = await screen.findByRole("combobox", {
      name: "Linked project",
    });

    fireEvent.change(search, {
      target: { value: "Genome" },
    });
    fireEvent.click(
      screen.getByRole("option", { name: /Genome Sequencing Study/ }),
    );

    await waitFor(() =>
      expect(fixtures.updateModule).toHaveBeenCalledWith({
        moduleId: "module-1",
        input: { projectId: "project-1" },
      }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });
  it.each([
    [false, "Pin Meeting notes", true],
    [true, "Unpin Meeting notes", false],
  ] as const)(
    "saves the paper note pin when initially pinned=%s",
    async (initialPinned, buttonName, expectedPinned) => {
      fixtures.notes[0].modulePinned = initialPinned;
      renderPage();

      fireEvent.click(
        screen.getByRole("button", { name: buttonName }),
      );

      await waitFor(() =>
        expect(fixtures.updateNote).toHaveBeenCalledWith({
          noteId: "note-1",
          input: {
            modulePinned: expectedPinned,
          },
        }),
      );

      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: buttonName }),
        ).toBeEnabled(),
      );

      expect(fixtures.updateNote).toHaveBeenCalledTimes(1);
    },
  );

  it("keeps the existing pin state and shows an error when saving fails", async () => {
    fixtures.notes[0].modulePinned = true;
    fixtures.updateNote.mockRejectedValueOnce(
      new Error("Unable to update note pin"),
    );

    renderPage();

    fireEvent.click(
      screen.getByRole("button", { name: "Unpin Meeting notes" }),
    );

    expect(
      await screen.findByText("Unable to update note pin"),
    ).toBeInTheDocument();

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Unpin Meeting notes" }),
      ).toBeEnabled(),
    );

    expect(
      screen.getByRole("button", { name: "Unpin Meeting notes" }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});
