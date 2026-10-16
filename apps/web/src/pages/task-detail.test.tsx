import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import TaskDetailPage from "@/pages/task-detail";
import type { ApiTaskDescriptionEntry } from "@/api/hooks";

const fixtures = vi.hoisted(() => ({
  updateTask: vi.fn(),
  addDescriptionEntry: vi.fn(),
  updateDescriptionEntry: vi.fn(),
  deleteDescriptionEntry: vi.fn(),
  deleteTask: vi.fn(),
  sharingEnabled: false,
  task: {
    id: "task-1",
    displayId: "TSK-001",
    tenantId: "workspace-1",
    projectId: null as string | null,
    moduleId: null as string | null,
    createdBy: "user-owner",
    title: "Draft literature review",
    description: null as string | null,
    descriptionEntries: [] as ApiTaskDescriptionEntry[],
    status: "To do",
    priority: "Medium",
    dueDate: null as string | null,
    estimatedHours: null as string | null,
    visibility: "Private" as string,
    workingWith: null as string | null,
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
  useAddMyTaskDescriptionEntry: () => ({
    mutateAsync: fixtures.addDescriptionEntry,
    isPending: false,
    isError: false,
    error: undefined,
  }),
  useDeleteMyTask: () => ({ mutateAsync: fixtures.deleteTask, isPending: false }),
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
  useUpdateMyTaskDescriptionEntry: () => ({
    mutateAsync: fixtures.updateDescriptionEntry,
    isPending: false,
    isError: false,
    error: undefined,
  }),
  useDeleteMyTaskDescriptionEntry: () => ({
    mutateAsync: fixtures.deleteDescriptionEntry,
    isPending: false,
    isError: false,
    error: undefined,
  }),
}));

vi.mock("@/lib/feature-flags", () => ({
  get TASK_NOTE_SHARING_ENABLED() {
    return fixtures.sharingEnabled;
  },
}));

describe("TaskDetailPage", () => {
  beforeEach(() => {
    fixtures.updateDescriptionEntry.mockReset();
    fixtures.updateDescriptionEntry.mockResolvedValue(fixtures.task);

    fixtures.deleteDescriptionEntry.mockReset();
    fixtures.deleteDescriptionEntry.mockResolvedValue(fixtures.task);
    fixtures.sharingEnabled = false;
    fixtures.task.projectId = null;
    fixtures.task.moduleId = null;
    fixtures.task.visibility = "Private";
    fixtures.task.dueDate = null;
    fixtures.task.estimatedHours = null;
    fixtures.task.workingWith = null;
    fixtures.task.description = null;
    fixtures.updateTask.mockReset();
    fixtures.updateTask.mockResolvedValue(fixtures.task);
    fixtures.deleteTask.mockReset();
    fixtures.deleteTask.mockResolvedValue(fixtures.task);
    fixtures.task.descriptionEntries = [];
    fixtures.addDescriptionEntry.mockReset();
    fixtures.addDescriptionEntry.mockResolvedValue(fixtures.task);
  });

  function renderTask() {
    return render(
      <MemoryRouter initialEntries={["/tasks/task-1"]}>
        <Routes>
          <Route path="tasks/:taskId" element={<TaskDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  function setInitialDescription() {
    fixtures.task.description = "Original description";
    fixtures.task.descriptionEntries = [{
      id: "entry-1",
      taskId: "task-1",
      content: "Original description",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }];
  }

  it("groups descriptions by local date with newest content first", () => {
    fixtures.task.descriptionEntries = [
      {
        id: "entry-old",
        taskId: "task-1",
        content: "Original description",
        createdAt: "2026-10-12T12:00:00.000Z",
        updatedAt: "2026-10-12T12:00:00.000Z",
      },
      {
        id: "entry-middle",
        taskId: "task-1",
        content: "First update",
        createdAt: "2026-10-12T14:00:00.000Z",
        updatedAt: "2026-10-12T14:00:00.000Z",
      },
      {
        id: "entry-new",
        taskId: "task-1",
        content: "Latest update",
        createdAt: "2026-10-12T15:00:00.000Z",
        updatedAt: "2026-10-12T15:00:00.000Z",
      },
    ];

    const originalFormatter = Intl.DateTimeFormat;
    const timezoneMock = vi
      .spyOn(Intl, "DateTimeFormat")
      .mockImplementation(
        (locales, options) =>
          new originalFormatter(locales, {
            ...options,
            timeZone: "Australia/Sydney",
          }),
      );

    try {
      renderTask();
    } finally {
      timezoneMock.mockRestore();
    }

    const panel = screen.getByRole("region", { name: "Description" });

    expect(
      [...panel.querySelectorAll("time")].map(
        (element) => element.textContent,
      ),
    ).toEqual(["13/10/2026", "12/10/2026"]);

    expect(
      within(panel)
        .getAllByText(/^(Original description|First update|Latest update)$/)
        .map((element) => element.textContent),
    ).toEqual([
      "Latest update",
      "First update",
      "Original description",
    ]);
  });

  it("opens one description editor with existing text and no date headings", () => {
    setInitialDescription();
    renderTask();

    expect(screen.getByRole("region", { name: "Description" }))
      .toHaveTextContent("Original description");
    expect(
      screen.queryByRole("textbox", { name: "Description" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit Task" }));

    expect(
      screen.queryByRole("region", { name: "Description" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("textbox", { name: "Description" }),
    ).toHaveLength(1);
    expect(screen.getByRole("textbox", { name: "Description" }))
      .toHaveValue("Original description");
    expect(screen.queryByText("01/01/2026")).not.toBeInTheDocument();
  });

  it("appends only new description content from the single editor", async () => {
    setInitialDescription();
    renderTask();

    fireEvent.click(screen.getByRole("button", { name: "Edit Task" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Description" }), {
      target: { value: "Original description\n\nNew observation" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Edit Task" }))
        .toBeInTheDocument(),
    );

    expect(fixtures.addDescriptionEntry).toHaveBeenCalledWith({
      taskId: "task-1",
      content: "New observation",
    });
    expect(fixtures.updateDescriptionEntry).not.toHaveBeenCalled();
    expect(fixtures.deleteDescriptionEntry).not.toHaveBeenCalled();
    expect(fixtures.updateTask.mock.calls[0][0].input)
      .not.toHaveProperty("description");
  });

  it("preserves the complete description draft when saving fails", async () => {
    setInitialDescription();
    fixtures.addDescriptionEntry.mockRejectedValue(new Error("Unable to save"));
    renderTask();

    const draft = "Original description\n\nKeep this draft";

    fireEvent.click(screen.getByRole("button", { name: "Edit Task" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Description" }), {
      target: { value: draft },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to save");
    expect(screen.getByRole("textbox", { name: "Description" }))
      .toHaveValue(draft);
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeEnabled();
  });

  it("saves metadata without rewriting unchanged description entries", async () => {
    setInitialDescription();
    renderTask();

    fireEvent.click(screen.getByRole("button", { name: "Edit Task" }));
    fireEvent.change(screen.getByLabelText("Task title"), {
      target: { value: "Updated title" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Edit Task" }))
        .toBeInTheDocument(),
    );

    expect(fixtures.updateTask.mock.calls[0][0].input.title)
      .toBe("Updated title");
    expect(fixtures.updateTask.mock.calls[0][0].input)
      .not.toHaveProperty("description");
    expect(fixtures.addDescriptionEntry).not.toHaveBeenCalled();
    expect(fixtures.updateDescriptionEntry).not.toHaveBeenCalled();
    expect(fixtures.deleteDescriptionEntry).not.toHaveBeenCalled();
  });

  it("shows the description in a dedicated reading panel", () => {
    fixtures.task.description = "Review the literature.\n\nCompare the findings.";
    fixtures.task.descriptionEntries = [{
      id: "entry-1",
      taskId: "task-1",
      content: fixtures.task.description,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }];

    render(
      <MemoryRouter initialEntries={["/tasks/task-1"]}>
        <Routes>
          <Route path="tasks/:taskId" element={<TaskDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const panel = screen.getByRole("region", { name: "Description" });
    expect(panel).toHaveTextContent("Review the literature.");
    expect(panel).toHaveTextContent("Compare the findings.");

    const text = screen.getByText(/Review the literature\./);
    expect(text.textContent).toBe(fixtures.task.description);
    expect(text).toHaveClass("whitespace-pre-wrap");
  });

  it("hides sharing controls while preserving existing task visibility on save", async () => {
    fixtures.task.visibility = "Shared";

    render(
      <MemoryRouter initialEntries={["/tasks/task-1"]}>
        <Routes>
          <Route path="tasks/:taskId" element={<TaskDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText("Visibility")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Task collaborators" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit Task" }));
    expect(screen.queryByLabelText("Visibility")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Task title"), {
      target: { value: "Updated task title" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(fixtures.updateTask).toHaveBeenCalledWith({
        taskId: "task-1",
        input: expect.objectContaining({
          title: "Updated task title",
          visibility: "Shared",
        }),
      }),
    );
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

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

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

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

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

  it("shows the task's planning details as stats in the page header", () => {
    fixtures.sharingEnabled = true;
    fixtures.task.dueDate = "2026-04-15";
    fixtures.task.estimatedHours = "3.5";
    fixtures.task.workingWith = "Sam Lee";
    render(
      <MemoryRouter initialEntries={["/tasks/task-1"]}>
        <Routes>
          <Route path="tasks/:taskId" element={<TaskDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Due date")).toBeInTheDocument();
    expect(screen.getByText("15/04/2026")).toBeInTheDocument();
    expect(screen.getByText("Estimated hours")).toBeInTheDocument();
    expect(screen.getByText("3.5h")).toBeInTheDocument();
    expect(screen.getByText("Visibility")).toBeInTheDocument();
    expect(screen.getByText("Private")).toBeInTheDocument();
    expect(screen.getByText("Working with")).toBeInTheDocument();
    expect(screen.getByText("Sam Lee")).toBeInTheDocument();
  });

  it("hides the working-with stat when no one else is tagged on the task", () => {
    render(
      <MemoryRouter initialEntries={["/tasks/task-1"]}>
        <Routes>
          <Route path="tasks/:taskId" element={<TaskDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText("Working with")).not.toBeInTheDocument();
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

  it("shows collaborators expanded by default, with an option to hide them", () => {
    fixtures.sharingEnabled = true;
    render(
      <MemoryRouter initialEntries={["/tasks/task-1"]}>
        <Routes>
          <Route path="tasks/:taskId" element={<TaskDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "Task collaborators" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Hide collaborators" }),
    ).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByRole("button", { name: "Hide collaborators" }));

    expect(
      screen.queryByRole("heading", { name: "Task collaborators" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show collaborators" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("shows the task's creator as Owner in the members list, even though they aren't an explicit member", () => {
    fixtures.sharingEnabled = true;
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

  it("saves changes to existing description text through the entry endpoint", async () => {
    setInitialDescription();
    renderTask();

    fireEvent.click(screen.getByRole("button", { name: "Edit Task" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Description" }), {
      target: { value: "Corrected description" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Edit Task" }))
        .toBeInTheDocument(),
    );

    expect(fixtures.updateDescriptionEntry).toHaveBeenCalledWith({
      taskId: "task-1",
      entryId: "entry-1",
      content: "Corrected description",
    });
    expect(fixtures.addDescriptionEntry).not.toHaveBeenCalled();
    expect(fixtures.deleteDescriptionEntry).not.toHaveBeenCalled();
  });

  it("deletes description entries when their text is erased and saved", async () => {
    setInitialDescription();
    renderTask();

    fireEvent.click(screen.getByRole("button", { name: "Edit Task" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Description" }), {
      target: { value: "" },
    });

    expect(fixtures.deleteDescriptionEntry).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Edit Task" }))
        .toBeInTheDocument(),
    );

    expect(fixtures.deleteDescriptionEntry).toHaveBeenCalledWith({
      taskId: "task-1",
      entryId: "entry-1",
    });
    expect(fixtures.updateDescriptionEntry).not.toHaveBeenCalled();
    expect(fixtures.addDescriptionEntry).not.toHaveBeenCalled();
  });

  it("discards description changes when editing is cancelled", () => {
    setInitialDescription();
    renderTask();

    fireEvent.click(screen.getByRole("button", { name: "Edit Task" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Description" }), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(fixtures.updateTask).not.toHaveBeenCalled();
    expect(fixtures.updateDescriptionEntry).not.toHaveBeenCalled();
    expect(fixtures.deleteDescriptionEntry).not.toHaveBeenCalled();
    expect(fixtures.addDescriptionEntry).not.toHaveBeenCalled();

    expect(screen.getByRole("region", { name: "Description" }))
      .toHaveTextContent("Original description");
  });

  it("uses entry edit dates for Modified and description ordering", () => {
    fixtures.task.descriptionEntries = [
      {
        id: "entry-untouched",
        taskId: "task-1",
        content: "Never edited",
        createdAt: "2026-10-02T06:00:00.000Z",
        updatedAt: "2026-10-02T06:00:00.000Z",
      },
      {
        id: "entry-edited",
        taskId: "task-1",
        content: "Corrected later",
        createdAt: "2026-10-01T06:00:00.000Z",
        updatedAt: "2026-10-10T06:00:00.000Z",
      },
    ];

    renderTask();

    expect(screen.getByText("Modified").parentElement)
      .toHaveTextContent("Oct 10, 2026");

    const panel = screen.getByRole("region", { name: "Description" });

    expect(
      [...panel.querySelectorAll("time")].map((element) => element.textContent),
    ).toEqual(["10/10/2026", "02/10/2026"]);

    expect(
      within(panel)
        .getAllByText(/^(Corrected later|Never edited)$/)
        .map((element) => element.textContent),
    ).toEqual(["Corrected later", "Never edited"]);
  });
});
