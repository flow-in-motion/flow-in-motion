import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/api/client")>("@/api/client");
  return {
    ...actual,
    // Stands in for the backend's own sanitisation (drizzle's `stringList`
    // dedupes and trims the array before it's persisted) — the response
    // returned here is what actually got committed, which can differ from
    // the raw patch the client sent.
    authenticatedJson: vi.fn(async () => ({
      preferences: {
        dashboardLayout: { order: ["a", "b", "c"], hidden: [] },
        tableColumns: {},
        pipelineHiddenStages: {},
      },
    })),
  };
});

import { apiKeys, useUpdateWorkspacePreferences, type WorkspacePreferences } from "@/api/hooks";

describe("useUpdateWorkspacePreferences", () => {
  it("caches the server's authoritative response, not a client-side reconstruction of the raw patch", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const tenantId = "tenant-1";
    const queryKey = apiKeys.workspacePreferences(tenantId);

    function wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    }

    const { result } = renderHook(() => useUpdateWorkspacePreferences(tenantId), { wrapper });

    // The raw patch carries a duplicate id (e.g. from a stale intermediate
    // reorder step) — the server dedupes it server-side. The cache should
    // end up matching what the server actually persisted, not this raw,
    // unsanitised patch.
    await result.current.mutateAsync({
      dashboardLayout: { order: ["a", "a", "b", "c"], hidden: [] },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cached = queryClient.getQueryData<WorkspacePreferences>(queryKey);
    expect(cached?.dashboardLayout?.order).toEqual(["a", "b", "c"]);
  });
});
