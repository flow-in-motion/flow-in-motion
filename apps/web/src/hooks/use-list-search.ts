import { useCallback, useEffect, useState } from "react";

/** Commit the search and reset pagination together, after typing pauses. */
export function useListSearch() {
  const [search, setSearch] = useState("");
  const [request, setRequest] = useState({ search: "", page: 1 });
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const next = search.trim();
      setRequest((current) => current.search === next ? current : { search: next, page: 1 });
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [search]);
  const setPage = useCallback((page: number) => setRequest((current) => current.page === page ? current : { ...current, page }), []);
  return {
    search,
    setSearch,
    requestSearch: request.search,
    page: request.page,
    setPage,
  };
}
