const SESSION_STORAGE_KEY = "flow.usage-session.v1";
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

interface StoredUsageSession {
  id: string;
  lastActivityAt: number;
}

export interface UsagePageContext {
  pageKey: string;
  path: string;
  featureKey?: string;
}

const PAGE_KEYS: Record<string, string> = {
  projects: "projects",
  modules: "papers",
  papers: "papers",
  tasks: "tasks",
  "daily-notes": "notes",
  pipeline: "pipeline",
  calendar: "calendar",
  conferences: "conferences",
  funding: "funding",
  "mind-map": "mind_map",
  settings: "settings",
  usage: "usage",
  "site-map": "site_map",
};

function safeFeatureKey(value: string | undefined) {
  const normalised = value
    ?.toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);

  return normalised || "unknown";
}

/** Maps detail routes to stable page names without retaining record IDs. */
export function usagePageContext(pathname: string): UsagePageContext {
  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];

  if (!first) return { pageKey: "dashboard", path: "/" };

  if (first === "future") {
    const featureKey = safeFeatureKey(segments[1]);
    return {
      pageKey: "future_features",
      path: `/future/${featureKey}`,
      featureKey,
    };
  }

  if (first === "projects" && segments[1] === "archive") {
    return { pageKey: "project_archive", path: "/projects/archive" };
  }

  const pageKey = PAGE_KEYS[first];
  if (pageKey) return { pageKey, path: `/${pageKey}` };

  return { pageKey: "other", path: "/other" };
}

function createSessionId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (token) => {
    const random = Math.floor(Math.random() * 16);
    const value = token === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

/**
 * Returns the current anonymous browser session and advances its activity
 * timestamp. A new session starts after 30 minutes of inactivity.
 */
export function usageSessionId(
  storage: Pick<Storage, "getItem" | "setItem">,
  now = Date.now(),
  makeId = createSessionId,
) {
  let current: StoredUsageSession | undefined;

  try {
    const stored = storage.getItem(SESSION_STORAGE_KEY);
    if (stored) current = JSON.parse(stored) as StoredUsageSession;
  } catch {
    // Private browsing and restrictive storage settings must not affect use.
  }

  const elapsed = current
    ? now - current.lastActivityAt
    : Number.POSITIVE_INFINITY;
  const id =
    current?.id && elapsed >= 0 && elapsed < SESSION_TIMEOUT_MS
      ? current.id
      : makeId();

  try {
    storage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ id, lastActivityAt: now } satisfies StoredUsageSession),
    );
  } catch {
    // Analytics is intentionally best-effort.
  }

  return id;
}

export function currentUsageSessionId() {
  if (typeof window === "undefined") return undefined;

  try {
    return usageSessionId(window.localStorage);
  } catch {
    return undefined;
  }
}

export function withUsageContext<T extends { path?: string }>(
  input: T,
  currentPath: string,
  sessionId?: string,
) {
  const page = usagePageContext(input.path ?? currentPath);
  return {
    ...input,
    path: page.path,
    pageKey: page.pageKey,
    featureKey: page.featureKey,
    sessionId,
  };
}
