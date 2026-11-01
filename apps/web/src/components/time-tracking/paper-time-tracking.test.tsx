import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiPaperTime, ApiPaperTimer } from "@/api/paper-time-tracking";
import { localDateInput, middayOn } from "@/lib/time-format";

import { RunningTimerBar } from "./running-timer-bar";
import type { ApiTimer } from "@/api/time-tracking";
import { PaperRunningTimerBar } from "./paper-running-timer-bar";
import { PaperTimeCard } from "./paper-time-card";
import { PaperTimerButton } from "./paper-timer-button";

const server = vi.hoisted(() => ({
  timer: null as ApiPaperTimer | null,
  taskTimer: null as ApiTimer | null,
  owner: "auth-user-1",
  paperTime: undefined as ApiPaperTime | undefined,
  calls: [] as Array<{ method: string; path: string; body?: unknown }>,
}));

vi.mock("@/auth/auth-provider", () => ({
  useAuth: () => ({ user: { id: server.owner } }),
}));

function timerFor(
  paperId: string,
  overrides: Partial<ApiPaperTimer> = {},
): ApiPaperTimer {
  return {
    id: "entry-open",
    paperId,
    tenantId: "tenant-1",
    paperTitle: paperId === "paper-1" ? "Literature review" : "Other paper",
    paperDisplayId: "TSK-0001",
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
  authenticatedJson: vi.fn(async (path: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    server.calls.push({ method, path, body });

    if (path === "/api/v1/me/time-entries/current")
      return { timer: server.taskTimer };
    if (path === "/api/v1/me/paper-time-entries/current")
      return { timer: server.timer };
    if (path === "/api/v1/me/paper-time-entries/timer/start") {
      server.timer = timerFor(body.paperId);
      return { timer: server.timer };
    }
    if (path === "/api/v1/me/paper-time-entries/timer/pause" && server.timer) {
      server.timer = {
        ...server.timer,
        isRunning: false,
        durationSeconds:
          server.timer.durationSeconds + server.timer.runningSeconds,
        runningSeconds: 0,
      };
      return { timer: server.timer };
    }
    if (path === "/api/v1/me/paper-time-entries/timer/resume" && server.timer) {
      server.timer = { ...server.timer, isRunning: true };
      return { timer: server.timer };
    }
    if (path === "/api/v1/me/paper-time-entries/timer/stop") {
      server.timer = null;
      return { stopped: null };
    }
    if (path.endsWith("/time-entries") && method === "GET")
      return server.paperTime;
    return { id: "entry-new", paperId: "paper-1" };
  }),
}));

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
  server.timer = null;
  server.taskTimer = null;
  server.paperTime = undefined;
  server.owner = "auth-user-1";
  server.calls = [];
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("PaperTimerButton", () => {
  it("starts, pauses and resumes the timer for its paper", async () => {
    renderWithClient(
      <PaperTimerButton paperId="paper-1" paperTitle="Literature review" />,
    );

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Start timer for Literature review",
      }),
    );
    await waitFor(() =>
      expect(server.calls).toContainEqual({
        method: "POST",
        path: "/api/v1/me/paper-time-entries/timer/start",
        body: { paperId: "paper-1" },
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
    expect(
      await screen.findByRole("button", {
        name: "Pause timer for Literature review",
      }),
    ).toBeInTheDocument();
  });

  it("offers Start on a paper when another paper is being timed", async () => {
    server.timer = timerFor("paper-2");
    renderWithClient(
      <PaperTimerButton paperId="paper-1" paperTitle="Literature review" />,
    );

    expect(
      await screen.findByRole("button", {
        name: "Start timer for Literature review",
      }),
    ).toBeInTheDocument();
  });
});

describe("PaperRunningTimerBar", () => {
  it("stays hidden without a timer", async () => {
    renderWithClient(<PaperRunningTimerBar />);
    await waitFor(() => expect(server.calls.length).toBe(1));
    expect(screen.queryByRole("region", { name: "Paper timer" })).toBeNull();
  });

  it("counts up while running, and can pause and stop", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    server.timer = timerFor("paper-1", {
      durationSeconds: 600,
      runningSeconds: 125,
      elapsedSeconds: 725,
    });
    renderWithClient(<PaperRunningTimerBar />);

    const bar = await screen.findByRole("region", { name: "Paper timer" });
    expect(within(bar).getByText("Working on paper")).toBeInTheDocument();
    expect(
      within(bar).getByRole("link", { name: "Literature review" }),
    ).toHaveAttribute("href", "/modules/paper-1");
    expect(within(bar).getByRole("timer")).toHaveTextContent("12:05");

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(within(bar).getByRole("timer")).toHaveTextContent("12:08");

    fireEvent.click(within(bar).getByRole("button", { name: "Pause" }));
    expect(await within(bar).findByText("Paper paused")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(within(bar).getByRole("timer")).toHaveTextContent("12:05");

    fireEvent.click(within(bar).getByRole("button", { name: "Stop" }));
    await waitFor(() =>
      expect(screen.queryByRole("region", { name: "Paper timer" })).toBeNull(),
    );
  });
});

describe("PaperTimeCard", () => {
  const finished = {
    id: "entry-1",
    paperId: "paper-1",
    source: "timer" as const,
    startedAt: "2026-10-27T23:00:00.000Z",
    endedAt: "2026-10-28T00:00:00.000Z",
    note: "Read three papers",
    isOpen: false,
    isRunning: false,
    durationSeconds: 3600,
    runningSeconds: 0,
  };

  it("shows direct paper time, with everyone's total", async () => {
    server.paperTime = {
      paperId: "paper-1",
      entries: [finished],
      mySeconds: 3600,
      totalSeconds: 5400,
    };
    renderWithClient(<PaperTimeCard paper={{ id: "paper-1" }} />);

    expect(await screen.findByText("Read three papers")).toBeInTheDocument();
    expect(screen.getByText(/logged directly/)).toHaveTextContent(
      "1h 30m logged directly on this paper",
    );
  });

  it("adds time by hand", async () => {
    server.paperTime = {
      paperId: "paper-1",
      entries: [],
      mySeconds: 0,
      totalSeconds: 0,
    };
    renderWithClient(<PaperTimeCard paper={{ id: "paper-1" }} />);

    expect(await screen.findByText(/No time logged yet/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add time" }));
    const form = screen.getByRole("form", { name: "Add time" });

    fireEvent.click(within(form).getByRole("button", { name: "Add time" }));
    expect(await within(form).findByRole("alert")).toHaveTextContent(
      "Enter between 1 minute and 24 hours.",
    );

    fireEvent.change(within(form).getByLabelText("Hours"), {
      target: { value: "1" },
    });
    fireEvent.change(within(form).getByLabelText("Minutes"), {
      target: { value: "30" },
    });
    fireEvent.change(within(form).getByLabelText(/What did you do/), {
      target: { value: "  Coded interviews " },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Add time" }));

    await waitFor(() =>
      expect(server.calls).toContainEqual({
        method: "POST",
        path: "/api/v1/me/modules/paper-1/time-entries",
        body: {
          startedAt: middayOn(localDateInput(new Date())).toISOString(),
          minutes: 90,
          note: "Coded interviews",
        },
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("form", { name: "Add time" })).toBeNull(),
    );
  });

  it("corrects and deletes an entry", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    server.paperTime = {
      paperId: "paper-1",
      entries: [finished],
      mySeconds: 3600,
      totalSeconds: 3600,
    };
    renderWithClient(<PaperTimeCard paper={{ id: "paper-1" }} />);

    fireEvent.click(
      await screen.findByRole("button", { name: /^Edit time logged/ }),
    );
    const form = screen.getByRole("form", { name: "Edit time entry" });
    expect(within(form).getByLabelText("Hours")).toHaveValue(1);
    fireEvent.change(within(form).getByLabelText("Minutes"), {
      target: { value: "15" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(server.calls).toContainEqual({
        method: "PATCH",
        path: "/api/v1/me/paper-time-entries/entry-1",
        body: {
          startedAt: finished.startedAt,
          minutes: 75,
          note: "Read three papers",
        },
      }),
    );

    fireEvent.click(
      await screen.findByRole("button", { name: /^Delete time logged/ }),
    );
    await waitFor(() =>
      expect(server.calls).toContainEqual({
        method: "DELETE",
        path: "/api/v1/me/paper-time-entries/entry-1",
        body: undefined,
      }),
    );
  });
});

describe("paper and task isolation", () => {
  it("stops a paper timer without stopping or invalidating the task timer", async () => {
    server.timer = timerFor("paper-1");
    server.taskTimer = {
      id: "task-entry",
      taskId: "task-existing",
      tenantId: "tenant-1",
      taskTitle: "Existing task",
      taskDisplayId: "TSK-1",
      startedAt: new Date().toISOString(),
      isOpen: true,
      isRunning: true,
      durationSeconds: 600,
      runningSeconds: 0,
      elapsedSeconds: 600,
    };
    renderWithClient(
      <>
        <RunningTimerBar />
        <PaperRunningTimerBar />
      </>,
    );
    const paperBar = await screen.findByRole("region", { name: "Paper timer" });
    const taskBar = await screen.findByRole("region", { name: "Task timer" });
    fireEvent.click(within(paperBar).getByRole("button", { name: "Stop" }));
    await waitFor(() =>
      expect(screen.queryByRole("region", { name: "Paper timer" })).toBeNull(),
    );
    expect(taskBar).toHaveTextContent("Existing task");
    expect(taskBar).toHaveTextContent("10:00");
    expect(server.taskTimer.isRunning).toBe(true);
    expect(
      server.calls.filter(
        (call) =>
          call.path.startsWith("/api/v1/me/time-entries") &&
          call.method !== "GET",
      ),
    ).toEqual([]);
    expect(
      server.calls.filter(
        (call) => call.path === "/api/v1/me/time-entries/current",
      ),
    ).toHaveLength(1);
  });
});

it("does not show a previous account's cached paper timer after switching users", async () => {
  server.timer = timerFor("paper-1");
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <PaperRunningTimerBar />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(
    await screen.findByRole("region", { name: "Paper timer" }),
  ).toHaveTextContent("Literature review");
  server.owner = "auth-user-2";
  server.timer = null;
  view.rerender(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <PaperRunningTimerBar />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(screen.queryByRole("region", { name: "Paper timer" })).toBeNull();
  await waitFor(() =>
    expect(
      server.calls.filter(
        (call) => call.path === "/api/v1/me/paper-time-entries/current",
      ),
    ).toHaveLength(2),
  );
});
