import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PriorityTasksTable } from "@/components/dashboard/priority-tasks-table";

interface FixtureTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  estimatedHours: string | null;
  projectId: string;
  moduleId: string | null;
}

const fixtures = vi.hoisted(() => ({
  projects: [
    { id: "project-zeta", title: "Zeta Project" },
    { id: "project-alpha", title: "Alpha Project" },
    { id: "project-beta", title: "Beta Project" },
    { id: "project-omega", title: "Omega Project" },
  ],
  tasks: [
    {
      id: "task-critical",
      estimatedHours: "3",
      title: "Middle task",
      status: "To do",
      priority: "Critical",
      dueDate: "2026-10-10",
      projectId: "project-zeta",
      moduleId: null,
    },
    {
      id: "task-high",
      estimatedHours: "1.5",
      title: "Zulu task",
      status: "Underway",
      priority: "High",
      dueDate: "2026-10-02",
      projectId: "project-alpha",
      moduleId: null,
    },
    {
      id: "task-medium",
      estimatedHours: null,
      title: "Alpha task",
      status: "Waiting",
      priority: "Medium",
      dueDate: null,
      projectId: "project-beta",
      moduleId: null,
    },
    {
      id: "task-low",
      estimatedHours: "10",
      title: "Bravo task",
      status: "To do",
      priority: "Low",
      dueDate: "2026-10-05",
      projectId: "project-omega",
      moduleId: null,
    },
  ] as FixtureTask[],
}));

vi.mock("@/api/time-tracking", () => import("@/test/time-tracking-mock"));
vi.mock("@/api/hooks", () => ({
  useCurrentWorkspace: () => ({ data: { id: "workspace-1" } }),
  useMe: () => ({ data: { id: "user-1" } }),
  useTasks: (
    _tenantId?: string,
    _projectId?: string,
    _page?: number,
    _enabled?: boolean,
    options?: { pageSize?: number | "all" },
  ) => ({
    data: {
      data: options?.pageSize === "all"
        ? fixtures.tasks
        : fixtures.tasks.slice(0, options?.pageSize ?? 20),
    },
  }),
  useProjects: () => ({ data: { data: fixtures.projects } }),
  useModules: () => ({ data: { data: [] } }),
}));

describe("PriorityTasksTable", () => {
  beforeEach(() => {
    window.localStorage?.clear();
    window.sessionStorage.clear();
  });

  it.each(["2026-10-05", null])(
    "orders tasks sharing due date %s by priority",
    (dueDate) => {
      const originalTasks = fixtures.tasks;

      fixtures.tasks = originalTasks
        .map((task) => ({ ...task, dueDate }))
        .reverse();

      try {
        render(
          <MemoryRouter>
            <PriorityTasksTable />
          </MemoryRouter>,
        );

        const taskNames = screen
          .getAllByRole("link")
          .filter((link) => link.getAttribute("href")?.startsWith("/tasks/"))
          .map((link) => link.textContent);

        expect(taskNames).toEqual([
          "Middle task",
          "Zulu task",
          "Alpha task",
          "Bravo task",
        ]);
      } finally {
        fixtures.tasks = originalTasks;
      }
    },
  );

  it("finds selected priorities beyond the first task page", async () => {
    const originalTasks = fixtures.tasks;

    fixtures.tasks = [
      ...Array.from({ length: 20 }, (_, index) => ({
        id: `low-task-${index}`,
        title: `Low priority task ${index}`,
        status: "To do",
        priority: "Low",
        dueDate: null,
        estimatedHours: null,
        projectId: "project-zeta",
        moduleId: null,
      })),
      ...originalTasks.filter(
        (task) => task.priority === "Critical" || task.priority === "High",
      ),
    ];

    try {
      render(
        <MemoryRouter>
          <PriorityTasksTable />
        </MemoryRouter>,
      );

      fireEvent.keyDown(
        screen.getByRole("button", { name: "Filter by priorities" }),
        { key: "Enter" },
      );

      fireEvent.click(
        screen.getByRole("menuitemcheckbox", { name: "Critical" }),
      );
      fireEvent.click(
        screen.getByRole("menuitemcheckbox", { name: "High" }),
      );

      fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });

      await waitFor(() => {
        expect(screen.queryByRole("menu")).not.toBeInTheDocument();
      });

      expect(
        screen.getByRole("link", { name: "Middle task" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Zulu task" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: /^Low priority task/ }),
      ).not.toBeInTheDocument();
    } finally {
      fixtures.tasks = originalTasks;
    }
  });

  it("sorts Task, Project, Due, and Priority and reverses the active column", () => {
    render(
      <MemoryRouter>
        <PriorityTasksTable />
      </MemoryRouter>,
    );

    const taskNames = () =>
      screen
        .getAllByRole("link")
        .filter((link) => link.getAttribute("href")?.startsWith("/tasks/"))
        .map((link) => link.textContent);

    expect(taskNames()).toEqual([
      "Zulu task",
      "Bravo task",
      "Middle task",
      "Alpha task",
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Sort by Task" }));
    expect(taskNames()).toEqual([
      "Alpha task",
      "Bravo task",
      "Middle task",
      "Zulu task",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Sort by Task" }));
    expect(taskNames()).toEqual([
      "Zulu task",
      "Middle task",
      "Bravo task",
      "Alpha task",
    ]);

    fireEvent.click(
      screen.getByRole("button", { name: "Sort by Project/paper" }),
    );
    expect(taskNames()).toEqual([
      "Zulu task",
      "Alpha task",
      "Bravo task",
      "Middle task",
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Sort by Due" }));
    expect(taskNames()).toEqual([
      "Zulu task",
      "Bravo task",
      "Middle task",
      "Alpha task",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Sort by Due" }));
    expect(taskNames()).toEqual([
      "Middle task",
      "Bravo task",
      "Zulu task",
      "Alpha task",
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Sort by Priority" }));
    expect(taskNames()).toEqual([
      "Middle task",
      "Zulu task",
      "Alpha task",
      "Bravo task",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Sort by Priority" }));
    expect(taskNames()).toEqual([
      "Bravo task",
      "Alpha task",
      "Zulu task",
      "Middle task",
    ]);
  });

  it("filters by several priorities at once, like the pipeline filters", async () => {
    render(
      <MemoryRouter>
        <PriorityTasksTable />
      </MemoryRouter>,
    );
    const taskNames = () =>
      screen
        .getAllByRole("link")
        .filter((link) => link.getAttribute("href")?.startsWith("/tasks/"))
        .map((link) => link.textContent)
        .sort();
    const filter = screen.getByRole("button", { name: "Filter by priorities" });
    expect(filter).toHaveTextContent("All priorities");

    fireEvent.keyDown(filter, { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Critical" }));
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "High" }));
    // The menu stays open while ticking.
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());

    expect(filter).toHaveTextContent("2 priorities");
    expect(taskNames()).toEqual(["Middle task", "Zulu task"]);

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(filter).toHaveTextContent("All priorities");
    expect(taskNames()).toEqual([
      "Alpha task",
      "Bravo task",
      "Middle task",
      "Zulu task",
    ]);
  });

  it("restores descending task sorting after leaving and returning", () => {
    const first = render(
      <MemoryRouter>
        <PriorityTasksTable />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sort by Task" }));
    fireEvent.click(screen.getByRole("button", { name: "Sort by Task" }));

    first.unmount();

    render(
      <MemoryRouter>
        <PriorityTasksTable />
      </MemoryRouter>,
    );

    const taskNames = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href")?.startsWith("/tasks/"))
      .map((link) => link.textContent);

    expect(taskNames).toEqual([
      "Zulu task",
      "Middle task",
      "Bravo task",
      "Alpha task",
    ]);
  });

  it("shows estimated then logged hours before Due and sorts by them, blanks last", () => {
    render(
      <MemoryRouter>
        <PriorityTasksTable />
      </MemoryRouter>,
    );

    const headers = screen
      .getAllByRole("columnheader")
      .map((header) => header.textContent);
    expect(headers.indexOf("Est. hours")).toBe(headers.indexOf("Logged") - 1);
    expect(headers.indexOf("Logged")).toBe(headers.indexOf("Due") - 1);
    expect(screen.getByText("1h 30m")).toBeInTheDocument();

    const taskNames = () =>
      screen
        .getAllByRole("link")
        .filter((link) => link.getAttribute("href")?.startsWith("/tasks/"))
        .map((link) => link.textContent);

    fireEvent.click(screen.getByRole("button", { name: "Sort by Est. hours" }));
    expect(taskNames()).toEqual([
      "Zulu task",
      "Middle task",
      "Bravo task",
      "Alpha task",
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Sort by Est. hours" }));
    expect(taskNames()).toEqual([
      "Bravo task",
      "Middle task",
      "Zulu task",
      "Alpha task",
    ]);
  });
});
