import {
    fireEvent,
    render,
    screen,
    waitFor,
  } from "@testing-library/react";
  import { beforeEach, describe, expect, it, vi } from "vitest";
  
  import type { ApiConferencePresentation } from "@/api/hooks";
  import { ConferencePresentationHistory } from "./conference-presentation-history";
  
  const fixtures = vi.hoisted(() => ({
    presentations: [] as ApiConferencePresentation[],
    canLogPresentation: true,
    save: vi.fn(),
    remove: vi.fn(),
  }));
  
  vi.mock("@/api/hooks", () => ({
    useModuleConferencePresentations: () => ({
      data: {
        canLogPresentation: fixtures.canLogPresentation,
        data: fixtures.presentations,
      },
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    }),
    usePresentationConferenceOptions: () => ({
      data: [
        {
          id: "conference-1",
          name: "Annual research conference",
          acronym: null,
          location: "Melbourne",
          startDate: null,
          endDate: null,
        },
        {
          id: "conference-2",
          name: "International research conference",
          acronym: null,
          location: "Sydney",
          startDate: null,
          endDate: null,
        },
      ],
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    }),
    useSaveConferencePresentation: () => ({
      mutateAsync: fixtures.save,
      isPending: false,
    }),
    useDeleteConferencePresentation: () => ({
      mutateAsync: fixtures.remove,
      isPending: false,
    }),
  }));
  
  function presentation(
    overrides: Partial<ApiConferencePresentation> = {},
  ): ApiConferencePresentation {
    return {
      id: "link-1",
      conferenceId: "conference-1",
      conferenceName: "Annual research conference",
      acronym: null,
      location: "Melbourne",
      presentedDate: "2026-10-01",
      presentationType: "Talk",
      paperTitle: "Burnout contagion",
      abstract: "The original presented abstract.",
      notes: "Presented by the research team.",
      canManage: true,
      ...overrides,
    };
  }
  
  function renderPanel() {
    return render(
      <ConferencePresentationHistory
        tenantId="tenant-1"
        moduleId="paper-1"
        defaultPaperTitle="Burnout contagion"
      />,
    );
  }
  
  describe("ConferencePresentationHistory", () => {
    beforeEach(() => {
      fixtures.presentations = [];
      fixtures.canLogPresentation = true;
      fixtures.save.mockReset();
      fixtures.save.mockResolvedValue({ id: "link-new" });
      fixtures.remove.mockReset();
      fixtures.remove.mockResolvedValue({ message: "Removed" });
    });
  
    it("shows all four presentations for the same paper", () => {
      fixtures.presentations = Array.from({ length: 4 }, (_, index) =>
        presentation({
          id: `link-${index}`,
          conferenceId: `conference-${index}`,
          conferenceName: `Research conference ${index + 1}`,
        }),
      );
  
      renderPanel();
  
      expect(
        screen.getByRole("heading", {
          name: "Conference presentation history (4)",
        }),
      ).toBeInTheDocument();
      expect(screen.getAllByRole("article")).toHaveLength(4);
      expect(screen.getByText("Research conference 4")).toBeInTheDocument();
    });
  
    it("saves the chosen conference and presentation details", async () => {
      renderPanel();
  
      fireEvent.click(
        screen.getByRole("button", { name: "Log presentation" }),
      );
      fireEvent.change(
        screen.getByRole("combobox", { name: "Conference *" }),
        { target: { value: "conference-2" } },
      );
      fireEvent.change(screen.getByLabelText("Presentation date *"), {
        target: { value: "2026-10-02" },
      });
      fireEvent.change(screen.getByLabelText("Presentation type"), {
        target: { value: "Poster" },
      });
      fireEvent.change(screen.getByLabelText("Presented abstract"), {
        target: { value: "An abstract for this conference." },
      });
      fireEvent.change(screen.getByLabelText("Notes"), {
        target: { value: "Presented during the morning session." },
      });
  
      fireEvent.click(
        screen.getByRole("button", { name: "Save presentation" }),
      );
  
      await waitFor(() =>
        expect(fixtures.save).toHaveBeenCalledWith({
          conferenceId: "conference-2",
          mode: "create",
          input: {
            presentedDate: "2026-10-02",
            presentationType: "Poster",
            paperTitle: "Burnout contagion",
            abstract: "An abstract for this conference.",
            notes: "Presented during the morning session.",
          },
        }),
      );
  
      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      );
    });
  
    it("edits an existing presentation and allows clearing its abstract", async () => {
      fixtures.presentations = [presentation()];
      renderPanel();
  
      fireEvent.click(
        screen.getByRole("button", {
          name: "Edit presentation at Annual research conference",
        }),
      );
  
      expect(screen.getByLabelText("Presented abstract")).toHaveValue(
        "The original presented abstract.",
      );
  
      fireEvent.change(screen.getByLabelText("Presented abstract"), {
        target: { value: "" },
      });
      fireEvent.click(
        screen.getByRole("button", { name: "Save presentation" }),
      );
  
      await waitFor(() =>
        expect(fixtures.save).toHaveBeenCalledWith({
          conferenceId: "conference-1",
          mode: "update",
          input: {
            presentedDate: "2026-10-01",
            presentationType: "Talk",
            paperTitle: "Burnout contagion",
            abstract: null,
            notes: "Presented by the research team.",
          },
        }),
      );
    });
  
    it("disables conferences that already have a recorded presentation", () => {
      fixtures.presentations = [presentation()];
      renderPanel();
  
      fireEvent.click(
        screen.getByRole("button", { name: "Log presentation" }),
      );
  
      expect(
        screen.getByRole("option", {
          name: /Annual research conference.*already recorded/,
        }),
      ).toBeDisabled();
  
      expect(
        screen.getByRole("option", {
          name: "International research conference",
        }),
      ).not.toBeDisabled();
    });
  
    it("shows history without management controls for readers", () => {
      fixtures.canLogPresentation = false;
      fixtures.presentations = [presentation({ canManage: false })];
      renderPanel();
  
      expect(
        screen.getByText("The original presented abstract."),
      ).toBeInTheDocument();
  
      expect(
        screen.queryByRole("button", { name: "Log presentation" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /^Edit presentation at/ }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /^Remove presentation at/ }),
      ).not.toBeInTheDocument();
    });
  
    it("asks before clearing presentation details", async () => {
      fixtures.presentations = [presentation()];
      renderPanel();
  
      fireEvent.click(
        screen.getByRole("button", {
          name: "Remove presentation at Annual research conference",
        }),
      );
  
      expect(
        screen.getByText(/The conference will remain linked to this paper/),
      ).toBeInTheDocument();
      expect(fixtures.remove).not.toHaveBeenCalled();
  
      fireEvent.click(
        screen.getByRole("button", {
            name: /^Remove presentation$/,
          })
      );
  
      await waitFor(() =>
        expect(fixtures.remove).toHaveBeenCalledWith("conference-1"),
      );
    });
  
    it("keeps the form and entered text when saving fails", async () => {
      fixtures.presentations = [presentation()];
      fixtures.save.mockRejectedValue(new Error("Presentation could not be saved"));
      renderPanel();
  
      fireEvent.click(
        screen.getByRole("button", {
          name: "Edit presentation at Annual research conference",
        }),
      );
      fireEvent.change(screen.getByLabelText("Presented abstract"), {
        target: { value: "Keep this unsaved abstract." },
      });
      fireEvent.click(
        screen.getByRole("button", { name: "Save presentation" }),
      );
  
      await waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent(
          "Presentation could not be saved",
        ),
      );
  
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByLabelText("Presented abstract")).toHaveValue(
        "Keep this unsaved abstract.",
      );
    });
  });
