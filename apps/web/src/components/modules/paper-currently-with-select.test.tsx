import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PaperCurrentlyWithSelect } from "@/components/modules/paper-currently-with-select";
import { paperCurrentlyWithLabel } from "@/lib/paper-currently-with";

const collaborators = [
  {
    id: "user:user-2",
    userId: "user-2",
    invitationId: null,
    displayName: "Sam Lee",
    email: "sam@example.com",
    affiliation: null,
  },
];

function renderSelect(
  props: Partial<Parameters<typeof PaperCurrentlyWithSelect>[0]> = {},
) {
  const onChange = vi.fn();
  render(
    <PaperCurrentlyWithSelect
      id="currently-with"
      ariaLabel="Currently With"
      currentlyWithType={null}
      assignedToUserId={null}
      assignedToInvitationId={null}
      currentUserId="user-1"
      collaborators={collaborators as never}
      onChange={onChange}
      {...props}
    />,
  );
  return onChange;
}

describe("PaperCurrentlyWithSelect", () => {
  it("offers a general Collaborator/Author option above named collaborators", async () => {
    const onChange = renderSelect();

    fireEvent.keyDown(
      screen.getByRole("combobox", { name: "Currently With" }),
      { key: "Enter" },
    );
    fireEvent.keyDown(
      screen.getByRole("menuitem", { name: "Collaborators/Coauthors" }),
      { key: "ArrowRight" },
    );

    const general = await screen.findByText("Collaborator/Author");
    const samLee = await screen.findByText("Sam Lee");
    expect(general).toHaveAttribute("role", "menuitem");
    // The general option is listed before named collaborators.
    expect(
      general.compareDocumentPosition(samLee) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    fireEvent.click(general);

    expect(onChange).toHaveBeenCalledWith("collaborator", null, null);
  });

  it("labels a collaborator without a specific person as Collaborator/Author", () => {
    renderSelect({ currentlyWithType: "collaborator" });

    expect(
      screen.getByRole("combobox", { name: "Currently With" }),
    ).toHaveTextContent("Collaborator/Author");
  });

  it("still shows the chosen collaborator's name", () => {
    renderSelect({
      currentlyWithType: "collaborator",
      assignedToUserId: "user-2",
    });

    expect(
      screen.getByRole("combobox", { name: "Currently With" }),
    ).toHaveTextContent("Sam Lee");
  });
});

describe("paperCurrentlyWithLabel", () => {
  it("uses Collaborator/Author when no specific collaborator is chosen", () => {
    expect(
      paperCurrentlyWithLabel({
        currentlyWithType: "collaborator",
        assignedToUserId: null,
        assignedToInvitationId: null,
        assignedToDisplayName: null,
      }),
    ).toBe("Collaborator/Author");
  });
});
