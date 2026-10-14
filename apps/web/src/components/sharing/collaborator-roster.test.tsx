import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CollaboratorRoster } from "@/components/sharing/collaborator-roster";
import type { ApiInvitation, ApiUserSearchResult } from "@/api/hooks";

const invitations = vi.hoisted(() => ({ current: [] as ApiInvitation[] }));
const userSearchResults = vi.hoisted(() => ({
  current: [] as ApiUserSearchResult[],
}));
const sendInvitationMutate = vi.hoisted(() => vi.fn().mockResolvedValue({}));
const revokeInvitationMutate = vi.hoisted(() => vi.fn());
const createDraftMutate = vi.hoisted(() => vi.fn().mockResolvedValue({}));

vi.mock("@/api/hooks", async () => {
  const actual =
    await vi.importActual<typeof import("@/api/hooks")>("@/api/hooks");
  return {
    ...actual,
    useCollaboratorInvitations: () => ({
      data: invitations.current,
      isPending: false,
      isError: false,
    }),
    useCreateDraftInvitation: () => ({
      mutateAsync: createDraftMutate,
      isPending: false,
      isError: false,
    }),
    useSendInvitation: () => ({
      mutateAsync: sendInvitationMutate,
      isPending: false,
      isError: false,
    }),
    useRevokeCollaboratorInvitation: () => ({
      mutate: revokeInvitationMutate,
      isPending: false,
      isError: false,
    }),
    useMe: () => ({
      data: { id: "user-owner" },
      isPending: false,
    }),
    useUserSearch: () => ({
      data: userSearchResults.current,
      isPending: false,
    }),
  };
});

const timestamps = {
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("CollaboratorRoster", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    invitations.current = [];
    userSearchResults.current = [];
    vi.clearAllMocks();
  });
  it("shows an unsent collaborator without a status badge or Invite button", () => {
    invitations.current = [
      {
        id: "invite-1",
        taskId: "task-1",
        email: "jamie@example.com",
        name: "Jamie Collaborator",
        affiliation: "Example University",
        invitedBy: "user-owner",
        status: "draft",
        expiresAt: null,
        ...timestamps,
      },
    ];

    render(
      <CollaboratorRoster
        target="task"
        tenantId="tenant-1"
        entityId="task-1"
        entityTitle="Draft literature review"
        members={[]}
        collaborators={[]}
        onRemoveCollaborator={vi.fn()}
        canManage
      />,
    );

    expect(screen.getByText("Jamie Collaborator")).toBeInTheDocument();
    expect(screen.getByText("jamie@example.com")).toBeInTheDocument();
    expect(screen.getByText("Example University")).toBeInTheDocument();
    expect(screen.queryByText("Awaiting invitation")).not.toBeInTheDocument();

    expect(screen.queryByText("Draft")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Invite" }),
    ).not.toBeInTheDocument();
    expect(sendInvitationMutate).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Remove draft for jamie@example.com",
      }),
    );

    expect(revokeInvitationMutate).toHaveBeenCalledWith("invite-1");
  });

  it("shows a pending invitation with a revoke button", () => {
    invitations.current = [
      {
        id: "invite-2",
        taskId: "task-1",
        email: "pending@example.com",
        name: null,
        affiliation: null,
        invitedBy: "user-owner",
        status: "pending",
        expiresAt: "2026-12-01T00:00:00.000Z",
        ...timestamps,
      },
    ];

    render(
      <CollaboratorRoster
        target="task"
        tenantId="tenant-1"
        entityId="task-1"
        entityTitle="Draft literature review"
        members={[]}
        collaborators={[]}
        onRemoveCollaborator={vi.fn()}
        canManage
      />,
    );

    expect(screen.getByText("pending@example.com")).toBeInTheDocument();
    expect(screen.getByText(/Awaiting acceptance/)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Revoke invitation for pending@example.com",
      }),
    );

    expect(revokeInvitationMutate).toHaveBeenCalledWith("invite-2");
  });

  it("finds a reusable contact by name", () => {
    userSearchResults.current = [
      {
        id: "contact:sam@example.com",
        displayName: "Sam Invited",
        email: "sam@example.com",
        affiliation: "Example Institute",
      },
    ];

    render(
      <CollaboratorRoster
        target="module"
        tenantId="tenant-1"
        entityId="module-1"
        entityTitle="Literature review"
        members={[]}
        collaborators={[]}
        onRemoveCollaborator={vi.fn()}
        canManage
      />,
    );

    const nameInput = screen.getByLabelText("Collaborator name");

    fireEvent.focus(nameInput);
    fireEvent.change(nameInput, {
      target: { value: "Sam" },
    });

    expect(
      screen.getByRole("listbox", {
        name: "Available collaborator names",
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("option", {
        name: /Sam Invited/,
      }),
    );

    expect(nameInput).toHaveValue("Sam Invited");
    expect(screen.getByLabelText("Collaborator email")).toHaveValue(
      "sam@example.com",
    );
    expect(screen.getByLabelText("Collaborator affiliation")).toHaveValue(
      "Example Institute",
    );
  });

  it("reuses a contact from a previous invitation", async () => {
    userSearchResults.current = [
      {
        id: "contact:sam@example.com",
        displayName: "Sam Invited",
        email: "sam@example.com",
        affiliation: "Example Institute",
      },
    ];

    render(
      <CollaboratorRoster
        target="note"
        tenantId="tenant-1"
        entityId="note-1"
        entityTitle="Research observations"
        members={[]}
        collaborators={[]}
        onRemoveCollaborator={vi.fn()}
        canManage
      />,
    );

    const emailInput = screen.getByLabelText("Collaborator email");

    fireEvent.focus(emailInput);
    fireEvent.change(emailInput, {
      target: { value: "sam" },
    });

    fireEvent.click(
      screen.getByRole("option", {
        name: /Sam Invited/,
      }),
    );

    expect(screen.getByLabelText("Collaborator name")).toHaveValue(
      "Sam Invited",
    );
    expect(emailInput).toHaveValue("sam@example.com");
    expect(screen.getByLabelText("Collaborator affiliation")).toHaveValue(
      "Example Institute",
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Add collaborator",
      }),
    );

    await waitFor(() =>
      expect(createDraftMutate).toHaveBeenCalledWith({
        email: "sam@example.com",
        name: "Sam Invited",
        affiliation: "Example Institute",
      }),
    );
  });

  it("adds a collaborator with only a name", async () => {
    render(
      <CollaboratorRoster
        target="project"
        tenantId="tenant-1"
        entityId="project-1"
        entityTitle="Coral reef survey"
        members={[]}
        collaborators={[]}
        onRemoveCollaborator={vi.fn()}
        canManage
      />,
    );

    const addButton = screen.getByRole("button", { name: "Add collaborator" });
    expect(addButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Collaborator name"), {
      target: { value: "  Dr. Riley Name-Only  " },
    });
    expect(addButton).toBeEnabled();

    fireEvent.click(addButton);

    await waitFor(() =>
      expect(createDraftMutate).toHaveBeenCalledWith({
        email: undefined,
        name: "Dr. Riley Name-Only",
        affiliation: undefined,
      }),
    );
  });

  it("shows a name-only collaborator and lets it be removed", () => {
    invitations.current = [
      {
        id: "invite-name-only",
        projectId: "project-1",
        email: null,
        name: "Riley Name-Only",
        affiliation: null,
        invitedBy: "user-owner",
        status: "draft",
        expiresAt: null,
        ...timestamps,
      },
    ];

    render(
      <CollaboratorRoster
        target="project"
        tenantId="tenant-1"
        entityId="project-1"
        entityTitle="Coral reef survey"
        members={[]}
        collaborators={[]}
        onRemoveCollaborator={vi.fn()}
        canManage
      />,
    );

    expect(screen.getByText("Riley Name-Only")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Remove draft for Riley Name-Only" }),
    );
    expect(revokeInvitationMutate).toHaveBeenCalledWith("invite-name-only");
  });

  it("hides the add-collaborator form and management actions when the viewer can't manage", () => {
    invitations.current = [];

    render(
      <CollaboratorRoster
        target="task"
        tenantId="tenant-1"
        entityId="task-1"
        entityTitle="Draft literature review"
        members={[]}
        collaborators={[
          {
            id: "member-1",
            userId: "user-2",
            displayName: "Alice Anders",
            email: "alice@example.com",
          },
        ]}
        onRemoveCollaborator={vi.fn()}
        canManage={false}
      />,
    );

    expect(screen.getByText("Alice Anders")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add collaborator" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Remove/ }),
    ).not.toBeInTheDocument();
  });
});
