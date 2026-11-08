import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useReview,
  useReviews,
  useSaveReview,
  useReviewNoteMutation,
} from "./reviews";

const fixture = vi.hoisted(() => ({ userId: "owner", json: vi.fn() }));
vi.mock("@/auth/auth-provider", () => ({
  useAuth: () => ({ user: { id: fixture.userId } }),
}));
vi.mock("@/api/client", () => ({
  authenticatedJson: (...args: unknown[]) => fixture.json(...args),
}));
let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
describe("Reviews API cache and request isolation", () => {
  beforeEach(() => {
    fixture.userId = "owner";
    fixture.json.mockReset();
    fixture.json.mockResolvedValue({
      data: [],
      meta: { page: 1 },
      id: "record",
    });
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
  });
  it("searches the requested table on the server without polling or fetching details", async () => {
    const { result } = renderHook(
      () =>
        useReviews("w", "journal", { page: 2, pageSize: 50, search: " Rare " }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fixture.json).toHaveBeenCalledTimes(1);
    expect(fixture.json).toHaveBeenCalledWith(
      "/api/v1/tenant/w/reviews/journal?page=2&pageSize=50&search=Rare",
    );
  });
  it("does not carry results between users or review types", async () => {
    let kind: "journal" | "examination" = "journal";
    const { result, rerender } = renderHook(
      () => useReviews("w", kind, { page: 1, pageSize: 20, search: "" }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    fixture.json.mockImplementation(() => new Promise(() => {}));
    kind = "examination";
    rerender();
    expect(result.current.data).toBeUndefined();
    fixture.userId = "other";
    rerender();
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(fixture.json).toHaveBeenCalledTimes(3));
  });
  it("does not load a full record until requested", () => {
    renderHook(() => useReview("w", "examination"), { wrapper });
    expect(fixture.json).not.toHaveBeenCalled();
  });
  it("invalidates only the corresponding review table and record after an edit", async () => {
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useSaveReview("w", "journal"), {
      wrapper,
    });
    await act(() =>
      result.current.mutateAsync({
        id: "record",
        input: { journalRanking: "Q1" },
      }),
    );
    expect(invalidate.mock.calls).toEqual([
      [
        {
          queryKey: [
            "api",
            "tenant",
            "w",
            "academic-reviews",
            "owner",
            "journal",
            "list",
          ],
        },
      ],
      [
        {
          queryKey: [
            "api",
            "tenant",
            "w",
            "academic-reviews",
            "owner",
            "journal",
            "detail",
            "record",
          ],
        },
      ],
    ]);
    expect(JSON.parse(fixture.json.mock.calls[0][1].body)).toEqual({
      journalRanking: "Q1",
    });
  });
  it("saves notes only under their selected parent and refreshes its details", async () => {
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(
      () => useReviewNoteMutation("w", "examination", "record"),
      { wrapper },
    );
    await act(() => result.current.mutateAsync({ content: "Private note" }));
    expect(fixture.json).toHaveBeenCalledWith(
      "/api/v1/tenant/w/reviews/examination/record/notes",
      { method: "POST", body: '{"content":"Private note"}' },
    );
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: [
        "api",
        "tenant",
        "w",
        "academic-reviews",
        "owner",
        "examination",
        "detail",
        "record",
      ],
    });
  });
});
