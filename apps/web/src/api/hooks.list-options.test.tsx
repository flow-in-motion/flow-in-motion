import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.hoisted(() => vi.fn());
vi.mock("@/api/client", () => ({
  apiClient: { GET: get },
  responseData: (response: { data: unknown }) => response.data,
  apiJson: vi.fn(),
  authenticatedJson: vi.fn(),
  ApiError: Error,
}));
import { useModules, useTasks } from "./hooks";

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
let client: QueryClient;
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000, gcTime: 0 } } });
  get.mockReset();
  get.mockResolvedValue({ data: { data: [], meta: { page: 1, pageSize: 20, totalItems: 40, totalPages: 2 }, summary: { active: 34, review: 25 } } });
});

describe("list request costs and scope", () => {
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

  it("sends project scope and does not show old workspace data on a switch", async () => {
    const { result, rerender } = renderHook(({ tenant }) => useTasks(tenant, "project-a", 1, true, { projectOnly: true }), { wrapper, initialProps: { tenant: "tenant-a" } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(get.mock.calls[0][1].params.query.projectOnly).toBe(true);
    get.mockImplementation(() => new Promise(() => {}));
    rerender({ tenant: "tenant-b" });
    expect(result.current.data).toBeUndefined();
  });
});
