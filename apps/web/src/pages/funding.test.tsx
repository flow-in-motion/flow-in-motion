import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import FundingPage from "@/pages/funding";

const fixtures = vi.hoisted(() => ({
  fundings: [] as Record<string, unknown>[],
  deleteFunding: vi.fn(),
  useFundings: vi.fn(),
  useProjects: vi.fn(),
  useModules: vi.fn(),
}));

vi.mock("@/api/hooks", () => ({
  useCurrentWorkspace: () => ({
    data: { id: "workspace-1" },
    isPending: false,
  }),
  useMe: () => ({ data: { id: "user-owner" }, isPending: false }),
  useFundings: (...args: unknown[]) => {
    fixtures.useFundings(...args);
    return {
      data: {
        data: fixtures.fundings,
        meta: {
          page: 1,
          pageSize: 20,
          totalItems: fixtures.fundings.length,
          totalPages: 1,
        },
      },
      isPending: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    };
  },
  useCreateFunding: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateFunding: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteFunding: () => ({
    mutateAsync: fixtures.deleteFunding,
    isPending: false,
  }),
  useProjects: (...args: unknown[]) => fixtures.useProjects(...args),
  useModules: (...args: unknown[]) => fixtures.useModules(...args),
}));

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/funding"]}>
      <FundingPage />
    </MemoryRouter>,
  );
}

describe("FundingPage", () => {
  beforeEach(() => {
    fixtures.deleteFunding.mockReset();
    fixtures.deleteFunding.mockResolvedValue({});
    fixtures.useFundings.mockReset();
    fixtures.useProjects.mockReset();
    fixtures.useProjects.mockReturnValue({
      data: { data: [], generalProject: null },
      isFetching: false,
    });
    fixtures.useModules.mockReset();
    fixtures.useModules.mockReturnValue({
      data: { data: [] },
      isFetching: false,
    });
    fixtures.fundings = [
      {
        id: "funding-1",
        tenantId: "workspace-1",
        ownerUserId: "user-owner",
        fundingBody: "Australian Research Council",
        scheme: "Discovery Projects",
        partners: "Example University",
        amount: "250000.00",
        currency: "AUD",
        applicationDeadline: "2027-03-15",
        followUpDate: "2027-03-22",
        status: "Preparing",
        description: "Funding description",
        projects: [
          { id: "project-1", displayId: "PRJ-1", title: "Research Project" },
        ],
        papers: [
          {
            id: "paper-1",
            displayId: "P-1",
            shortTitle: "Paper",
            title: "Paper",
            projectId: "project-1",
          },
        ],
        createdAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-10-01T00:00:00.000Z",
      },
    ];
  });

  it("shows funding details and direct project/paper links", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: "Funding" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Australian Research Council" }),
    ).toHaveAttribute("href", "/funding/funding-1");
    expect(screen.getByText("Discovery Projects")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "PRJ-1" })).toHaveAttribute(
      "href",
      "/projects/project-1",
    );
    expect(screen.getByRole("link", { name: "P-1" })).toHaveAttribute(
      "href",
      "/modules/paper-1",
    );
  });

  it("opens a form where only Funding body is required", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Add Funding" }));

    expect(
      screen.getByRole("heading", { name: "Add funding" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Funding body/)).toBeRequired();
    expect(screen.getByLabelText("Partners")).not.toBeRequired();
    expect(screen.getByLabelText("Amount")).not.toBeRequired();
    expect(
      screen.getByPlaceholderText("Search all accessible projects…"),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Search all accessible papers…"),
    ).toBeInTheDocument();
  });

  it("searches all accessible projects and papers before pagination", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Add Funding" }));

    fireEvent.change(
      screen.getByPlaceholderText("Search all accessible projects…"),
      { target: { value: "Genome" } },
    );
    await waitFor(() => {
      expect(fixtures.useProjects).toHaveBeenCalledWith(
        "workspace-1",
        1,
        true,
        { pageSize: "all", search: "Genome" },
      );
    });

    fireEvent.change(
      screen.getByPlaceholderText("Search all accessible papers…"),
      { target: { value: "Draft" } },
    );
    await waitFor(() => {
      expect(fixtures.useModules).toHaveBeenCalledWith(
        "workspace-1",
        undefined,
        1,
        true,
        { pageSize: "all", search: "Draft" },
      );
    });
  });

  it("only shows edit and delete controls to the funding owner", () => {
    renderPage();
    expect(
      screen.getByRole("button", { name: "Edit Australian Research Council" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Delete Australian Research Council",
      }),
    ).toBeInTheDocument();
  });

  it("sorts the full funding result set through the server query", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Sort by Amount" }));
    expect(fixtures.useFundings).toHaveBeenLastCalledWith(
      "workspace-1",
      1,
      true,
      expect.objectContaining({ sortBy: "amount", sortDirection: "asc" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Sort by Amount" }));
    expect(fixtures.useFundings).toHaveBeenLastCalledWith(
      "workspace-1",
      1,
      true,
      expect.objectContaining({ sortBy: "amount", sortDirection: "desc" }),
    );
  });
});
