import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import {
  LinkedNotesPanel,
  type PanelNote,
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
