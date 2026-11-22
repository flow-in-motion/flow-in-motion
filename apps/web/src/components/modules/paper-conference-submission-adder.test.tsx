import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PaperConferenceSubmissionAdder from "./paper-conference-submission-adder";
const fixture = vi.hoisted(() => ({
  options: [] as { id: string; name: string }[],
  records: {} as Record<string, unknown>,
  create: vi.fn(),
}));
vi.mock("@/api/hooks", () => ({
  usePresentationConferenceOptions: () => ({ data: fixture.options }),
  useConference: (_tenant: string, id: string) => ({
    data: fixture.records[id],
  }),
  useMe: () => ({ data: { id: "owner" } }),
  useCreateConference: () => ({ mutateAsync: fixture.create }),
}));
vi.mock("@/components/conferences/conference-submissions-panel", () => ({
  SubmissionFormDialog: ({
    fixedPaper,
    submission,
    conferenceId,
  }: {
    fixedPaper: { id: string };
    submission: { id: string } | null;
    conferenceId: string;
  }) => (
    <div role="dialog" aria-label="Submission details">
      {fixedPaper.id} · {conferenceId} · {submission?.id ?? "new"}
    </div>
  ),
}));
vi.mock("@/components/dashboard/conference-submission-dialog", () => ({
  ConferenceSubmissionDialog: ({
    onSave,
  }: {
    onSave: (input: unknown) => Promise<void>;
  }) => (
    <button
      onClick={() =>
        void onSave({ name: "New conference", moduleIds: [], projectIds: [] })
      }
    >
      Save new conference
    </button>
  ),
}));
function show() {
  render(
    <PaperConferenceSubmissionAdder
      tenantId="workspace"
      moduleId="paper-24"
      paperTitle="Current paper"
      onClose={vi.fn()}
    />,
  );
}
describe("adding a conference submission from a paper", () => {
  beforeEach(() => {
    fixture.options = Array.from({ length: 26 }, (_, i) => ({
      id: `conference-${i}`,
      name: `Conference ${i + 1}`,
    }));
    fixture.records = {
      "conference-25": {
        id: "conference-25",
        ownerUserId: "owner",
        submissionDue: null,
        submissions: [],
      },
    };
    vi.clearAllMocks();
  });
  it("finds a conference beyond the first 20 and pins the current paper", () => {
    show();
    fireEvent.change(
      screen.getByRole("textbox", { name: "Search your conferences" }),
      { target: { value: "Conference 26" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Conference 26" }));
    expect(
      screen.getByRole("dialog", { name: "Submission details" }),
    ).toHaveTextContent("paper-24 · conference-25 · new");
  });
  it("reuses an existing paper submission instead of adding a duplicate", () => {
    fixture.records["conference-25"] = {
      id: "conference-25",
      ownerUserId: "owner",
      submissionDue: null,
      submissions: [{ id: "existing", kind: "paper", moduleId: "paper-24" }],
    };
    show();
    fireEvent.click(screen.getByRole("button", { name: "Conference 26" }));
    expect(
      screen.getByRole("dialog", { name: "Submission details" }),
    ).toHaveTextContent("existing");
  });
  it("opens the existing creation form and continues with the newly created conference", async () => {
    fixture.create.mockImplementation(async () => {
      fixture.records.new = {
        id: "new",
        ownerUserId: "owner",
        submissionDue: null,
        submissions: [],
      };
      return { id: "new" };
    });
    show();
    fireEvent.click(
      screen.getByRole("button", { name: "Create conference / event" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Save new conference" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("dialog", { name: "Submission details" }),
      ).toHaveTextContent("paper-24 · new · new"),
    );
  });
});
