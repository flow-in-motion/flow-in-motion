import { useCallback, useEffect, useState } from "react";

import { useSessionListState } from "@/hooks/use-session-list-state";

interface ListSearchScope {
  userId?: string | null;
  workspaceId?: string | null;
  preferenceKey: string;
}

/** Commit the search and reset pagination together, after typing pauses. */
export function useListSearch(scope?: ListSearchScope, debounceMs = 400) {
  const [search, setSearch] = useSessionListState<string>(
    scope?.userId,
    scope?.workspaceId,
    `${scope?.preferenceKey ?? "list"}:search`,
    "",
  );

  const scopeKey = JSON.stringify([
    scope?.userId ?? "",
    scope?.workspaceId ?? "",
    scope?.preferenceKey ?? "",
  ]);

  const [request, setRequest] = useState(() => ({
    scopeKey,
    search: search.trim(),
    page: 1,
  }));

  let currentRequest = request;

  if (request.scopeKey !== scopeKey) {
    currentRequest = {
      scopeKey,
      search: search.trim(),
      page: 1,
    };
    setRequest(currentRequest);
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const next = search.trim();

      setRequest((current) => {
        if (current.scopeKey !== scopeKey) return current;
        if (current.search === next) return current;

        return { scopeKey, search: next, page: 1 };
      });
    }, debounceMs);

    return () => window.clearTimeout(timeout);
  }, [search, scopeKey, debounceMs]);

  const setPage = useCallback(
    (page: number) => {
      setRequest((current) => {
        if (current.scopeKey !== scopeKey || current.page === page) {
          return current;
        }

        return { ...current, page };
      });
    },
    [scopeKey],
  );

  return {
    search,
    setSearch,
    requestSearch: currentRequest.search,
    page: currentRequest.page,
    setPage,
  };
}
