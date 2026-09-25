import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import MindMapPage from "@/pages/mind-map";

const fixtures = vi.hoisted(() => ({
  projects: [{ id: "project-1", title: "Climate study", status: "Active" }, { id: "project-2", title: "Health study", status: "Review" }],
  modules: [{ id: "module-1", projectId: "project-1", title: "Fieldwork" }],
  tasks: [{ id: "task-1", projectId: "project-1", moduleId: "module-1", title: "Calibrate sensors" }],
  notes: [{ id: "note-1", projectId: "project-1", moduleId: "module-1", title: "Site observation" }],
}));

vi.mock("@/api/hooks", () => ({
  useCurrentWorkspace: () => ({ data: { id: "workspace-1", name: "Research lab" }, isPending: false }),
  useProjects: () => ({ data: { data: fixtures.projects, meta: { page: 1, pageSize: 20, totalItems: fixtures.projects.length, totalPages: 1 } }, isPending: false, isError: false, refetch: vi.fn() }),
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
    refetch: vi.fn(),
  }),
}));

describe("MindMapPage", () => {
  it("shows linked projects, modules, tasks, and notes", () => {
    render(<MemoryRouter><MindMapPage /></MemoryRouter>);

    expect(screen.getByRole("link", { name: /Climate study/ })).toHaveAttribute("href", "/projects/project-1");
    expect(screen.getByRole("link", { name: /Fieldwork/ })).toHaveAttribute("href", "/modules/module-1");
    expect(screen.getByRole("link", { name: /Calibrate sensors/ })).toHaveAttribute("href", "/tasks/task-1");
    expect(screen.getByRole("link", { name: /Site observation/ })).toHaveAttribute("href", "/daily-notes/note-1");
  });

  it("filters the map by project and search text", () => {
    render(<MemoryRouter><MindMapPage /></MemoryRouter>);

    fireEvent.click(screen.getByRole("combobox", { name: "Filter mind map by project" }));
    fireEvent.click(screen.getByRole("option", { name: "Health study" }));
    expect(screen.queryByRole("link", { name: /Climate study/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Health study/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("combobox", { name: "Filter mind map by project" }));
    fireEvent.click(screen.getByRole("option", { name: "All projects" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Search the mind map" }), { target: { value: "sensor" } });
    expect(screen.getByRole("link", { name: /Climate study/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Health study/ })).not.toBeInTheDocument();
  });

  it("offers a connected bubble view with clickable records", () => {
    render(<MemoryRouter><MindMapPage /></MemoryRouter>);

    fireEvent.click(screen.getByRole("button", { name: /Bubbles/ }));

    expect(screen.getByRole("group", { name: "Bubble relationship map" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Project: Climate study" })).toHaveAttribute("href", "/projects/project-1");
    expect(screen.getByRole("link", { name: "Paper: Fieldwork" })).toHaveAttribute("href", "/modules/module-1");
    expect(screen.getByRole("link", { name: "Task: Calibrate sensors" })).toHaveAttribute("href", "/tasks/task-1");
    expect(screen.getByRole("link", { name: "Note: Site observation" })).toHaveAttribute("href", "/daily-notes/note-1");
  });

  it("labels the legend with a Key: prefix and includes the workspace icon", () => {
    render(<MemoryRouter><MindMapPage /></MemoryRouter>);

    const legend = screen.getByRole("group", { name: "Mind map legend" });
    expect(legend).toHaveTextContent("Key:");
    expect(legend).toHaveTextContent("Workspace");
    expect(legend).toHaveTextContent("Project");
    expect(legend).toHaveTextContent("Paper");
    expect(legend).toHaveTextContent("Task");
    expect(legend).toHaveTextContent("Note");
  });

  it("expands and collapses every panel in the tree view at once", () => {
    render(<MemoryRouter><MindMapPage /></MemoryRouter>);

    expect(screen.getByText("Calibrate sensors")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
    expect(screen.queryByText("Calibrate sensors")).not.toBeInTheDocument();
    expect(screen.queryByText("Fieldwork")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Climate study/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
    expect(screen.getByText("Calibrate sensors")).toBeInTheDocument();
  });

  it("collapses and expands bubble nodes to hide or reveal their children", () => {
    render(<MemoryRouter><MindMapPage /></MemoryRouter>);

    fireEvent.click(screen.getByRole("button", { name: /Bubbles/ }));
    expect(screen.getByRole("link", { name: "Paper: Fieldwork" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Collapse project Climate study" }));
    expect(screen.getByRole("link", { name: "Project: Climate study" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Paper: Fieldwork" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Task: Calibrate sensors" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Note: Site observation" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Expand project Climate study" }));
    expect(screen.getByRole("link", { name: "Paper: Fieldwork" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Task: Calibrate sensors" })).toBeInTheDocument();
  });

  it("expands and collapses every node in the bubble view at once", () => {
    render(<MemoryRouter><MindMapPage /></MemoryRouter>);

    fireEvent.click(screen.getByRole("button", { name: /Bubbles/ }));
    expect(screen.getByRole("link", { name: "Paper: Fieldwork" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
    expect(screen.getByRole("link", { name: "Project: Climate study" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Paper: Fieldwork" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Task: Calibrate sensors" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
    expect(screen.getByRole("link", { name: "Paper: Fieldwork" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Task: Calibrate sensors" })).toBeInTheDocument();
  });
});
