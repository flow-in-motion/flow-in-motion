import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DailyNoteDetailPage from "@/pages/daily-note-detail";

const fixtures = vi.hoisted(() => ({
  updateNote: vi.fn(),
  note: {
    id: "note-1",
    displayId: "NTE-001",
    tenantId: "workspace-1",
    projectId: null as string | null,
    moduleId: null as string | null,
    createdBy: "user-owner",
    title: "Initial observations",
    content: "Baseline readings look consistent.",
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
  useUpdateMyNote: () => ({ mutateAsync: fixtures.updateNote, isPending: false }),
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
}));

describe("DailyNoteDetailPage", () => {
  beforeEach(() => {
    fixtures.note.projectId = null;
    fixtures.note.moduleId = null;
    fixtures.note.visibility = "Private";
    fixtures.updateNote.mockReset();
    fixtures.updateNote.mockResolvedValue(fixtures.note);
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

  it("shows the note overview expanded by default at the top, with an option to hide it", () => {
    render(
      <MemoryRouter initialEntries={["/daily-notes/note-1"]}>
        <Routes>
          <Route path="daily-notes/:noteId" element={<DailyNoteDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Note overview" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Hide overview" }),
    ).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByRole("button", { name: "Hide overview" }));

    expect(screen.queryByRole("heading", { name: "Note overview" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show overview" }),
    ).toHaveAttribute("aria-expanded", "false");
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

  it("edits a note's title and content", async () => {
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
});
