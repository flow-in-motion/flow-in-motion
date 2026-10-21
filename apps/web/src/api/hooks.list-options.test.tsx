import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.hoisted(() => vi.fn());
vi.mock("@/api/client", async () => ({
  apiClient: { GET: get },
  responseData: (response: { data: unknown }) => response.data,
  apiJson: vi.fn(),
  authenticatedJson: vi.fn(),
  ApiError: (await vi.importActual<typeof import("./client")>("./client")).ApiError,
}));
import { useModules, useTasks, useNotes, useMyProject, useMyModule } from "./hooks";
import { ApiError } from "./client";

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
let client: QueryClient;
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0, staleTime: 30_000, gcTime: 0 } } });
  get.mockReset();
  get.mockResolvedValue({ data: { data: [], meta: { page: 1, pageSize: 20, totalItems: 40, totalPages: 2 }, summary: { active: 34, review: 25 } } });
});

describe("list request costs and scope", () => {
  it.each([useTasks, useNotes])("keeps paper-scoped results separate from other papers and workspace lists", async (useLinkedWork) => {
    const { result, rerender } = renderHook(
      ({ moduleId }) => useLinkedWork("tenant-a", undefined, 1, true, { moduleId, pageSize: "all" }),
      { wrapper, initialProps: { moduleId: "paper-24" } },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(get.mock.calls[0][1].params.query).toEqual(expect.objectContaining({ moduleId: "paper-24", pageSize: "all" }));
    get.mockImplementation(() => new Promise(() => {}));
    rerender({ moduleId: "paper-25" });
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    expect(get.mock.calls[1][1].params.query.moduleId).toBe("paper-25");
  });

  it.each([useMyProject, useMyModule])("reuses an exact-record lookup when its detail page opens", async (useRecord) => {
    get.mockResolvedValue({ data: { id: "record-24", title: "Older record" } });
    const first = renderHook(() => useRecord("record-24"), { wrapper });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    first.unmount();
    const detail = renderHook(() => useRecord("record-24"), { wrapper });
    expect(detail.result.current.data?.title).toBe("Older record");
    expect(get).toHaveBeenCalledTimes(1);
  });

  it.each([403, 404])("does not keep retrying a permanent linked-record error (%s)", async (status) => {
    get.mockRejectedValue(new ApiError(status, "Unavailable record"));
    const { result } = renderHook(() => useMyProject("record-24"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("retains retries for transient failures", async () => {
    get.mockRejectedValueOnce(new ApiError(503, "Temporary failure"));
    const { result } = renderHook(() => useMyModule("record-24"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("shares one default paper request between dashboard consumers", async () => {
    const { result } = renderHook(() => [useModules("tenant-a"), useModules("tenant-a")], { wrapper });
    await waitFor(() => expect(result.current.every((query) => query.isSuccess)).toBe(true));
    expect(get).toHaveBeenCalledTimes(1);
    expect(result.current[0].data?.summary?.review).toBe(25);
  });

  it("preserves All when a search changes without fetching additional pages", async () => {
    const { result, rerender } = renderHook(({ search }) => useModules("tenant-a", undefined, 1, true, { pageSize: "all", search }), { wrapper, initialProps: { search: "quantum" } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    rerender({ search: "" });
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    expect(get.mock.calls.map((call) => call[1].params.query.pageSize)).toEqual(["all", "all"]);
  });

  it("sends paper sorting through the existing paginated request", async () => {
    const { result } = renderHook(() => useModules("tenant-a", undefined, 1, true, {
      sortBy: "progress",
      sortDirection: "asc",
    }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0][1].params.query).toEqual(expect.objectContaining({
      page: 1,
      pageSize: 20,
      sortBy: "progress",
      sortDirection: "asc",
    }));
  });

  it("sends multiple paper statuses, stages and current holders through the existing request", async () => {
    const { result } = renderHook(() => useModules("tenant-a", undefined, 1, true, {
      statuses: ["Stalled", "Complete"],
      stages: ["Submitted, Under Review", "Literature Review"],
      currentlyWithTypes: ["journal", "collaborator"],
    }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0][1].params.query).toEqual(expect.objectContaining({
      statuses: ["Complete", "Stalled"],
      stages: ["Literature Review", "Submitted, Under Review"],
      currentlyWithTypes: ["collaborator", "journal"],
    }));
  });

  it("sends project scope and does not show old workspace data on a switch", async () => {
    const { result, rerender } = renderHook(({ tenant }) => useTasks(tenant, "project-a", 1, true, { projectOnly: true }), { wrapper, initialProps: { tenant: "tenant-a" } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(get.mock.calls[0][1].params.query.projectOnly).toBe(true);
    get.mockImplementation(() => new Promise(() => {}));
    rerender({ tenant: "tenant-b" });
    expect(result.current.data).toBeUndefined();
  });
});
