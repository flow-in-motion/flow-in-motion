import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import {
  LinkedNotesPanel,
  LinkedTasksPanel,
  type PanelNote,
  type PanelTask,
} from "@/components/shared/linked-items-panels";

const notes: PanelNote[] = [
  {
    id: "newest",
    title: "Newest note",
    updatedAt: "2026-10-19T12:00:00.000Z",
    modulePinned: false,
  },
  {
    id: "middle",
    title: "Middle note",
    updatedAt: "2026-10-18T12:00:00.000Z",
    modulePinned: false,
  },
  {
    id: "older",
    title: "Older note",
    updatedAt: "2026-10-17T12:00:00.000Z",
    modulePinned: false,
  },
  {
    id: "pinned",
    title: "Old pinned note",
    updatedAt: "2026-01-01T12:00:00.000Z",
    modulePinned: true,
  },
];

function noteTitles() {
  return screen
    .getAllByRole("link")
    .map((link) => link.textContent);
}

describe("LinkedNotesPanel pins", () => {
  it("puts a funding-pinned note into the three-note preview", () => {
    const onTogglePin = vi.fn();
    const fundingNotes = notes.map((note) => ({
      ...note,
      modulePinned: false,
      fundingPinned: note.id === "pinned",
    }));

    render(
      <MemoryRouter>
        <LinkedNotesPanel
          notes={fundingNotes}
          entityLabel="funding"
          contentId="funding-notes"
          visible
          onToggleVisible={vi.fn()}
          pinnedFirst
          getPinState={(note) => note.fundingPinned}
          onTogglePin={onTogglePin}
        />
      </MemoryRouter>,
    );

    expect(noteTitles()).toEqual([
      "Old pinned note",
      "Newest note",
      "Middle note",
    ]);
    expect(
      screen.queryByRole("link", { name: "Older note" }),
    ).not.toBeInTheDocument();

    const unpin = screen.getByRole("button", {
      name: "Unpin Old pinned note",
    });
    expect(unpin).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(unpin);
    expect(onTogglePin).toHaveBeenCalledWith(fundingNotes[3]);
  });

  it("places pinned notes before recent notes in the three-note preview", () => {
    render(
      <MemoryRouter>
        <LinkedNotesPanel
          notes={notes}
          entityLabel="paper"
          contentId="paper-notes"
          visible
          onToggleVisible={vi.fn()}
          pinnedFirst
        />
      </MemoryRouter>,
    );

    expect(noteTitles()).toEqual([
      "Old pinned note",
      "Newest note",
      "Middle note",
    ]);
    expect(
      screen.queryByRole("link", { name: "Older note" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Show all 4 notes" }),
    );

    expect(noteTitles()).toEqual([
      "Old pinned note",
      "Newest note",
      "Middle note",
      "Older note",
    ]);
  });

  it("keeps project notes ordered by recency when pin sorting is not enabled", () => {
    render(
      <MemoryRouter>
        <LinkedNotesPanel
          notes={notes}
          entityLabel="project"
          contentId="project-notes"
          visible
          onToggleVisible={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(noteTitles()).toEqual([
      "Newest note",
      "Middle note",
      "Older note",
    ]);
    expect(
      screen.queryByRole("button", { name: /^Pin |^Unpin / }),
    ).not.toBeInTheDocument();
  });

  it("offers pin and unpin actions without navigating to the note", () => {
    const onTogglePin = vi.fn();

    render(
      <MemoryRouter>
        <LinkedNotesPanel
          notes={notes}
          entityLabel="paper"
          contentId="paper-notes"
          visible
          onToggleVisible={vi.fn()}
          pinnedFirst
          onTogglePin={onTogglePin}
        />
      </MemoryRouter>,
    );

    const pin = screen.getByRole("button", {
      name: "Pin Newest note",
    });
    const unpin = screen.getByRole("button", {
      name: "Unpin Old pinned note",
    });

    expect(pin).toHaveAttribute("aria-pressed", "false");
    expect(unpin).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(pin);
    expect(onTogglePin).toHaveBeenNthCalledWith(1, notes[0]);

    fireEvent.click(unpin);
    expect(onTogglePin).toHaveBeenNthCalledWith(2, notes[3]);
  });

  it("disables pin actions while a save is pending", () => {
    const onTogglePin = vi.fn();

    render(
      <MemoryRouter>
        <LinkedNotesPanel
          notes={notes}
          entityLabel="paper"
          contentId="paper-notes"
          visible
          onToggleVisible={vi.fn()}
          pinnedFirst
          onTogglePin={onTogglePin}
          pinDisabled
        />
      </MemoryRouter>,
    );

    const buttons = screen.getAllByRole("button", {
      name: /^Pin |^Unpin /,
    });

    buttons.forEach((button) => {
      expect(button).toBeDisabled();
      fireEvent.click(button);
    });

    expect(onTogglePin).not.toHaveBeenCalled();
  });

  it("orders multiple pinned notes by recency without changing the input array", () => {
    const input: PanelNote[] = [
      notes[0],
      notes[3],
      {
        id: "recent-pin",
        title: "Recent pinned note",
        updatedAt: "2026-10-18T12:00:00.000Z",
        modulePinned: true,
      },
    ];
    const originalOrder = input.map((note) => note.id);

    render(
      <MemoryRouter>
        <LinkedNotesPanel
          notes={input}
          entityLabel="paper"
          contentId="paper-notes"
          visible
          onToggleVisible={vi.fn()}
          pinnedFirst
        />
      </MemoryRouter>,
    );

    expect(noteTitles()).toEqual([
      "Recent pinned note",
      "Old pinned note",
      "Newest note",
    ]);
    expect(input.map((note) => note.id)).toEqual(originalOrder);
  });
});

describe("LinkedTasksPanel completed tasks", () => {
  const tasks: PanelTask[] = [
    {
      id: "active",
      title: "Draft discussion",
      status: "In progress",
      priority: "High",
      dueDate: "2026-11-10",
    },
    {
      id: "done-old",
      title: "Collect data",
      status: "Complete",
      priority: "Medium",
      dueDate: "2026-09-01",
    },
    {
      id: "done-new",
      title: "Ethics approval",
      status: "Complete",
      priority: "High",
      dueDate: "2026-10-01",
    },
  ];

  function taskLinks() {
    return screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));
  }

  it("shows this panel's own completed tasks in place, not the whole task list", () => {
    render(
      <MemoryRouter>
        <LinkedTasksPanel
          tasks={tasks}
          entityLabel="paper"
          contentId="paper-tasks"
          visible
          onToggleVisible={vi.fn()}
          renderTaskAction={() => <button type="button">Timer</button>}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText(/2 completed tasks are hidden/)).toBeInTheDocument();
    expect(screen.queryByText("Collect data")).not.toBeInTheDocument();
    expect(taskLinks()).toEqual(["/tasks/active"]);

    const show = screen.getByRole("button", { name: "Show completed tasks" });
    expect(show).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(show);

    expect(screen.getByText("Completed (2)")).toBeInTheDocument();
    expect(taskLinks()).toEqual([
      "/tasks/active",
      "/tasks/done-new",
      "/tasks/done-old",
    ]);
    expect(screen.queryByText(/completed tasks are hidden/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Timer" })).toHaveLength(1);

    const hide = screen.getByRole("button", { name: "Hide completed tasks" });
    expect(hide).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(hide);

    expect(screen.queryByText("Collect data")).not.toBeInTheDocument();
    expect(screen.getByText(/2 completed tasks are hidden/)).toBeInTheDocument();
  });

  it("can show the completed task when every task is complete", () => {
    render(
      <MemoryRouter>
        <LinkedTasksPanel
          tasks={[tasks[1]]}
          entityLabel="paper"
          contentId="paper-tasks"
          visible
          onToggleVisible={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(
      screen.getByText("All tasks for this paper are complete."),
    ).toBeInTheDocument();
    expect(screen.getByText(/1 completed task is hidden/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show completed task" }));

    expect(taskLinks()).toEqual(["/tasks/done-old"]);
    expect(screen.getByText("Collect data")).toBeInTheDocument();
  });
});
