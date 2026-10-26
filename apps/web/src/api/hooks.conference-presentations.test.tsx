import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticatedJson: vi.fn(),
}));

vi.mock("@/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/api/client")>(
    "@/api/client",
  );

  return {
    ...actual,
    authenticatedJson: mocks.authenticatedJson,
  };
});

import {
  moduleConferencePresentationsKey,
  useDeleteConferencePresentation,
  useModuleConferencePresentations,
  useSaveConferencePresentation,
} from "@/api/hooks";

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  }

  return { queryClient, wrapper: Wrapper };
}

describe("conference presentation hooks", () => {
  beforeEach(() => {
    mocks.authenticatedJson.mockReset();
  });

  it("loads history with its management permission", async () => {
    const { wrapper } = setup();
    const response = {
      canLogPresentation: false,
      data: [],
    };

    mocks.authenticatedJson.mockResolvedValue(response);

    const { result } = renderHook(
      () => useModuleConferencePresentations("tenant-1", "paper-1"),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(response);
    expect(mocks.authenticatedJson).toHaveBeenCalledWith(
      "/api/v1/tenant/tenant-1/modules/paper-1/conference-presentations",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("does not load history when disabled", () => {
    const { wrapper } = setup();

    renderHook(
      () => useModuleConferencePresentations("tenant-1", "paper-1", false),
      { wrapper },
    );

    expect(mocks.authenticatedJson).not.toHaveBeenCalled();
  });

  it.each([
    ["create", "POST"],
    ["update", "PATCH"],
  ] as const)(
    "%s saves the presentation and refreshes related caches",
    async (mode, method) => {
      const { queryClient, wrapper } = setup();
      const historyKey = moduleConferencePresentationsKey(
        "tenant-1",
        "paper-1",
      );
      const conferenceKey = ["api", "tenant", "tenant-1", "conferences", 2];

      queryClient.setQueryData(historyKey, {
        canLogPresentation: true,
        data: [],
      });
      queryClient.setQueryData(conferenceKey, { data: [] });
      mocks.authenticatedJson.mockResolvedValue({ id: "link-1" });

      const { result } = renderHook(
        () => useSaveConferencePresentation("tenant-1", "paper-1"),
        { wrapper },
      );

      const input = {
        presentedDate: "2026-10-01",
        presentationType: "Poster",
        abstract: "Presented abstract",
      };

      await act(async () => {
        await result.current.mutateAsync({
          conferenceId: "conference-1",
          input,
          mode,
        });
      });

      expect(mocks.authenticatedJson).toHaveBeenCalledWith(
        "/api/v1/tenant/tenant-1/modules/paper-1/conference-presentations/conference-1",
        {
          method,
          body: JSON.stringify(input),
        },
      );

      expect(queryClient.getQueryState(historyKey)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(conferenceKey)?.isInvalidated).toBe(true);
    },
  );

  it("clears a presentation through the delete endpoint", async () => {
    const { queryClient, wrapper } = setup();
    const historyKey = moduleConferencePresentationsKey(
      "tenant-1",
      "paper-1",
    );

    queryClient.setQueryData(historyKey, {
      canLogPresentation: true,
      data: [],
    });
    mocks.authenticatedJson.mockResolvedValue({ message: "Removed" });

    const { result } = renderHook(
      () => useDeleteConferencePresentation("tenant-1", "paper-1"),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync("conference-1");
    });

    expect(mocks.authenticatedJson).toHaveBeenCalledWith(
      "/api/v1/tenant/tenant-1/modules/paper-1/conference-presentations/conference-1",
      { method: "DELETE" },
    );
    expect(queryClient.getQueryState(historyKey)?.isInvalidated).toBe(true);
  });
});
