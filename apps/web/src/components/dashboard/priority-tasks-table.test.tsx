import { fireEvent, render, screen } from "@testing-library/react";
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

vi.mock("@/api/hooks", () => ({
  useCurrentWorkspace: () => ({ data: { id: "workspace-1" } }),
  useMe: () => ({ data: { id: "user-1" } }),
  useTasks: () => ({ data: { data: fixtures.tasks } }),
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

  it("shows estimated hours before Due and sorts by them, blanks last", () => {
    render(
      <MemoryRouter>
        <PriorityTasksTable />
      </MemoryRouter>,
    );

    const headers = screen
      .getAllByRole("columnheader")
      .map((header) => header.textContent);
    expect(headers.indexOf("Est. hours")).toBe(headers.indexOf("Due") - 1);
    expect(screen.getByText("1.5h")).toBeInTheDocument();

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
