import { HdrPersonDialog } from "@/components/hdr/hdr-person-dialog";
import { PaperTimerButton } from "./paper-timer-button";
import { TaskTimerButton } from "./task-timer-button";
import { WorkTimeCard } from "./work-time-card";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkTimerControls } from "./work-timer-controls";
import { WorkRunningTimers } from "./work-running-timers";
import {
  workElapsed,
  type WorkTimeEntry,
  type WorkTimer,
  type WorkTimeKind,
} from "@/api/work-time-tracking";
const server = vi.hoisted(() => ({
  timers: [] as WorkTimer[],
  entries: [] as WorkTimeEntry[],
  calls: [] as string[],
  fail: false,
}));
vi.mock("@/auth/auth-provider", () => ({
  useAuth: () => ({ user: { id: "owner" } }),
}));
function timer(kind: WorkTimeKind, targetId = "target"): WorkTimer {
  return {
    id: `${kind}-${targetId}`,
    kind,
    targetId,
    title: `My ${kind}`,
    tenantId: "tenant",
    source: "timer",
    startedAt: "2026-11-01T12:00:00Z",
    endedAt: null,
    note: null,
    isOpen: true,
    isRunning: true,
    durationSeconds: 120,
    runningSeconds: 60,
  };
}
vi.mock("@/api/client", () => ({
  authenticatedJson: async (path: string, init: RequestInit = {}) => {
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    const method = init.method ?? "GET";
    server.calls.push(`${method} ${path}`);
    if (server.fail && method === "POST") throw new Error("Access has changed");
    if (path.endsWith("/current"))
      return { timers: server.timers.map((t) => ({ ...t })) };
    if (path.endsWith("/timer/start")) {
      const created = timer(body.kind, body.targetId);
      server.timers.push(created);
      server.entries.push(created);
      return { timer: created };
    }
    const action = path.match(/\/timer\/([^/]+)\/(pause|resume|stop)$/);
    if (action) {
      const entry = server.entries.find((e) => e.id === action[1])!;
      if (action[2] === "resume") entry.isRunning = true;
      else {
        entry.durationSeconds += entry.runningSeconds;
        entry.runningSeconds = 0;
        entry.isRunning = false;
      }
      if (action[2] === "stop") {
        entry.isOpen = false;
        entry.endedAt = "2026-11-01T12:03:00Z";
        server.timers = server.timers.filter((t) => t.id !== entry.id);
      }
      return { timer: entry };
    }
    const item = path.match(/\/items\/(project|note|hdr)\/([^/]+)$/);
    if (item && method === "GET") {
      const entries = server.entries.filter(
        (e) => e.kind === item[1] && e.targetId === item[2],
      );
      return {
        entries: entries.map((e) => ({ ...e })),
        mySeconds: entries.reduce((s, e) => s + e.durationSeconds, 0),
      };
    }
    if (item && method === "POST") {
      const entry = {
        ...timer(item[1] as WorkTimeKind, item[2]),
        id: "manual",
        source: "manual" as const,
        startedAt: body.startedAt,
        endedAt: body.startedAt,
        isOpen: false,
        isRunning: false,
        durationSeconds: body.minutes * 60,
        runningSeconds: 0,
        note: body.note,
      };
      server.entries.push(entry);
      return entry;
    }
    const id = path.split("/").at(-1);
    if (method === "PATCH") {
      const entry = server.entries.find((e) => e.id === id)!;
      Object.assign(entry, {
        note: body.note,
        startedAt: body.startedAt,
        durationSeconds: body.minutes * 60,
      });
      return entry;
    }
    if (method === "DELETE") {
      server.entries = server.entries.filter((e) => e.id !== id);
      return { deleted: true };
    }
    throw new Error(`Unexpected request: ${method} ${path}`);
  },
}));
function show(kind: WorkTimeKind = "project", withTime = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <WorkRunningTimers />
        <WorkTimerControls kind={kind} targetId="target" title={`My ${kind}`} />
        {withTime ? <WorkTimeCard kind={kind} targetId="target" /> : null}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  server.timers = [];
  server.entries = [];
  server.calls = [];
  server.fail = false;
});
describe("Project, Note and HDR timers", () => {
  it.each<WorkTimeKind>(["project", "note", "hdr"])(
    "starts, pauses, resumes and stops a %s without task/paper requests",
    async (kind) => {
      show(kind);
      const start = screen.getByRole("button", {
        name: `Start timer for My ${kind}`,
      });
      await waitFor(() => expect(start).toBeEnabled());
      fireEvent.click(start);
      const region = await screen.findByRole("region", {
        name: `${kind === "hdr" ? "HDR" : kind === "note" ? "Note" : "Project"} timer: My ${kind}`,
      });
      expect(within(region).getByRole("timer")).toHaveTextContent("03:00");
      fireEvent.click(
        within(region).getByRole("button", {
          name: `Pause timer for My ${kind}`,
        }),
      );
      const resume = await within(region).findByRole("button", {
        name: `Resume timer for My ${kind}`,
      });
      await waitFor(() => expect(resume).toBeEnabled());
      fireEvent.click(resume);
      await within(region).findByRole("button", {
        name: `Pause timer for My ${kind}`,
      });
      const stop = within(region).getByRole("button", {
        name: `Stop timer for My ${kind}`,
      });
      await waitFor(() => expect(stop).toBeEnabled());
      fireEvent.click(stop);
      await waitFor(() =>
        expect(screen.queryByRole("region")).not.toBeInTheDocument(),
      );
      expect(server.entries[0]?.isOpen).toBe(false);
      expect(
        server.calls.every((c) => c.includes("/api/v1/me/work-time-entries/")),
      ).toBe(true);
    },
  );
  it.each<WorkTimeKind>(["project", "note", "hdr"])(
    "uses a single timer button in a %s list row",
    async (kind) => {
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      render(
        <QueryClientProvider client={client}>
          <WorkTimerControls kind={kind} targetId="target" title="Work" />
        </QueryClientProvider>,
      );
      await waitFor(() => expect(server.calls).toHaveLength(1));
      expect(screen.getAllByRole("button")).toHaveLength(1);
      expect(
        screen.getByRole("button", { name: "Start timer for Work" }),
      ).toHaveClass("h-8", "w-8");
      expect(screen.queryByTitle("Time logged")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /View time|Stop timer/ }),
      ).not.toBeInTheDocument();
    },
  );

  it("restores the saved timer after remounting", async () => {
    server.timers = [timer("hdr")];
    server.entries = [...server.timers];
    const first = show("hdr");
    await screen.findByRole("region", { name: "HDR timer: My hdr" });
    first.unmount();
    show("hdr");
    expect(
      await screen.findByRole("region", { name: "HDR timer: My hdr" }),
    ).toBeInTheDocument();
  });
  it("shares a single request across thirty rows and fetches no unopened history", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          {Array.from({ length: 30 }, (_, i) => (
            <WorkTimerControls
              key={i}
              kind="note"
              targetId={`note-${i}`}
              title={`Note ${i}`}
            />
          ))}
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Start timer for Note 29" }),
      ).toBeEnabled(),
    );
    expect(server.calls).toEqual(["GET /api/v1/me/work-time-entries/current"]);
  });
  it("reports an error without starting a timer", async () => {
    server.fail = true;
    show();
    const start = screen.getByRole("button", {
      name: "Start timer for My project",
    });
    await waitFor(() => expect(start).toBeEnabled());
    fireEvent.click(start);
    await waitFor(() =>
      expect(start).toHaveAttribute("title", "Access has changed"),
    );
    expect(start).toHaveAttribute("aria-invalid", "true");
    expect(server.timers).toHaveLength(0);
  });
  it("views, adds, edits and removes only time entries", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    show("note", true);
    const dialog = await screen.findByRole("region", { name: "Time" });
    fireEvent.click(
      await within(dialog).findByRole("button", { name: "Add time" }),
    );
    fireEvent.change(within(dialog).getByLabelText("Minutes"), {
      target: { value: "15" },
    });
    fireEvent.change(within(dialog).getByLabelText(/What did you do/), {
      target: { value: "A meeting" },
    });
    fireEvent.click(
      within(
        within(dialog).getByRole("form", { name: /Add time|Edit time entry/ }),
      ).getByRole("button", { name: /Add time|Save changes/ }),
    );
    await within(dialog).findByText("A meeting");
    fireEvent.click(
      within(dialog).getByRole("button", { name: /^Edit time logged/ }),
    );
    fireEvent.change(within(dialog).getByLabelText("Minutes"), {
      target: { value: "25" },
    });
    fireEvent.click(
      within(
        within(dialog).getByRole("form", { name: /Add time|Edit time entry/ }),
      ).getByRole("button", { name: /Add time|Save changes/ }),
    );
    await waitFor(() => expect(server.entries[0]?.durationSeconds).toBe(1500));
    await waitFor(() =>
      expect(
        within(dialog).queryByLabelText("Minutes"),
      ).not.toBeInTheDocument(),
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: /^Delete time logged/ }),
    );
    await within(dialog).findByText(/No time logged yet/);
    expect(server.entries).toHaveLength(0);
  });
  it("matches the existing detail timer button appearance and labels", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <TaskTimerButton taskId="task" taskTitle="Task" variant="button" />
        <PaperTimerButton
          moduleId="paper"
          paperTitle="Paper"
          variant="button"
        />
        <WorkTimerControls
          kind="project"
          targetId="target"
          title="Project"
          variant="button"
        />
      </QueryClientProvider>,
    );
    const task = screen.getByRole("button", { name: "Start timer for Task" });
    const paper = screen.getByRole("button", { name: "Start timer for Paper" });
    const project = screen.getByRole("button", {
      name: "Start timer for Project",
    });
    expect(project.className).toBe(task.className);
    expect(project.className).toBe(paper.className);
    expect(project).toHaveTextContent("Start timer");
  });

  it("adds HDR time without submitting the student record form", async () => {
    const save = vi.fn(),
      close = vi.fn();
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    render(
      <QueryClientProvider client={client}>
        <HdrPersonDialog
          tenantId="tenant"
          person={{
            id: "target",
            name: "Student",
            type: "PhD",
            category: "Current",
            email: null,
            researchTopic: null,
            projects: [],
            papers: [],
          }}
          onSave={save}
          onClose={close}
        />
      </QueryClientProvider>,
    );
    const panel = await screen.findByRole("region", { name: "Time" });
    fireEvent.click(within(panel).getByRole("button", { name: "Add time" }));
    const form = within(panel).getByRole("form", { name: "Add time" });
    fireEvent.change(within(form).getByLabelText("Minutes"), {
      target: { value: "20" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Add time" }));
    await waitFor(() => expect(server.entries[0]?.durationSeconds).toBe(1200));
    expect(save).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Name/)).toHaveValue("Student");
  });

  it("adds a running stretch exactly once, and never ticks paused entries", () => {
    const entry = timer("project");
    expect(workElapsed(entry, 1000, 11000)).toBe(190);
    expect(workElapsed({ ...entry, isRunning: false }, 1000, 11000)).toBe(180);
  });
});

vi.mock("@/components/hdr/hdr-work-picker", () => ({
  HdrWorkPicker: () => null,
}));
