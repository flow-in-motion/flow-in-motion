import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  useArchiveMyProject,
  useArchiveMyModuleWithOptions,
  useDeleteMyNote,
  useUpdateMyNote,
  useUpdateMyProject,
} from "./hooks";
import { useDeleteHdrPerson, useSaveHdrPerson } from "./hdr";
vi.mock("@/auth/auth-provider", () => ({
  useAuth: () => ({ user: { id: "owner" } }),
}));
vi.mock("@/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/client")>()),
  apiClient: {
    PATCH: vi.fn().mockResolvedValue({
      data: { id: "item", tenantId: "tenant", title: "Renamed" },
    }),
    DELETE: vi.fn().mockResolvedValue({ data: { id: "item" } }),
  },
  authenticatedJson: vi.fn().mockResolvedValue({
    id: "item",
    module: { id: "item", tenantId: "tenant" },
    project: { id: "item", tenantId: "tenant" },
  }),
}));
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const current = ["api", "work-time-entries", "owner", "current"];
  client.setQueryData(current, { timers: [], receivedAt: 0 });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  return { client, current, wrapper: Wrapper };
}
describe("refresh new timer state when its parent changes", () => {
  it.each(["project", "note"] as const)(
    "refreshes after renaming %s",
    async (kind) => {
      const context = setup();
      const { result } = renderHook(
        () => ({ project: useUpdateMyProject(), note: useUpdateMyNote() }),
        context,
      );
      if (kind === "project")
        await result.current.project.mutateAsync({
          projectId: "item",
          input: { title: "Renamed" },
        });
      else
        await result.current.note.mutateAsync({
          noteId: "item",
          input: { title: "Renamed" },
        });
      expect(context.client.getQueryState(context.current)?.isInvalidated).toBe(
        true,
      );
    },
  );
  it("refreshes after deleting a note", async () => {
    const context = setup();
    const { result } = renderHook(() => useDeleteMyNote(), context);
    await result.current.mutateAsync("item");
    expect(context.client.getQueryState(context.current)?.isInvalidated).toBe(
      true,
    );
  });
  it("refreshes after archiving a project or paper containing notes", async () => {
    const context = setup();
    const { result } = renderHook(
      () => ({
        project: useArchiveMyProject(),
        paper: useArchiveMyModuleWithOptions(),
      }),
      context,
    );
    await result.current.project.mutateAsync({
      projectId: "item",
      mode: "archive_contents",
    });
    expect(context.client.getQueryState(context.current)?.isInvalidated).toBe(
      true,
    );
    context.client.setQueryData(context.current, { timers: [] });
    await result.current.paper.mutateAsync({
      moduleId: "item",
      mode: "archive_contents",
    });
    expect(context.client.getQueryState(context.current)?.isInvalidated).toBe(
      true,
    );
  });
  it("refreshes after changing or removing an HDR record", async () => {
    const context = setup();
    const { result } = renderHook(
      () => ({
        save: useSaveHdrPerson("tenant"),
        remove: useDeleteHdrPerson("tenant"),
      }),
      context,
    );
    await result.current.save.mutateAsync({
      personId: "item",
      input: {
        name: "Renamed",
        type: "PhD",
        category: "Current",
        email: null,
        researchTopic: null,
        projectIds: [],
        paperIds: [],
      },
    });
    expect(context.client.getQueryState(context.current)?.isInvalidated).toBe(
      true,
    );
    context.client.setQueryData(context.current, { timers: [] });
    await result.current.remove.mutateAsync("item");
    expect(context.client.getQueryState(context.current)?.isInvalidated).toBe(
      true,
    );
  });
});
