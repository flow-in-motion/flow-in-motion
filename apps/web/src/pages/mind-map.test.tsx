import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MindMapPage from "@/pages/mind-map";

// jsdom has no PointerEvent, so pointer events would arrive without a
// pointer id, button or position. A MouseEvent with a pointerId is enough
// for dragging bubbles. Kept to this file so other tests are unaffected.
if (typeof window.PointerEvent === "undefined") {
  class TestPointerEvent extends MouseEvent {
    readonly pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
    }
  }
  window.PointerEvent = TestPointerEvent as unknown as typeof PointerEvent;
}

const BASE_MODULES = [
  {
    id: "module-1",
    projectId: "project-1",
    title: "Fieldwork",
    status: "Active",
  },
];

const fixtures = vi.hoisted(() => ({
  projects: [
    { id: "project-1", title: "Climate study", status: "Active" },
    { id: "project-2", title: "Health study", status: "Review" },
  ],
  generalProject: null as null | {
    id: string;
    title: string;
    status: string;
  },
  modules: [] as Array<{
    id: string;
    projectId: string | null;
    title: string;
    status?: string;
  }>,
  listCalls: {} as Record<string, unknown[][]>,
  tasks: [
    {
      id: "task-1",
      projectId: "project-1",
      moduleId: "module-1",
      title: "Calibrate sensors",
      status: "Blocked",
    },
  ],
  notes: [
    {
      id: "note-1",
      projectId: "project-1",
      moduleId: "module-1",
      title: "Site observation",
    },
  ],
}));

const BASE_TASKS = [...fixtures.tasks];

vi.mock("@/api/hooks", () => ({
  useCurrentWorkspace: () => ({
    data: { id: "workspace-1", name: "Research lab" },
    isPending: false,
  }),
  useProjects: (...args: unknown[]) => {
    (fixtures.listCalls.projects ??= []).push(args);
    return {
      data: {
        data: fixtures.projects,
        generalProject: fixtures.generalProject,
        meta: {
          page: 1,
          pageSize: 20,
          totalItems: fixtures.projects.length,
          totalPages: 1,
        },
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    };
  },
  useMe: () => ({ data: { id: "user-owner" } }),
  useModules: (...args: unknown[]) => {
    (fixtures.listCalls.modules ??= []).push(args);
    return {
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
    };
  },
  useTasks: (...args: unknown[]) => {
    (fixtures.listCalls.tasks ??= []).push(args);
    return {
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
    };
  },
  useNotes: (...args: unknown[]) => {
    (fixtures.listCalls.notes ??= []).push(args);
    return {
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
    };
  },
}));

beforeEach(() => {
  window.sessionStorage.clear();
  fixtures.generalProject = null;
  fixtures.modules = [...BASE_MODULES];
  fixtures.tasks = [...BASE_TASKS];
  fixtures.listCalls = {};
});

function renderWithProjectPage() {
  render(
    <MemoryRouter initialEntries={["/mind-map"]}>
      <Routes>
        <Route path="/mind-map" element={<MindMapPage />} />
        <Route path="/projects/:projectId" element={<p>Project page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function climateBubble() {
  return screen.getByRole("link", { name: "Project: Climate study, Active" });
}

/** The bubble's centre on the map, read from its translate(x y). */
function bubbleCentre(link: HTMLElement) {
  const transform = link.closest("g[transform]")?.getAttribute("transform");
  const [x, y] = /translate\(([-\d.]+) ([-\d.]+)\)/
    .exec(transform ?? "")!
    .slice(1)
    .map(Number);
  return { x, y };
}

function dragBy(target: HTMLElement, dx: number, dy: number) {
  fireEvent.pointerDown(target, {
    pointerId: 1,
    button: 0,
    clientX: 100,
    clientY: 100,
  });
  fireEvent.pointerMove(target, {
    pointerId: 1,
    clientX: 100 + dx,
    clientY: 100 + dy,
  });
  fireEvent.pointerUp(target, {
    pointerId: 1,
    clientX: 100 + dx,
    clientY: 100 + dy,
  });
}

function bubbleMapSize() {
  const [, , width, height] = screen
    .getByRole("group", { name: "Bubble relationship map" })
    .getAttribute("viewBox")!
    .split(" ")
    .map(Number);
  return { width, height };
}

function fileUnlinkedPaperUnderGeneral() {
  fixtures.generalProject = {
    id: "project-general",
    title: "General",
    status: "Active",
  };
  fixtures.modules = [
    ...BASE_MODULES,
    {
      id: "module-general",
      projectId: "project-general",
      title: "Unlinked draft",
    },
  ];
}

describe("MindMapPage", () => {
  it("shows linked projects, modules, tasks, and notes", () => {
    render(
      <MemoryRouter>
        <MindMapPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /Climate study/ })).toHaveAttribute(
      "href",
      "/projects/project-1",
    );
    expect(screen.getByRole("link", { name: /Fieldwork/ })).toHaveAttribute(
      "href",
      "/modules/module-1",
    );
    expect(
      screen.getByRole("link", { name: /Calibrate sensors/ }),
    ).toHaveAttribute("href", "/tasks/task-1");
    expect(
      screen.getByRole("link", { name: /Site observation/ }),
    ).toHaveAttribute("href", "/daily-notes/note-1");
  });

  it("filters the map by project and search text", () => {
    render(
      <MemoryRouter>
        <MindMapPage />
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole("combobox", { name: "Filter mind map by project" }),
    );
    fireEvent.click(screen.getByRole("option", { name: "Health study" }));
    expect(
      screen.queryByRole("link", { name: /Climate study/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Health study/ }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("combobox", { name: "Filter mind map by project" }),
    );
    fireEvent.click(screen.getByRole("option", { name: "All projects" }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "Search the mind map" }),
      { target: { value: "sensor" } },
    );
    expect(
      screen.getByRole("link", { name: /Climate study/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Health study/ }),
    ).not.toBeInTheDocument();
  });

  it("offers a connected bubble view with clickable records", () => {
    render(
      <MemoryRouter>
        <MindMapPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Bubbles/ }));

    expect(
      screen.getByRole("group", { name: "Bubble relationship map" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Project: Climate study, Active" }),
    ).toHaveAttribute("href", "/projects/project-1");
    expect(
      screen.getByRole("link", { name: "Paper: Fieldwork, Active" }),
    ).toHaveAttribute("href", "/modules/module-1");
    expect(
      screen.getByRole("link", { name: "Task: Calibrate sensors, Blocked" }),
    ).toHaveAttribute("href", "/tasks/task-1");
    expect(
      screen.getByRole("link", { name: "Note: Site observation" }),
    ).toHaveAttribute("href", "/daily-notes/note-1");
  });

  it("loads every project, paper, task and note instead of the first page", () => {
    render(
      <MemoryRouter>
        <MindMapPage />
      </MemoryRouter>,
    );

    expect(fixtures.listCalls.projects?.at(-1)).toEqual([
      "workspace-1",
      1,
      true,
      { pageSize: "all" },
    ]);
    for (const key of ["modules", "tasks", "notes"]) {
      expect(fixtures.listCalls[key]?.at(-1)).toEqual([
        "workspace-1",
        undefined,
        1,
        true,
        { pageSize: "all" },
      ]);
    }
  });

  it("shows papers filed under General after the research projects", () => {
    fileUnlinkedPaperUnderGeneral();
    render(
      <MemoryRouter>
        <MindMapPage />
      </MemoryRouter>,
    );

    const general = screen.getByRole("link", { name: /^General/ });
    expect(general).toHaveAttribute("href", "/projects/project-general");
    expect(
      screen.getByRole("link", { name: /Unlinked draft/ }),
    ).toHaveAttribute("href", "/modules/module-general");
    expect(
      screen
        .getByRole("link", { name: /Health study/ })
        .compareDocumentPosition(general) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("lets the map be filtered to General", () => {
    fileUnlinkedPaperUnderGeneral();
    render(
      <MemoryRouter>
        <MindMapPage />
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole("combobox", { name: "Filter mind map by project" }),
    );
    fireEvent.click(screen.getByRole("option", { name: "General" }));

    expect(
      screen.getByRole("link", { name: /Unlinked draft/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Climate study/ }),
    ).not.toBeInTheDocument();
  });

  it("shows papers filed under General in the bubble view", () => {
    fileUnlinkedPaperUnderGeneral();
    render(
      <MemoryRouter>
        <MindMapPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Bubbles/ }));

    expect(
      screen.getByRole("link", { name: "Project: General, Active" }),
    ).toHaveAttribute("href", "/projects/project-general");
    expect(
      screen.getByRole("link", { name: "Paper: Unlinked draft" }),
    ).toHaveAttribute("href", "/modules/module-general");
  });

  it("shows the status of each project, paper and task in the tree", () => {
    render(
      <MemoryRouter>
        <MindMapPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("link", { name: /Climate study.*Status: Active/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Health study.*Status: Review/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Fieldwork.*Status: Active/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Calibrate sensors.*Status: Blocked/ }),
    ).toBeInTheDocument();
    // Colour follows the app-wide meaning: blocked is red, review is amber.
    expect(screen.getByText("Blocked")).toHaveClass("text-red-700");
    expect(screen.getByText("Review")).toHaveClass("text-amber-800");
    // Notes have no status.
    expect(
      screen.getByRole("link", { name: /Site observation/ }),
    ).not.toHaveTextContent("Status:");
  });

  it("shows the status inside each bubble", () => {
    render(
      <MemoryRouter>
        <MindMapPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Bubbles/ }));

    const task = screen.getByRole("link", {
      name: "Task: Calibrate sensors, Blocked",
    });
    expect(within(task).getByText("Blocked")).toHaveClass("fill-red-700");
    expect(
      screen.getByRole("link", { name: "Note: Site observation" }),
    ).toBeInTheDocument();
  });

  it("moves a bubble when it is dragged, without opening it", () => {
    renderWithProjectPage();
    fireEvent.click(screen.getByRole("button", { name: /Bubbles/ }));
    const before = bubbleCentre(climateBubble());

    dragBy(climateBubble(), 60, 30);
    fireEvent.click(climateBubble());

    expect(screen.queryByText("Project page")).not.toBeInTheDocument();
    expect(bubbleCentre(climateBubble())).toEqual({
      x: before.x + 60,
      y: before.y + 30,
    });
  });

  it("still opens a bubble on a plain click", () => {
    renderWithProjectPage();
    fireEvent.click(screen.getByRole("button", { name: /Bubbles/ }));

    dragBy(climateBubble(), 1, 1);
    fireEvent.click(climateBubble());

    expect(screen.getByText("Project page")).toBeInTheDocument();
  });

  it("keeps moved bubbles across views until the layout is reset", () => {
    renderWithProjectPage();
    fireEvent.click(screen.getByRole("button", { name: /Bubbles/ }));
    const reset = () => screen.getByRole("button", { name: "Reset layout" });
    const original = bubbleCentre(climateBubble());
    expect(reset()).toBeDisabled();

    dragBy(climateBubble(), 80, 0);
    fireEvent.click(screen.getByRole("button", { name: /Tree/ }));
    fireEvent.click(screen.getByRole("button", { name: /Bubbles/ }));

    expect(bubbleCentre(climateBubble()).x).toBe(original.x + 80);
    expect(reset()).toBeEnabled();

    fireEvent.click(reset());
    expect(bubbleCentre(climateBubble())).toEqual(original);
    expect(reset()).toBeDisabled();
  });

  it("makes the bubble map taller when a column has many bubbles", () => {
    fixtures.tasks = Array.from({ length: 12 }, (_, index) => ({
      id: `task-${index + 1}`,
      projectId: "project-1",
      moduleId: "module-1",
      title: `Task ${index + 1}`,
      status: "To do",
    }));
    renderWithProjectPage();
    fireEvent.click(screen.getByRole("button", { name: /Bubbles/ }));

    // 12 tasks and 1 note share the last column, 105px each plus margins.
    expect(bubbleMapSize()).toEqual({ width: 1100, height: 13 * 105 + 80 });
  });

  it("grows the bubble map to fit a bubble dragged past its edge", () => {
    renderWithProjectPage();
    fireEvent.click(screen.getByRole("button", { name: /Bubbles/ }));
    expect(bubbleMapSize()).toEqual({ width: 1100, height: 520 });
    const before = bubbleCentre(climateBubble());

    dragBy(climateBubble(), 2000, 1500);

    const after = bubbleCentre(climateBubble());
    expect(after).toEqual({ x: before.x + 2000, y: before.y + 1500 });
    expect(bubbleMapSize()).toEqual({
      width: Math.ceil(after.x + 90),
      height: Math.ceil(after.y + 90),
    });
    expect(
      screen.getByRole("group", { name: "Bubble relationship map" }),
    ).toHaveStyle({ width: `${Math.ceil(after.x + 90)}px` });

    fireEvent.click(screen.getByRole("button", { name: "Reset layout" }));
    expect(bubbleMapSize()).toEqual({ width: 1100, height: 520 });
  });

  it("spreads the bubble map across a wide screen", () => {
    const originalResizeObserver = window.ResizeObserver;
    class WideScreenObserver {
      private readonly callback: ResizeObserverCallback;
      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
      }
      observe() {
        this.callback(
          [{ contentRect: { width: 1600 } } as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        );
      }
      unobserve() {}
      disconnect() {}
    }
    window.ResizeObserver =
      WideScreenObserver as unknown as typeof ResizeObserver;
    try {
      renderWithProjectPage();
      fireEvent.click(screen.getByRole("button", { name: /Bubbles/ }));

      expect(bubbleMapSize().width).toBe(1600);
      expect(bubbleCentre(climateBubble()).x).toBe(
        Math.round((1600 * 340) / 1100),
      );
    } finally {
      window.ResizeObserver = originalResizeObserver;
    }
  });

  it("gives every project and paper bubble a +/− button, greyed out when nothing is linked", () => {
    render(
      <MemoryRouter>
        <MindMapPage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Bubbles/ }));

    expect(
      screen.getByRole("button", { name: "Collapse project Climate study" }),
    ).not.toHaveAttribute("aria-disabled");
    expect(
      screen.getByRole("button", { name: "Collapse paper Fieldwork" }),
    ).not.toHaveAttribute("aria-disabled");
    // Health study has nothing linked yet.
    const empty = screen.getByRole("button", {
      name: "Collapse project Health study",
    });
    expect(empty).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(empty);
    expect(
      screen.getByRole("button", { name: "Collapse project Health study" }),
    ).toBeInTheDocument();
    // Tasks and notes never hold anything, so they have no button.
    expect(
      screen.queryByRole("button", { name: /Calibrate sensors|Site observation/ }),
    ).not.toBeInTheDocument();
  });

  it("hides and shows the whole map from the workspace bubble", () => {
    // Enough tasks to make the map taller than its minimum height.
    fixtures.tasks = [
      ...BASE_TASKS,
      ...Array.from({ length: 6 }, (_, index) => ({
        id: `extra-task-${index + 1}`,
        projectId: "project-1",
        moduleId: "module-1",
        title: `Extra task ${index + 1}`,
        status: "To do",
      })),
    ];
    render(
      <MemoryRouter>
        <MindMapPage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Bubbles/ }));

    const workspaceSpot = () =>
      screen
        .getByRole("button", { name: /workspace Research lab/ })
        .parentElement?.getAttribute("transform");
    const spotBefore = workspaceSpot();
    fireEvent.click(
      screen.getByRole("button", { name: "Collapse workspace Research lab" }),
    );
    // The bubble stays put, so its button can be clicked again straight away.
    expect(workspaceSpot()).toBe(spotBefore);
    expect(
      screen.queryByRole("link", { name: /^Project:/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Paper:/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Task:/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Note:/ })).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Expand workspace Research lab" }),
    );
    expect(
      screen.getByRole("link", { name: "Task: Calibrate sensors, Blocked" }),
    ).toBeInTheDocument();
  });

  it("labels the legend with a Key: prefix and includes the workspace icon", () => {
    render(
      <MemoryRouter>
        <MindMapPage />
      </MemoryRouter>,
    );

    const legend = screen.getByRole("group", { name: "Mind map legend" });
    expect(legend).toHaveTextContent("Key:");
    expect(legend).toHaveTextContent("Workspace");
    expect(legend).toHaveTextContent("Project");
    expect(legend).toHaveTextContent("Paper");
    expect(legend).toHaveTextContent("Task");
    expect(legend).toHaveTextContent("Note");
  });

  it("expands and collapses every panel in the tree view at once", () => {
    render(
      <MemoryRouter>
        <MindMapPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Calibrate sensors")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
    expect(screen.queryByText("Calibrate sensors")).not.toBeInTheDocument();
    expect(screen.queryByText("Fieldwork")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Climate study/ }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
    expect(screen.getByText("Calibrate sensors")).toBeInTheDocument();
  });

  it("collapses and expands bubble nodes to hide or reveal their children", () => {
    render(
      <MemoryRouter>
        <MindMapPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Bubbles/ }));
    expect(
      screen.getByRole("link", { name: "Paper: Fieldwork, Active" }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Collapse project Climate study" }),
    );
    expect(
      screen.getByRole("link", { name: "Project: Climate study, Active" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Paper: Fieldwork, Active" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Task: Calibrate sensors, Blocked" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Note: Site observation" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Expand project Climate study" }),
    );
    expect(
      screen.getByRole("link", { name: "Paper: Fieldwork, Active" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Task: Calibrate sensors, Blocked" }),
    ).toBeInTheDocument();
  });

  it("expands and collapses every node in the bubble view at once", () => {
    render(
      <MemoryRouter>
        <MindMapPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Bubbles/ }));
    expect(
      screen.getByRole("link", { name: "Paper: Fieldwork, Active" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
    expect(
      screen.getByRole("link", { name: "Project: Climate study, Active" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Paper: Fieldwork, Active" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Task: Calibrate sensors, Blocked" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
    expect(
      screen.getByRole("link", { name: "Paper: Fieldwork, Active" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Task: Calibrate sensors, Blocked" }),
    ).toBeInTheDocument();
  });
});
