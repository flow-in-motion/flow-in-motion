import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CollaboratorRoster } from "@/components/sharing/collaborator-roster";

vi.mock("@/api/hooks", () => ({
  useMe: () => ({ data: { id: "user-owner" } }),
  useCollaboratorInvitations: () => ({ data: [], isPending: false }),
  useCreateDraftInvitation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useSendInvitation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useRevokeCollaboratorInvitation: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useUserSearch: () => ({ data: [], isPending: false }),
}));

const collaborators = [
  {
    id: "collaborator-sam",
    userId: "user-sam",
    displayName: "Sam Coauthor",
    email: "sam@example.com",
    role: "Collaborator",
  },
  {
    id: "collaborator-dana",
    userId: "user-dana",
    displayName: "Dana Coauthor",
    email: "dana@example.com",
    role: "Collaborator",
  },
];

function roster(entityId: string) {
  return (
    <MemoryRouter>
      <CollaboratorRoster
        target="module"
        tenantId="workspace-1"
        entityId={entityId}
        entityTitle="Test paper"
        members={[]}
        collaborators={collaborators}
        onRemoveCollaborator={vi.fn()}
        canManage={false}
      />
    </MemoryRouter>
  );
}

beforeEach(() => {
  window.sessionStorage.clear();
});

describe("CollaboratorRoster session search", () => {
  it("restores the search after returning to the same paper", () => {
    const first = render(roster("paper-a"));

    fireEvent.change(
      screen.getByRole("textbox", {
        name: "Search collaborators by name, email, or affiliation",
      }),
      { target: { value: "Sam" } },
    );

    first.unmount();
    render(roster("paper-a"));

    expect(
      screen.getByRole("textbox", {
        name: "Search collaborators by name, email, or affiliation",
      }),
    ).toHaveValue("Sam");
    expect(screen.getByText("Sam Coauthor")).toBeInTheDocument();
    expect(screen.queryByText("Dana Coauthor")).not.toBeInTheDocument();
  });

  it("keeps different papers' searches separate", () => {
    const { rerender } = render(roster("paper-a"));

    fireEvent.change(
      screen.getByRole("textbox", {
        name: "Search collaborators by name, email, or affiliation",
      }),
      { target: { value: "Sam" } },
    );

    rerender(roster("paper-b"));

    expect(
      screen.getByRole("textbox", {
        name: "Search collaborators by name, email, or affiliation",
      }),
    ).toHaveValue("");
    expect(screen.getByText("Dana Coauthor")).toBeInTheDocument();

    rerender(roster("paper-a"));

    expect(
      screen.getByRole("textbox", {
        name: "Search collaborators by name, email, or affiliation",
      }),
    ).toHaveValue("Sam");
  });
});
