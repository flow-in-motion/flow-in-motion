import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useHdrPeople, useSaveHdrPerson } from "./hdr";

const fixture = vi.hoisted(() => ({ userId: "owner-1", json: vi.fn() }));
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
const options = { page: 1, pageSize: 20, search: "" };
describe("HDR request isolation", () => {
  beforeEach(() => {
    fixture.userId = "owner-1";
    fixture.json.mockReset();
    fixture.json.mockResolvedValue({
      data: [],
      counts: { currentStudents: 0, potentialStudents: 0, visitingScholars: 0 },
      meta: { page: 1 },
    });
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
  });
  it("sends pagination and filters in one request without polling", async () => {
    const { result } = renderHook(
      () =>
        useHdrPeople("workspace", {
          ...options,
          search: " Student ",
          type: "MRes",
          category: "Potential",
        }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const path = fixture.json.mock.calls[0][0];
    const params = new URL(path, "https://test.example").searchParams;
    expect(Object.fromEntries(params)).toEqual({
      page: "1",
      pageSize: "20",
      search: "Student",
      type: "MRes",
      category: "Potential",
    });
    expect(fixture.json).toHaveBeenCalledTimes(1);
  });
  it("never displays another account’s cached HDR results", async () => {
    const { result, rerender } = renderHook(
      () => useHdrPeople("workspace", options),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    fixture.json.mockImplementation(() => new Promise(() => {}));
    fixture.userId = "owner-2";
    rerender();
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(fixture.json).toHaveBeenCalledTimes(2));
  });
  it("only invalidates HDR queries after saving", async () => {
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useSaveHdrPerson("workspace"), {
      wrapper,
    });
    await act(() =>
      result.current.mutateAsync({
        input: {
          name: "Student",
          type: "PhD",
          category: "Current",
          email: null,
          researchTopic: null,
          projectIds: [],
          paperIds: [],
        },
      }),
    );
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["api", "tenant", "workspace", "hdr-people", "owner-1"],
    });
  });
});
