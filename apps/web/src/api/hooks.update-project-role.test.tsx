import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  patch: vi.fn().mockResolvedValue({
    data: {
      id: "collaborator-1",
      tenantId: "tenant-1",
      userId: "user-1",
      role: "Lead",
    },
  }),
}));

vi.mock("@/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/api/client")>("@/api/client");
  return {
    ...actual,
    apiClient: {
      PATCH: mocks.patch,
    },
  };
});

import { useUpdateProjectCollaboratorRole } from "@/api/hooks";

describe("useUpdateProjectCollaboratorRole", () => {
  it("updates the current collaborator role through the project collaborator endpoint", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    function wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    }

    const { result } = renderHook(
      () => useUpdateProjectCollaboratorRole("tenant-1"),
      { wrapper },
    );

    await result.current.mutateAsync({
      projectId: "project-1",
      userId: "user-1",
      role: "Lead",
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.patch).toHaveBeenCalledWith(
      "/api/v1/tenant/{tenantId}/projects/{projectId}/collaborators/{userId}",
      {
        params: {
          path: {
            tenantId: "tenant-1",
            projectId: "project-1",
            userId: "user-1",
          },
        },
        body: { role: "Lead" },
      },
    );
  });
});
