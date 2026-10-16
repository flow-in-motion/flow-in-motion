import { describe, expect, it } from "vitest";

import {
  createEntryDocument,
  editEntryDocument,
  getEntryDocumentChanges,
} from "./entry-document";

const entries = [
  { id: "entry-1", content: "First observation" },
  { id: "entry-2", content: "Second observation" },
];

describe("entry document", () => {
  it("combines existing content without adding date headings", () => {
    const document = createEntryDocument(entries);

    expect(document.text).toBe(
      "First observation\n\nSecond observation",
    );
    expect(getEntryDocumentChanges(document)).toEqual({
      updates: [],
      deletions: [],
      addition: "",
    });
  });

  it("preserves existing entries when new content is appended", () => {
    const original = createEntryDocument(entries);
    const edited = editEntryDocument(
      original,
      `${original.text}\n\nNew observation`,
    );

    expect(getEntryDocumentChanges(edited)).toEqual({
      updates: [],
      deletions: [],
      addition: "New observation",
    });
  });

  it("recognizes additional content when Enter is pressed separately", () => {
    const original = createEntryDocument(entries);
  
    const firstEnter = editEntryDocument(
      original,
      `${original.text}\n`,
    );
    const secondEnter = editEntryDocument(
      firstEnter,
      `${original.text}\n\n`,
    );
    const typedContent = editEntryDocument(
      secondEnter,
      `${original.text}\n\nNew observation`,
    );
  
    expect(getEntryDocumentChanges(typedContent)).toEqual({
      updates: [],
      deletions: [],
      addition: "New observation",
    });
  });
  
  it("updates only the entry whose text changed", () => {
    const original = createEntryDocument(entries);
    const edited = editEntryDocument(
      original,
      "First observation\n\nCorrected observation",
    );

    expect(getEntryDocumentChanges(edited)).toEqual({
      updates: [
        {
          entryId: "entry-2",
          content: "Corrected observation",
        },
      ],
      deletions: [],
      addition: "",
    });
  });

  it("deletes an entry when its text is erased", () => {
    const original = createEntryDocument(entries);
    const edited = editEntryDocument(
      original,
      "Second observation",
    );

    expect(getEntryDocumentChanges(edited)).toEqual({
      updates: [],
      deletions: ["entry-1"],
      addition: "",
    });
  });

  it("supports clearing all content", () => {
    const original = createEntryDocument(entries);
    const edited = editEntryDocument(original, "");

    expect(getEntryDocumentChanges(edited)).toEqual({
      updates: [],
      deletions: ["entry-1", "entry-2"],
      addition: "",
    });
  });

  it("treats typing directly onto existing text as an edit", () => {
    const original = createEntryDocument([
      { id: "entry-1", content: "Observation" },
    ]);
    const edited = editEntryDocument(
      original,
      "Observation corrected",
    );

    expect(getEntryDocumentChanges(edited)).toEqual({
      updates: [
        {
          entryId: "entry-1",
          content: "Observation corrected",
        },
      ],
      deletions: [],
      addition: "",
    });
  });

  it("merges entries when the user removes their separating blank line", () => {
    const original = createEntryDocument(entries);
    const edited = editEntryDocument(
      original,
      "First observationSecond observation",
    );

    expect(getEntryDocumentChanges(edited)).toEqual({
      updates: [
        {
          entryId: "entry-1",
          content: "First observationSecond observation",
        },
      ],
      deletions: ["entry-2"],
      addition: "",
    });
  });

  it("keeps tracking edits while additional content is being typed", () => {
    const original = createEntryDocument(entries);
    const firstEdit = editEntryDocument(
      original,
      `${original.text}\n\nNew`,
    );
    const secondEdit = editEntryDocument(
      firstEdit,
      `${original.text}\n\nNew observation`,
    );

    expect(getEntryDocumentChanges(secondEdit)).toEqual({
      updates: [],
      deletions: [],
      addition: "New observation",
    });
  });
});