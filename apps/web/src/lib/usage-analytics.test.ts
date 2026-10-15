import { describe, expect, it } from "vitest";

import {
  usagePageContext,
  usageSessionId,
  withUsageContext,
} from "./usage-analytics";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe("usagePageContext", () => {
  it.each([
    ["/", { pageKey: "dashboard", path: "/" }],
    ["/projects", { pageKey: "projects", path: "/projects" }],
    ["/projects/project-123", { pageKey: "projects", path: "/projects" }],
    ["/modules/paper-123", { pageKey: "papers", path: "/papers" }],
    ["/daily-notes/note-123", { pageKey: "notes", path: "/notes" }],
    ["/mind-map", { pageKey: "mind_map", path: "/mind_map" }],
  ])("normalises %s without retaining entity IDs", (pathname, expected) => {
    expect(usagePageContext(pathname)).toEqual(expected);
  });

  it("records a future feature without retaining any other route data", () => {
    expect(usagePageContext("/future/Document Builder/ignored")).toEqual({
      pageKey: "future_features",
      path: "/future/document_builder",
      featureKey: "document_builder",
    });
  });
});

describe("usageSessionId", () => {
  it("keeps a session during activity within 30 minutes", () => {
    const storage = memoryStorage();
    const first = usageSessionId(storage, 1_000, () => "session-1");
    const second = usageSessionId(
      storage,
      1_000 + 29 * 60_000,
      () => "session-2",
    );

    expect(first).toBe("session-1");
    expect(second).toBe("session-1");
  });

  it("starts a new session after 30 minutes of inactivity", () => {
    const storage = memoryStorage();
    usageSessionId(storage, 1_000, () => "session-1");

    expect(
      usageSessionId(storage, 1_000 + 30 * 60_000, () => "session-2"),
    ).toBe("session-2");
  });
});

it("enriches an existing event without adding a second event", () => {
  expect(
    withUsageContext(
      { name: "page_view", path: "/modules/private-record-id" },
      "/",
      "3d6f0a27-8900-49dc-8d0a-b87ec6b23583",
    ),
  ).toEqual({
    name: "page_view",
    path: "/papers",
    pageKey: "papers",
    featureKey: undefined,
    sessionId: "3d6f0a27-8900-49dc-8d0a-b87ec6b23583",
  });
});
