import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ModuleDetailPage from "@/pages/module-detail";

const fixtures = vi.hoisted(() => ({
  confetti: vi.fn(),
  updateModule: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  updateNote: vi.fn(),
  createSubmission: vi.fn(),
  updateSubmission: vi.fn(),
  deleteSubmission: vi.fn(),
  submissions: [] as Array<{
    id: string;
    tenantId: string;
    moduleId: string;
    createdBy: string;
    submittedDate: string;
    journalName: string;
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
      moduleId: null as string | null,
      title: "Independent task",
      status: "To do",
      priority: "Medium",
      dueDate: null,
    },
  ],
  notes: [
    {
      id: "note-1",
      moduleId: "module-1",
      title: "Meeting notes",
      content: "Discussed scope",
    },
    {
      id: "note-2",
      moduleId: null as string | null,
      title: "Independent note",
      content: "Unrelated",
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
    tag: "Research Paper",
    status: "Active",
    pipelineStage: "Concept",
    dueDate: "2026-09-15",
    assignedToUserId: null,
    archivedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  projects: [
    { id: "project-1", title: "Genome Sequencing Study" },
    { id: "project-2", title: "Protein Folding Analysis" },
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
vi.mock("canvas-confetti", () => ({
  default: fixtures.confetti,
}));
vi.mock("@/api/hooks", () => ({
  useCurrentWorkspace: () => ({
    data: { id: "workspace-1" },
    isPending: false,
  }),
  useMe: () => ({
    data: { id: "user-owner", displayName: "Avi Researcher", email: "owner@example.com" },
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
  useCreateTask: () => ({ mutateAsync: fixtures.createTask, isPending: false }),
  useUpdateTask: () => ({ mutateAsync: fixtures.updateTask, isPending: false }),
  useUpdateNote: () => ({ mutateAsync: fixtures.updateNote, isPending: false }),
  useModuleSubmissions: () => ({ data: fixtures.submissions, isPending: false }),
  useCreateModuleSubmission: () => ({ mutateAsync: fixtures.createSubmission, isPending: false }),
  useUpdateModuleSubmission: () => ({ mutateAsync: fixtures.updateSubmission, isPending: false }),
  useDeleteModuleSubmission: () => ({ mutateAsync: fixtures.deleteSubmission, isPending: false }),
  useTrackEvent: () => vi.fn(),
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
  }),
  useNotes: () => ({
    data: {
      data: fixtures.notes,
      meta: {
        page: 1,
        pageSize: 20,
        totalItems: fixtures.notes.length,
        totalPages: 1,
      },
    },
  }),
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
  useProject: () => ({ data: undefined, isError: false }),
  useProjects: () => ({
    data: { data: fixtures.projects, meta: { page: 1, pageSize: 20, totalItems: fixtures.projects.length, totalPages: 1 } },
    isPending: false,
  }),
  useModuleCollaborators: () => ({ data: [], isPending: false }),
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
    fixtures.confetti.mockReset();
    fixtures.module.pipelineStage = "Concept";
    fixtures.module.projectId = null;
    fixtures.updateModule.mockReset();
    fixtures.updateModule.mockImplementation(
      async ({ input }: { input: Record<string, unknown> }) => {
        Object.assign(fixtures.module, input);
        return fixtures.module;
      },
    );
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
    fixtures.deleteSubmission.mockResolvedValue({ message: "Submission deleted successfully" });
  });

  function nativeDateInputFor(textInputId: string) {
    const textInput = document.getElementById(textInputId)!;
    return textInput.closest(".relative")!.querySelector<HTMLInputElement>('input[type="date"]')!;
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
  it("celebrates after moving the paper into Submitted, Under Review", async () => {
    renderPage();
  
    fireEvent.click(
      screen.getByRole("button", { name: "Edit Module" }),
    );
  
    fireEvent.click(
      screen.getByRole("combobox", { name: "Pipeline stage" }),
    );
  
    fireEvent.click(
      screen.getByRole("option", {
        name: "Submitted, Under Review",
      }),
    );
  
    fireEvent.click(
      screen.getByRole("button", { name: "Save Changes" }),
    );
  
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
    expect(fixtures.confetti).toHaveBeenCalledOnce();
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

    fireEvent.click(screen.getByRole("button", { name: "Cancel Editing" }));

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

    fireEvent.click(screen.getByRole("button", { name: "Cancel Editing" }));

    expect(
      screen.getByRole("button", { name: "Edit Module" }),
    ).toBeInTheDocument();
  });

  it("unlinks a module from its project when Independent module is checked", async () => {
    fixtures.module.projectId = "project-1";
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Change project" }));
    const checkbox = screen.getByRole("checkbox", { name: /Independent module/ });
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(fixtures.updateModule).toHaveBeenCalledWith(
        expect.objectContaining({
          moduleId: "module-1",
          input: { projectId: null },
        }),
      ),
    );
  });

  it("blocks saving when Independent module is unchecked without picking a project", () => {
    fixtures.module.projectId = null;
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Change project" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Independent module/ }));

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
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
        expect.objectContaining({ title: "Draft outline", moduleId: "module-1" }),
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

  it("unlinks the project via the quick Unlink button", async () => {
    fixtures.module.projectId = "project-1";
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Unlink" }));

    await waitFor(() =>
      expect(fixtures.updateModule).toHaveBeenCalledWith({
        moduleId: "module-1",
        input: { projectId: null },
      }),
    );
  });

  it("unlinks a task from this module", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage();

    fireEvent.click(
      screen.getByRole("button", { name: "Unlink Extract references from this module" }),
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
      screen.getByRole("button", { name: "Unlink Meeting notes from this module" }),
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

    fireEvent.click(screen.getAllByRole("button", { name: "Link existing" })[0]);

    const searchInput = await screen.findByPlaceholderText("Search tasks by title");
    fireEvent.focus(searchInput);
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

    fireEvent.click(screen.getAllByRole("button", { name: "Link existing" })[1]);

    const searchInput = await screen.findByPlaceholderText("Search notes by title");
    fireEvent.focus(searchInput);
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
    fireEvent.change(screen.getByRole("textbox", { name: /Journal \/ venue/ }), {
      target: { value: "Nature Communications" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save submission" }));

    await waitFor(() =>
      expect(fixtures.createSubmission).toHaveBeenCalledWith(
        expect.objectContaining({
          submittedDate: "2026-03-01",
          journalName: "Nature Communications",
          status: "Submitted",
        }),
      ),
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
      screen.getByRole("button", { name: "Edit submission to Nature Communications" }),
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
      screen.getByRole("button", { name: "Delete submission to Nature Communications" }),
    );

    await waitFor(() =>
      expect(fixtures.deleteSubmission).toHaveBeenCalledWith("submission-1"),
    );
  });

  it("shows collaborators expanded by default, with an option to hide them", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: "Module collaborators" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Hide collaborators" }),
    ).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByRole("button", { name: "Hide collaborators" }));

    expect(
      screen.queryByRole("heading", { name: "Module collaborators" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show collaborators" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("shows linked work expanded by default, with an option to hide it", () => {
    renderPage();

    expect(screen.getByText("Extract references")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Hide linked work" }),
    ).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByRole("button", { name: "Hide linked work" }));

    expect(screen.queryByText("Extract references")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Module collaborators" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show linked work" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("shows submission history expanded by default, with an option to hide it", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: "Submission history (0)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Hide submission history" }),
    ).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(
      screen.getByRole("button", { name: "Hide submission history" }),
    );

    expect(
      screen.queryByRole("heading", { name: "Submission history (0)" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Submission history" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show submission history" }),
    ).toHaveAttribute("aria-expanded", "false");
  });
});
