import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ConferencesPage from "@/pages/conferences";

const fixtures = vi.hoisted(() => ({
  tenantId: "workspace-1",
  conferences: [] as Record<string, unknown>[],
  projects: [{ id: "project-1", title: "Genome Sequencing Study", userId: "user-owner", role: "owner" }],
  modules: [] as Record<string, unknown>[],
  deleteConference: vi.fn(),
}));

vi.mock("@/api/hooks", () => ({
  useCurrentWorkspace: () => ({ data: { id: fixtures.tenantId }, isPending: false }),
  useMe: () => ({ data: { id: "user-owner", displayName: "Avi Researcher", email: "owner@example.com" } }),
  useConferences: () => ({
    data: {
      data: fixtures.conferences,
      meta: { page: 1, pageSize: 20, totalItems: fixtures.conferences.length, totalPages: 1 },
    },
    isPending: false,
    isFetching: false,
    isError: false,
    error: undefined,
    refetch: vi.fn(),
  }),
  useProjects: () => ({
    data: {
      data: fixtures.projects,
      meta: { page: 1, pageSize: 20, totalItems: fixtures.projects.length, totalPages: 1 },
    },
    isPending: false,
  }),
  useModules: () => ({
    data: {
      data: fixtures.modules,
      meta: { page: 1, pageSize: 20, totalItems: fixtures.modules.length, totalPages: 1 },
    },
  }),
  useCreateConference: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateConference: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteConference: () => ({ mutateAsync: fixtures.deleteConference, isPending: false }),
  useTrackEvent: () => vi.fn(),
}));

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/conferences"]}>
      <ConferencesPage />
    </MemoryRouter>,
  );
}

describe("ConferencesPage", () => {
  beforeEach(() => {
    fixtures.conferences = [
      {
        id: "conf-1",
        tenantId: "workspace-1",
        ownerUserId: "user-owner",
        acronym: "ICML",
        name: "International Conference on Machine Learning",
        location: "Vienna, Austria",
        submissionDue: "2026-03-01",
        startDate: "2026-07-01",
        endDate: "2026-07-05",
        submissionType: "Abstract",
        daysRemaining: 10,
        projects: [{ id: "project-1", title: "Genome Sequencing Study", displayId: "PRJ-1" }],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "conf-2",
        tenantId: "workspace-1",
        ownerUserId: "someone-else",
        acronym: "NIPS",
        name: "Neural Information Processing Systems",
        location: "Vancouver, Canada",
        submissionDue: "2026-02-01",
        startDate: "2026-12-01",
        endDate: "2026-12-06",
        submissionType: "Full paper",
        daysRemaining: -5,
        projects: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    fixtures.deleteConference.mockReset();
    fixtures.deleteConference.mockResolvedValue({});
  });

  it("lists conferences with their linked projects, using the expandable list layout shared with Projects/Papers/Tasks", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Conferences" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "International Conference on Machine Learning" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "PRJ-1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sort by Conference" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sort by Submission Due" })).toBeInTheDocument();
  });

  it("only shows edit/delete controls for conferences the current user owns", () => {
    renderPage();

    expect(screen.getByRole("button", { name: "Edit International Conference on Machine Learning" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit Neural Information Processing Systems" }),
    ).not.toBeInTheDocument();
  });

  it("filters the list by search text", () => {
    renderPage();

    fireEvent.change(screen.getByPlaceholderText("Search conference, project, or location…"), {
      target: { value: "NIPS" },
    });

    expect(screen.getByRole("link", { name: "Neural Information Processing Systems" })).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "International Conference on Machine Learning" }),
    ).not.toBeInTheDocument();
  });

  it("shows an empty state when no conference matches the filters", () => {
    renderPage();

    fireEvent.change(screen.getByPlaceholderText("Search conference, project, or location…"), {
      target: { value: "nothing matches this" },
    });

    expect(screen.getByText("No conferences match the current filters.")).toBeInTheDocument();
  });

  it("deletes a conference after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Delete International Conference on Machine Learning" }));

    expect(fixtures.deleteConference).toHaveBeenCalledWith("conf-1");
  });
});
