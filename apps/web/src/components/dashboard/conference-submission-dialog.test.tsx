import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConferenceSubmissionDialog } from "@/components/dashboard/conference-submission-dialog";
import type { ApiModule, ApiProject } from "@/api/hooks";

const projects: ApiProject[] = [];
const modules: ApiModule[] = [];

const genomeProject: ApiProject = {
  id: "project-1",
  displayId: "PRJ-001",
  userId: "user-1",
  tenantId: "tenant-1",
  title: "Genome Project",
  description: null,
  researchArea: null,
  status: null,
  importance: null,
  scheduledFor: null,
  dueDate: null,
  totalBudget: null,
  targetJournals: null,
  archivedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  role: "owner",
};

const projectsWithOne: ApiProject[] = [genomeProject];

function makeModule(overrides: Partial<ApiModule>): ApiModule {
  return {
    id: "module-1",
    displayId: "MOD-001",
    tenantId: "tenant-1",
    projectId: genomeProject.id,
    shortTitle: overrides.title ?? "Draft manuscript",
    title: "Draft manuscript",
    description: null,
    abstract: null,
    targetJournal: null,
    backupJournal: null,
    targetConference: null,
    backupConference: null,
    tag: "Research Paper",
    status: null,
    pipelineStage: null,
    pipelineStageChangedAt: null,
    dueDate: null,
    assignedToUserId: null,
    archivedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

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

function linkCombobox() {
  return screen.getByRole("combobox", { name: "Linked project or module/paper" });
}

describe("ConferenceSubmissionDialog", () => {
  it("defaults the end date to the start date just entered when end date is empty", () => {
    render(
      <ConferenceSubmissionDialog
        open
        onOpenChange={vi.fn()}
        projects={projects}
        modules={modules}
        onSave={vi.fn()}
      />,
    );

    fireEvent.change(startDateInput(), { target: { value: "2026-08-05" } });

    expect(endDateInput().value).toBe("2026-08-05");
  });

  it("does not override an end date the user already picked", () => {
    render(
      <ConferenceSubmissionDialog
        open
        onOpenChange={vi.fn()}
        projects={projects}
        modules={modules}
        onSave={vi.fn()}
      />,
    );

    fireEvent.change(endDateInput(), { target: { value: "2026-08-10" } });
    fireEvent.change(startDateInput(), { target: { value: "2026-08-05" } });

    expect(endDateInput().value).toBe("2026-08-10");
  });

  it("defaults the link field to No linked project or module/paper and submits with none selected", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <ConferenceSubmissionDialog
        open
        onOpenChange={vi.fn()}
        projects={projectsWithOne}
        modules={modules}
        onSave={onSave}
      />,
    );

    expect(linkCombobox()).toHaveValue("No linked project or module/paper");

    fireEvent.change(screen.getByRole("textbox", { name: /Acronym/ }), { target: { value: "ASM" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Conference name/ }), {
      target: { value: "Conference 2027" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Location/ }), {
      target: { value: "Sydney" },
    });
    fireEvent.change(nativeDateInputFor("conference-submission-due"), {
      target: { value: "2026-08-01" },
    });
    fireEvent.change(startDateInput(), { target: { value: "2027-06-04" } });
    fireEvent.change(endDateInput(), { target: { value: "2027-06-08" } });

    fireEvent.click(screen.getByRole("button", { name: "Add Conference" }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ projectIds: [] }),
    );
  });

  it("lets a project be picked from the searchable dropdown", () => {
    render(
      <ConferenceSubmissionDialog
        open
        onOpenChange={vi.fn()}
        projects={projectsWithOne}
        modules={modules}
        onSave={vi.fn()}
      />,
    );

    fireEvent.focus(linkCombobox());
    fireEvent.click(screen.getByRole("option", { name: /Genome Project/ }));

    expect(linkCombobox()).toHaveValue("Genome Project");
  });

  it("lets a module tagged Research Paper be picked, resolving to its parent project", () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const paperModule = makeModule({ id: "module-paper", title: "Draft manuscript", tag: "Research Paper" });
    render(
      <ConferenceSubmissionDialog
        open
        onOpenChange={vi.fn()}
        projects={projectsWithOne}
        modules={[paperModule]}
        onSave={onSave}
      />,
    );

    fireEvent.focus(linkCombobox());
    const option = screen.getByRole("option", { name: /Draft manuscript/ });
    expect(option).toHaveTextContent("Paper · via Genome Project");
    fireEvent.click(option);

    expect(linkCombobox()).toHaveValue("Draft manuscript");
  });

  it("excludes independent modules (no parent project) from the picker", () => {
    const independentModule = makeModule({
      id: "module-independent",
      title: "Standalone module",
      projectId: null,
    });
    render(
      <ConferenceSubmissionDialog
        open
        onOpenChange={vi.fn()}
        projects={projectsWithOne}
        modules={[independentModule]}
        onSave={vi.fn()}
      />,
    );

    fireEvent.focus(linkCombobox());

    expect(screen.queryByRole("option", { name: /Standalone module/ })).not.toBeInTheDocument();
  });

  it("filters the dropdown as you type", () => {
    const otherModule = makeModule({ id: "module-2", title: "Grant application", tag: "Grant Submission" });
    render(
      <ConferenceSubmissionDialog
        open
        onOpenChange={vi.fn()}
        projects={projectsWithOne}
        modules={[otherModule]}
        onSave={vi.fn()}
      />,
    );

    fireEvent.focus(linkCombobox());
    fireEvent.change(linkCombobox(), { target: { value: "grant" } });

    expect(screen.getByRole("option", { name: /Grant application/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /^Genome Project/ })).not.toBeInTheDocument();
  });

  it("clears the link with the clear button", () => {
    render(
      <ConferenceSubmissionDialog
        open
        onOpenChange={vi.fn()}
        projects={projectsWithOne}
        modules={modules}
        onSave={vi.fn()}
      />,
    );

    fireEvent.focus(linkCombobox());
    fireEvent.click(screen.getByRole("option", { name: /Genome Project/ }));
    expect(linkCombobox()).toHaveValue("Genome Project");

    fireEvent.click(screen.getByRole("button", { name: "Clear linked project or module/paper" }));

    expect(linkCombobox()).toHaveValue("No linked project or module/paper");
  });
});
