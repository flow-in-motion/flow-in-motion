import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DailyNotesPage from "@/pages/daily-notes";

type NoteFixture = {
  id: string;
  displayId: string | null;
  tenantId: string;
  projectId: string | null;
  moduleId: string | null;
  createdBy: string;
  title: string | null;
  content: string | null;
  visibility: string | null;
  followUpDate: string | null;
  createdAt: string | null;
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
}));

const deleteNoteMock = vi.hoisted(() => vi.fn());

vi.mock("@/api/hooks", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    useCurrentWorkspace: () => ({ data: { id: fixtures.tenantId }, isPending: false }),
    useTrackEvent: () => vi.fn(),
    useMe: () => ({ data: { id: "user-owner" }, isPending: false }),
    useMembers: () => ({
      data: { data: [], meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 } },
      isPending: false,
    }),
    useCollaboratorInvitations: () => ({ data: [], isPending: false, isError: false }),
    useCreateDraftInvitation: () => ({ mutateAsync: vi.fn(), isPending: false, isError: false }),
    useSendInvitation: () => ({ mutateAsync: vi.fn(), isPending: false, isError: false }),
    useRevokeCollaboratorInvitation: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
    useUserSearch: () => ({ data: [], isPending: false, isError: false }),
    useNoteMembers: () => ({ data: [], isPending: false }),
    useRemoveNoteMember: () => ({ mutate: vi.fn(), isPending: false }),
    useProjects: () => ({ data: { data: fixtures.projects, meta: { page: 1, pageSize: 20, totalItems: fixtures.projects.length, totalPages: 1 } }, isPending: false, isError: false }),
    useModules: () => ({
      data: {
        data: fixtures.modules,
        meta: { page: 1, pageSize: 20, totalItems: fixtures.modules.length, totalPages: 1 },
      },
    }),
    useNotes: (tenantId: string, projectId?: string, page = 1) => {
      hookMocks.useNotes(tenantId, projectId, page);

      const notes = useSyncExternalStore(store.subscribe, store.getNotes);

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
          followUpDate: (input.followUpDate as string | undefined) ?? null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        };
        store.setNotes([note, ...notes]);
        return note;
      }),
    }),
    useDeleteNote: () => ({ mutateAsync: deleteNoteMock }),
  };
});

function renderPage(initialEntries: string[] = ["/daily-notes"]) {
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="daily-notes" element={<DailyNotesPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("DailyNotesPage", () => {
  beforeEach(() => {
    hookMocks.useNotes.mockClear();
    hookMocks.pagination.totalItems = 1;
    hookMocks.pagination.totalPages = 1;
    deleteNoteMock.mockReset();
    deleteNoteMock.mockResolvedValue({});
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
        followUpDate: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
  });

  it("lists notes using the flat table layout shared with Projects/Papers/Tasks", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Daily Notes" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Initial observations" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sort by Note" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sort by Created" })).toBeInTheDocument();
  });

  it("shows note content in its own column, without needing to expand", () => {
    renderPage();

    expect(screen.getByRole("button", { name: "Sort by Content" })).toBeInTheDocument();
    expect(screen.getByText("Baseline readings look consistent.")).toBeInTheDocument();
  });

  it("requests the next notes page when Next is clicked", () => {
    hookMocks.pagination.totalItems = 21;
    hookMocks.pagination.totalPages = 2;

    renderPage();

    expect(hookMocks.useNotes).toHaveBeenCalledWith(fixtures.tenantId, undefined, 1);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(hookMocks.useNotes).toHaveBeenLastCalledWith(fixtures.tenantId, undefined, 2);
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
  });

  it("creates a general note", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "New Note" }));
    fireEvent.change(screen.getByPlaceholderText("Enter a note title"), {
      target: { value: "Reagent calibration notes" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Note" }));

    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Reagent calibration notes" })).toBeInTheDocument(),
    );
  });

  it("shows a project-select field when the Project link target is chosen", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "New Note" }));
    fireEvent.click(screen.getByRole("button", { name: "Project" }));

    expect(screen.getByText("Select a project")).toBeInTheDocument();
  });

  it("points to inviting collaborators after the note is created, instead of staging them", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "New Note" }));

    const visibilityTrigger = screen
      .getAllByRole("combobox")
      .find((el) => el.textContent?.includes("Private"));
    fireEvent.click(visibilityTrigger!);
    fireEvent.click(screen.getByRole("option", { name: "Shared" }));

    expect(
      screen.queryByPlaceholderText("Type a name or email to search all users"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "After creating the note, open it to invite collaborators by email using a secure acceptance link.",
      ),
    ).toBeInTheDocument();
  });

  it("pre-fills and opens the create dialog when linked via a project's Add note action", () => {
    renderPage(["/daily-notes?projectId=project-1&new=true"]);

    expect(screen.getByRole("dialog", { name: "Create a new note" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Project" })).toHaveAttribute("aria-pressed", "true");
    const projectTrigger = screen
      .getAllByRole("combobox")
      .find((el) => el.textContent?.includes("Genome Project"));
    expect(projectTrigger).toBeDefined();
  });

  it("filters the list by search text", () => {
    store.setNotes([
      ...store.getNotes(),
      {
        id: "note-2",
        displayId: "NTE-002",
        tenantId: fixtures.tenantId,
        projectId: null,
        moduleId: null,
        createdBy: "user-owner",
        title: "Reagent calibration",
        content: null,
        visibility: "Private",
        followUpDate: null,
        createdAt: "2026-01-02T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ]);
    renderPage();

    fireEvent.change(screen.getByPlaceholderText("Search notes…"), {
      target: { value: "Reagent" },
    });

    expect(screen.getByRole("link", { name: "Reagent calibration" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Initial observations" })).not.toBeInTheDocument();
  });

  it("shows the collaborators icon only for shared notes the current user owns", () => {
    store.setNotes(store.getNotes().map((note) => ({ ...note, visibility: "Shared" })));

    renderPage();

    expect(
      screen.getByRole("button", { name: "Manage collaborators for Initial observations" }),
    ).toBeInTheDocument();
  });

  it("hides the collaborators icon for private notes", () => {
    renderPage();

    expect(
      screen.queryByRole("button", { name: /Manage collaborators/ }),
    ).not.toBeInTheDocument();
  });

  it("deletes a note after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Delete Initial observations" }));

    expect(deleteNoteMock).toHaveBeenCalledWith("note-1");
  });

  it("renders and sorts legacy notes that have a missing title or created date, without crashing", () => {
    // Regression test: some real notes have a null title/createdAt (data
    // predating a stricter backend contract), which previously crashed
    // compareNotes's unconditional `.localeCompare` on those fields.
    store.setNotes([
      ...store.getNotes(),
      {
        id: "note-legacy",
        displayId: null,
        tenantId: fixtures.tenantId,
        projectId: null,
        moduleId: null,
        createdBy: "user-owner",
        title: null,
        content: null,
        visibility: "Private",
        followUpDate: null,
        createdAt: null,
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    renderPage();

    expect(screen.getByRole("link", { name: "Untitled note" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sort by Note" }));

    expect(screen.getByRole("link", { name: "Untitled note" })).toBeInTheDocument();
  });
});
