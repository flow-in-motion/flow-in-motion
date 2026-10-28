import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import TaskDetailPage from "@/pages/task-detail";
import type { ApiTaskDescriptionEntry } from "@/api/hooks";

const fixtures = vi.hoisted(() => ({
  projectLists: vi.fn(),
  paperLists: vi.fn(),
  projectLookups: vi.fn(),
  paperLookups: vi.fn(),
  linkedPaperError: false,

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

vi.mock("@/api/time-tracking", () => import("@/test/time-tracking-mock"));
vi.mock("@/api/hooks", () => ({
  useCurrentWorkspace: () => ({ data: { id: "workspace-1" }, isPending: false }),
  useMyTask: () => ({
    data: fixtures.task,
    isPending: false,
    isError: false,
    error: undefined,
    refetch: vi.fn(),
  }),
  useProjects: (...args: unknown[]) => {
    fixtures.projectLists(...args);
    return ({
    data: { data: fixtures.projects, meta: { page: 1, pageSize: 20, totalItems: fixtures.projects.length, totalPages: 1 } },
  }); },
  useModules: (...args: unknown[]) => {
    fixtures.paperLists(...args);
    return ({
    data: { data: fixtures.modules, meta: { page: 1, pageSize: 20, totalItems: fixtures.modules.length, totalPages: 1 } },
  }); },
  useUpdateMyTask: () => ({ mutateAsync: fixtures.updateTask, isPending: false }),
  useAddMyTaskDescriptionEntry: () => ({
    mutateAsync: fixtures.addDescriptionEntry,
    isPending: false,
    isError: false,
    error: undefined,
  }),
  useDeleteMyTask: () => ({ mutateAsync: fixtures.deleteTask, isPending: false }),
  useTrackEvent: () => vi.fn(),
  useMyProject: (projectId: string) => {
    fixtures.projectLookups(projectId);
    return {
      data: projectId === "project-outside-page"
        ? { title: "Older project" }
        : projectId === "project-1" ? { title: "Genome Sequencing Study" } : undefined,
      isError: false,
    };
  },
  useMyModule: (moduleId: string) => {
    fixtures.paperLookups(moduleId);
    return {
      data: fixtures.linkedPaperError ? undefined : moduleId === "module-outside-page"
        ? { title: "Older paper" }
        : fixtures.modules.find((module) => module.id === moduleId),
      isError: fixtures.linkedPaperError,
    };
  },
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
    fixtures.task.tenantId = "workspace-1";
    fixtures.projectLists.mockClear();
    fixtures.paperLists.mockClear();
    fixtures.projectLookups.mockClear();
    fixtures.paperLookups.mockClear();
    fixtures.linkedPaperError = false;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
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

  afterEach(() => {
    vi.unstubAllGlobals();
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

  it("offers the task timer and shows the time logged against the estimate", () => {
    fixtures.task.estimatedHours = "2";
    Object.assign(fixtures.task, { loggedSeconds: 2700 });
    renderTask();

    expect(
      screen.getByRole("button", {
        name: "Start timer for Draft literature review",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Logged").parentElement).toHaveTextContent(
      "Logged45m",
    );
    expect(screen.getByRole("heading", { name: "Time" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add time" })).toBeInTheDocument();
    Object.assign(fixtures.task, { loggedSeconds: undefined });
  });

  it("resolves linked names outside the first page, including a shared record", () => {
    fixtures.task.tenantId = "other-workspace";
    fixtures.task.moduleId = "module-outside-page";
    fixtures.task.projectId = "project-outside-page";
    renderTask();

    expect(screen.getByRole("link", { name: "Paper Older paper" })).toHaveAttribute("href", "/modules/module-outside-page");
    expect(screen.getByRole("link", { name: "Parent project Older project" })).toHaveAttribute("href", "/projects/project-outside-page");
    expect(fixtures.projectLookups).toHaveBeenCalledWith("project-outside-page");
    expect(fixtures.paperLookups).toHaveBeenCalledWith("module-outside-page");
    expect(fixtures.projectLists.mock.calls.every((args) => args[2] === false)).toBe(true);
    expect(fixtures.paperLists.mock.calls.every((args) => args[3] === false)).toBe(true);
  });

  it("loads link choices when Change link is opened", () => {
    renderTask();
    expect(fixtures.projectLists.mock.calls.every((args) => args[2] === false)).toBe(true);
    expect(fixtures.paperLists.mock.calls.every((args) => args[3] === false)).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Change link" }));
    expect(fixtures.projectLists).toHaveBeenCalledWith("workspace-1", 1, true);
    expect(fixtures.paperLists).toHaveBeenCalledWith("workspace-1", undefined, 1, true);
  });

  it("ends the linked paper loading state when access fails", () => {
    fixtures.task.moduleId = "module-outside-page";
    fixtures.linkedPaperError = true;
    renderTask();
    expect(screen.getByRole("link", { name: "Paper Unknown paper" })).toBeInTheDocument();
    expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
  });

  it("accepts a typed due date from the task header", async () => {
    renderTask();

    fireEvent.click(
      screen.getByRole("button", { name: "Change task due date" }),
    );

    fireEvent.change(
      screen.getByRole("textbox", { name: "Due date" }),
      { target: { value: "20/11/2026" } },
    );

    await waitFor(() =>
      expect(fixtures.updateTask).toHaveBeenCalledWith({
        taskId: "task-1",
        input: { dueDate: "2026-11-20" },
      }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    expect(fixtures.addDescriptionEntry).not.toHaveBeenCalled();
    expect(fixtures.updateDescriptionEntry).not.toHaveBeenCalled();
    expect(fixtures.deleteDescriptionEntry).not.toHaveBeenCalled();
  });

  it("accepts a calendar date from the task header", async () => {
    renderTask();

    fireEvent.click(
      screen.getByRole("button", { name: "Change task due date" }),
    );

    const dateInput = screen
      .getByRole("dialog")
      .querySelector<HTMLInputElement>('input[type="date"]');

    expect(dateInput).not.toBeNull();

    fireEvent.change(dateInput!, {
      target: { value: "2026-11-20" },
    });

    await waitFor(() =>
      expect(fixtures.updateTask).toHaveBeenCalledWith({
        taskId: "task-1",
        input: { dueDate: "2026-11-20" },
      }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("clears the task due date from the header", async () => {
    fixtures.task.dueDate = "2026-08-15";
    renderTask();

    fireEvent.click(
      screen.getByRole("button", { name: "Change task due date" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Clear due date" }),
    );

    await waitFor(() =>
      expect(fixtures.updateTask).toHaveBeenCalledWith({
        taskId: "task-1",
        input: { dueDate: null },
      }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("restores the saved task date when updating fails", async () => {
    fixtures.task.dueDate = "2026-08-15";
    fixtures.updateTask.mockRejectedValueOnce(
      new Error("Unable to update date"),
    );
    renderTask();

    fireEvent.click(
      screen.getByRole("button", { name: "Change task due date" }),
    );

    const dialog = screen.getByRole("dialog");

    fireEvent.change(
      within(dialog).getByRole("textbox", { name: "Due date" }),
      { target: { value: "20/11/2026" } },
    );

    expect(await within(dialog).findByRole("alert"))
      .toHaveTextContent("Unable to update date");

    await waitFor(() =>
      expect(
        within(dialog).getByRole("textbox", { name: "Due date" }),
      ).toHaveValue("15/08/2026"),
    );
  });

  it.each([
    { label: "fractional hours", draft: "3.5", expected: "3.5" },
    { label: "a quarter hour", draft: "0.25", expected: "0.25" },
    { label: "three quarters of an hour", draft: "1.75", expected: "1.75" },
    { label: "zero hours", draft: "0", expected: "0" },
    { label: "cleared hours", draft: "", expected: null },
  ])("saves $label from the header", async ({ draft, expected }) => {
    fixtures.task.estimatedHours = "2";
    renderTask();

    fireEvent.click(
      screen.getByRole("button", { name: "Change estimated hours" }),
    );

    const dialog = screen.getByRole("dialog");
    const hours = within(dialog).getByRole("spinbutton", {
      name: "Estimated hours",
    });
    // Quarter hours are allowed (0.25, 0.75, …).
    expect(hours).toHaveAttribute("step", "0.25");

    fireEvent.change(hours, { target: { value: draft } });

    expect(fixtures.updateTask).not.toHaveBeenCalled();

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save" }),
    );

    await waitFor(() =>
      expect(fixtures.updateTask).toHaveBeenCalledWith({
        taskId: "task-1",
        input: { estimatedHours: expected },
      }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("discards an estimated-hours draft when cancelled", () => {
    fixtures.task.estimatedHours = "2";
    renderTask();

    fireEvent.click(
      screen.getByRole("button", { name: "Change estimated hours" }),
    );

    const dialog = screen.getByRole("dialog");

    fireEvent.change(
      within(dialog).getByRole("spinbutton", {
        name: "Estimated hours",
      }),
      { target: { value: "5" } },
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );

    expect(fixtures.updateTask).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "Change estimated hours" }),
    );

    expect(
      screen.getByRole("spinbutton", { name: "Estimated hours" }),
    ).toHaveValue(2);
  });

  it("preserves the estimated-hours draft when saving fails", async () => {
    fixtures.updateTask.mockRejectedValueOnce(
      new Error("Unable to update hours"),
    );
    renderTask();

    fireEvent.click(
      screen.getByRole("button", { name: "Change estimated hours" }),
    );

    const dialog = screen.getByRole("dialog");

    fireEvent.change(
      within(dialog).getByRole("spinbutton", {
        name: "Estimated hours",
      }),
      { target: { value: "3.5" } },
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save" }),
    );

    expect(await within(dialog).findByRole("alert"))
      .toHaveTextContent("Unable to update hours");
    expect(
      within(dialog).getByRole("spinbutton", {
        name: "Estimated hours",
      }),
    ).toHaveValue(3.5);
    expect(
      within(dialog).getByRole("button", { name: "Save" }),
    ).toBeEnabled();
  });

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

    const panel = screen.getByRole("region", {
      name: "Description",
    });

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

  it("opens dated description sections with fixed headings", () => {
    setInitialDescription();
    renderTask();

    expect(screen.getByRole("region", { name: "Description" }))
      .toHaveTextContent("Original description");

    expect(
      screen.queryByRole("textbox", {
        name: "Description content from 01/01/2026",
      }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit Task" }));

    expect(
      screen.queryByRole("region", { name: "Description" }),
    ).not.toBeInTheDocument();

    const editor = screen.getByRole("group", {
      name: "Dated task description",
    });

    const today = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date());

    expect(
      [...editor.querySelectorAll("time")].map(
        (element) => element.textContent,
      ),
    ).toEqual([today, "01/01/2026"]);

    expect(
      within(editor).getByRole("textbox", {
        name: "New description content",
      }),
    ).toHaveValue("");

    expect(
      within(editor).getByRole("textbox", {
        name: "Description content from 01/01/2026",
      }),
    ).toHaveValue("Original description");

    for (const heading of editor.querySelectorAll("time")) {
      expect(heading.closest("textarea")).toBeNull();
      expect(heading.closest('[contenteditable="true"]')).toBeNull();
    }

    expect(
      within(editor).getByRole("region", {
        name: "Entry dated 01/01/2026",
      }),
    ).toHaveClass("border-t");
  });

  it("adds new description content without rewriting previous entries", async () => {
    setInitialDescription();
    renderTask();

    fireEvent.click(screen.getByRole("button", { name: "Edit Task" }));
    fireEvent.change(
      screen.getByRole("textbox", {
        name: "New description content",
      }),
      { target: { value: "New observation" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Edit Task" }))
        .toBeInTheDocument(),
    );

    expect(fixtures.addDescriptionEntry).toHaveBeenCalledTimes(1);
    expect(fixtures.addDescriptionEntry).toHaveBeenCalledWith({
      taskId: "task-1",
      content: "New observation",
    });
    expect(fixtures.updateDescriptionEntry).not.toHaveBeenCalled();
    expect(fixtures.deleteDescriptionEntry).not.toHaveBeenCalled();
    expect(fixtures.updateTask.mock.calls[0][0].input)
      .not.toHaveProperty("description");
  });

  it("preserves new and previous description content when saving fails", async () => {
    setInitialDescription();
    fixtures.addDescriptionEntry.mockRejectedValue(
      new Error("Unable to save"),
    );
    renderTask();

    fireEvent.click(screen.getByRole("button", { name: "Edit Task" }));
    fireEvent.change(
      screen.getByRole("textbox", {
        name: "New description content",
      }),
      { target: { value: "Keep this draft" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(await screen.findByRole("alert"))
      .toHaveTextContent("Unable to save");

    expect(
      screen.getByRole("textbox", {
        name: "New description content",
      }),
    ).toHaveValue("Keep this draft");

    expect(
      screen.getByRole("textbox", {
        name: "Description content from 01/01/2026",
      }),
    ).toHaveValue("Original description");

    expect(screen.getByRole("button", { name: "Save Changes" }))
      .toBeEnabled();
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
    expect(
      screen.getByRole("button", { name: "Change estimated hours" }),
    ).toHaveTextContent("3h 30m");
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
    fireEvent.change(screen.getByRole("textbox", { name: "Description content from 01/01/2026" }), {
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
    fireEvent.change(screen.getByRole("textbox", { name: "Description content from 01/01/2026" }), {
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
    fireEvent.change(screen.getByRole("textbox", { name: "Description content from 01/01/2026" }), {
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

  it("uses the latest edit for Modified while preserving original description dates", () => {
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
    ).toEqual(["02/10/2026", "01/10/2026"]);

    expect(
      within(panel)
        .getAllByText(/^(Corrected later|Never edited)$/)
        .map((element) => element.textContent),
      ).toEqual(["Never edited", "Corrected later"]);

      fireEvent.click(screen.getByRole("button", { name: "Edit Task" }));

      const editor = screen.getByRole("group", {
        name: "Dated task description",
      });

      fireEvent.change(
        within(editor).getByRole("textbox", {
          name: "Description content from 01/10/2026",
        }),
        { target: { value: "Another correction" } },
      );

      expect(within(editor).getByText("01/10/2026"))
        .toBeInTheDocument();
      expect(within(editor).queryByText("10/10/2026"))
        .not.toBeInTheDocument();
  });

  it("edits today's description without creating another entry", async () => {
    const timestamp = new Date().toISOString();
    const today = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(timestamp));

    fixtures.task.descriptionEntries = [{
      id: "entry-today",
      taskId: "task-1",
      content: "Today's existing description",
      createdAt: timestamp,
      updatedAt: timestamp,
    }];

    renderTask();
    fireEvent.click(screen.getByRole("button", { name: "Edit Task" }));

    const editor = screen.getByRole("group", {
      name: "Dated task description",
    });

    expect(editor.querySelectorAll("time")).toHaveLength(1);
    expect(
      within(editor).queryByRole("textbox", {
        name: "New description content",
      }),
    ).not.toBeInTheDocument();

    fireEvent.change(
      within(editor).getByRole("textbox", {
        name: `Description content from ${today}`,
      }),
      {
        target: {
          value: "Today's existing description\nAnother observation",
        },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Edit Task" }))
        .toBeInTheDocument(),
    );

    expect(fixtures.updateDescriptionEntry).toHaveBeenCalledWith({
      taskId: "task-1",
      entryId: "entry-today",
      content: "Today's existing description\nAnother observation",
    });
    expect(fixtures.addDescriptionEntry).not.toHaveBeenCalled();
    expect(fixtures.deleteDescriptionEntry).not.toHaveBeenCalled();
  });
});
