import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConferenceSubmissionDialog } from "@/components/dashboard/conference-submission-dialog";
import type { ApiConference, ApiConferenceLinkOption } from "@/api/hooks";

const fixtures = vi.hoisted(() => ({
  linkOptions: [] as ApiConferenceLinkOption[],
  searches: [] as Array<{ search: string; enabled: boolean }>,
}));

vi.mock("@/api/hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/hooks")>();
  return {
    ...actual,
    useConferenceLinkOptions: (_tenantId: string, search: string, enabled: boolean) => {
      fixtures.searches.push({ search, enabled });
      return {
        data: enabled ? fixtures.linkOptions : undefined,
        isFetching: false,
      };
    },
  };
});

const projectOption: ApiConferenceLinkOption = {
  kind: "project",
  id: "project-1",
  projectId: "project-1",
  displayId: "PRJ-001",
  label: "Genome Project",
  projectTitle: "Genome Project",
};

const paperOption: ApiConferenceLinkOption = {
  kind: "paper",
  id: "module-paper",
  projectId: "project-1",
  displayId: "MOD-001",
  label: "Draft manuscript",
  projectTitle: "Genome Project",
};

const linkedConference: ApiConference = {
  id: "conference-1",
  tenantId: "tenant-1",
  ownerUserId: "user-1",
  acronym: "ASM",
  name: "Conference 2027",
  location: "Sydney",
  submissionDue: null,
  startDate: null,
  endDate: null,
  submissionType: null,
  daysRemaining: null,
  projects: [{ id: "project-1", displayId: "PRJ-001", title: "Genome Project" }],
  papers: [{
    id: "module-paper",
    displayId: "MOD-001",
    shortTitle: "Draft manuscript",
    title: "Draft manuscript",
    projectId: "project-1",
  }],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function nativeDateInputFor(textInputId: string) {
  const textInput = document.getElementById(textInputId)!;
  return textInput.closest(".relative")!.querySelector<HTMLInputElement>('input[type="date"]')!;
}

function startDateInput() {
  return nativeDateInputFor("conference-start-date");
}

function endDateInput() {
  return nativeDateInputFor("conference-end-date");
}

function projectCombobox() {
  return screen.getByRole("combobox", { name: "Linked project" });
}

function openPaperSearch() {
  fireEvent.click(screen.getByRole("button", { name: "Search papers" }));
  return screen.getByRole("textbox", { name: "Search all papers" });
}

describe("ConferenceSubmissionDialog", () => {
  beforeEach(() => {
    fixtures.linkOptions = [];
    fixtures.searches = [];
  });

  it("requires only the conference name and submits blank details as null", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <ConferenceSubmissionDialog open onOpenChange={vi.fn()} tenantId="tenant-1" onSave={onSave} />,
    );

    const nameInput = screen.getByRole("textbox", { name: /Conference name/ });
    expect(nameInput).toBeRequired();
    expect(screen.getByRole("textbox", { name: /Acronym/ })).not.toBeRequired();
    expect(screen.getByRole("textbox", { name: /Location/ })).not.toBeRequired();
    expect(nativeDateInputFor("conference-submission-due")).not.toBeRequired();
    expect(startDateInput()).not.toBeRequired();
    expect(endDateInput()).not.toBeRequired();

    fireEvent.change(nameInput, { target: { value: "XYZ, London, 2027" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Conference" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({
      acronym: null,
      name: "XYZ, London, 2027",
      location: null,
      submissionDue: null,
      startDate: null,
      endDate: null,
      submissionType: null,
      projectIds: [],
      moduleIds: [],
    }));
  });

  it("defaults the end date to the day after the start date just entered", () => {
    render(
      <ConferenceSubmissionDialog open onOpenChange={vi.fn()} tenantId="tenant-1" onSave={vi.fn()} />,
    );
    fireEvent.change(startDateInput(), { target: { value: "2026-08-05" } });
    expect(endDateInput().value).toBe("2026-08-06");
  });

  it("carries the default end date into the next month", () => {
    render(
      <ConferenceSubmissionDialog open onOpenChange={vi.fn()} tenantId="tenant-1" onSave={vi.fn()} />,
    );
    fireEvent.change(startDateInput(), { target: { value: "2027-12-31" } });
    expect(endDateInput().value).toBe("2028-01-01");
  });

  it("does not override an end date the user already picked", () => {
    render(
      <ConferenceSubmissionDialog open onOpenChange={vi.fn()} tenantId="tenant-1" onSave={vi.fn()} />,
    );
    fireEvent.change(endDateInput(), { target: { value: "2026-08-10" } });
    fireEvent.change(startDateInput(), { target: { value: "2026-08-05" } });
    expect(endDateInput().value).toBe("2026-08-10");
  });

  it("keeps project linking separate from the new paper search", async () => {
    fixtures.linkOptions = [projectOption, paperOption];
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <ConferenceSubmissionDialog open onOpenChange={vi.fn()} tenantId="tenant-1" onSave={onSave} />,
    );

    fireEvent.focus(projectCombobox());
    fireEvent.change(projectCombobox(), { target: { value: "Genome" } });
    fireEvent.click(await screen.findByRole("option", { name: /Genome Project/ }));

    const paperSearch = openPaperSearch();
    fireEvent.change(paperSearch, { target: { value: "Draft" } });
    fireEvent.click(await screen.findByRole("option", { name: /Draft manuscript/ }));

    expect(projectCombobox()).toHaveValue("Genome Project");
    expect(screen.getByRole("textbox", { name: "Linked paper" })).toHaveValue("Draft manuscript");

    fireEvent.change(screen.getByRole("textbox", { name: /Conference name/ }), {
      target: { value: "Conference 2027" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Conference" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ projectIds: ["project-1"], moduleIds: ["module-paper"] }),
    ));
  });

  it("does not load papers until Search papers is opened and text is entered", () => {
    render(
      <ConferenceSubmissionDialog open onOpenChange={vi.fn()} tenantId="tenant-1" onSave={vi.fn()} />,
    );

    openPaperSearch();
    expect(screen.getByText("Type to search all papers.")).toBeInTheDocument();
    expect(fixtures.searches.every((request) => !request.enabled)).toBe(true);
  });

  it("finds and attaches a paper beyond the first page", async () => {
    fixtures.linkOptions = [{ ...paperOption, id: "module-42", label: "Beyond page one" }];
    render(
      <ConferenceSubmissionDialog open onOpenChange={vi.fn()} tenantId="tenant-1" onSave={vi.fn()} />,
    );

    const paperSearch = openPaperSearch();
    fireEvent.change(paperSearch, { target: { value: "Beyond" } });

    expect(await screen.findByRole("option", { name: /Beyond page one/ })).toBeInTheDocument();
    expect(fixtures.searches).toContainEqual({ search: "Beyond", enabled: true });
  });

  it("shows paper matches returned for a parent project search", async () => {
    fixtures.linkOptions = [paperOption];
    render(
      <ConferenceSubmissionDialog open onOpenChange={vi.fn()} tenantId="tenant-1" onSave={vi.fn()} />,
    );

    const paperSearch = openPaperSearch();
    fireEvent.change(paperSearch, { target: { value: "Genome" } });

    const option = await screen.findByRole("option", { name: /Draft manuscript/ });
    expect(option).toHaveTextContent("Paper · via Genome Project");
  });

  it("removes only the linked paper", () => {
    render(
      <ConferenceSubmissionDialog
        open
        onOpenChange={vi.fn()}
        tenantId="tenant-1"
        conference={linkedConference}
        onSave={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove linked paper" }));
    expect(screen.getByRole("textbox", { name: "Linked paper" })).toHaveValue("No linked paper");
    expect(projectCombobox()).toHaveValue("Genome Project");
  });

  it("preserves existing project and paper links when editing", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <ConferenceSubmissionDialog
        open
        onOpenChange={vi.fn()}
        tenantId="tenant-1"
        conference={linkedConference}
        onSave={onSave}
      />,
    );

    expect(projectCombobox()).toHaveValue("Genome Project");
    expect(screen.getByRole("textbox", { name: "Linked paper" })).toHaveValue("Draft manuscript");
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ projectIds: ["project-1"], moduleIds: ["module-paper"] }),
    ));
  });
});
