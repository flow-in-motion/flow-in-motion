import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ReviewsExaminationsPage from "./reviews-examinations";

const fixture = vi.hoisted(() => ({
  list: vi.fn(),
  detail: vi.fn(),
  save: vi.fn(),
  remove: vi.fn(),
  note: vi.fn(),
  noteSave: vi.fn(),
  record: {
    id: "exam",
    kind: "examination",
    studentName: "Sample Student",
    studentNumber: "001234",
    supervisorName1: "Supervisor One",
    supervisorName2: "Supervisor Two",
    universityName: "Sample University",
    school: "Business School",
    country: "Australia",
    thesisTitle: "Sample thesis",
    degreeType: "PhD",
    fee: "AUD 500",
    abstract: "Thesis abstract",
    requestedOn: "2026-11-09",
    dueOn: "2027-02-01",
    journalName: null,
    manuscriptReference: null,
    manuscriptTitle: null,
    journalRanking: null,
    notes: [
      {
        id: "note-1",
        content: "Existing examination note",
        createdAt: "2026-11-09T10:00:00Z",
        updatedAt: "2026-11-09T10:00:00Z",
      },
    ],
  },
}));
vi.mock("@/api/hooks", () => ({
  useMe: () => ({ data: { id: "user" } }),
  useCurrentWorkspace: () => ({ data: { id: "workspace" } }),
}));
vi.mock("@/api/reviews", () => ({
  useReviews: (...args: unknown[]) => {
    fixture.list(...args);
    const kind = args[1];
    return {
      data: {
        data: [
          {
            ...fixture.record,
            ...(kind === "journal"
              ? {
                  id: "journal",
                  kind,
                  studentName: null,
                  manuscriptTitle: "Sample Manuscript",
                  journalName: "Sample Journal",
                  manuscriptReference: "REF-123",
                  journalRanking: "Q1",
                  notes: [],
                }
              : {}),
          },
        ],
        meta: { page: 1, pageSize: 20, totalItems: 24, totalPages: 2 },
      },
      isPending: false,
      isFetching: false,
      isError: false,
    };
  },
  useReview: (...args: unknown[]) => {
    fixture.detail(...args);
    const kind = args[1];
    return {
      data: args[2]
        ? {
            ...fixture.record,
            ...(kind === "journal"
              ? {
                  id: "journal",
                  kind,
                  studentName: null,
                  manuscriptTitle: "Sample Manuscript",
                  journalName: "Sample Journal",
                  manuscriptReference: "REF-123",
                  journalRanking: "Q1",
                  abstract: null,
                  notes: [],
                }
              : {}),
          }
        : undefined,
      isPending: false,
      isError: false,
    };
  },
  useSaveReview: () => ({ mutateAsync: fixture.save, isPending: false }),
  useDeleteReview: () => ({ mutateAsync: fixture.remove, isPending: false }),
  useReviewNoteMutation: (...args: unknown[]) => {
    fixture.note(...args);
    return { mutateAsync: fixture.noteSave, isPending: false };
  },
}));
// Separate mock keeps the hook scope assertions distinct from note mutation calls.
const noteSave = fixture.noteSave;

describe("Reviews and HDR examinations page", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
    fixture.save.mockResolvedValue({ id: "saved" });
    fixture.remove.mockResolvedValue({});
    noteSave.mockResolvedValue({});
  });
  it("shows two independently labelled tables and addition controls, with no HDR students controls", () => {
    render(<ReviewsExaminationsPage />);
    expect(
      screen.getByRole("table", { name: "HDR examinations" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Reviews" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add examination" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add review" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Current students")).not.toBeInTheDocument();
    expect(fixture.detail).not.toHaveBeenCalled();
  });
  it("provides every examination field, accepts name-only creation and keeps IDs as text", async () => {
    render(<ReviewsExaminationsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Add examination" }));
    const dialog = within(screen.getByRole("dialog"));
    for (const label of [
      "Student ID number",
      "Supervisor name 1",
      "Supervisor name 2",
      "University name",
      "School/Business Unit",
      "Country",
      "Title of thesis",
      "Degree type",
      "Date request received",
      "Due date for review",
      "Fee",
      "Abstract",
      "Notes",
    ])
      expect(dialog.getByLabelText(label)).toBeInTheDocument();
    expect(dialog.queryByLabelText("Journal name")).not.toBeInTheDocument();
    expect(dialog.getByLabelText("Student ID number")).toHaveAttribute(
      "type",
      "text",
    );
    fireEvent.change(dialog.getByLabelText(/Student name/), {
      target: { value: "New Student" },
    });
    fireEvent.click(dialog.getByRole("button", { name: "Add examination" }));
    await waitFor(() =>
      expect(fixture.save).toHaveBeenCalledWith({
        id: undefined,
        input: expect.objectContaining({
          studentName: "New Student",
          degreeType: null,
          dueOn: null,
          initialNote: null,
        }),
      }),
    );
    const input = fixture.save.mock.calls[0][0].input;
    expect(input).not.toHaveProperty("journalName");
    expect(input).not.toHaveProperty("projectIds");
  });
  it("uses a separate journal form with only manuscript title required", async () => {
    render(<ReviewsExaminationsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Add review" }));
    const dialog = within(screen.getByRole("dialog"));
    for (const label of [
      "Journal name",
      "Manuscript reference",
      "Date request received",
      "Due date",
      "Journal ranking",
      "Notes",
    ])
      expect(dialog.getByLabelText(label)).toBeInTheDocument();
    expect(
      dialog.queryByLabelText("Student ID number"),
    ).not.toBeInTheDocument();
    fireEvent.change(dialog.getByLabelText(/Manuscript title/), {
      target: { value: "New Manuscript" },
    });
    fireEvent.click(dialog.getByRole("button", { name: "Add review" }));
    await waitFor(() =>
      expect(fixture.save).toHaveBeenCalledWith({
        id: undefined,
        input: {
          manuscriptTitle: "New Manuscript",
          journalName: null,
          manuscriptReference: null,
          requestedOn: null,
          dueOn: null,
          journalRanking: null,
          initialNote: null,
        },
      }),
    );
  });
  it("opens full details and notes from the student name and preserves fields on editing", async () => {
    render(<ReviewsExaminationsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Sample Student" }));
    expect(fixture.detail).toHaveBeenLastCalledWith(
      "workspace",
      "examination",
      "exam",
    );
    expect(screen.getByText("001234")).toBeInTheDocument();
    expect(screen.getByText("Thesis abstract")).toBeInTheDocument();
    expect(screen.getByText("Existing examination note")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit examination" }));
    expect(screen.getByLabelText("Fee")).toHaveValue("AUD 500");
    expect(screen.getByLabelText("Due date for review")).toHaveValue(
      "2027-02-01",
    );
    fireEvent.change(screen.getByLabelText("Student ID number"), {
      target: { value: "001235" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(fixture.save).toHaveBeenCalledWith({
        id: "exam",
        input: expect.objectContaining({
          studentNumber: "001235",
          fee: "AUD 500",
          abstract: "Thesis abstract",
        }),
      }),
    );
    expect(fixture.save.mock.calls[0][0].input).not.toHaveProperty(
      "initialNote",
    );
  });
  it("saves and edits notes under the correct parent, without saving metadata", async () => {
    render(<ReviewsExaminationsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Sample Student" }));
    fireEvent.change(screen.getByLabelText("New note"), {
      target: { value: "Next steps\nCheck methods" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));
    await waitFor(() =>
      expect(noteSave).toHaveBeenCalledWith({
        noteId: undefined,
        content: "Next steps\nCheck methods",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Edit note from/ }));
    expect(screen.getByLabelText("Edit note")).toHaveValue(
      "Existing examination note",
    );
    fireEvent.change(screen.getByLabelText("Edit note"), {
      target: { value: "Updated note" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));
    await waitFor(() =>
      expect(noteSave).toHaveBeenLastCalledWith({
        noteId: "note-1",
        content: "Updated note",
      }),
    );
    expect(fixture.note).toHaveBeenCalledWith(
      "workspace",
      "examination",
      "exam",
    );
    expect(fixture.save).not.toHaveBeenCalled();
  });
  it("retains inputs and note text after failed saves", async () => {
    fixture.save.mockRejectedValue(new Error("Save failed"));
    render(<ReviewsExaminationsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Add review" }));
    fireEvent.change(screen.getByLabelText(/Manuscript title/), {
      target: { value: "Keep this title" },
    });
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Add review",
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Save failed");
    expect(screen.getByLabelText(/Manuscript title/)).toHaveValue(
      "Keep this title",
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Sample Student" }));
    noteSave.mockRejectedValue(new Error("Note failed"));
    fireEvent.change(screen.getByLabelText("New note"), {
      target: { value: "Keep this note" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Note failed");
    expect(screen.getByLabelText("New note")).toHaveValue("Keep this note");
  });
  it("searches only the selected table and sends pagination to its server endpoint", async () => {
    render(<ReviewsExaminationsPage />);
    fireEvent.change(screen.getByRole("textbox", { name: "Search reviews" }), {
      target: { value: "Rare Manuscript" },
    });
    await waitFor(() =>
      expect(fixture.list).toHaveBeenCalledWith(
        "workspace",
        "journal",
        expect.objectContaining({ search: "Rare Manuscript", page: 1 }),
      ),
    );
    expect(fixture.list).toHaveBeenCalledWith(
      "workspace",
      "examination",
      expect.objectContaining({ search: "" }),
    );
    const section = within(screen.getByRole("region", { name: "Reviews" }));
    fireEvent.click(section.getByRole("button", { name: "Next" }));
    expect(fixture.list).toHaveBeenLastCalledWith(
      "workspace",
      "journal",
      expect.objectContaining({ page: 2 }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Clear reviews search" }),
    );
    await waitFor(() =>
      expect(fixture.list).toHaveBeenLastCalledWith(
        "workspace",
        "journal",
        expect.objectContaining({ search: "", page: 1 }),
      ),
    );
  });
  it("confirms deletion and removes only the chosen record", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<ReviewsExaminationsPage />);
    fireEvent.click(
      screen.getByRole("button", { name: "Delete Sample Manuscript" }),
    );
    expect(fixture.remove).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(
      screen.getByRole("button", { name: "Delete Sample Manuscript" }),
    );
    await waitFor(() => expect(fixture.remove).toHaveBeenCalledWith("journal"));
    confirm.mockRestore();
  });
});
