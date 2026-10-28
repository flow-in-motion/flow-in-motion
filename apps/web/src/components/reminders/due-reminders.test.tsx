import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiDueReminder } from "@/api/due-reminders";

import { DueReminderSettingsCard } from "./due-reminder-settings";
import { DueRemindersBell } from "./due-reminders-bell";
import { reminderWhen } from "./reminder-format";

const server = vi.hoisted(() => ({
  items: [] as ApiDueReminder[],
  calls: [] as Array<{ method: string; path: string; body?: unknown }>,
  preferences: null as Record<string, unknown> | null,
}));

vi.mock("@/api/client", () => ({
  authenticatedJson: vi.fn(async (path: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    server.calls.push({ method, path, body });
    if (path.startsWith("/api/v1/tenant/tenant-1/due-reminders?")) {
      return {
        items: server.items,
        unreadCount: server.items.filter((item) => item.unread).length,
      };
    }
    if (path.endsWith("/due-reminders/seen")) {
      server.items = server.items.map((item) => ({ ...item, unread: false }));
      return { ok: true };
    }
    if (path.endsWith("/due-reminders/dismiss-all")) {
      const ids = new Set(body.items.map((item: { itemId: string }) => item.itemId));
      server.items = server.items.filter((item) => !ids.has(item.itemId));
      return { ok: true };
    }
    if (path.endsWith("/due-reminders/dismiss")) {
      server.items = server.items.filter((item) => item.itemId !== body.itemId);
      return { ok: true };
    }
    if (path === "/api/v1/me/preferences") {
      if (method === "PATCH") {
        server.preferences = { ...(server.preferences ?? {}), ...body };
      }
      return { preferences: server.preferences };
    }
    throw new Error(`Unexpected ${method} ${path}`);
  }),
  apiClient: { GET: vi.fn(), use: vi.fn() },
}));

vi.mock("@/api/hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/hooks")>();
  return {
    ...actual,
    useCurrentWorkspace: () => ({ data: { id: "tenant-1" } }),
  };
});

function reminder(overrides: Partial<ApiDueReminder>): ApiDueReminder {
  const base = {
    type: "task" as const,
    itemId: "task-1",
    targetId: "task-1",
    title: "Write methods",
    context: "Thesis",
    dueDate: "2026-10-29",
    daysUntil: 1,
    stage: 1,
    unread: true,
    ...overrides,
  };
  return { ...base, key: `${base.type}:${base.itemId}:${base.dueDate}` };
}

function renderWithClient(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  server.items = [];
  server.calls = [];
  server.preferences = null;
});

describe("reminderWhen", () => {
  it.each([
    [{ type: "task", daysUntil: -3 }, "Overdue by 3 days"],
    [{ type: "task", daysUntil: -1 }, "Overdue by 1 day"],
    [{ type: "note", daysUntil: -2 }, "Follow-up was 2 days ago"],
    [{ type: "paper", daysUntil: 0 }, "Due today"],
    [{ type: "funding_follow_up", daysUntil: 1 }, "Follow up tomorrow"],
    [{ type: "task", daysUntil: 5, dueDate: "2026-11-02" }, "Due in 5 days (Mon 2 Nov)"],
  ] as const)("%o reads %s", (input, expected) => {
    expect(
      reminderWhen({ dueDate: "2026-10-28", ...input } as Parameters<typeof reminderWhen>[0]),
    ).toBe(expected);
  });
});

describe("DueRemindersBell", () => {
  it("shows how many reminders are new", async () => {
    server.items = [
      reminder({ itemId: "a" }),
      reminder({ itemId: "b", unread: false }),
    ];
    renderWithClient(<DueRemindersBell />);

    expect(
      await screen.findByRole("button", { name: "Reminders, 1 new" }),
    ).toBeInTheDocument();
  });

  it("lists reminders by when they're due, and marks them seen when opened", async () => {
    server.items = [
      reminder({ itemId: "late", title: "Overdue draft", daysUntil: -2, stage: -1, dueDate: "2026-10-26" }),
      reminder({ itemId: "today", title: "Send survey", daysUntil: 0, stage: 0, dueDate: "2026-10-28" }),
      reminder({
        type: "conference_submission",
        itemId: "sub",
        targetId: "conf-1",
        title: "Panel proposal",
        context: "Submission to AMCIS",
        daysUntil: 5,
        stage: 7,
        dueDate: "2026-11-02",
      }),
    ];
    renderWithClient(<DueRemindersBell />);

    fireEvent.click(await screen.findByRole("button", { name: "Reminders, 3 new" }));
    const panel = await screen.findByRole("dialog", { name: "Reminders" });

    expect(
      within(panel)
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(["Overdue", "Today", "Coming up"]);
    const overdue = within(panel).getByRole("region", { name: "Overdue" });
    expect(overdue).toHaveTextContent("Overdue draft");
    expect(overdue).toHaveTextContent("Overdue by 2 days");
    expect(
      within(panel).getByRole("link", { name: /Panel proposal/ }),
    ).toHaveAttribute("href", "/conferences/conf-1");
    // Still marked New while the panel is open.
    expect(within(panel).getAllByText("New")).toHaveLength(3);

    await waitFor(() =>
      expect(server.calls).toContainEqual(
        expect.objectContaining({
          method: "POST",
          path: "/api/v1/tenant/tenant-1/due-reminders/seen",
          body: {
            items: [
              { type: "task", itemId: "late", dueDate: "2026-10-26", stage: -1 },
              { type: "task", itemId: "today", dueDate: "2026-10-28", stage: 0 },
              {
                type: "conference_submission",
                itemId: "sub",
                dueDate: "2026-11-02",
                stage: 7,
              },
            ],
          },
        }),
      ),
    );
  });

  it("dismisses a reminder", async () => {
    server.items = [reminder({ itemId: "a", title: "Write methods", unread: false })];
    renderWithClient(<DueRemindersBell />);

    fireEvent.click(await screen.findByRole("button", { name: "Reminders" }));
    const panel = await screen.findByRole("dialog", { name: "Reminders" });
    await act(async () => {
      fireEvent.click(
        within(panel).getByRole("button", { name: "Dismiss reminder for Write methods" }),
      );
    });

    await waitFor(() =>
      expect(within(panel).getByText("You're all caught up")).toBeInTheDocument(),
    );
    expect(server.calls).toContainEqual({
      method: "POST",
      path: "/api/v1/tenant/tenant-1/due-reminders/dismiss",
      body: { type: "task", itemId: "a", dueDate: "2026-10-29" },
    });
  });

  it("dismisses every reminder after a quick confirm", async () => {
    server.items = [
      reminder({ itemId: "a", title: "Write methods", unread: false }),
      reminder({ type: "note", itemId: "b", title: "Ask supervisor", unread: false }),
    ];
    renderWithClient(<DueRemindersBell />);

    fireEvent.click(await screen.findByRole("button", { name: "Reminders" }));
    const panel = await screen.findByRole("dialog", { name: "Reminders" });
    await within(panel).findByText("Ask supervisor");

    fireEvent.click(within(panel).getByRole("button", { name: "Dismiss all" }));
    const confirm = within(panel).getByRole("group", { name: "Dismiss all reminders" });
    expect(confirm).toHaveTextContent("Dismiss all 2 reminders?");

    // Cancel keeps everything.
    fireEvent.click(within(confirm).getByRole("button", { name: "Cancel" }));
    expect(within(panel).getByText("Ask supervisor")).toBeInTheDocument();

    fireEvent.click(within(panel).getByRole("button", { name: "Dismiss all" }));
    await act(async () => {
      fireEvent.click(
        within(
          within(panel).getByRole("group", { name: "Dismiss all reminders" }),
        ).getByRole("button", { name: "Dismiss all" }),
      );
    });

    await waitFor(() =>
      expect(within(panel).getByText("You're all caught up")).toBeInTheDocument(),
    );
    expect(server.calls).toContainEqual({
      method: "POST",
      path: "/api/v1/tenant/tenant-1/due-reminders/dismiss-all",
      body: {
        items: [
          { type: "task", itemId: "a", dueDate: "2026-10-29" },
          { type: "note", itemId: "b", dueDate: "2026-10-29" },
        ],
      },
    });
    expect(within(panel).queryByRole("button", { name: "Dismiss all" })).toBeNull();
  });

  it("says when nothing is due", async () => {
    renderWithClient(<DueRemindersBell />);
    fireEvent.click(await screen.findByRole("button", { name: "Reminders" }));
    expect(await screen.findByText("You're all caught up")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Reminder settings" })).toHaveAttribute(
      "href",
      "/settings#due-reminders",
    );
  });
});

describe("DueReminderSettingsCard", () => {
  it("starts with the default times and saves changes", async () => {
    renderWithClient(<DueReminderSettingsCard />);

    const weekBefore = await screen.findByRole("button", { name: "1 week before" });
    await waitFor(() => expect(weekBefore).toBeEnabled());
    expect(weekBefore).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "3 days before" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "3 days before" }));
    });

    await waitFor(() =>
      expect(server.calls).toContainEqual({
        method: "PATCH",
        path: "/api/v1/me/preferences",
        body: {
          dueReminders: {
            leadDays: [7, 1, 0, 3],
            overdue: true,
            types: ["tasks", "papers", "projects", "events", "funding", "notes"],
          },
        },
      }),
    );
    expect(await screen.findByText("Saved")).toBeInTheDocument();
  });

  it("warns when every reminder is turned off", async () => {
    server.preferences = {
      dueReminders: { leadDays: [], overdue: false, types: ["tasks"] },
    };
    renderWithClient(<DueReminderSettingsCard />);

    expect(
      await screen.findByText(/Reminders are off: choose at least one time/),
    ).toBeInTheDocument();
  });
});
