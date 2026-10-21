import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GlobalSearch } from "@/components/search/global-search";

const calls = vi.hoisted(() => ({
  projects: vi.fn(),
  conferences: vi.fn(),
}));

function page<T>(data: T[], totalItems = data.length) {
  return {
    data: { data, meta: { page: 1, pageSize: 5, totalItems, totalPages: 1 } },
    isFetching: false,
    isError: false,
  };
}

const empty = page([]);

vi.mock("@/api/hooks", () => ({
  useProjects: (
    tenantId: string,
    pageNumber: number,
    enabled: boolean,
    options: { search?: string },
  ) => {
    calls.projects(tenantId, pageNumber, enabled, options);
    return enabled
      ? page(
          [
            {
              id: "project-1",
              displayId: "PRJ-001",
              title: "Coral reef survey",
              description: "Reef health",
            },
          ],
          7,
        )
      : empty;
  },
  useModules: (_t: string, _p: unknown, _n: number, enabled: boolean) =>
    enabled
      ? page([
          {
            id: "paper-1",
            displayId: "PAP-001",
            shortTitle: "Reef paper",
            title: null,
            pipelineStage: "Drafting",
          },
        ])
      : empty,
  useTasks: () => empty,
  useNotes: () => empty,
  useConferences: (
    tenantId: string,
    pageNumber: number,
    enabled: boolean,
    options: { search?: string },
  ) => {
    calls.conferences(tenantId, pageNumber, enabled, options);
    return enabled
      ? page([
          {
            id: "conf-1",
            acronym: "ICRS",
            name: "International Coral Reef Symposium",
            location: "Auckland",
            submissionType: null,
          },
        ])
      : empty;
  },
  useFundings: () => empty,
}));

function renderSearch() {
  render(
    <MemoryRouter>
      <GlobalSearch tenantId="tenant-1" />
    </MemoryRouter>,
  );
  return screen.getByRole("combobox", { name: "Search everything" });
}

describe("GlobalSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    calls.projects.mockClear();
    calls.conferences.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("searches every area and groups the results with links", () => {
    const input = renderSearch();

    fireEvent.change(input, { target: { value: "reef" } });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(calls.projects).toHaveBeenLastCalledWith("tenant-1", 1, true, {
      pageSize: 5,
      search: "reef",
    });
    expect(calls.conferences).toHaveBeenLastCalledWith("tenant-1", 1, true, {
      search: "reef",
    });

    expect(
      screen.getByRole("link", { name: /Coral reef survey/ }),
    ).toHaveAttribute("href", "/projects/project-1");
    expect(screen.getByRole("link", { name: /Reef paper/ })).toHaveAttribute(
      "href",
      "/modules/paper-1",
    );
    expect(
      screen.getByRole("link", {
        name: /ICRS — International Coral Reef Symposium/,
      }),
    ).toHaveAttribute("href", "/conferences/conf-1");
    expect(screen.getByText("Showing 1 of 7")).toBeInTheDocument();
    expect(screen.queryByText("Tasks")).not.toBeInTheDocument();
  });

  it("waits for at least two characters before searching", () => {
    const input = renderSearch();

    fireEvent.change(input, { target: { value: "r" } });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(calls.projects).toHaveBeenLastCalledWith(
      "tenant-1",
      1,
      false,
      expect.anything(),
    );
    expect(
      screen.queryByRole("region", { name: "Search results" }),
    ).not.toBeInTheDocument();
  });

  it("focuses with the / key and clears with Escape", () => {
    const input = renderSearch();

    fireEvent.keyDown(window, { key: "/" });
    expect(input).toHaveFocus();

    fireEvent.change(input, { target: { value: "reef" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveValue("");
  });
});
