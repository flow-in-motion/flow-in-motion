import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DailyNotesPage from "@/pages/daily-notes";

type NoteFixture = {
  id: string;
  displayId: string | null;
  tenantId: string;
  projectId: string | null;
  moduleId: string | null;
  createdBy: string;
  title: string;
  content: string | null;
  visibility: string | null;
  createdAt: string;
  updatedAt: string;
};

// Mirrors react-query's cache-subscription behaviour so hand-written mocks
// still trigger a re-render when the underlying fixture data changes.
const store = vi.hoisted(() => {
  let notes: NoteFixture[] = [];
  const listeners = new Set<() => void>();
  return {
    getNotes: () => notes,
    setNotes: (next: NoteFixture[]) => {
      notes = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
});
const hookMocks = vi.hoisted(() => ({
  useNotes: vi.fn(),
  pagination: {
    totalItems: 1,
    totalPages: 1,
  },
}));

const fixtures = vi.hoisted(() => ({
  tenantId: "workspace-1",
  projects: [{ id: "project-1", title: "Genome Project" }],
  modules: [{ id: "module-1", title: "Assay optimization" }],
  members: [
    {
      id: "membership-owner",
      userId: "user-owner",
      displayName: "Avi Researcher",
      email: "owner@example.com",
      role: "owner",
    },
    {
      id: "membership-collaborator",
      userId: "user-collaborator",
      displayName: "Jamie Collaborator",
      email: "jamie@example.com",
      role: "limited_member",
    },
  ],
  // Proves the "Share with" search hits the platform-wide user-search
  // endpoint, not the workspace member list.
  allUsers: [
    { id: "user-outside-workspace", displayName: "Jamie Outsider", email: "jamie@example.com" },
  ],
}));

const sharingMutations = vi.hoisted(() => ({
  addNoteMember: vi.fn(),
}));

const updateNoteMock = vi.hoisted(() => vi.fn());

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
    useUserSearch: (query: string) => ({
      data: query.trim()
        ? fixtures.allUsers.filter((user) =>
            user.displayName.toLowerCase().includes(query.trim().toLowerCase()),
          )
        : [],
      isPending: false,
    }),
    useNotes: (
      tenantId: string,
      projectId?: string,
      page = 1,
    ) => {
      hookMocks.useNotes(tenantId, projectId, page);
    
      const notes = useSyncExternalStore(
        store.subscribe,
        store.getNotes,
      );
    
      return {
        data: {
          data: notes,
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
    useCreateNote: () => ({
      mutateAsync: vi.fn(async (input: Record<string, unknown>) => {
        const notes = store.getNotes();
        const note: NoteFixture = {
          id: `note-${notes.length + 1}`,
          displayId: `NTE-${String(notes.length + 1).padStart(3, "0")}`,
          tenantId: fixtures.tenantId,
          projectId: (input.projectId as string | undefined) ?? null,
          moduleId: (input.moduleId as string | undefined) ?? null,
          createdBy: "user-owner",
          title: input.title as string,
          content: (input.content as string | undefined) ?? null,
          visibility: (input.visibility as string | undefined) ?? "Private",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        };
        store.setNotes([note, ...notes]);
        return note;
      }),
    }),
    useUpdateNote: () => ({
      mutateAsync: updateNoteMock.mockImplementation(
        async ({ noteId, input }: { noteId: string; input: Record<string, unknown> }) => {
          const updated = store.getNotes().map((item) =>
            item.id === noteId
              ? {
                  ...item,
                  ...input,
                  projectId:
                    input.projectId === "" || input.projectId === null
                      ? null
                      : (input.projectId as string | undefined) ?? item.projectId,
                  moduleId:
                    input.moduleId === "" || input.moduleId === null
                      ? null
                      : (input.moduleId as string | undefined) ?? item.moduleId,
                }
              : item,
          );
          store.setNotes(updated);
          return updated.find((item) => item.id === noteId);
        },
      ),
    }),
    useDeleteNote: () => ({
      mutateAsync: vi.fn(async (noteId: string) => {
        store.setNotes(store.getNotes().filter((item) => item.id !== noteId));
      }),
    }),
    useNoteMembers: () => ({ data: [], isPending: false }),
    useAddNoteMember: () => ({ mutate: sharingMutations.addNoteMember }),
    useRemoveNoteMember: () => ({ mutate: vi.fn() }),
  };
});

describe("DailyNotesPage", () => {
  beforeEach(() => {
    sharingMutations.addNoteMember.mockClear();
    updateNoteMock.mockClear();
    hookMocks.useNotes.mockClear();
    hookMocks.pagination.totalItems = 1;
    hookMocks.pagination.totalPages = 1;
    store.setNotes([
      {
        id: "note-1",
        displayId: "NTE-001",
        tenantId: fixtures.tenantId,
        projectId: null,
        moduleId: null,
        createdBy: "user-owner",
        title: "Initial observations",
        content: "Baseline readings look consistent.",
        visibility: "Private",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
  });
  it("requests the next notes page when Next is clicked", () => {
    hookMocks.pagination.totalItems = 21;
    hookMocks.pagination.totalPages = 2;
  
    render(
      <MemoryRouter>
        <DailyNotesPage />
      </MemoryRouter>,
    );
  
    expect(hookMocks.useNotes).toHaveBeenCalledWith(
      fixtures.tenantId,
      undefined,
      1,
    );
  
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
  
    expect(hookMocks.useNotes).toHaveBeenLastCalledWith(
      fixtures.tenantId,
      undefined,
      2,
    );
  
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
  });
  
  it("creates a general note", async () => {
    render(
      <MemoryRouter>
        <DailyNotesPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add note" }));
    fireEvent.change(screen.getByLabelText("Note title"), {
      target: { value: "Reagent calibration notes" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Reagent calibration notes" }),
      ).toBeInTheDocument(),
    );
  });

  it("shows a project-select field when the Project link target is chosen", () => {
    render(
      <MemoryRouter>
        <DailyNotesPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add note" }));
    fireEvent.click(screen.getByRole("button", { name: "Project" }));

    expect(screen.getByText("Select a project")).toBeInTheDocument();
  });

  it("searches all platform users, not just workspace members, when sharing a new note", () => {
    render(
      <MemoryRouter>
        <DailyNotesPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add note" }));

    const visibilityTrigger = screen
      .getAllByRole("combobox")
      .find((el) => el.textContent?.includes("Private"));
    fireEvent.click(visibilityTrigger!);
    fireEvent.click(screen.getByRole("option", { name: "Shared" }));

    const shareSearch = screen.getByPlaceholderText("Type a name or email to search all users");
    fireEvent.change(shareSearch, { target: { value: "Jamie" } });

    expect(screen.getByText("jamie@example.com")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: /Jamie Outsider/ }));
    expect(screen.getByLabelText("Selected note members")).toHaveTextContent(
      "Jamie Outsider",
    );
  });

  it("directly assigns any platform user when a private note is changed to shared", () => {
    render(
      <MemoryRouter>
        <DailyNotesPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit note" }));
    const visibilityTrigger = screen
      .getAllByRole("combobox")
      .find((element) => element.textContent?.includes("Private"));
    fireEvent.click(visibilityTrigger!);
    fireEvent.click(screen.getByRole("option", { name: "Shared" }));

    const search = screen.getByPlaceholderText("Type a name or email to search all users");
    fireEvent.change(search, { target: { value: "Jamie" } });
    fireEvent.click(screen.getByRole("option", { name: /Jamie Outsider/ }));

    expect(sharingMutations.addNoteMember).toHaveBeenCalledWith("user-outside-workspace");
    expect(screen.getByText(/No email invitation is sent/)).toBeInTheDocument();
  });

  it("edits an existing note's title and content", async () => {
    render(
      <MemoryRouter>
        <DailyNotesPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit note" }));
    fireEvent.change(screen.getByLabelText("Note title"), {
      target: { value: "Updated observations" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Updated observations" })).toBeInTheDocument(),
    );
  });

  it("sorts notes alphabetically by title", () => {
    store.setNotes([
      {
        id: "note-1",
        displayId: "NTE-001",
        tenantId: fixtures.tenantId,
        projectId: null,
        moduleId: null,
        createdBy: "user-owner",
        title: "Charlie note",
        content: null,
        visibility: "Private",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "note-2",
        displayId: "NTE-002",
        tenantId: fixtures.tenantId,
        projectId: null,
        moduleId: null,
        createdBy: "user-owner",
        title: "Alpha note",
        content: null,
        visibility: "Private",
        createdAt: "2026-01-02T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
      {
        id: "note-3",
        displayId: "NTE-003",
        tenantId: fixtures.tenantId,
        projectId: null,
        moduleId: null,
        createdBy: "user-owner",
        title: "Bravo note",
        content: null,
        visibility: "Private",
        createdAt: "2026-01-03T00:00:00.000Z",
        updatedAt: "2026-01-03T00:00:00.000Z",
      },
    ]);
    render(
      <MemoryRouter>
        <DailyNotesPage />
      </MemoryRouter>,
    );

    const sidebar = screen.getByRole("heading", { level: 3, name: "Daily Notes" }).closest("aside")!;
    const titleOrder = () =>
      within(sidebar)
        .getAllByText(/^(Alpha|Bravo|Charlie) note$/)
        .map((el) => el.textContent);

    // Default sort is newest first (by createdAt).
    expect(titleOrder()).toEqual(["Bravo note", "Alpha note", "Charlie note"]);

    fireEvent.click(screen.getByRole("combobox", { name: "Sort notes by" }));
    fireEvent.click(screen.getByRole("option", { name: "Title (A–Z)" }));

    expect(titleOrder()).toEqual(["Alpha note", "Bravo note", "Charlie note"]);

    fireEvent.click(screen.getByRole("combobox", { name: "Sort notes by" }));
    fireEvent.click(screen.getByRole("option", { name: "Title (Z–A)" }));

    expect(titleOrder()).toEqual(["Charlie note", "Bravo note", "Alpha note"]);
  });

  it("unlinks a note from its project via the Unlink button", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    store.setNotes([
      {
        id: "note-1",
        displayId: "NTE-001",
        tenantId: fixtures.tenantId,
        projectId: "project-1",
        moduleId: null,
        createdBy: "user-owner",
        title: "Initial observations",
        content: "Baseline readings look consistent.",
        visibility: "Private",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    render(
      <MemoryRouter>
        <DailyNotesPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Unlink" }));

    await waitFor(() =>
      expect(
        screen.getByText("This is a general note with no linked project or paper."),
      ).toBeInTheDocument(),
    );
  });

  it("shows the paper (not the project) when linked to a project-linked paper, alongside its parent project", () => {
    // The backend denormalizes a module-linked note's projectId to the
    // module's parent project, so both fields are set here — the "Linked
    // work" section must not mistake that for a direct project link.
    store.setNotes([
      {
        id: "note-1",
        displayId: "NTE-001",
        tenantId: fixtures.tenantId,
        projectId: "project-1",
        moduleId: "module-1",
        createdBy: "user-owner",
        title: "Assay results",
        content: null,
        visibility: "Private",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    render(
      <MemoryRouter>
        <DailyNotesPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Paper")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Paper Assay optimization/ }),
    ).toHaveAttribute("href", "/modules/module-1");

    expect(screen.getByText("Parent project")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Parent project Genome Project/ }),
    ).toHaveAttribute("href", "/projects/project-1");
  });

  it("sends null (not empty string) to clear a note's module link when switching to General", async () => {
    store.setNotes([
      {
        id: "note-1",
        displayId: "NTE-001",
        tenantId: fixtures.tenantId,
        projectId: null,
        moduleId: "module-1",
        createdBy: "user-owner",
        title: "Linked to a module",
        content: null,
        visibility: "Private",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    render(
      <MemoryRouter>
        <DailyNotesPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit note" }));
    fireEvent.click(screen.getByRole("button", { name: "General" }));
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));

    await waitFor(() => expect(updateNoteMock).toHaveBeenCalled());
    expect(updateNoteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        noteId: "note-1",
        input: expect.objectContaining({ projectId: null, moduleId: null }),
      }),
    );
  });

  it("deletes the selected note", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <MemoryRouter>
        <DailyNotesPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Initial observations" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete note" }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "No note selected" })).toBeInTheDocument(),
    );
  });
});
