import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { SubmissionFormDialog } from "./conference-submissions-panel";
const fixture = vi.hoisted(() => ({ add: vi.fn(), update: vi.fn() }));
vi.mock("@/api/hooks", () => ({
  CONFERENCE_SUBMISSION_TYPES: ["Full paper", "Abstract"],
  CONFERENCE_SUBMISSION_STATUSES: ["Planning", "Submitted", "Presented"],
  useAddConferenceSubmission: () => ({
    mutateAsync: fixture.add,
    isPending: false,
  }),
  useUpdateConferenceSubmission: () => ({
    mutateAsync: fixture.update,
    isPending: false,
  }),
  useConferenceLinkOptions: () => ({ data: [], isFetching: false }),
}));
describe("paper-pinned conference submission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fixture.add.mockResolvedValue({});
  });
  it("keeps the current paper fixed and saves its optional presentation title using the existing submission API", async () => {
    const close = vi.fn();
    render(
      <SubmissionFormDialog
        open
        tenantId="workspace"
        conferenceId="conference"
        conferenceDue="2027-01-01"
        submission={null}
        fixedPaper={{
          id: "paper-24",
          kind: "paper",
          label: "Current paper",
          displayId: "P-24",
          projectId: null,
          projectTitle: null,
        }}
        onOpenChange={close}
      />,
    );
    expect(screen.getByText("Paper: Current paper")).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    const title = screen.getByRole("textbox", { name: "Presentation title" });
    expect(title).not.toBeRequired();
    fireEvent.change(title, {
      target: { value: "Conference-specific presentation title" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Submission" }));
    await waitFor(() =>
      expect(fixture.add).toHaveBeenCalledWith({
        conferenceId: "conference",
        input: expect.objectContaining({
          moduleId: "paper-24",
          title: "Conference-specific presentation title",
          submissionDue: null,
        }),
      }),
    );
    expect(fixture.add.mock.calls[0][0].input).not.toHaveProperty("projectId");
    expect(fixture.update).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledWith(false);
  });
  it("does not save when cancelled", () => {
    render(
      <SubmissionFormDialog
        open
        tenantId="workspace"
        conferenceId="conference"
        conferenceDue={null}
        submission={null}
        fixedPaper={{
          id: "paper",
          kind: "paper",
          label: "Paper",
          displayId: null,
          projectId: null,
          projectTitle: null,
        }}
        onOpenChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(fixture.add).not.toHaveBeenCalled();
    expect(fixture.update).not.toHaveBeenCalled();
  });
});
