import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DailyNoteDetailPage from "@/pages/daily-note-detail";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

const fixtures = vi.hoisted(() => ({
  updateNote: vi.fn(),
  addEntry: vi.fn(),
  updateEntry: vi.fn(),
  deleteNote: vi.fn(),
  sharingEnabled: false,
  deleteEntry: vi.fn(),
  note: {
    id: "note-1",
    displayId: "NTE-001",
    tenantId: "workspace-1",
    projectId: null as string | null,
    moduleId: null as string | null,
    createdBy: "user-owner",
    title: "Initial observations",
    content: "Baseline readings look consistent.",
    entries: [{
      id: "entry-1",
      noteId: "note-1",
      content: "Baseline readings look consistent.",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }],
    visibility: "Private",
    followUpDate: null as string | null,
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
  useUpdateMyNote: () => ({
    mutateAsync: fixtures.updateNote,
    isPending: false,
    isError: false,
    error: undefined,
  }),
  useAddMyNoteEntry: () => ({
    mutateAsync: fixtures.addEntry,
    isPending: false,
    isError: false,
    error: undefined,
  }),
  useUpdateMyNoteEntry: () => ({
    mutateAsync: fixtures.updateEntry,
    reset: vi.fn(),
    isPending: false,
    isError: false,
    error: undefined,
  }),
  useMyNote: () => ({
    data: fixtures.note,
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

  useDeleteMyNote: () => ({ mutateAsync: fixtures.deleteNote, isPending: false }),
  useProject: (_tenantId: string, projectId?: string) => ({
    data: projectId === "project-1" ? { title: "Genome Sequencing Study" } : undefined,
    isError: false,
  }),
  useMembers: () => ({
    data: { data: fixtures.members, meta: { page: 1, pageSize: 20, totalItems: fixtures.members.length, totalPages: 1 } },
    isPending: false,
  }),
  useNoteMembers: () => ({ data: [], isPending: false }),
  useAddNoteMember: () => ({ mutate: vi.fn() }),
  useRemoveNoteMember: () => ({ mutate: vi.fn(), isPending: false }),
  useUserSearch: () => ({ data: [], isPending: false }),
  useMe: () => ({ data: { id: "user-owner" }, isPending: false }),
  useCollaboratorInvitations: () => ({ data: [], isPending: false, isError: false }),
  useCreateDraftInvitation: () => ({ mutateAsync: vi.fn(), isPending: false, isError: false }),
  useSendInvitation: () => ({ mutateAsync: vi.fn(), isPending: false, isError: false }),
  useRevokeCollaboratorInvitation: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
  useDeleteMyNoteEntry: () => ({
    mutateAsync: fixtures.deleteEntry,
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


describe("DailyNoteDetailPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    fixtures.deleteEntry.mockReset();
    fixtures.deleteEntry.mockResolvedValue(fixtures.note);
    fixtures.deleteNote.mockReset();
    fixtures.deleteNote.mockResolvedValue(fixtures.note);
    fixtures.sharingEnabled = false;
    fixtures.note.content = "Baseline readings look consistent.";
    fixtures.note.entries = [{
      id: "entry-1",
      noteId: "note-1",
      content: "Baseline readings look consistent.",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }];
    fixtures.note.followUpDate = null;
    fixtures.note.projectId = null;
    fixtures.note.moduleId = null;
    fixtures.note.visibility = "Private";

    fixtures.updateNote.mockReset();
    fixtures.updateNote.mockResolvedValue(fixtures.note);

    fixtures.addEntry.mockReset();
    fixtures.addEntry.mockResolvedValue(fixtures.note);

    fixtures.updateEntry.mockReset();
    fixtures.updateEntry.mockResolvedValue(fixtures.note);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function renderNote() {
    return render(
      <MemoryRouter initialEntries={["/daily-notes/note-1"]}>
        <Routes>
          <Route
            path="daily-notes/:noteId"
            element={<DailyNoteDetailPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("groups entries by local date and displays newest content first", () => {
    // In Sydney, 14:00 UTC on October 12 is October 13.
    fixtures.note.entries = [
      {
        id: "entry-old",
        noteId: "note-1",
        content: "Original content",
        // entry-old
        createdAt: "2026-10-12T12:00:00.000Z",
        updatedAt: "2026-10-12T12:00:00.000Z",
      },
      {
        id: "entry-middle",
        noteId: "note-1",
        content: "First update",
        createdAt: "2026-10-12T14:00:00.000Z",
        updatedAt: "2026-10-12T14:00:00.000Z",
      },
      {
        id: "entry-new",
        noteId: "note-1",
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
      renderNote();
    } finally {
      timezoneMock.mockRestore();
    }

    const region = screen.getByRole("region", { name: "Content" });
    const dates = [...region.querySelectorAll("time")]
      .map((element) => element.textContent);

    expect(dates).toEqual(["13/10/2026", "12/10/2026"]);

    const content = within(region).getAllByText(
      /^(Original content|First update|Latest update)$/,
    );
    expect(content.map((element) => element.textContent)).toEqual([
      "Latest update",
      "First update",
      "Original content",
    ]);
  });

  it("opens dated sections with fixed headings and a blank section for today", () => {
    renderNote();

    expect(screen.getByRole("region", { name: "Content" }))
      .toHaveTextContent("Baseline readings look consistent.");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit Note" }));

    expect(
      screen.queryByRole("region", { name: "Content" }),
    ).not.toBeInTheDocument();

    const editor = screen.getByRole("group", {
      name: "Dated note content",
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
        name: "New note content",
      }),
    ).toHaveValue("");

    expect(
      within(editor).getByRole("textbox", {
        name: "Note content from 01/01/2026",
      }),
    ).toHaveValue("Baseline readings look consistent.");

    // Date headings are outside the editable text.
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

  it("adds new content without rewriting previous entries", async () => {
    renderNote();

    fireEvent.click(screen.getByRole("button", { name: "Edit Note" }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "New note content" }),
      { target: { value: "New observation" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Edit Note" }))
        .toBeInTheDocument(),
    );

    expect(fixtures.addEntry).toHaveBeenCalledTimes(1);
    expect(fixtures.addEntry).toHaveBeenCalledWith({
      noteId: "note-1",
      content: "New observation",
    });
    expect(fixtures.updateEntry).not.toHaveBeenCalled();
    expect(fixtures.deleteEntry).not.toHaveBeenCalled();
    expect(fixtures.updateNote.mock.calls[0][0].input)
      .not.toHaveProperty("content");
  });

  it("preserves new and previous content when adding content fails", async () => {
    fixtures.addEntry.mockRejectedValue(new Error("Unable to save"));
    renderNote();

    fireEvent.click(screen.getByRole("button", { name: "Edit Note" }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "New note content" }),
      { target: { value: "Keep this draft" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(await screen.findByRole("alert"))
      .toHaveTextContent("Unable to save");

    expect(
      screen.getByRole("textbox", { name: "New note content" }),
    ).toHaveValue("Keep this draft");

    expect(
      screen.getByRole("textbox", {
        name: "Note content from 01/01/2026",
      }),
    ).toHaveValue("Baseline readings look consistent.");

    expect(screen.getByRole("button", { name: "Save Changes" }))
      .toBeEnabled();
  });

  it("deletes existing entries when all content is erased and saved", async () => {
    renderNote();

    fireEvent.click(screen.getByRole("button", { name: "Edit Note" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Note content from 01/01/2026" }), {
      target: { value: "" },
    });

    expect(fixtures.deleteEntry).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Edit Note" }))
        .toBeInTheDocument(),
    );

    expect(fixtures.deleteEntry).toHaveBeenCalledWith({
      noteId: "note-1",
      entryId: "entry-1",
    });
    expect(fixtures.updateEntry).not.toHaveBeenCalled();
    expect(fixtures.addEntry).not.toHaveBeenCalled();
  });

  it("saves metadata without sending earlier content", async () => {
    renderNote();

    fireEvent.click(screen.getByRole("button", { name: "Edit Note" }));
    fireEvent.change(screen.getByLabelText("Note title"), {
      target: { value: "Updated observations" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(fixtures.updateNote).toHaveBeenCalledTimes(1),
    );

    const payload = fixtures.updateNote.mock.calls[0][0];
    expect(payload.input.title).toBe("Updated observations");
    expect(payload.input).not.toHaveProperty("content");
    expect(fixtures.addEntry).not.toHaveBeenCalled();
  });

  it("returns to whatever page linked into edit mode when editing is cancelled", () => {
    render(
      <MemoryRouter
        initialEntries={["/daily-notes", "/daily-notes/note-1?edit=true"]}
        initialIndex={1}
      >
        <Routes>
          <Route path="daily-notes/:noteId" element={<DailyNoteDetailPage />} />
          <Route path="daily-notes" element={<h1>Notes</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /^Cancel$/ }));

    expect(screen.getByRole("heading", { name: "Notes" })).toBeInTheDocument();
  });

  it("falls back to the read-only note view when there is no previous page to return to", () => {
    render(
      <MemoryRouter initialEntries={["/daily-notes/note-1?edit=true"]}>
        <Routes>
          <Route path="daily-notes/:noteId" element={<DailyNoteDetailPage />} />
          <Route path="daily-notes" element={<h1>Notes</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /^Cancel$/ }));

    expect(screen.getByRole("button", { name: "Edit Note" })).toBeInTheDocument();
  });

  it("unlinks a note from its project via the Unlink button", async () => {
    fixtures.note.projectId = "project-1";
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <MemoryRouter initialEntries={["/daily-notes/note-1"]}>
        <Routes>
          <Route path="daily-notes/:noteId" element={<DailyNoteDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Unlink" }));

    await waitFor(() =>
      expect(fixtures.updateNote).toHaveBeenCalledWith({
        noteId: "note-1",
        input: { projectId: null, moduleId: null },
      }),
    );
  });

  it("shows the paper (not the project) when linked to a project-linked paper, alongside its parent project", () => {
    // The backend denormalizes a module-linked note's projectId to the
    // module's parent project, so a note linked to a paper still has both
    // moduleId and projectId set — the UI must not mistake that for a
    // direct project link.
    fixtures.note.moduleId = "module-1";
    fixtures.note.projectId = "project-1";
    render(
      <MemoryRouter initialEntries={["/daily-notes/note-1"]}>
        <Routes>
          <Route path="daily-notes/:noteId" element={<DailyNoteDetailPage />} />
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
      <MemoryRouter initialEntries={["/daily-notes/note-1"]}>
        <Routes>
          <Route path="daily-notes/:noteId" element={<DailyNoteDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Change link" }));
    fireEvent.click(screen.getByRole("button", { name: "Project" }));

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("shows content and header dates without a collapsible overview", () => {
    fixtures.note.followUpDate = "2026-04-15";

    render(
      <MemoryRouter initialEntries={["/daily-notes/note-1"]}>
        <Routes>
          <Route
            path="daily-notes/:noteId"
            element={<DailyNoteDetailPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    const content = screen.getByRole("region", { name: "Content" });
    expect(content).toHaveTextContent("Baseline readings look consistent.");
    expect(content).not.toHaveTextContent("Follow-up date");

    expect(screen.getByText("Created").parentElement)
      .toHaveTextContent("Jan 1, 2026");
    expect(screen.getByText("Follow-up date").parentElement)
      .toHaveTextContent("Apr 15, 2026");

    expect(
      screen.getByRole("link", { name: "Apr 15, 2026" }),
    ).toHaveAttribute("href", "/calendar");

    expect(
      screen.queryByRole("heading", { name: "Note overview" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /overview/i }),
    ).not.toBeInTheDocument();
  });

  it("shows linked work expanded by default, with an option to hide it", () => {
    fixtures.note.projectId = "project-1";
    render(
      <MemoryRouter initialEntries={["/daily-notes/note-1"]}>
        <Routes>
          <Route path="daily-notes/:noteId" element={<DailyNoteDetailPage />} />
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

  it("shows the shared-with section expanded by default, with an option to hide it", () => {
    fixtures.sharingEnabled = true;
    fixtures.note.visibility = "Shared";
    render(
      <MemoryRouter initialEntries={["/daily-notes/note-1"]}>
        <Routes>
          <Route path="daily-notes/:noteId" element={<DailyNoteDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Manage who has access" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Hide shared with" }),
    ).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByRole("button", { name: "Hide shared with" }));

    expect(
      screen.queryByRole("heading", { name: "Manage who has access" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show shared with" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("shows the note's creator as Owner in the shared-with list, even though they aren't an explicit member", () => {
    fixtures.sharingEnabled = true;
    fixtures.note.visibility = "Shared";
    render(
      <MemoryRouter initialEntries={["/daily-notes/note-1"]}>
        <Routes>
          <Route path="daily-notes/:noteId" element={<DailyNoteDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Avi Researcher")).toBeInTheDocument();
    expect(screen.getByText("Owner")).toBeInTheDocument();
  });

  it("edits a note's title", async () => {
    render(
      <MemoryRouter initialEntries={["/daily-notes/note-1"]}>
        <Routes>
          <Route path="daily-notes/:noteId" element={<DailyNoteDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit Note" }));
    fireEvent.change(screen.getByLabelText("Note title"), {
      target: { value: "Updated observations" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(fixtures.updateNote).toHaveBeenCalledWith({
        noteId: "note-1",
        input: expect.objectContaining({ title: "Updated observations" }),
      }),
    );
  });

  it("edits existing content through the single editor", async () => {
    renderNote();

    fireEvent.click(screen.getByRole("button", { name: "Edit Note" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Note content from 01/01/2026" }), {
      target: { value: "Baseline readings corrected." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Edit Note" }))
        .toBeInTheDocument(),
    );

    expect(fixtures.updateEntry).toHaveBeenCalledWith({
      noteId: "note-1",
      entryId: "entry-1",
      content: "Baseline readings corrected.",
    });
    expect(fixtures.addEntry).not.toHaveBeenCalled();
    expect(fixtures.deleteEntry).not.toHaveBeenCalled();
  });

  it("discards content edits and deletions when Cancel is clicked", () => {
    renderNote();

    fireEvent.click(screen.getByRole("button", { name: "Edit Note" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Note content from 01/01/2026" }), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(fixtures.updateNote).not.toHaveBeenCalled();
    expect(fixtures.updateEntry).not.toHaveBeenCalled();
    expect(fixtures.deleteEntry).not.toHaveBeenCalled();
    expect(fixtures.addEntry).not.toHaveBeenCalled();

    expect(screen.getByRole("region", { name: "Content" }))
      .toHaveTextContent("Baseline readings look consistent.");

    fireEvent.click(screen.getByRole("button", { name: "Edit Note" }));
    expect(screen.getByRole("textbox", { name: "Note content from 01/01/2026" })).toHaveValue(
      "Baseline readings look consistent.",
    );
  });

  it("does not rewrite unchanged entries when saving", async () => {
    renderNote();

    fireEvent.click(screen.getByRole("button", { name: "Edit Note" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Edit Note" }))
        .toBeInTheDocument(),
    );

    expect(fixtures.updateEntry).not.toHaveBeenCalled();
    expect(fixtures.deleteEntry).not.toHaveBeenCalled();
    expect(fixtures.addEntry).not.toHaveBeenCalled();
  });

  it("uses the latest edit for Modified while preserving original entry dates", () => {
    fixtures.note.entries = [
      {
        id: "entry-untouched",
        noteId: "note-1",
        content: "Never edited",
        createdAt: "2026-10-02T06:00:00.000Z",
        updatedAt: "2026-10-02T06:00:00.000Z",
      },
      {
        id: "entry-edited",
        noteId: "note-1",
        content: "Corrected later",
        createdAt: "2026-10-01T06:00:00.000Z",
        updatedAt: "2026-10-10T06:00:00.000Z",
      },
    ];

    renderNote();

    expect(screen.getByText("Modified").parentElement)
      .toHaveTextContent("Oct 10, 2026");

    const region = screen.getByRole("region", { name: "Content" });

    expect(
      [...region.querySelectorAll("time")].map(
        (element) => element.textContent,
      ),
    ).toEqual(["02/10/2026", "01/10/2026"]);

    expect(
      within(region)
        .getAllByText(/^(Corrected later|Never edited)$/)
        .map((element) => element.textContent),
    ).toEqual(["Never edited", "Corrected later"]);

    fireEvent.click(screen.getByRole("button", { name: "Edit Note" }));

    const editor = screen.getByRole("group", {
      name: "Dated note content",
    });

    expect(within(editor).getByText("01/10/2026"))
      .toBeInTheDocument();
    expect(within(editor).queryByText("10/10/2026"))
      .not.toBeInTheDocument();

    fireEvent.change(
      within(editor).getByRole("textbox", {
        name: "Note content from 01/10/2026",
      }),
      { target: { value: "Another correction" } },
    );

    expect(within(editor).getByText("01/10/2026"))
      .toBeInTheDocument();
    expect(within(editor).queryByText("10/10/2026"))
      .not.toBeInTheDocument();
  });
  it("edits today's existing section without creating another entry", async () => {
    const timestamp = new Date().toISOString();
    const today = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(timestamp));

    fixtures.note.entries = [{
      id: "entry-today",
      noteId: "note-1",
      content: "Today's existing note",
      createdAt: timestamp,
      updatedAt: timestamp,
    }];

    renderNote();
    fireEvent.click(screen.getByRole("button", { name: "Edit Note" }));

    const editor = screen.getByRole("group", {
      name: "Dated note content",
    });

    expect(editor.querySelectorAll("time")).toHaveLength(1);
    expect(
      within(editor).queryByRole("textbox", {
        name: "New note content",
      }),
    ).not.toBeInTheDocument();

    fireEvent.change(
      within(editor).getByRole("textbox", {
        name: `Note content from ${today}`,
      }),
      {
        target: {
          value: "Today's existing note\nAnother observation",
        },
      },
    );

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Edit Note" }))
        .toBeInTheDocument(),
    );

    expect(fixtures.updateEntry).toHaveBeenCalledWith({
      noteId: "note-1",
      entryId: "entry-today",
      content: "Today's existing note\nAnother observation",
    });
    expect(fixtures.addEntry).not.toHaveBeenCalled();
    expect(fixtures.deleteEntry).not.toHaveBeenCalled();
  });
});
