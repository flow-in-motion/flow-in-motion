import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ArchiveProjectDialog } from "@/components/projects/archive-project-dialog";

vi.mock("@/api/hooks", () => ({
  useProjects: () => ({
    data: {
      generalProject: null,
      data: [
        {
          id: "project-2",
          userId: "owner-1",
          title: "Destination Project",
          displayId: "PRJ-002",
        },
      ],
    },
    isPending: false,
  }),
}));

const project = {
  id: "project-1",
  displayId: "PRJ-001",
  userId: "owner-1",
  tenantId: "tenant-1",
  title: "Source Project",
  description: null,
  researchArea: null,
  status: "Active",
  importance: null,
  scheduledFor: null,
  dueDate: null,
  totalBudget: null,
  targetJournals: null,
  archivedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  role: "Owner",
};

describe("ArchiveProjectDialog", () => {
  it("shows impact and can move linked work before archiving", async () => {
    const onArchive = vi.fn().mockResolvedValue(undefined);

    render(
      <ArchiveProjectDialog
        open
        onOpenChange={vi.fn()}
        project={project}
        impact={{ papers: 2, tasks: 4, notes: 3 }}
        impactPending={false}
        onArchive={onArchive}
        isPending={false}
      />,
    );

    expect(
      screen.getByText("2 papers, 4 tasks, and 3 notes are linked to this project.", {
        exact: false,
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("radio", {
        name: /Move linked work, then archive project/i,
      }),
    );
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "Destination" },
    });
    fireEvent.click(screen.getByRole("option", { name: /Destination Project/i }));
    fireEvent.click(screen.getByRole("button", { name: "Archive Project" }));

    await waitFor(() =>
      expect(onArchive).toHaveBeenCalledWith({
        projectId: "project-1",
        mode: "move_contents",
        destinationProjectId: "project-2",
      }),
    );
  });
});
