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
function show(kind: WorkTimeKind = "project") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <WorkRunningTimers />
        <WorkTimerControls kind={kind} targetId="target" title={`My ${kind}`} />
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
      const region = await screen.findByRole("region");
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
  it("restores the saved timer after remounting", async () => {
    server.timers = [timer("hdr")];
    server.entries = [...server.timers];
    const first = show("hdr");
    await screen.findByRole("region");
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
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Access has changed",
    );
    expect(server.timers).toHaveLength(0);
  });
  it("views, adds, edits and removes only time entries", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    show("note");
    fireEvent.click(
      screen.getByRole("button", { name: "View time for My note" }),
    );
    const dialog = await screen.findByRole("dialog");
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
      within(dialog).getByRole("button", { name: /Add time|Save changes/ }),
    );
    await within(dialog).findByText("A meeting");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Edit time entry" }),
    );
    fireEvent.change(within(dialog).getByLabelText("Minutes"), {
      target: { value: "25" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: /Add time|Save changes/ }),
    );
    await waitFor(() => expect(server.entries[0]?.durationSeconds).toBe(1500));
    await waitFor(() =>
      expect(
        within(dialog).queryByLabelText("Minutes"),
      ).not.toBeInTheDocument(),
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Delete time entry" }),
    );
    await within(dialog).findByText(/No time logged yet/);
    expect(server.entries).toHaveLength(0);
  });
  it("adds a running stretch exactly once, and never ticks paused entries", () => {
    const entry = timer("project");
    expect(workElapsed(entry, 1000, 11000)).toBe(190);
    expect(workElapsed({ ...entry, isRunning: false }, 1000, 11000)).toBe(180);
  });
});
