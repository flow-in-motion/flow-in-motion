import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ConferenceNotesPreview } from "./conference-notes-preview";

describe("ConferenceNotesPreview", () => {
  it.each([undefined, null, "", " \n\t "])(
    "renders nothing for empty notes: %s",
    (notes) => {
      const { container } = render(
        <ConferenceNotesPreview notes={notes} />,
      );

      expect(container).toBeEmptyDOMElement();
    },
  );

  it("shows multiline notes as a compact description", () => {
    render(
      <ConferenceNotesPreview
        notes={"Collaborator will attend.\n\nConsider two other papers."}
      />,
    );

    expect(
      screen.getByText(
        "Collaborator will attend. Consider two other papers.",
      ),
    ).toBeInTheDocument();
  });

  it("limits long descriptions and adds an ellipsis", () => {
    const { container } = render(
      <ConferenceNotesPreview notes={"A".repeat(200)} />,
    );

    expect(container.textContent).toBe(`${"A".repeat(180)}…`);
  });
});
