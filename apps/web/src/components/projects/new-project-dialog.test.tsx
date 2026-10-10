import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createDraftInvitation: vi.fn(),
}));

vi.mock("@/api/hooks", async () => {
  const actual = await vi.importActual<typeof import("@/api/hooks")>("@/api/hooks");
  return {
    ...actual,
    useMe: () => ({
      data: {
        id: "user-owner",
        displayName: "Avi Researcher",
        email: "owner@example.com",
      },
    }),
    useUserSearch: () => ({ data: [], isPending: false, isError: false }),
    createDraftInvitation: mocks.createDraftInvitation,
    useModules: () => ({ data: { data: [] }, isPending: false }),
    useTasks: () => ({ data: { data: [] }, isPending: false }),
    useNotes: () => ({ data: { data: [] }, isPending: false }),
    useUpdateModule: () => ({ mutateAsync: vi.fn() }),
    useUpdateTask: () => ({ mutateAsync: vi.fn() }),
    useUpdateNote: () => ({ mutateAsync: vi.fn() }),
  };
});

import { NewProjectDialog } from "@/components/projects/new-project-dialog";

describe("NewProjectDialog", () => {
  it("shows an error and keeps the dialog open when creation fails", async () => {
    const onCreate = vi.fn().mockRejectedValue(new Error("Title already in use"));
    const onOpenChange = vi.fn();

    render(
      <NewProjectDialog
        open
        onOpenChange={onOpenChange}
        tenantId="tenant-1"
        onCreate={onCreate}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Project title/), {
      target: { value: "Genome sequencing" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Project" }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledOnce());
    expect(await screen.findByText("Title already in use")).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByLabelText(/Project title/)).toHaveValue("Genome sequencing");
  });

  it("closes and resets after a successful creation", async () => {
    mocks.createDraftInvitation.mockReset();
    const onCreate = vi.fn().mockResolvedValue({ id: "project-1" });
    const onOpenChange = vi.fn();

    render(
      <NewProjectDialog
        open
        onOpenChange={onOpenChange}
        tenantId="tenant-1"
        onCreate={onCreate}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Project title/), {
      target: { value: "Genome sequencing" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Project" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(mocks.createDraftInvitation).not.toHaveBeenCalled();
  });

  it("offers optional collaborator entry without making it required", () => {
    render(
      <NewProjectDialog
        open
        onOpenChange={vi.fn()}
        tenantId="tenant-1"
        onCreate={vi.fn()}
      />,
    );

    expect(screen.getByText("Collaborators (optional)")).toBeInTheDocument();
    expect(screen.getByLabelText("Collaborator email")).not.toBeRequired();
    expect(screen.queryByText("Importance")).not.toBeInTheDocument();
  });

  it("does not allow the owner to be added as their own collaborator", () => {
    render(
      <NewProjectDialog
        open
        onOpenChange={vi.fn()}
        tenantId="tenant-1"
        onCreate={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Collaborator email"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add collaborator" }));

    expect(
      screen.getByText(
        "You are already the owner and cannot be added as a collaborator.",
      ),
    ).toBeInTheDocument();
  });
});
