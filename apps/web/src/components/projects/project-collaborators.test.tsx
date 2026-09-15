import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProjectCollaborators } from "@/components/projects/project-collaborators";
import type { ApiCollaborator, ApiInvitation, Membership } from "@/api/hooks";

const timestamps = { createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };

const collaborators: ApiCollaborator[] = [
  {
    id: "collab-1",
    tenantId: "tenant-1",
    userId: "user-alice",
    role: "Editor",
    displayName: "Alice Anders",
    email: "alice@example.com",
    affiliation: "University of Sydney",
    ...timestamps,
  },
  {
    id: "collab-2",
    tenantId: "tenant-1",
    userId: "user-bob",
    role: "Viewer",
    displayName: "Bob Baker",
    email: "bob@example.com",
    affiliation: "Monash University",
    ...timestamps,
  },
];

const invitations: ApiInvitation[] = [];
const removeCollaboratorMutate = vi.fn();
const createDraftMutate = vi.fn();
const sendInvitationMutate = vi.fn();
const revokeInvitationMutate = vi.fn();

vi.mock("@/api/hooks", async () => {
  const actual = await vi.importActual<typeof import("@/api/hooks")>("@/api/hooks");
  return {
    ...actual,
    useProjectCollaborators: () => ({ data: collaborators, isPending: false }),
    useRemoveProjectCollaborator: () => ({ mutate: removeCollaboratorMutate, isPending: false }),
    useCollaboratorInvitations: () => ({ data: invitations, isPending: false, isError: false }),
    useCreateDraftInvitation: () => ({
      mutateAsync: createDraftMutate,
      isPending: false,
      isError: false,
    }),
    useSendInvitation: () => ({ mutateAsync: sendInvitationMutate, isPending: false, isError: false }),
    useRevokeCollaboratorInvitation: () => ({
      mutate: revokeInvitationMutate,
      isPending: false,
      isError: false,
    }),
    useUserSearch: () => ({ data: [], isPending: false }),
  };
});

const members: Membership[] = [];

describe("ProjectCollaborators", () => {
  it("displays affiliations and filters collaborators by affiliation", () => {
    render(
      <ProjectCollaborators
        tenantId="tenant-1"
        projectId="project-1"
        ownerUserId="user-owner"
        members={members}
        entityTitle="Genome Project"
        canManage
      />,
    );

    expect(screen.getByText("University of Sydney")).toBeInTheDocument();
    expect(screen.getByText("Monash University")).toBeInTheDocument();

    fireEvent.change(
      screen.getByLabelText(
        "Search collaborators by name, email, or affiliation",
      ),
      {
        target: { value: "sydney" },
      },
    );

    expect(screen.getByText("Alice Anders")).toBeInTheDocument();
    expect(screen.getByText("University of Sydney")).toBeInTheDocument();
    expect(screen.queryByText("Bob Baker")).not.toBeInTheDocument();
    expect(screen.queryByText("Monash University")).not.toBeInTheDocument();
  });
  it("filters the collaborator list by name as you type", () => {
    render(
      <ProjectCollaborators
        tenantId="tenant-1"
        projectId="project-1"
        ownerUserId="user-owner"
        members={members}
        entityTitle="Genome Project"
        canManage
      />,
    );

    expect(screen.getByText("Alice Anders")).toBeInTheDocument();
    expect(screen.getByText("Bob Baker")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(
      "Search collaborators by name, email, or affiliation",
    ), {
      target: { value: "ali" },
    });

    expect(screen.getByText("Alice Anders")).toBeInTheDocument();
    expect(screen.queryByText("Bob Baker")).not.toBeInTheDocument();
  });

  it("shows a no-match message when the search finds nobody", () => {
    render(
      <ProjectCollaborators
        tenantId="tenant-1"
        projectId="project-1"
        ownerUserId="user-owner"
        members={members}
        entityTitle="Genome Project"
        canManage
      />,
    );

    fireEvent.change(screen.getByLabelText(
      "Search collaborators by name, email, or affiliation",
    ), {
      target: { value: "zzz" },
    });

    expect(screen.getByText('No collaborators match "zzz".')).toBeInTheDocument();
  });

  it("adds a draft collaborator by name, email, and affiliation without sending anything", async () => {
    render(
      <ProjectCollaborators
        tenantId="tenant-1"
        projectId="project-1"
        ownerUserId="user-owner"
        members={members}
        entityTitle="Genome Project"
        canManage
      />,
    );

    fireEvent.change(screen.getByLabelText("Collaborator name"), {
      target: { value: "Jamie Collaborator" },
    });
    fireEvent.change(screen.getByLabelText("Collaborator email"), {
      target: { value: "jamie@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Collaborator affiliation"), {
      target: { value: "Example University" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add collaborator" }));

    expect(createDraftMutate).toHaveBeenCalledWith({
      email: "jamie@example.com",
      name: "Jamie Collaborator",
      affiliation: "Example University",
    });
  });
});
