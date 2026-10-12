import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import {
  clearSessionListState,
  sessionListStateKey,
  useSessionListState,
} from "@/hooks/use-session-list-state";

beforeEach(() => {
  window.sessionStorage.clear();
});

describe("useSessionListState", () => {
  it("restores sorting after unmounting and remounting", () => {
    const first = renderHook(() =>
      useSessionListState("user-1", "workspace-1", "tasks:sort", "asc"),
    );

    act(() => first.result.current[1]("desc"));
    first.unmount();

    const second = renderHook(() =>
      useSessionListState("user-1", "workspace-1", "tasks:sort", "asc"),
    );

    expect(second.result.current[0]).toBe("desc");
  });

  it("isolates users and workspaces and restores the original scope", () => {
    const { result, rerender } = renderHook(
      ({ userId, workspaceId }) =>
        useSessionListState(userId, workspaceId, "tasks:sort", "asc"),
      {
        initialProps: {
          userId: "user-1",
          workspaceId: "workspace-1",
        },
      },
    );

    act(() => result.current[1]("desc"));

    rerender({ userId: "user-1", workspaceId: "workspace-2" });
    expect(result.current[0]).toBe("asc");

    rerender({ userId: "user-2", workspaceId: "workspace-1" });
    expect(result.current[0]).toBe("asc");

    rerender({ userId: "user-1", workspaceId: "workspace-1" });
    expect(result.current[0]).toBe("desc");
  });

  it("waits for user and workspace IDs before using storage", () => {
    const { result, rerender } = renderHook(
      ({ userId, workspaceId }) =>
        useSessionListState(userId, workspaceId, "tasks:sort", "asc"),
      { initialProps: { userId: "", workspaceId: "" } },
    );

    expect(window.sessionStorage.length).toBe(0);

    window.sessionStorage.setItem(
      sessionListStateKey("user-1", "workspace-1", "tasks:sort"),
      JSON.stringify({ kind: "value", value: "desc" }),
    );

    rerender({ userId: "user-1", workspaceId: "workspace-1" });
    expect(result.current[0]).toBe("desc");
  });

  it("restores Set filters and supports functional updates", () => {
    const first = renderHook(() =>
      useSessionListState<Set<string>>(
        "user-1",
        "workspace-1",
        "papers:statuses",
        () => new Set(),
      ),
    );

    act(() =>
      first.result.current[1]((previous) => new Set([...previous, "Review"])),
    );
    first.unmount();

    const second = renderHook(() =>
      useSessionListState<Set<string>>(
        "user-1",
        "workspace-1",
        "papers:statuses",
        () => new Set(),
      ),
    );

    expect(second.result.current[0]).toEqual(new Set(["Review"]));
  });

  it("falls back to defaults when saved JSON is invalid", () => {
    window.sessionStorage.setItem(
      sessionListStateKey("user-1", "workspace-1", "tasks:sort"),
      "{invalid",
    );

    const { result } = renderHook(() =>
      useSessionListState("user-1", "workspace-1", "tasks:sort", "asc"),
    );

    expect(result.current[0]).toBe("asc");
  });

  it("clears saved selections and resets mounted controls", () => {
    window.sessionStorage.setItem("unrelated-setting", "keep");

    const first = renderHook(() =>
      useSessionListState("user-1", "workspace-1", "tasks:sort", "asc"),
    );

    act(() => first.result.current[1]("desc"));
    act(() => clearSessionListState());

    expect(first.result.current[0]).toBe("asc");
    expect(window.sessionStorage.getItem("unrelated-setting")).toBe("keep");

    first.unmount();

    const second = renderHook(() =>
      useSessionListState("user-1", "workspace-1", "tasks:sort", "asc"),
    );

    expect(second.result.current[0]).toBe("asc");
  });
});
