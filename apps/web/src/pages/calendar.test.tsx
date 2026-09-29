import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CalendarPage from "@/pages/calendar";

type CalendarEventFixture = {
  id: string;
  tenantId: string;
  createdBy: string;
  title: string;
  eventDate: string;
  createdAt: string;
  updatedAt: string;
};

// Mirrors react-query's cache-subscription behaviour so hand-written mocks
// still trigger a re-render when the underlying fixture data changes.
const calendarEventsStore = vi.hoisted(() => {
  let items: CalendarEventFixture[] = [];
  const listeners = new Set<() => void>();
  return {
    get: () => items,
    set: (next: CalendarEventFixture[]) => {
      items = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
});

const fixtures = vi.hoisted(() => {
  const today = new Date();
  const dueDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-15`;
  return {
    dueDate,
    projects: [
      {
        id: "project-1",
        title: "Research launch",
        dueDate,
        status: "Active",
      },
    ],
    modules: [
      {
        id: "module-1",
        title: "Analysis module",
        dueDate,
        projectId: "project-1",
      },
    ],
    conferences: [
      {
        id: "conference-1",
        acronym: "CONF",
        name: "Research Conference",
        location: "Sydney, Australia",
        submissionDue: dueDate,
        startDate: dueDate,
        endDate: dueDate,
      },
      {
        id: "conference-partial",
        acronym: null,
        name: "Conference details pending",
        location: null,
        submissionDue: null,
        startDate: null,
        endDate: null,
      },
    ],
    tasks: [
      {
        id: "task-1",
        title: "Submit ethics application",
        dueDate,
        projectId: "project-1",
      },
    ],
    notes: [
      {
        id: "note-1",
        title: "Follow up with collaborator",
        followUpDate: dueDate,
      },
    ],
  };
});

vi.mock("@/api/hooks", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    useCurrentWorkspace: () => ({ data: { id: "workspace-1" }, isPending: false }),
    useMe: () => ({ data: { id: "user-owner" } }),
    useProjects: () => ({
      data: { data: fixtures.projects, meta: { page: 1, pageSize: 20, totalItems: fixtures.projects.length, totalPages: 1 } },
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    }),
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
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    }),
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
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    }),
    useConferences: () => ({
      data: {
        data: fixtures.conferences,
        meta: {
          page: 1,
          pageSize: 20,
          totalItems: fixtures.conferences.length,
          totalPages: 1,
        },
      },
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
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
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    }),
    useCalendarEvents: () => {
      const events = useSyncExternalStore(
        calendarEventsStore.subscribe,
        calendarEventsStore.get,
      );
      return {
        data: {
          data: events,
          meta: { page: 1, pageSize: 20, totalItems: events.length, totalPages: 1 },
        },
        isPending: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      };
    },
    useCreateCalendarEvent: () => ({
      mutateAsync: vi.fn(async (input: { title: string; eventDate: string }) => {
        const current = calendarEventsStore.get();
        const event: CalendarEventFixture = {
          id: `event-${current.length + 1}`,
          tenantId: "workspace-1",
          createdBy: "user-owner",
          title: input.title,
          eventDate: input.eventDate,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        };
        calendarEventsStore.set([...current, event]);
        return event;
      }),
    }),
    useUpdateCalendarEvent: () => ({
      mutateAsync: vi.fn(
        async ({ eventId, input }: { eventId: string; input: { title: string; eventDate: string } }) => {
          const updated = calendarEventsStore
            .get()
            .map((item) => (item.id === eventId ? { ...item, ...input } : item));
          calendarEventsStore.set(updated);
          return updated.find((item) => item.id === eventId);
        },
      ),
    }),
    useDeleteCalendarEvent: () => ({
      mutateAsync: vi.fn(async (eventId: string) => {
        calendarEventsStore.set(
          calendarEventsStore.get().filter((item) => item.id !== eventId),
        );
      }),
    }),
  };
});

describe("CalendarPage", () => {
  beforeEach(() => {
    calendarEventsStore.set([]);
  });

  it("starts with every filter unselected and shows all due dates", () => {
    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole("link", { name: "Research launch" })).not.toHaveLength(0);
    expect(screen.getAllByRole("link", { name: "Analysis module" })).not.toHaveLength(0);
    expect(screen.getAllByRole("link", { name: "Submit ethics application" })).not.toHaveLength(0);
    expect(screen.getAllByRole("link", { name: "Research Conference — submission deadline" })).not.toHaveLength(0);
    expect(screen.getAllByRole("link", { name: "Follow up with collaborator" })).not.toHaveLength(0);

    expect(screen.getByRole("button", { name: /Projects/ })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /Papers/ })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /Tasks/ })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /Conferences/ })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /Events/ })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /Notes/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("shows only note follow-ups when Notes is selected", () => {
    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Notes/ }));

    expect(screen.getAllByRole("link", { name: "Follow up with collaborator" })).not.toHaveLength(0);
    expect(screen.queryByRole("link", { name: "Research launch" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Analysis module" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Submit ethics application" })).not.toBeInTheDocument();
  });

  it("shows only project due dates when Projects is selected", () => {
    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Projects/ }));

    expect(screen.getAllByRole("link", { name: "Research launch" })).not.toHaveLength(0);
    expect(screen.queryByRole("link", { name: "Analysis module" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Submit ethics application" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Research Conference" })).not.toBeInTheDocument();
  });

  it("switches exclusively between module, task, and conference due dates", () => {
    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Papers/ }));
    expect(screen.getAllByRole("link", { name: "Analysis module" })).not.toHaveLength(0);
    expect(screen.queryByRole("link", { name: "Research launch" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Tasks/ }));
    expect(screen.getAllByRole("link", { name: "Submit ethics application" })).not.toHaveLength(0);
    expect(screen.queryByRole("link", { name: "Analysis module" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Conferences/ }));
    expect(screen.getAllByRole("link", { name: "Research Conference — submission deadline" })).not.toHaveLength(0);
    expect(screen.getAllByRole("link", { name: "Research Conference" })).not.toHaveLength(0);
    expect(screen.queryByRole("link", { name: "Submit ethics application" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Conferences/ }));
    expect(screen.getAllByRole("link", { name: "Research launch" })).not.toHaveLength(0);
    expect(screen.getAllByRole("link", { name: "Analysis module" })).not.toHaveLength(0);
    expect(screen.getAllByRole("link", { name: "Submit ethics application" })).not.toHaveLength(0);
  });

  it("does not create invalid calendar entries for a conference with no dates", () => {
    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Conferences/ }));

    expect(screen.queryByRole("link", { name: "Conference details pending" })).not.toBeInTheDocument();
  });

  it("supports month navigation and returning to today", () => {
    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>,
    );

    const initialMonth = screen.getByRole("heading", { level: 2 }).textContent;
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByRole("heading", { level: 2 })).not.toHaveTextContent(initialMonth ?? "");
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(initialMonth ?? "");
  });

  it("creates a standalone calendar event with just a title and date", async () => {
    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "New Event" }));
    fireEvent.change(screen.getByLabelText(/Title/), {
      target: { value: "Lab equipment booking closes" },
    });

    const dateInput = document
      .getElementById("calendar-event-date")!
      .closest(".relative")!
      .querySelector<HTMLInputElement>('input[type="date"]')!;
    fireEvent.change(dateInput, { target: { value: fixtures.dueDate } });

    fireEvent.click(screen.getByRole("button", { name: "Add Event" }));

    await waitFor(() =>
      expect(screen.getAllByText("Lab equipment booking closes").length).toBeGreaterThan(0),
    );
  });

  it("edits and deletes an existing calendar event created by the caller", async () => {
    calendarEventsStore.set([
      {
        id: "event-1",
        tenantId: "workspace-1",
        createdBy: "user-owner",
        title: "Existing reminder",
        eventDate: fixtures.dueDate,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getAllByText("Existing reminder")[0]!);

    expect(screen.getByRole("heading", { name: "Edit event" })).toBeInTheDocument();

    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(screen.queryByText("Existing reminder")).not.toBeInTheDocument(),
    );
  });
});
