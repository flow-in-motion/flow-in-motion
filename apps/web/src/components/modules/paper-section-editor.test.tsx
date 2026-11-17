import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiModule } from "@/api/hooks";
import PaperSectionEditor from "./paper-section-editor";
const fixtures = vi.hoisted(() => ({
  venues: vi.fn(),
  save: vi.fn(),
  close: vi.fn(),
}));
vi.mock("@/api/hooks", () => ({
  usePaperVenueSuggestions: (...args: unknown[]) => {
    fixtures.venues(...args);
    return {
      data: { journals: ["Known Journal"], conferences: ["Known Conference"] },
    };
  },
}));
const paper = {
  id: "paper",
  tenantId: "tenant",
  title: "Formal title",
  shortTitle: "Short",
  description: "Description",
  abstract: "Original abstract",
  targetJournal: "Journal",
  backupJournal: "",
  targetConference: "Conference",
  backupConference: "",
  workingDate: "2027-01-10",
  plannedHours: "1.5",
  manuscriptUrl: "https://example.org/paper",
  dataUrl: null,
  otherFilesUrl: null,
  journalPublishers: [{ journalName: "Journal", publisher: "Publisher" }],
} as unknown as ApiModule;
beforeEach(() => {
  vi.clearAllMocks();
  fixtures.save.mockResolvedValue({});
});
describe("Paper section edits", () => {
  it("saves only the abstract and can clear it", async () => {
    render(
      <PaperSectionEditor
        paper={paper}
        tenantId="tenant"
        section="abstract"
        onSave={fixtures.save}
        onClose={fixtures.close}
      />,
    );
    fireEvent.change(screen.getByLabelText("Abstract"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(fixtures.save).toHaveBeenCalledWith({ abstract: "" }),
    );
    expect(fixtures.close).toHaveBeenCalledTimes(1);
    expect(fixtures.venues).toHaveBeenCalledWith("tenant", false);
  });
  it("preserves typed text and the open editor after a failed save", async () => {
    fixtures.save.mockRejectedValue(new Error("Save failed"));
    render(
      <PaperSectionEditor
        paper={paper}
        tenantId="tenant"
        section="abstract"
        onSave={fixtures.save}
        onClose={fixtures.close}
      />,
    );
    fireEvent.change(screen.getByLabelText("Abstract"), {
      target: { value: "Keep my draft" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Save failed"),
    );
    expect(screen.getByLabelText("Abstract")).toHaveValue("Keep my draft");
    expect(fixtures.close).not.toHaveBeenCalled();
  });
  it("updates working dates and links without overwriting journal publishers or other metadata", async () => {
    render(
      <PaperSectionEditor
        paper={paper}
        tenantId="tenant"
        section="references"
        onSave={fixtures.save}
        onClose={fixtures.close}
      />,
    );
    fireEvent.change(screen.getByLabelText("Working date (optional)"), {
      target: { value: "2027-02-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(fixtures.save).toHaveBeenCalledWith({
        workingDate: "2027-02-01",
        plannedHours: 1.5,
        manuscriptUrl: "https://example.org/paper",
        dataUrl: null,
        otherFilesUrl: null,
      }),
    );
  });
  it("updates paper titles and description without sending its status or associations", async () => {
    render(
      <PaperSectionEditor
        paper={paper}
        tenantId="tenant"
        section="details"
        onSave={fixtures.save}
        onClose={fixtures.close}
      />,
    );
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Changed description" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(fixtures.save).toHaveBeenCalledWith({
        title: "Formal title",
        shortTitle: "Short",
        description: "Changed description",
      }),
    );
  });
  it("saves venue targets and their publishers only, and fetches venue suggestions only for that editor", async () => {
    render(
      <PaperSectionEditor
        paper={paper}
        tenantId="tenant"
        section="publishing"
        onSave={fixtures.save}
        onClose={fixtures.close}
      />,
    );
    expect(fixtures.venues).toHaveBeenCalledWith("tenant", true);
    fireEvent.change(
      screen.getByLabelText("Publisher for Journal (optional)"),
      { target: { value: "Updated publisher" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(fixtures.save).toHaveBeenCalledWith({
        targetJournal: "Journal",
        backupJournal: "",
        targetConference: "Conference",
        backupConference: "",
        journalPublishers: [
          { journalName: "Journal", publisher: "Updated publisher" },
        ],
      }),
    );
  });
});
