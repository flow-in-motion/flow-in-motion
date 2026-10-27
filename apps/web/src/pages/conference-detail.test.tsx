import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiConference } from "@/api/hooks";
import ConferenceDetailPage from "@/pages/conference-detail";

const fixtures = vi.hoisted(() => ({
  conference: null as ApiConference | null,
  meId: "user-1",
  updateConference: vi.fn(),
}));

vi.mock("@/api/hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/hooks")>();
  return {
    ...actual,
    useCurrentWorkspace: () => ({ data: { id: "tenant-1" }, isPending: false }),
    useMe: () => ({ data: { id: fixtures.meId }, isPending: false }),
    useConference: () => ({
      data: fixtures.conference,
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    }),
    useUpdateConference: () => ({
      mutateAsync: fixtures.updateConference,
      isPending: false,
    }),
    useDeleteConference: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useConferenceLinkOptions: () => ({ data: [], isFetching: false }),
  };
});

const conference: ApiConference = {
  id: "conference-1",
  tenantId: "tenant-1",
  ownerUserId: "user-1",
  acronym: "ASM",
  name: "Conference 2027",
  location: "Sydney",
  notes: "Abstract due with the poster.",
  submissionDue: null,
  startDate: null,
  endDate: null,
  submissionType: "Poster",
  intents: ["Submitting"],
  daysRemaining: null,
  projects: [
    { id: "project-1", displayId: "PRJ-001", title: "Genome Project" },
    { id: "project-2", displayId: "PRJ-002", title: "Ocean Project" },
  ],
  papers: [
    {
      id: "paper-1",
      displayId: "MOD-001",
      shortTitle: "Draft manuscript",
      title: null,
      projectId: "project-1",
    },
    {
      id: "paper-2",
      displayId: "MOD-002",
      shortTitle: "Literature review",
      title: null,
      projectId: null,
    },
    {
      id: "paper-3",
      displayId: "MOD-003",
      shortTitle: "Poster abstract",
      title: null,
      projectId: "project-2",
    },
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/conferences/conference-1"]}>
      <Routes>
        <Route path="/conferences/:conferenceId" element={<ConferenceDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ConferenceDetailPage", () => {
  beforeEach(() => {
    fixtures.conference = conference;
    fixtures.meId = "user-1";
    fixtures.updateConference = vi.fn().mockResolvedValue(conference);
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows linked projects and papers in separate panels", () => {
    renderPage();

    expect(screen.getByText("Projects (2)")).toBeInTheDocument();
    expect(screen.getByText("Papers (3)")).toBeInTheDocument();

    const projects = document.getElementById("conference-projects-content")!;
    expect(within(projects).getByRole("link", { name: /Genome Project/ })).toHaveAttribute(
      "href",
      "/projects/project-1",
    );
    expect(within(projects).getByRole("link", { name: /Ocean Project/ })).toBeInTheDocument();
    expect(within(projects).queryByText("Draft manuscript")).not.toBeInTheDocument();

    const papers = document.getElementById("conference-papers-content")!;
    expect(within(papers).getByRole("link", { name: /Draft manuscript/ })).toHaveAttribute(
      "href",
      "/modules/paper-1",
    );
    expect(within(papers).getAllByRole("link")).toHaveLength(3);
    expect(within(papers).queryByText("Genome Project")).not.toBeInTheDocument();
  });

  it("hides and shows each panel on its own", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Hide papers" }));
    expect(document.getElementById("conference-papers-content")).toBeNull();
    expect(document.getElementById("conference-projects-content")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Show papers" }));
    expect(document.getElementById("conference-papers-content")).not.toBeNull();
  });

  it("lets the owner unlink one paper, keeping everything else", async () => {
    renderPage();

    fireEvent.click(
      screen.getByRole("button", { name: "Unlink Literature review from this conference" }),
    );

    await waitFor(() =>
      expect(fixtures.updateConference).toHaveBeenCalledWith({
        conferenceId: "conference-1",
        input: expect.objectContaining({
          name: "Conference 2027",
          notes: "Abstract due with the poster.",
          submissionType: "Poster",
          intents: ["Submitting"],
          projectIds: ["project-1", "project-2"],
          moduleIds: ["paper-1", "paper-3"],
        }),
      }),
    );
  });

  it("shows why an unlink failed", async () => {
    fixtures.updateConference = vi
      .fn()
      .mockRejectedValue(new Error("Clear its presentation details before unlinking it."));
    renderPage();

    fireEvent.click(
      screen.getByRole("button", { name: "Unlink Draft manuscript from this conference" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Clear its presentation details before unlinking it.",
    );
  });

  it("shows links without editing controls to people who don't own the conference", () => {
    fixtures.meId = "someone-else";
    renderPage();

    expect(screen.getByText("Projects (2)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Unlink / })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Link projects" })).not.toBeInTheDocument();
  });

  it("says when nothing is linked yet", () => {
    fixtures.conference = { ...conference, projects: [], papers: [] };
    renderPage();

    expect(screen.getByText("Projects (0)")).toBeInTheDocument();
    expect(screen.getByText("No projects are linked to this conference.")).toBeInTheDocument();
    expect(screen.getByText("No papers are linked to this conference.")).toBeInTheDocument();
  });
});
