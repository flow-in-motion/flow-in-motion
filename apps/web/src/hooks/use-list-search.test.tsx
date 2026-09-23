import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useListSearch } from "./use-list-search";

describe("useListSearch", () => {
  afterEach(() => vi.useRealTimers());

  it("makes one committed search after rapid typing and resets the page atomically", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useListSearch());
    act(() => result.current.setPage(3));
    act(() => result.current.setSearch("q"));
    act(() => vi.advanceTimersByTime(200));
    act(() => result.current.setSearch("quantum"));
    act(() => vi.advanceTimersByTime(399));
    expect(result.current.requestSearch).toBe("");
    expect(result.current.page).toBe(3);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.requestSearch).toBe("quantum");
    expect(result.current.page).toBe(1);
  });

  it("cancels pending searches on unmount", () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() => useListSearch());
    act(() => result.current.setSearch("pending"));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
