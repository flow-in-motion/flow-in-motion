import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PaperConferenceSubmissionEditor from "./paper-conference-submission-editor";
const fixtures = vi.hoisted(() => ({
  owner: "owner",
  save: vi.fn(),
  close: vi.fn(),
  conferenceRead: vi.fn(),
}));
vi.mock("@/api/hooks", async (original) => ({
  ...(await original<typeof import("@/api/hooks")>()),
  useMe: () => ({ data: { id: "owner" }, isPending: false }),
  useConference: (...args: unknown[]) => {
    fixtures.conferenceRead(...args);
    return {
      isPending: false,
      isError: false,
      data: {
        id: "conference",
        ownerUserId: fixtures.owner,
        submissionDue: "2027-01-10",
        submissions: [
          {
            id: "submission",
            kind: "paper",
            moduleId: "paper",
            titleAsSubmitted: "Submitted title",
            submissionType: "Full paper",
            status: "Planning",
            submissionDue: null,
            notes: "Original submission notes",
          },
        ],
      },
    };
  },
  useAddConferenceSubmission: () => ({ isPending: false }),
  useUpdateConferenceSubmission: () => ({
    isPending: false,
    mutateAsync: fixtures.save,
  }),
}));
describe("Conference edits from a paper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fixtures.owner = "owner";
    fixtures.save.mockResolvedValue({});
  });
  it("reuses the existing editor without converting an inherited deadline or losing notes", async () => {
    render(
      <PaperConferenceSubmissionEditor
        tenantId="tenant"
        moduleId="paper"
        conferenceId="conference"
        submissionId="submission"
        onClose={fixtures.close}
      />,
    );
    expect(fixtures.conferenceRead).toHaveBeenCalledWith(
      "tenant",
      "conference",
    );
    expect(screen.getByLabelText("Notes")).toHaveValue(
      "Original submission notes",
    );
    fireEvent.change(screen.getByLabelText("Notes"), {
      target: { value: "Edited notes" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() =>
      expect(fixtures.save).toHaveBeenCalledWith({
        conferenceId: "conference",
        submissionId: "submission",
        input: {
          title: "Submitted title",
          submissionType: "Full paper",
          status: "Planning",
          submissionDue: null,
          notes: "Edited notes",
        },
      }),
    );
    expect(fixtures.close).toHaveBeenCalledTimes(1);
  });
  it("does not expose the form for another owner's conference or a mismatched paper", () => {
    fixtures.owner = "someone-else";
    render(
      <PaperConferenceSubmissionEditor
        tenantId="tenant"
        moduleId="paper"
        conferenceId="conference"
        submissionId="submission"
        onClose={fixtures.close}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("no longer available");
    expect(
      screen.queryByRole("button", { name: "Save Changes" }),
    ).not.toBeInTheDocument();
    expect(fixtures.save).not.toHaveBeenCalled();
  });
  it("retains a failed edit and shows its save error", async () => {
    fixtures.save.mockRejectedValue(new Error("Access changed"));
    render(
      <PaperConferenceSubmissionEditor
        tenantId="tenant"
        moduleId="paper"
        conferenceId="conference"
        submissionId="submission"
        onClose={fixtures.close}
      />,
    );
    fireEvent.change(screen.getByLabelText("Notes"), {
      target: { value: "Keep this draft" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Access changed"),
    );
    expect(screen.getByLabelText("Notes")).toHaveValue("Keep this draft");
    expect(fixtures.close).not.toHaveBeenCalled();
  });
});
