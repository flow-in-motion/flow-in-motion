import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiConferencePresentationHistory } from "@/api/hooks";
import { PaperConferenceSubmissions } from "@/components/modules/paper-conference-submissions";

const fixtures = vi.hoisted(() => ({
  history: undefined as ApiConferencePresentationHistory | undefined,
}));

vi.mock("@/api/hooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/hooks")>()),
  useModuleConferencePresentations: () => ({
    data: fixtures.history,
    isPending: false,
  }),
}));

function renderCard() {
  render(
    <MemoryRouter>
      <PaperConferenceSubmissions tenantId="tenant-1" moduleId="paper-1" />
    </MemoryRouter>,
  );
}

describe("PaperConferenceSubmissions", () => {
  beforeEach(() => {
    fixtures.history = { canLogPresentation: true, data: [], submissions: [] };
  });

  it("lists the conferences this paper was submitted to, with type and status", () => {
    fixtures.history!.submissions = [
      {
        id: "submission-1",
        conferenceId: "conference-1",
        conferenceName: "Academy of Management 2027",
        acronym: "AOM",
        submissionType: "Full paper",
        status: "Accepted",
        submissionDue: "2027-01-10",
        presentedDate: null,
      },
      {
        id: "submission-2",
        conferenceId: "conference-2",
        conferenceName: "Research seminar",
        acronym: null,
        submissionType: null,
        status: null,
        submissionDue: null,
        presentedDate: "2026-10-01",
      },
    ];
    renderCard();

    const card = within(screen.getByRole("region", { name: "Conference submissions" }));
    expect(card.getByText("Conference submissions (2)")).toBeInTheDocument();

    const aom = card.getByRole("link", { name: /AOM · Academy of Management 2027/ });
    expect(aom).toHaveAttribute("href", "/conferences/conference-1");
    expect(aom).toHaveTextContent("Full paper · Due");
    expect(card.getByText("Accepted")).toHaveClass("text-emerald-700");

    expect(card.getByRole("link", { name: /Research seminar/ })).toHaveTextContent("Presented");
  });

  it("points to the conference pages when there is nothing yet", () => {
    renderCard();

    expect(screen.getByText("Conference submissions (0)")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Conferences/Events" })).toHaveAttribute(
      "href",
      "/conferences",
    );
  });
});
