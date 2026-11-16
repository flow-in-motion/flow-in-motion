import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import {
  JournalPublisherFields,
  PaperReferenceFields,
} from "./paper-reference-fields";
import {
  type PaperReferenceForm,
  safePaperUrl,
  savedJournalPublishers,
} from "@/lib/paper-references";

describe("optional paper references", () => {
  function Form() {
    const [value, setValue] = useState<PaperReferenceForm>({
      workingDate: "",
      plannedHours: "",
      manuscriptUrl: "",
      dataUrl: "",
      otherFilesUrl: "",
      journalPublishers: [],
    });
    return (
      <>
        <PaperReferenceFields
          id="paper"
          value={value}
          onChange={(patch) => setValue({ ...value, ...patch })}
        />
        <output>{JSON.stringify(value)}</output>
      </>
    );
  }

  it("edits work planning and all three URLs independently, without making them required", () => {
    render(<Form />);
    for (const [label, value] of [
      ["Working date", "2027-01-12"],
      ["Planned duration", "1.5"],
      ["Manuscript URL", "https://example.org/manuscript"],
      ["Data URL", "https://example.org/data"],
      ["Other files URL", "https://example.org/files"],
    ]) {
      const field = screen.getByLabelText(new RegExp(label!));
      expect(field).not.toBeRequired();
      fireEvent.change(field, { target: { value } });
    }
    expect(screen.getByRole("status")).toHaveTextContent(
      '"plannedHours":"1.5"',
    );
    fireEvent.change(screen.getByLabelText(/Working date/), {
      target: { value: "" },
    });
    expect(screen.getByLabelText(/Planned duration/)).toHaveValue(1.5);
  });

  it("keeps publishers attached to individual names in multi-journal target/backup lists", () => {
    function Publishers() {
      const [value, setValue] = useState<
        PaperReferenceForm["journalPublishers"]
      >([]);
      return (
        <JournalPublisherFields
          id="publisher"
          target="Nature; Accounting, Organizations and Society"
          backup="nature; PLOS ONE"
          value={value}
          onChange={setValue}
        />
      );
    }
    render(<Publishers />);
    expect(screen.getAllByRole("textbox")).toHaveLength(3);
    fireEvent.change(screen.getByLabelText(/Publisher for Nature /), {
      target: { value: "Springer Nature" },
    });
    expect(screen.getByLabelText(/Publisher for PLOS ONE/)).toHaveValue("");
    expect(screen.getByLabelText(/Publisher for Nature /)).toHaveValue(
      "Springer Nature",
    );
  });

  it("drops blank publishers and removes orphan entries when journal targets are removed", () => {
    expect(
      savedJournalPublishers(
        [
          { journalName: "Nature", publisher: " Springer Nature " },
          { journalName: "Removed journal", publisher: "Old publisher" },
          { journalName: "PLOS ONE", publisher: " " },
        ],
        "NATURE",
        "Nature; PLOS ONE",
      ),
    ).toEqual([{ journalName: "NATURE", publisher: "Springer Nature" }]);
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,x",
    "file:///paper",
    "https://user:password@example.org",
    "invalid",
    null,
    undefined,
  ])("does not render an unsafe stored URL: %s", (url) => {
    expect(safePaperUrl(url)).toBeNull();
  });

  it("preserves URL queries and fragments for shared manuscripts and datasets", () => {
    const url = "https://example.org/paper?share=abc#draft";
    expect(safePaperUrl(url)).toBe(url);
  });
});
