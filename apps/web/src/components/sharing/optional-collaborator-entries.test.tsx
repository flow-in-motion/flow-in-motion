import { useState } from "react";
import {
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ApiUserSearchResult,
  DraftCollaboratorInput,
} from "@/api/hooks";
import { OptionalCollaboratorEntries } from "./optional-collaborator-entries";

const mocks = vi.hoisted(() => ({
  searchResults: [] as ApiUserSearchResult[],
  useUserSearch: vi.fn(),
}));

vi.mock("@/api/hooks", () => ({
  useUserSearch: mocks.useUserSearch,
}));

function Harness({
  entityLabel,
}: {
  entityLabel: "paper" | "project";
}) {
  const [entries, setEntries] = useState<DraftCollaboratorInput[]>([]);

  return (
    <OptionalCollaboratorEntries
      value={entries}
      onChange={setEntries}
      ownerUserId="user-owner"
      ownerEmail="owner@example.com"
      entityLabel={entityLabel}
    />
  );
}

describe.each(["paper", "project"] as const)(
  "OptionalCollaboratorEntries for a new %s",
  (entityLabel) => {
    beforeEach(() => {
      mocks.searchResults = [{
        id: "user-sam",
        displayName: "Sam Researcher",
        email: "sam@example.com",
        affiliation: "MQ",
      }];

      mocks.useUserSearch.mockReset();
      mocks.useUserSearch.mockImplementation(() => ({
        data: mocks.searchResults,
        isPending: false,
        isError: false,
      }));
    });

    it.each([
      {
        field: "Collaborator name",
        query: "Sam",
        list: "Available collaborator names",
      },
      {
        field: "Collaborator email",
        query: "sam@example",
        list: "Available collaborator emails",
      },
    ])(
      "searches through $field, fills all details, and adds/removes the collaborator",
      ({ field, query, list }) => {
        render(<Harness entityLabel={entityLabel} />);

        const input = screen.getByLabelText(field);
        fireEvent.focus(input);
        fireEvent.change(input, {
          target: { value: query },
        });

        expect(mocks.useUserSearch).toHaveBeenCalledWith(query, true);

        const options = screen.getByRole("listbox", { name: list });
        fireEvent.click(
          within(options).getByRole("option", {
            name: /Sam Researcher/,
          }),
        );

        expect(screen.getByLabelText("Collaborator name"))
          .toHaveValue("Sam Researcher");
        expect(screen.getByLabelText("Collaborator email"))
          .toHaveValue("sam@example.com");
        expect(screen.getByLabelText("Collaborator affiliation"))
          .toHaveValue("MQ");
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

        fireEvent.click(
          screen.getByRole("button", { name: "Add collaborator" }),
        );

        expect(screen.getByText("Sam Researcher")).toBeInTheDocument();
        expect(screen.getByText("sam@example.com")).toBeInTheDocument();
        expect(screen.getByText("MQ")).toBeInTheDocument();
        expect(screen.queryByText("Draft")).not.toBeInTheDocument();
        expect(
          screen.queryByRole("button", { name: "Invite" }),
        ).not.toBeInTheDocument();

        expect(screen.getByLabelText("Collaborator name")).toHaveValue("");
        expect(screen.getByLabelText("Collaborator email")).toHaveValue("");
        expect(screen.getByLabelText("Collaborator affiliation"))
          .toHaveValue("");

        fireEvent.click(
          screen.getByRole("button", { name: "Remove Sam Researcher" }),
        );

        expect(screen.queryByText("Sam Researcher"))
          .not.toBeInTheDocument();
      },
    );

    it("clears an earlier affiliation when the selected contact has none", () => {
      mocks.searchResults = [{
        id: "user-sam",
        displayName: "Sam Researcher",
        email: "sam@example.com",
        affiliation: null,
      }];

      render(<Harness entityLabel={entityLabel} />);

      fireEvent.change(screen.getByLabelText("Collaborator affiliation"), {
        target: { value: "Previous institution" },
      });

      const nameInput = screen.getByLabelText("Collaborator name");
      fireEvent.focus(nameInput);
      fireEvent.change(nameInput, {
        target: { value: "Sam" },
      });

      fireEvent.click(
        screen.getByRole("option", { name: /Sam Researcher/ }),
      );

      expect(screen.getByLabelText("Collaborator affiliation"))
        .toHaveValue("");
    });
  },
);