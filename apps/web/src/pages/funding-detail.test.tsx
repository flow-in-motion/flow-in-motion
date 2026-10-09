import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import FundingDetailPage from "@/pages/funding-detail";

const fixtures = vi.hoisted(() => ({
  attachNote: vi.fn(),
  detachNote: vi.fn(),
  attachTask: vi.fn(),
  detachTask: vi.fn(),
  useNotes: vi.fn(),
  useTasks: vi.fn(),
}));

vi.mock("@/api/hooks", () => ({
  useCurrentWorkspace: () => ({
    data: { id: "workspace-1" },
    isPending: false,
  }),
  useFunding: () => ({
    data: {
      id: "funding-1",
      tenantId: "workspace-1",
      ownerUserId: "user-owner",
      fundingBody: "Research Council",
      scheme: "Discovery",
      partners: "University",
      amount: "1000.00",
      currency: "AUD",
      applicationDeadline: "2027-03-15",
      followUpDate: "2027-03-22",
      status: "Preparing",
      description: "A concise funding description.",
      projects: [],
      papers: [],
      linkedNotes: [
        {
          id: "note-1",
          displayId: "N-1",
          title: "Budget note",
          content: null,
          followUpDate: null,
          createdAt: "2026-10-01T00:00:00.000Z",
        },
      ],
      tasks: [
        {
          id: "task-1",
          displayId: "T-1",
          title: "Submit budget",
          description: null,
          dueDate: "2027-03-10",
          createdAt: "2026-10-01T00:00:00.000Z",
        },
      ],
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useMe: () => ({ data: { id: "user-owner" }, isPending: false }),
  useUpdateFunding: () => ({ mutateAsync: vi.fn() }),
  useDeleteFunding: () => ({ mutateAsync: vi.fn() }),
  useAttachFundingNote: () => ({ mutateAsync: fixtures.attachNote }),
  useDetachFundingNote: () => ({ mutateAsync: fixtures.detachNote }),
  useAttachFundingTask: () => ({ mutateAsync: fixtures.attachTask }),
  useDetachFundingTask: () => ({ mutateAsync: fixtures.detachTask }),
  useCreateNote: () => ({ mutateAsync: vi.fn() }),
  useCreateTask: () => ({ mutateAsync: vi.fn() }),
  useNotes: (...args: unknown[]) => {
    fixtures.useNotes(...args);
    return { data: { data: [] }, isFetching: false };
  },
  useTasks: (...args: unknown[]) => {
    fixtures.useTasks(...args);
    return { data: { data: [] }, isFetching: false };
  },
  useProjects: () => ({ data: { data: [], generalProject: null } }),
  useModules: () => ({ data: { data: [] }, isFetching: false }),
}));

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/funding/funding-1"]}>
      <Routes>
        <Route path="/funding/:fundingId" element={<FundingDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("FundingDetailPage", () => {
  beforeEach(() => {
    fixtures.attachNote.mockReset().mockResolvedValue({});
    fixtures.detachNote.mockReset().mockResolvedValue({});
    fixtures.attachTask.mockReset().mockResolvedValue({});
    fixtures.detachTask.mockReset().mockResolvedValue({});
    fixtures.useNotes.mockReset();
    fixtures.useTasks.mockReset();
  });

  it("shows the description, follow-up date, and clickable linked work", () => {
    renderPage();

    expect(
      screen.getByText("A concise funding description."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/22.*March.*2027|March.*22.*2027/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Budget note/ })).toHaveAttribute(
      "href",
      "/daily-notes/note-1",
    );
    expect(screen.getByRole("link", { name: /Submit budget/ })).toHaveAttribute(
      "href",
      "/tasks/task-1",
    );
  });

  it("searches all accessible notes before attaching one", async () => {
    renderPage();
    fireEvent.click(
      screen.getAllByRole("button", { name: "Attach existing" })[0],
    );
    fireEvent.change(
      screen.getByPlaceholderText("Search all accessible notes…"),
      {
        target: { value: "budget" },
      },
    );

    await waitFor(() => {
      expect(fixtures.useNotes).toHaveBeenLastCalledWith(
        "workspace-1",
        undefined,
        1,
        true,
        { pageSize: "all", search: "budget" },
      );
    });
  });

  it("detaches associations without deleting the note or task", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Detach Budget note" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Detach Submit budget" }),
    );

    expect(fixtures.detachNote).toHaveBeenCalledWith("note-1");
    expect(fixtures.detachTask).toHaveBeenCalledWith("task-1");
  });
});
