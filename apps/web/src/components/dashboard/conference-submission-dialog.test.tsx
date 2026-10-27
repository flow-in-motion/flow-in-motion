import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  intents: ["Considering"],
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

const secondProjectOption: ApiConferenceLinkOption = {
  kind: "project",
  id: "project-2",
  projectId: "project-2",
  displayId: "PRJ-002",
  label: "Ocean Project",
  projectTitle: "Ocean Project",
};

const secondPaperOption: ApiConferenceLinkOption = {
  kind: "paper",
  id: "module-review",
  projectId: "project-2",
  displayId: "MOD-002",
  label: "Literature review",
  projectTitle: "Ocean Project",
};

const independentPaperOption: ApiConferenceLinkOption = {
  kind: "paper",
  id: "module-solo",
  projectId: null,
  displayId: "MOD-003",
  label: "Solo paper",
  projectTitle: null,
};

function projectCombobox() {
  return screen.getByRole("combobox", { name: "Linked projects" });
}

function paperCombobox() {
  return screen.getByRole("combobox", { name: "Linked papers" });
}

/** Names of the projects or papers currently linked, as shown in the chips. */
function linkedNames(kind: "projects" | "papers") {
  const list = screen.queryByRole("list", { name: `Linked ${kind}` });
  if (!list) return [];
  return within(list)
    .getAllByRole("listitem")
    .map((item) => item.textContent);
}

function openPaperSearch() {
  const input = paperCombobox();
  fireEvent.focus(input);
  return input;
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
      notes: null,
      submissionDue: null,
      startDate: null,
      endDate: null,
      submissionType: null,
      intents: [],
      projectIds: [],
      moduleIds: [],
    }));
  });

  it("allows more than one conference intent to be selected", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <ConferenceSubmissionDialog open onOpenChange={vi.fn()} tenantId="tenant-1" onSave={onSave} />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: /Conference name/ }), {
      target: { value: "Conference 2028" },
    });
    fireEvent.keyDown(screen.getByRole("button", { name: "Intent: Not specified" }), {
      key: "Enter",
    });
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Submitting" }));
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Attending" }));
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Add Conference" }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ intents: ["Submitting", "Attending"] }),
      ),
    );
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

  it("links several projects and several papers to one conference", async () => {
    fixtures.linkOptions = [
      projectOption,
      secondProjectOption,
      paperOption,
      secondPaperOption,
      independentPaperOption,
    ];
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <ConferenceSubmissionDialog open onOpenChange={vi.fn()} tenantId="tenant-1" onSave={onSave} />,
    );

    fireEvent.focus(projectCombobox());
    fireEvent.click(await screen.findByRole("option", { name: /Genome Project/ }));
    // The list stays open, so the next one can be picked straight away.
    fireEvent.click(screen.getByRole("option", { name: /Ocean Project/ }));

    openPaperSearch();
    fireEvent.click(await screen.findByRole("option", { name: /Draft manuscript/ }));
    fireEvent.click(screen.getByRole("option", { name: /Literature review/ }));
    fireEvent.click(screen.getByRole("option", { name: /Solo paper/ }));

    expect(linkedNames("projects")).toEqual(["Genome Project", "Ocean Project"]);
    expect(linkedNames("papers")).toEqual([
      "Draft manuscript",
      "Literature review",
      "Solo paper",
    ]);

    fireEvent.change(screen.getByRole("textbox", { name: /Conference name/ }), {
      target: { value: "Conference 2027" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Conference" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        projectIds: ["project-1", "project-2"],
        moduleIds: ["module-paper", "module-review", "module-solo"],
      }),
    ));
  });

  it.each(["focus", "click"] as const)(
    "shows project options on %s without typing",
    (interaction) => {
      fixtures.linkOptions = [projectOption, paperOption];

      render(
        <ConferenceSubmissionDialog
          open
          onOpenChange={vi.fn()}
          tenantId="tenant-1"
          onSave={vi.fn()}
        />,
      );

      expect(fixtures.searches.every((request) => !request.enabled)).toBe(true);

      if (interaction === "focus") {
        fireEvent.focus(projectCombobox());
      } else {
        fireEvent.click(projectCombobox());
      }

      expect(projectCombobox()).toHaveValue("");
      expect(
        screen.getByRole("option", { name: /Genome Project/ }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("option", { name: /Draft manuscript/ }),
      ).not.toBeInTheDocument();
      expect(fixtures.searches).toContainEqual({
        search: "",
        enabled: true,
      });
    },
  );

  it.each(["focus", "click"] as const)(
    "shows paper options on %s without typing",
    (interaction) => {
      fixtures.linkOptions = [projectOption, paperOption];

      render(
        <ConferenceSubmissionDialog
          open
          onOpenChange={vi.fn()}
          tenantId="tenant-1"
          onSave={vi.fn()}
        />,
      );

      expect(fixtures.searches.every((request) => !request.enabled)).toBe(true);

      if (interaction === "focus") {
        fireEvent.focus(paperCombobox());
      } else {
        fireEvent.click(paperCombobox());
      }

      expect(paperCombobox()).toHaveValue("");
      expect(
        screen.getByRole("option", { name: /Draft manuscript/ }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("option", { name: /Genome Project Project · PRJ-001/ }),
      ).not.toBeInTheDocument();
      expect(fixtures.searches).toContainEqual({
        search: "",
        enabled: true,
      });
    },
  );

  it("finds and attaches a paper beyond the first page", async () => {
    fixtures.linkOptions = [{ ...paperOption, id: "module-42", label: "Beyond page one" }];
    render(
      <ConferenceSubmissionDialog open onOpenChange={vi.fn()} tenantId="tenant-1" onSave={vi.fn()} />,
    );

    const paperSearch = openPaperSearch();
    fireEvent.change(paperSearch, { target: { value: "Beyond" } });

    fireEvent.click(await screen.findByRole("option", { name: /Beyond page one/ }));
    expect(fixtures.searches).toContainEqual({ search: "Beyond", enabled: true });
    expect(linkedNames("papers")).toEqual(["Beyond page one"]);
    // The search clears so the next paper can be found.
    expect(paperSearch).toHaveValue("");
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

    expect(linkedNames("projects")).toEqual(["Genome Project"]);
    expect(linkedNames("papers")).toEqual(["Draft manuscript"]);
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ projectIds: ["project-1"], moduleIds: ["module-paper"] }),
    ));
  });

  it("adds a paper to a conference that already has one", async () => {
    fixtures.linkOptions = [paperOption, secondPaperOption];
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

    openPaperSearch();
    expect(
      screen.getByRole("option", { name: /Draft manuscript/ }),
    ).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("option", { name: /Literature review/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        projectIds: ["project-1"],
        moduleIds: ["module-paper", "module-review"],
      }),
    ));
  });

  it("unlinks one paper with its chip button, leaving the rest", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <ConferenceSubmissionDialog
        open
        onOpenChange={vi.fn()}
        tenantId="tenant-1"
        conference={{
          ...linkedConference,
          papers: [
            ...(linkedConference.papers ?? []),
            {
              id: "module-review",
              displayId: "MOD-002",
              shortTitle: "Literature review",
              title: null,
              projectId: "project-2",
            },
          ],
        }}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Unlink Draft manuscript" }));

    expect(linkedNames("papers")).toEqual(["Literature review"]);
    expect(linkedNames("projects")).toEqual(["Genome Project"]);
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        projectIds: ["project-1"],
        moduleIds: ["module-review"],
      }),
    ));
  });

  it("unlinks a paper by picking it again in the list", async () => {
    fixtures.linkOptions = [paperOption];
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

    openPaperSearch();
    fireEvent.click(screen.getByRole("option", { name: /Draft manuscript/ }));

    expect(linkedNames("papers")).toEqual([]);
    expect(linkedNames("projects")).toEqual(["Genome Project"]);
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          projectIds: ["project-1"],
          moduleIds: [],
        }),
      ),
    );
  });
});
