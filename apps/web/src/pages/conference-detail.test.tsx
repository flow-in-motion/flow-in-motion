import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiConference, ApiConferenceLinkOption } from "@/api/hooks";
import ConferenceDetailPage from "@/pages/conference-detail";

const fixtures = vi.hoisted(() => ({
  conference: null as ApiConference | null,
  meId: "user-1",
  linkOptions: [] as ApiConferenceLinkOption[],
  updateConference: vi.fn(),
  addSubmission: vi.fn(),
  updateSubmission: vi.fn(),
  removeSubmission: vi.fn(),
}));

vi.mock("@/api/hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/hooks")>();
  const mutation = (fn: () => unknown) => ({ mutateAsync: fn, isPending: false });
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
    useUpdateConference: () => mutation(fixtures.updateConference),
    useDeleteConference: () => mutation(vi.fn()),
    useAddConferenceSubmission: () => mutation(fixtures.addSubmission),
    useUpdateConferenceSubmission: () => mutation(fixtures.updateSubmission),
    useRemoveConferenceSubmission: () => mutation(fixtures.removeSubmission),
    useConferenceLinkOptions: () => ({ data: fixtures.linkOptions, isFetching: false }),
  };
});

// Radix dropdowns call these browser features, which jsdom doesn't have.
beforeAll(() => {
  Element.prototype.scrollIntoView ??= vi.fn();
  Element.prototype.hasPointerCapture ??= vi.fn(() => false);
  Element.prototype.releasePointerCapture ??= vi.fn();
});

const conference: ApiConference = {
  id: "conference-1",
  tenantId: "tenant-1",
  ownerUserId: "user-1",
  acronym: "AOM",
  name: "Academy of Management 2027",
  location: "Boston",
  notes: "Abstract due with the poster.",
  submissionDue: "2027-01-10",
  startDate: null,
  endDate: null,
  submissionType: null,
  intents: ["Submitting"],
  daysRemaining: null,
  projects: [
    { id: "project-1", displayId: "PRJ-001", title: "Genome Project" },
    { id: "project-2", displayId: "PRJ-002", title: "Ocean Project" },
  ],
  papers: [],
  submissions: [
    {
      id: "submission-paper",
      kind: "paper",
      moduleId: "paper-1",
      projectId: null,
      displayId: "MOD-001",
      name: "Draft manuscript",
      titleAsSubmitted: null,
      submissionType: "Full paper",
      status: "Submitted",
      submissionDue: null,
      presentedDate: null,
      notes: null,
    },
    {
      id: "submission-project",
      kind: "project",
      moduleId: null,
      projectId: "project-2",
      displayId: "PRJ-002",
      name: "Ocean Project",
      titleAsSubmitted: "Oceans symposium",
      submissionType: "Symposium / Panel",
      status: "Planning",
      submissionDue: null,
      presentedDate: null,
      notes: null,
    },
    {
      id: "submission-pdw",
      kind: "other",
      moduleId: null,
      projectId: null,
      displayId: null,
      name: "PDW: Qualitative methods",
      titleAsSubmitted: "PDW: Qualitative methods",
      submissionType: "PDW",
      status: "Accepted",
      submissionDue: "2027-01-15",
      presentedDate: null,
      notes: null,
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

function submissionRow(name: string) {
  const list = screen.getByRole("list", { name: "Submissions" });
  return within(list).getAllByRole("listitem").find((item) => item.textContent?.includes(name))!;
}

function chooseFromSelect(label: RegExp | string, option: string) {
  fireEvent.keyDown(screen.getByRole("combobox", { name: label }), { key: "Enter" });
  fireEvent.click(screen.getByRole("option", { name: option }));
}

describe("ConferenceDetailPage", () => {
  beforeEach(() => {
    fixtures.conference = conference;
    fixtures.meId = "user-1";
    fixtures.linkOptions = [];
    fixtures.updateConference = vi.fn().mockResolvedValue(conference);
    fixtures.addSubmission = vi.fn().mockResolvedValue(conference);
    fixtures.updateSubmission = vi.fn().mockResolvedValue(conference);
    fixtures.removeSubmission = vi.fn().mockResolvedValue(conference);
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows linked projects and submissions in separate panels", () => {
    renderPage();

    expect(screen.getByText("Projects (2)")).toBeInTheDocument();
    expect(screen.getByText("Submissions (3)")).toBeInTheDocument();

    const projects = document.getElementById("conference-projects-content")!;
    expect(within(projects).getByRole("link", { name: /Genome Project/ })).toHaveAttribute(
      "href",
      "/projects/project-1",
    );

    const paper = submissionRow("Draft manuscript");
    expect(within(paper).getByRole("link")).toHaveAttribute("href", "/modules/paper-1");
    expect(paper).toHaveTextContent("Paper · Full paper · Due");
    expect(paper).toHaveTextContent("Status: Submitted");

    const project = submissionRow("Ocean Project");
    expect(within(project).getByRole("link")).toHaveAttribute("href", "/projects/project-2");
    expect(project).toHaveTextContent("Submitted as “Oceans symposium”");

    // A typed submission has nowhere to link to.
    const pdw = submissionRow("PDW: Qualitative methods");
    expect(within(pdw).queryByRole("link")).not.toBeInTheDocument();
    expect(pdw).toHaveTextContent("Other · PDW · Due");
    expect(pdw).toHaveTextContent("Status: Accepted");
  });

  it("hides and shows each panel on its own", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Hide submissions" }));
    expect(document.getElementById("conference-submissions-content")).toBeNull();
    expect(document.getElementById("conference-projects-content")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Show submissions" }));
    expect(document.getElementById("conference-submissions-content")).not.toBeNull();
  });

  it("lets the owner list a submission that isn't in the app, such as a PDW", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Add submission" }));
    const dialog = within(await screen.findByRole("dialog"));
    fireEvent.click(dialog.getByRole("radio", { name: "Something else" }));
    fireEvent.change(dialog.getByRole("textbox", { name: /Title/ }), {
      target: { value: "PDW: Writing for top journals" },
    });
    chooseFromSelect("Type", "PDW");
    fireEvent.click(dialog.getByRole("button", { name: "Add Submission" }));

    await waitFor(() =>
      expect(fixtures.addSubmission).toHaveBeenCalledWith({
        conferenceId: "conference-1",
        input: {
          title: "PDW: Writing for top journals",
          submissionType: "PDW",
          status: null,
          submissionDue: null,
          notes: null,
        },
      }),
    );
  });

  it("lets the owner add a paper by searching for it", async () => {
    fixtures.linkOptions = [
      {
        kind: "paper",
        id: "paper-2",
        projectId: null,
        displayId: "MOD-002",
        label: "Second draft",
        projectTitle: null,
      },
      {
        kind: "project",
        id: "project-1",
        projectId: "project-1",
        displayId: "PRJ-001",
        label: "Genome Project",
        projectTitle: "Genome Project",
      },
    ];
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Add submission" }));
    const dialog = within(await screen.findByRole("dialog"));
    // Papers are offered, projects are not.
    expect(dialog.queryByRole("option", { name: /Genome Project/ })).not.toBeInTheDocument();
    fireEvent.click(dialog.getByRole("option", { name: /Second draft/ }));
    expect(dialog.getByRole("button", { name: "Change" })).toBeInTheDocument();
    fireEvent.click(dialog.getByRole("button", { name: "Add Submission" }));

    await waitFor(() =>
      expect(fixtures.addSubmission).toHaveBeenCalledWith({
        conferenceId: "conference-1",
        input: expect.objectContaining({ moduleId: "paper-2", title: null }),
      }),
    );
  });

  it("asks for a title when the submission isn't a paper or project", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Add submission" }));
    const dialog = within(await screen.findByRole("dialog"));
    fireEvent.click(dialog.getByRole("radio", { name: "Something else" }));
    fireEvent.click(dialog.getByRole("button", { name: "Add Submission" }));

    expect(await dialog.findByRole("alert")).toHaveTextContent("Give the submission a title.");
    expect(fixtures.addSubmission).not.toHaveBeenCalled();
  });

  it("lets the owner update a submission's status", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Edit submission Draft manuscript" }));
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByText("Paper: Draft manuscript")).toBeInTheDocument();
    chooseFromSelect("Status", "Accepted");
    fireEvent.click(dialog.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(fixtures.updateSubmission).toHaveBeenCalledWith({
        conferenceId: "conference-1",
        submissionId: "submission-paper",
        input: expect.objectContaining({ status: "Accepted", submissionType: "Full paper" }),
      }),
    );
  });

  it("explains why a submission couldn't be removed", async () => {
    fixtures.removeSubmission = vi
      .fn()
      .mockRejectedValue(new Error("This paper has a presentation recorded for this conference."));
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Remove submission Draft manuscript" }));

    await waitFor(() =>
      expect(fixtures.removeSubmission).toHaveBeenCalledWith({
        conferenceId: "conference-1",
        submissionId: "submission-paper",
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This paper has a presentation recorded for this conference.",
    );
  });

  it("lets the owner unlink one project, keeping everything else", async () => {
    renderPage();

    fireEvent.click(
      screen.getByRole("button", { name: "Unlink Ocean Project from this conference" }),
    );

    await waitFor(() =>
      expect(fixtures.updateConference).toHaveBeenCalledWith({
        conferenceId: "conference-1",
        input: expect.objectContaining({
          name: "Academy of Management 2027",
          notes: "Abstract due with the poster.",
          projectIds: ["project-1"],
          moduleIds: [],
        }),
      }),
    );
  });

  it("shows everything without editing controls to people who don't own the conference", () => {
    fixtures.meId = "someone-else";
    renderPage();

    expect(screen.getByText("Submissions (3)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add submission" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Edit submission / })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Remove submission / })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Unlink / })).not.toBeInTheDocument();
  });

  it("describes a journal special issue as one", () => {
    fixtures.conference = {
      ...conference,
      eventType: "Journal special issue",
      acronym: null,
      name: "Special issue on AI in accounting",
      location: "Accounting, Organizations and Society",
      startDate: "2027-05-01",
      endDate: "2027-05-02",
    };
    renderPage();

    expect(screen.getAllByText("Journal special issue").length).toBeGreaterThan(0);
    expect(screen.getByText("Journal")).toBeInTheDocument();
    expect(screen.queryByText("Starts")).not.toBeInTheDocument();
    expect(screen.queryByText("Ends")).not.toBeInTheDocument();
  });

  it("says when there is nothing yet", () => {
    fixtures.conference = { ...conference, projects: [], papers: [], submissions: [] };
    renderPage();

    expect(screen.getByText("Projects (0)")).toBeInTheDocument();
    expect(screen.getByText("No projects are linked to this conference.")).toBeInTheDocument();
    expect(screen.getByText(/No submissions yet\./)).toBeInTheDocument();
  });
});
