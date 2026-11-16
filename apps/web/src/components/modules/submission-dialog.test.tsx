import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SubmissionDialog } from "./submission-dialog";

describe("journal publisher in submissions", () => {
  it("prefills the matching target publisher and allows it to be changed or left blank", async () => {
    const save = vi.fn();
    render(
      <SubmissionDialog
        open
        onOpenChange={vi.fn()}
        onSave={save}
        forStageChange
        journalPublishers={[
          { journalName: "Nature", publisher: "Springer Nature" },
        ]}
      />,
    );
    fireEvent.change(screen.getByLabelText(/Journal \/ venue/), {
      target: { value: "Nature" },
    });
    const publisher = screen.getByLabelText("Journal publisher (optional)");
    expect(publisher).toHaveValue("Springer Nature");
    expect(publisher).not.toBeRequired();
    fireEvent.change(publisher, { target: { value: "" } });
    fireEvent.submit(publisher.closest("form")!);
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          journalName: "Nature",
          journalPublisher: "",
          status: "Submitted",
        }),
      ),
    );
  });

  it("does not carry a publisher to a different journal", () => {
    render(
      <SubmissionDialog
        open
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        forStageChange
        journalPublishers={[
          { journalName: "Nature", publisher: "Springer Nature" },
        ]}
      />,
    );
    fireEvent.change(screen.getByLabelText(/Journal \/ venue/), {
      target: { value: "Nature" },
    });
    expect(screen.getByLabelText("Journal publisher (optional)")).toHaveValue(
      "Springer Nature",
    );
    fireEvent.change(screen.getByLabelText(/Journal \/ venue/), {
      target: { value: "Different journal" },
    });
    expect(screen.getByLabelText("Journal publisher (optional)")).toHaveValue(
      "",
    );
  });
});
