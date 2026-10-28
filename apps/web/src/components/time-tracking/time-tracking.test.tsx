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

import type { ApiTaskTime, ApiTimer } from "@/api/time-tracking";
import { localDateInput, middayOn } from "@/lib/time-format";

import { LoggedTime } from "./logged-time";
import { RunningTimerBar } from "./running-timer-bar";
import { TaskTimeCard } from "./task-time-card";
import { TaskTimeSummary } from "./task-time-summary";
import { TaskTimerButton } from "./task-timer-button";

const server = vi.hoisted(() => ({
  timer: null as ApiTimer | null,
  taskTime: undefined as ApiTaskTime | undefined,
  calls: [] as Array<{ method: string; path: string; body?: unknown }>,
}));

function timerFor(taskId: string, overrides: Partial<ApiTimer> = {}): ApiTimer {
  return {
    id: "entry-open",
    taskId,
    tenantId: "tenant-1",
    taskTitle: taskId === "task-1" ? "Literature review" : "Other task",
    taskDisplayId: "TSK-0001",
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

    if (path === "/api/v1/me/time-entries/current") return { timer: server.timer };
    if (path === "/api/v1/me/time-entries/timer/start") {
      server.timer = timerFor(body.taskId);
      return { timer: server.timer };
    }
    if (path === "/api/v1/me/time-entries/timer/pause" && server.timer) {
      server.timer = {
        ...server.timer,
        isRunning: false,
        durationSeconds: server.timer.durationSeconds + server.timer.runningSeconds,
        runningSeconds: 0,
      };
      return { timer: server.timer };
    }
    if (path === "/api/v1/me/time-entries/timer/resume" && server.timer) {
      server.timer = { ...server.timer, isRunning: true };
      return { timer: server.timer };
    }
    if (path === "/api/v1/me/time-entries/timer/stop") {
      server.timer = null;
      return { stopped: null };
    }
    if (path.endsWith("/time-entries") && method === "GET") return server.taskTime;
    return { id: "entry-new", taskId: "task-1" };
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
  server.taskTime = undefined;
  server.calls = [];
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("TaskTimerButton", () => {
  it("starts, pauses and resumes the timer for its task", async () => {
    renderWithClient(
      <TaskTimerButton taskId="task-1" taskTitle="Literature review" />,
    );

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Start timer for Literature review",
      }),
    );
    await waitFor(() =>
      expect(server.calls).toContainEqual({
        method: "POST",
        path: "/api/v1/me/time-entries/timer/start",
        body: { taskId: "task-1" },
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

  it("offers Start on a task when another task is being timed", async () => {
    server.timer = timerFor("task-2");
    renderWithClient(
      <TaskTimerButton taskId="task-1" taskTitle="Literature review" />,
    );

    expect(
      await screen.findByRole("button", {
        name: "Start timer for Literature review",
      }),
    ).toBeInTheDocument();
  });
});

describe("RunningTimerBar", () => {
  it("stays hidden without a timer", async () => {
    renderWithClient(<RunningTimerBar />);
    await waitFor(() => expect(server.calls.length).toBe(1));
    expect(screen.queryByRole("region", { name: "Task timer" })).toBeNull();
  });

  it("counts up while running, and can pause and stop", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    server.timer = timerFor("task-1", {
      durationSeconds: 600,
      runningSeconds: 125,
      elapsedSeconds: 725,
    });
    renderWithClient(<RunningTimerBar />);

    const bar = await screen.findByRole("region", { name: "Task timer" });
    expect(within(bar).getByText("Working on")).toBeInTheDocument();
    expect(
      within(bar).getByRole("link", { name: "Literature review" }),
    ).toHaveAttribute("href", "/tasks/task-1");
    expect(within(bar).getByRole("timer")).toHaveTextContent("12:05");

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(within(bar).getByRole("timer")).toHaveTextContent("12:08");

    fireEvent.click(within(bar).getByRole("button", { name: "Pause" }));
    expect(await within(bar).findByText("Paused")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(within(bar).getByRole("timer")).toHaveTextContent("12:05");

    fireEvent.click(within(bar).getByRole("button", { name: "Stop" }));
    await waitFor(() =>
      expect(screen.queryByRole("region", { name: "Task timer" })).toBeNull(),
    );
  });
});

describe("TaskTimeCard", () => {
  const finished = {
    id: "entry-1",
    taskId: "task-1",
    source: "timer" as const,
    startedAt: "2026-10-27T23:00:00.000Z",
    endedAt: "2026-10-28T00:00:00.000Z",
    note: "Read three papers",
    isOpen: false,
    isRunning: false,
    durationSeconds: 3600,
    runningSeconds: 0,
  };

  it("shows logged time against the estimate, with everyone's total", async () => {
    server.taskTime = {
      taskId: "task-1",
      estimatedHours: "6.00",
      entries: [finished],
      mySeconds: 3600,
      totalSeconds: 5400,
    };
    renderWithClient(
      <TaskTimeCard task={{ id: "task-1", estimatedHours: "6.00" }} />,
    );

    expect(await screen.findByText("Read three papers")).toBeInTheDocument();
    expect(screen.getByText(/logged of/)).toHaveTextContent(
      "1h 30m logged of 6h estimated",
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "25",
    );
    expect(screen.getByText("You: 1h · Everyone: 1h 30m")).toBeInTheDocument();
  });

  it("warns when the time logged goes over the estimate", async () => {
    server.taskTime = {
      taskId: "task-1",
      estimatedHours: "1.00",
      entries: [],
      mySeconds: 5400,
      totalSeconds: 5400,
    };
    renderWithClient(
      <TaskTimeCard task={{ id: "task-1", estimatedHours: "1.00" }} />,
    );

    expect(await screen.findByText(/30m over/)).toBeInTheDocument();
  });

  it("adds time by hand", async () => {
    server.taskTime = {
      taskId: "task-1",
      estimatedHours: null,
      entries: [],
      mySeconds: 0,
      totalSeconds: 0,
    };
    renderWithClient(
      <TaskTimeCard task={{ id: "task-1", estimatedHours: null }} />,
    );

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
        path: "/api/v1/me/tasks/task-1/time-entries",
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
    server.taskTime = {
      taskId: "task-1",
      estimatedHours: null,
      entries: [finished],
      mySeconds: 3600,
      totalSeconds: 3600,
    };
    renderWithClient(
      <TaskTimeCard task={{ id: "task-1", estimatedHours: null }} />,
    );

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
        path: "/api/v1/me/time-entries/entry-1",
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
        path: "/api/v1/me/time-entries/entry-1",
        body: undefined,
      }),
    );
  });
});

describe("summaries", () => {
  it("adds up a paper's or project's tasks, counting a running timer", async () => {
    server.timer = timerFor("task-1", { runningSeconds: 1800 });
    renderWithClient(
      <TaskTimeSummary
        label="Time on this paper"
        tasks={[
          { id: "task-1", estimatedHours: "2.00", loggedSeconds: 1800 },
          { id: "task-2", estimatedHours: "1.50", loggedSeconds: 0 },
          { id: "task-3", estimatedHours: null, loggedSeconds: 600 },
        ]}
      />,
    );

    // 30m + 10m logged, plus 30m on the timer running now.
    await waitFor(() =>
      expect(screen.getByText(/logged of/)).toHaveTextContent(
        "1h 10m logged of 3h 30m estimated",
      ),
    );
    expect(
      screen.getByRole("progressbar", { name: "Time on this paper" }),
    ).toBeInTheDocument();
  });

  it("shows nothing when no task has an estimate or time", () => {
    const { container } = renderWithClient(
      <TaskTimeSummary
        label="Time on this paper"
        tasks={[{ id: "task-1", estimatedHours: null, loggedSeconds: 0 }]}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a task's logged time", async () => {
    renderWithClient(<LoggedTime task={{ id: "task-1", loggedSeconds: 4500 }} />);
    expect(await screen.findByText("1h 15m")).toBeInTheDocument();
  });
});
