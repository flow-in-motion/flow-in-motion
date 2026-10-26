import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const mockUseCurrentWorkspace = vi.fn();
const mockUseAnalyticsSummary = vi.fn();

vi.mock("@/api/hooks", () => ({
  useCurrentWorkspace: () => mockUseCurrentWorkspace(),
  useAnalyticsSummary: () => mockUseAnalyticsSummary(),
}));

import UsagePage from "@/pages/usage";

describe("UsagePage", () => {
  it("tells non-owners that usage is owner-only", () => {
    mockUseCurrentWorkspace.mockReturnValue({
      data: { id: "tenant-1", membershipRole: "limited_member" },
      isPending: false,
    });
    mockUseAnalyticsSummary.mockReturnValue({
      isPending: false,
      isError: false,
    });

    render(
      <MemoryRouter>
        <UsagePage />
      </MemoryRouter>,
    );

    expect(
      screen.getByText("Only the workspace owner can view usage analytics."),
    ).toBeInTheDocument();
  });

  it("shows the summary for the workspace owner", () => {
    mockUseCurrentWorkspace.mockReturnValue({
      data: { id: "tenant-1", membershipRole: "owner" },
      isPending: false,
    });
    mockUseAnalyticsSummary.mockReturnValue({
      isPending: false,
      isError: false,
      data: {
        windowDays: 30,
        headlines: {
          papersMoved: { current: 3, previous: 1 },
          stageChanges: { current: 8, previous: 2 },
          submissionsLogged: { current: 2, previous: 0 },
          accepted: { current: 1, previous: 0 },
          rejected: { current: 0, previous: 1 },
          revisionRequests: { current: 1, previous: 0 },
          tasksCompleted: { current: 4, previous: 2 },
          activeMembers: { current: 2, previous: 1 },
        },
        stageChangesByStage: [
          { stage: "Concept, Ideation", changes: 3 },
          { stage: "Drafting & Writing", changes: 5 },
          { stage: "Published", changes: 0 },
        ],
        stageMovements: [
          {
            fromStage: "Concept, Ideation",
            toStage: "Drafting & Writing",
            papers: 3,
          },
        ],
        pipelineNow: [
          { stage: "Concept, Ideation", papers: 2, medianDays: 12 },
          { stage: "Drafting & Writing", papers: 3, medianDays: 8 },
        ],
        paperStatuses: [
          { status: "Active", papers: 4 },
          { status: "Stalled", papers: 1 },
        ],
        submissions: {
          logged: 2,
          accepted: 1,
          rejected: 0,
          withdrawn: 0,
          acceptanceRate: 100,
          medianDecisionDays: 21,
          awaitingDecision: 1,
          oldestAwaitingDays: 9,
          journals: [
            { journal: "Nature", submissions: 2, accepted: 1, rejected: 0 },
          ],
        },
        currentlyWith: [
          { holder: "me", papers: 3 },
          { holder: "collaborator", papers: 2 },
        ],
        work: {
          tasksCreated: 6,
          tasksCompleted: 4,
          overdueTasks: 1,
          estimatedOpenHours: 12,
          medianTaskCompletionDays: 5,
          fundingByStatus: [{ status: "Preparing", applications: 2 }],
          awardedByCurrency: [{ currency: "AUD", amount: 150000 }],
          fundingDeadlines: 1,
          conferencesAdded: 2,
          conferencePaperLinks: 3,
          conferenceDeadlines: 1,
        },
        team: {
          registeredMembers: 2,
          dailyActivity: [
            { day: "2026-01-01", activeMembers: 2, pageVisits: 12 },
          ],
          pages: [
            { page: "pipeline", visits: 7, members: 2, adoptionPercent: 100 },
          ],
          members: [
            {
              userId: "user-1",
              name: "Research Owner",
              email: "owner@example.com",
              sessions: 3,
              pageVisits: 9,
              projectsAdded: 1,
              papersAdded: 1,
              tasksAdded: 2,
              notesAdded: 1,
              lastActive: "2026-01-02T00:00:00.000Z",
            },
          ],
        },
      },

    });

    render(
      <MemoryRouter>
        <UsagePage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Progress overview")).toBeInTheDocument();
    expect(screen.getByText("Paper pipeline")).toBeInTheDocument();
    expect(screen.getByText("Submissions and decisions")).toBeInTheDocument();
    expect(screen.getByText("Waiting and upcoming work")).toBeInTheDocument();
    expect(screen.getByText("Team activity")).toBeInTheDocument();
    expect(screen.getByText("Nature")).toBeInTheDocument();
    expect(screen.getByText("Research Owner")).toBeInTheDocument();
    expect(screen.queryByText("Events by type")).not.toBeInTheDocument();
    expect(screen.queryByText("page_view")).not.toBeInTheDocument();
    expect(screen.getByText("Stage changes")).toBeInTheDocument();
    expect(screen.getByText("8", { exact: true })).toBeInTheDocument();

    const stageTable = screen.getByRole("table", {
      name: "Stage changes by destination",
    });

    expect(
      within(stageTable).getByRole("row", {
        name: "Concept, Ideation 3",
      }),
    ).toBeInTheDocument();

    expect(
      within(stageTable).getByRole("row", {
        name: "Drafting & Writing 5",
      }),
    ).toBeInTheDocument();

    expect(
      within(stageTable).getByRole("row", {
        name: "Published 0",
      }),
    ).toBeInTheDocument();
  });

  it("explains when progress history has not accumulated yet", () => {
    mockUseCurrentWorkspace.mockReturnValue({
      data: { id: "tenant-1", membershipRole: "owner" },
      isPending: false,
    });
    mockUseAnalyticsSummary.mockReturnValue({
      isPending: false,
      isError: false,
      data: {
        windowDays: 7,
        headlines: {
          papersMoved: { current: 0, previous: 0 },
          stageChanges: { current: 0, previous: 0 },
          submissionsLogged: { current: 0, previous: 0 },
          accepted: { current: 0, previous: 0 },
          rejected: { current: 0, previous: 0 },
          revisionRequests: { current: 0, previous: 0 },
          tasksCompleted: { current: 0, previous: 0 },
          activeMembers: { current: 0, previous: 0 },
        },
        stageChangesByStage: [],
        stageMovements: [],
        pipelineNow: [],
        paperStatuses: [],
        submissions: {
          logged: 0,
          accepted: 0,
          rejected: 0,
          withdrawn: 0,
          acceptanceRate: null,
          medianDecisionDays: null,
          awaitingDecision: 0,
          oldestAwaitingDays: null,
          journals: [],
        },
        currentlyWith: [],
        work: {
          tasksCreated: 0,
          tasksCompleted: 0,
          overdueTasks: 0,
          estimatedOpenHours: 0,
          medianTaskCompletionDays: null,
          fundingByStatus: [],
          awardedByCurrency: [],
          fundingDeadlines: 0,
          conferencesAdded: 0,
          conferencePaperLinks: 0,
          conferenceDeadlines: 0,
        },
        team: {
          registeredMembers: 0,
          dailyActivity: [],
          pages: [],
          members: [],
        },
      },
    });

    render(
      <MemoryRouter>
        <UsagePage />
      </MemoryRouter>,
    );

    expect(
      screen.getByText("No stage movements have been recorded in this period."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Progress history begins when this release is deployed/),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No stage changes have been recorded in this period."),
    ).toBeInTheDocument();
  });
});
