import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CollaboratorRoster } from "@/components/sharing/collaborator-roster";
import type { ApiInvitation } from "@/api/hooks";

const invitations = vi.hoisted(() => ({ current: [] as ApiInvitation[] }));
const sendInvitationMutate = vi.hoisted(() => vi.fn().mockResolvedValue({}));
const revokeInvitationMutate = vi.hoisted(() => vi.fn());
const createDraftMutate = vi.hoisted(() => vi.fn().mockResolvedValue({}));

vi.mock("@/api/hooks", async () => {
  const actual = await vi.importActual<typeof import("@/api/hooks")>("@/api/hooks");
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
    useUserSearch: () => ({ data: [], isPending: false }),
  };
});

const timestamps = { createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };

describe("CollaboratorRoster", () => {
  it("shows a draft collaborator with an Invite button, and opens a mailto link with a sample message after sending", async () => {
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
    sendInvitationMutate.mockResolvedValueOnce({
      invitation: {
        id: "invite-1",
        email: "jamie@example.com",
        name: "Jamie Collaborator",
        expiresAt: "2026-12-01T00:00:00.000Z",
      },
      acceptanceToken: "raw-token-123",
    });

    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      writable: true,
      configurable: true,
      value: { ...originalLocation, href: "" },
    });

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
    expect(screen.getByText("Draft")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Invite" }));

    await waitFor(() => expect(sendInvitationMutate).toHaveBeenCalledWith("invite-1"));
    await waitFor(() => expect(window.location.href).toContain("mailto:jamie%40example.com"));
    expect(window.location.href).toContain(encodeURIComponent("Draft literature review"));
    expect(window.location.href).toContain("raw-token-123");

    Object.defineProperty(window, "location", {
      writable: true,
      configurable: true,
      value: originalLocation,
    });
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
    expect(screen.getByText(/Pending/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Revoke invitation for pending@example.com" }));

    expect(revokeInvitationMutate).toHaveBeenCalledWith("invite-2");
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
          { id: "member-1", userId: "user-2", displayName: "Alice Anders", email: "alice@example.com" },
        ]}
        onRemoveCollaborator={vi.fn()}
        canManage={false}
      />,
    );

    expect(screen.getByText("Alice Anders")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add collaborator" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remove/ })).not.toBeInTheDocument();
  });
});
