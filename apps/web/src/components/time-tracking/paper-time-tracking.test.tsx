import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ApiPaperTime,
  ApiTimeEntry,
  ApiTimer,
} from "@/api/time-tracking";

import { PaperTimeCard } from "./paper-time-card";
import { PaperTimerButton } from "./paper-timer-button";
import { RunningTimerBar } from "./running-timer-bar";

const server = vi.hoisted(() => ({
  timers: [] as ApiTimer[],
  paperTime: undefined as ApiPaperTime | undefined,
  owner: "auth-user-1",
  calls: [] as Array<{
    method: string;
    path: string;
    body?: unknown;
  }>,
}));

vi.mock("@/auth/auth-provider", () => ({
  useAuth: () => ({ user: { id: server.owner } }),
}));

function timerFor(
  moduleId: string,
  overrides: Partial<ApiTimer> = {},
): ApiTimer {
  return {
    id: `entry-${moduleId}`,
    taskId: null,
    moduleId,
    tenantId: "tenant-1",
    taskTitle: null,
    taskDisplayId: null,
    paperTitle:
      moduleId === "paper-1" ? "Literature review" : "Other paper",
    paperDisplayId: "MOD-0001",
    startedAt: "2026-10-28T00:00:00.000Z",
    isOpen: true,
    isRunning: true,
    durationSeconds: 0,
    runningSeconds: 0,
    elapsedSeconds: 0,
    ...overrides,
  };
}

vi.mock("@/api/client", () => ({
  authenticatedJson: vi.fn(
    async (path: string, init: RequestInit = {}) => {
      const method = init.method ?? "GET";
      const body = init.body
        ? JSON.parse(String(init.body))
        : undefined;

      server.calls.push({ method, path, body });

      if (path === "/api/v1/me/time-entries/current") {
        return { timers: server.timers };
      }

      if (path === "/api/v1/me/time-entries/timer/start-paper") {
        let timer = server.timers.find(
          (item) => item.moduleId === body.moduleId,
        );

        if (timer) {
          timer.isRunning = true;
        } else {
          timer = timerFor(body.moduleId);
          server.timers.push(timer);
        }

        return { timer };
      }

      const action = path.match(
        /^\/api\/v1\/me\/time-entries\/timer\/([^/]+)\/(pause|resume|stop)$/,
      );

      if (action) {
        const entryId = decodeURIComponent(action[1]!);
        const timer = server.timers.find(
          (item) => item.id === entryId,
        );

        if (!timer) throw new Error("Open timer not found");

        if (action[2] === "resume") {
          timer.isRunning = true;
          return { timer };
        }

        timer.durationSeconds += timer.runningSeconds;
        timer.runningSeconds = 0;
        timer.elapsedSeconds = timer.durationSeconds;
        timer.isRunning = false;

        if (action[2] === "stop") {
          server.timers = server.timers.filter(
            (item) => item.id !== entryId,
          );
          return { stopped: { ...timer, isOpen: false } };
        }

        return { timer };
      }

      if (
        path === "/api/v1/me/modules/paper-1/time-entries" &&
        method === "GET"
      ) {
        return server.paperTime;
      }

      return {
        id: "entry-new",
        taskId: null,
        moduleId: "paper-1",
      };
    },
  ),
}));

function renderWithClient(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper });
}

beforeEach(() => {
  server.timers = [];
  server.paperTime = {
    moduleId: "paper-1",
    entries: [],
    mySeconds: 0,
    totalSeconds: 0,
  };
  server.owner = "auth-user-1";
  server.calls = [];
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PaperTimerButton", () => {
  it("starts, pauses and resumes its paper without stopping another paper", async () => {
    server.timers = [timerFor("paper-2")];

    renderWithClient(
      <PaperTimerButton
        moduleId="paper-1"
        paperTitle="Literature review"
      />,
    );

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Start timer for Literature review",
      }),
    );

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Pause timer for Literature review",
      }),
    );

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Resume timer for Literature review",
      }),
    );

    await screen.findByRole("button", {
      name: "Pause timer for Literature review",
    });

    expect(server.timers).toHaveLength(2);
    expect(
      server.timers.every((timer) => timer.isRunning),
    ).toBe(true);

    expect(server.calls).toContainEqual({
      method: "POST",
      path: "/api/v1/me/time-entries/timer/start-paper",
      body: { moduleId: "paper-1" },
    });
    expect(server.calls).toContainEqual({
      method: "POST",
      path: "/api/v1/me/time-entries/timer/entry-paper-1/pause",
      body: undefined,
    });
    expect(server.calls).toContainEqual({
      method: "POST",
      path: "/api/v1/me/time-entries/timer/entry-paper-1/resume",
      body: undefined,
    });
  });
});

describe("PaperTimeCard", () => {
  const finished: ApiTimeEntry = {
    id: "entry-1",
    taskId: null,
    moduleId: "paper-1",
    source: "timer",
    startedAt: "2026-10-27T23:00:00.000Z",
    endedAt: "2026-10-28T00:00:00.000Z",
    note: "Read three papers",
    isOpen: false,
    isRunning: false,
    durationSeconds: 3600,
    runningSeconds: 0,
  };

  it("shows saved paper time and everyone's total", async () => {
    server.paperTime = {
      moduleId: "paper-1",
      entries: [finished],
      mySeconds: 3600,
      totalSeconds: 5400,
    };

    renderWithClient(<PaperTimeCard paper={{ id: "paper-1" }} />);

    expect(
      await screen.findByText("Read three papers"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/no estimate yet/),
    ).toHaveTextContent("1h 30m");
  });

  it("adds time by hand through the paper endpoint", async () => {
    renderWithClient(<PaperTimeCard paper={{ id: "paper-1" }} />);

    await screen.findByText(/No time logged yet/);
    fireEvent.click(screen.getByRole("button", { name: "Add time" }));

    const form = screen.getByRole("form", { name: "Add time" });

    fireEvent.change(within(form).getByLabelText("Hours"), {
      target: { value: "1" },
    });
    fireEvent.change(within(form).getByLabelText("Minutes"), {
      target: { value: "30" },
    });
    fireEvent.change(within(form).getByLabelText(/What did you do/), {
      target: { value: "  Coded interviews  " },
    });

    fireEvent.click(
      within(form).getByRole("button", { name: "Add time" }),
    );

    await waitFor(() =>
      expect(server.calls).toContainEqual(
        expect.objectContaining({
          method: "POST",
          path: "/api/v1/me/modules/paper-1/time-entries",
          body: expect.objectContaining({
            minutes: 90,
            note: "Coded interviews",
          }),
        }),
      ),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("form", { name: "Add time" }),
      ).toBeNull(),
    );
  });

  it("corrects and deletes paper entries through the shared entry endpoints", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);

    server.paperTime = {
      moduleId: "paper-1",
      entries: [finished],
      mySeconds: 3600,
      totalSeconds: 3600,
    };

    renderWithClient(<PaperTimeCard paper={{ id: "paper-1" }} />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: /^Edit time logged/,
      }),
    );

    const form = screen.getByRole("form", {
      name: "Edit time entry",
    });

    fireEvent.change(within(form).getByLabelText("Minutes"), {
      target: { value: "15" },
    });
    fireEvent.click(
      within(form).getByRole("button", { name: "Save changes" }),
    );

    await waitFor(() =>
      expect(server.calls).toContainEqual(
        expect.objectContaining({
          method: "PATCH",
          path: "/api/v1/me/time-entries/entry-1",
          body: expect.objectContaining({ minutes: 75 }),
        }),
      ),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("form", { name: "Edit time entry" }),
      ).toBeNull(),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /^Delete time logged/,
      }),
    );

    await waitFor(() =>
      expect(server.calls).toContainEqual({
        method: "DELETE",
        path: "/api/v1/me/time-entries/entry-1",
        body: undefined,
      }),
    );
  });
});

describe("shared timer account isolation", () => {
  it("does not show a previous account's cached timer after switching users", async () => {
    server.timers = [timerFor("paper-1")];

    const view = renderWithClient(<RunningTimerBar />);

    expect(
      await screen.findByRole("region", {
        name: "Paper timer: Literature review",
      }),
    ).toBeInTheDocument();

    server.owner = "auth-user-2";
    server.timers = [];
    view.rerender(<RunningTimerBar />);

    expect(
      screen.queryByRole("region", { name: "Open timers" }),
    ).toBeNull();

    await waitFor(() =>
      expect(
        server.calls.filter(
          (call) => call.path === "/api/v1/me/time-entries/current",
        ),
      ).toHaveLength(2),
    );
  });
});