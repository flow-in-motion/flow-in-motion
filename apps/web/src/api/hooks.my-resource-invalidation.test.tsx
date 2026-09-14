import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/api/client")>("@/api/client");
  return {
    ...actual,
    apiClient: {
      PATCH: vi.fn().mockResolvedValue({ data: { id: "resource-1", title: "Updated" } }),
      DELETE: vi.fn().mockResolvedValue({ data: { id: "resource-1", warning: "" } }),
    },
  };
});

import {
  apiKeys,
  useArchiveMyModule,
  useArchiveMyProject,
  useDeleteMyTask,
  useUpdateModule,
  useUpdateMyModule,
  useUpdateMyProject,
  useUpdateMyTask,
  useUpdateNote,
  useUpdateTask,
} from "@/api/hooks";

const tenantId = "tenant-1";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function wrapperFor(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("'My*' mutations invalidate the matching tenant-scoped list", () => {
  it("useUpdateMyProject invalidates apiKeys.projects(tenantId)", async () => {
    const queryClient = makeQueryClient();
    queryClient.setQueryData(apiKeys.projects(tenantId), { data: [], meta: {} });

    const { result } = renderHook(() => useUpdateMyProject(), {
      wrapper: wrapperFor(queryClient),
    });
    await result.current.mutateAsync({ projectId: "resource-1", input: { title: "Updated" } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(queryClient.getQueryState(apiKeys.projects(tenantId))?.isInvalidated).toBe(true);
  });

  it("useArchiveMyProject invalidates apiKeys.projects(tenantId)", async () => {
    const queryClient = makeQueryClient();
    queryClient.setQueryData(apiKeys.projects(tenantId), { data: [], meta: {} });

    const { result } = renderHook(() => useArchiveMyProject(), {
      wrapper: wrapperFor(queryClient),
    });
    await result.current.mutateAsync("resource-1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(queryClient.getQueryState(apiKeys.projects(tenantId))?.isInvalidated).toBe(true);
  });

  it("useUpdateMyModule invalidates apiKeys.modules(tenantId)", async () => {
    const queryClient = makeQueryClient();
    queryClient.setQueryData(apiKeys.modules(tenantId), []);

    const { result } = renderHook(() => useUpdateMyModule(), {
      wrapper: wrapperFor(queryClient),
    });
    await result.current.mutateAsync({ moduleId: "resource-1", input: { title: "Updated" } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(queryClient.getQueryState(apiKeys.modules(tenantId))?.isInvalidated).toBe(true);
  });

  it("useArchiveMyModule invalidates apiKeys.modules(tenantId)", async () => {
    const queryClient = makeQueryClient();
    queryClient.setQueryData(apiKeys.modules(tenantId), []);

    const { result } = renderHook(() => useArchiveMyModule(), {
      wrapper: wrapperFor(queryClient),
    });
    await result.current.mutateAsync("resource-1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(queryClient.getQueryState(apiKeys.modules(tenantId))?.isInvalidated).toBe(true);
  });

  it("useUpdateMyTask invalidates apiKeys.tasks(tenantId)", async () => {
    const queryClient = makeQueryClient();
    queryClient.setQueryData(apiKeys.tasks(tenantId), []);

    const { result } = renderHook(() => useUpdateMyTask(), {
      wrapper: wrapperFor(queryClient),
    });
    await result.current.mutateAsync({ taskId: "resource-1", input: { title: "Updated" } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(queryClient.getQueryState(apiKeys.tasks(tenantId))?.isInvalidated).toBe(true);
  });

  it("useDeleteMyTask invalidates apiKeys.tasks(tenantId)", async () => {
    const queryClient = makeQueryClient();
    queryClient.setQueryData(apiKeys.tasks(tenantId), []);

    const { result } = renderHook(() => useDeleteMyTask(), {
      wrapper: wrapperFor(queryClient),
    });
    await result.current.mutateAsync("resource-1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(queryClient.getQueryState(apiKeys.tasks(tenantId))?.isInvalidated).toBe(true);
  });
});

describe("Tenant-scoped mutations also invalidate the matching 'My*' cache", () => {
  // A module/task/note is reachable both via its tenant-scoped cache (used
  // by list pages) and its tenant-agnostic "my *" cache (used by that
  // resource's own detail page, e.g. useMyModule). Linking or unlinking one
  // from a project via the tenant-scoped mutation — e.g. project-detail.tsx's
  // "Link existing" / "Unlink" actions — must invalidate both, or the
  // resource's own detail page keeps showing its pre-change state until a
  // hard refresh.

  it("useUpdateModule invalidates the 'my modules' cache", async () => {
    const queryClient = makeQueryClient();
    queryClient.setQueryData(["api", "me", "modules"], []);

    const { result } = renderHook(() => useUpdateModule(tenantId), {
      wrapper: wrapperFor(queryClient),
    });
    await result.current.mutateAsync({
      moduleId: "resource-1",
      input: { projectId: "project-1" },
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(queryClient.getQueryState(["api", "me", "modules"])?.isInvalidated).toBe(true);
  });

  it("useUpdateTask invalidates the 'my tasks' cache", async () => {
    const queryClient = makeQueryClient();
    queryClient.setQueryData(["api", "me", "tasks"], []);

    const { result } = renderHook(() => useUpdateTask(tenantId), {
      wrapper: wrapperFor(queryClient),
    });
    await result.current.mutateAsync({
      taskId: "resource-1",
      input: { projectId: "project-1" },
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(queryClient.getQueryState(["api", "me", "tasks"])?.isInvalidated).toBe(true);
  });

  it("useUpdateNote invalidates the 'my notes' cache", async () => {
    const queryClient = makeQueryClient();
    queryClient.setQueryData(["api", "me", "notes"], []);

    const { result } = renderHook(() => useUpdateNote(tenantId), {
      wrapper: wrapperFor(queryClient),
    });
    await result.current.mutateAsync({
      noteId: "resource-1",
      input: { projectId: "project-1" },
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(queryClient.getQueryState(["api", "me", "notes"])?.isInvalidated).toBe(true);
  });
});
