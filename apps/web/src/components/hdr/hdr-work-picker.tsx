import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { useModules, useProjects } from "@/api/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/shared/search-input";
import { paperDisplayTitle } from "@/lib/paper-title";

export interface HdrWorkOption {
  id: string;
  label: string;
}

/** Uses the existing server search before pagination; no first-page-only lookup. */
export function HdrWorkPicker({
  tenantId,
  kind,
  selected,
  onChange,
}: {
  tenantId: string;
  kind: "projects" | "papers";
  selected: HdrWorkOption[];
  onChange: (options: HdrWorkOption[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [request, setRequest] = useState({ search: "", page: 1 });
  useEffect(() => {
    const timeout = window.setTimeout(
      () => setRequest({ search: search.trim(), page: 1 }),
      300,
    );
    return () => window.clearTimeout(timeout);
  }, [search]);
  const enabled = request.search.length > 0 && request.search === search.trim();
  const projectQuery = useProjects(
    tenantId,
    request.page,
    enabled && kind === "projects",
    { pageSize: 20, search: request.search },
  );
  const paperQuery = useModules(
    tenantId,
    undefined,
    request.page,
    enabled && kind === "papers",
    { pageSize: 20, search: request.search },
  );
  const activeQuery = kind === "projects" ? projectQuery : paperQuery;
  const general = projectQuery.data?.generalProject;
  const projectResults = [
    ...(general &&
    `${general.title} ${general.displayId ?? ""}`
      .toLowerCase()
      .includes(request.search.toLowerCase())
      ? [general]
      : []),
    ...(projectQuery.data?.data ?? []),
  ];
  const options = (
    kind === "projects"
      ? projectResults.map((p) => ({ id: p.id, label: p.title }))
      : (paperQuery.data?.data ?? []).map((p) => ({
          id: p.id,
          label: paperDisplayTitle(p),
        }))
  ).filter(
    (p, index, all) =>
      all.findIndex((item) => item.id === p.id) === index &&
      !selected.some((item) => item.id === p.id),
  );
  const meta = activeQuery.data?.meta;
  return (
    <div className="space-y-2">
      <label htmlFor={`hdr-${kind}`} className="text-sm font-medium">
        Linked {kind}
      </label>
      <SearchInput
        id={`hdr-${kind}`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onClear={() => setSearch("")}
        clearLabel={`Clear ${kind} search`}
        placeholder={`Search all ${kind}…`}
        maxLength={200}
      />
      {enabled ? (
        <div
          aria-label={`${kind} search results`}
          aria-live="polite"
          className="max-h-52 overflow-y-auto rounded-md border p-1"
        >
          {activeQuery.isFetching ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              Searching…
            </p>
          ) : activeQuery.isError ? (
            <div role="alert" className="p-2 text-sm text-destructive">
              Search could not be loaded.{" "}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void activeQuery.refetch()}
              >
                Retry
              </Button>
            </div>
          ) : options.length ? (
            options.map((option) => (
              <button
                type="button"
                key={option.id}
                className="block w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-accent focus:bg-accent"
                onClick={() => {
                  onChange([...selected, option]);
                  setSearch("");
                }}
              >
                {option.label}
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              No matching {kind} on this page.
            </p>
          )}
          {meta && meta.totalPages > 1 ? (
            <div className="flex items-center justify-between gap-2 border-t p-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={activeQuery.isFetching || request.page <= 1}
                onClick={() => setRequest((r) => ({ ...r, page: r.page - 1 }))}
              >
                Previous results
              </Button>
              <span className="text-xs text-muted-foreground">
                {meta.page} / {meta.totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={
                  activeQuery.isFetching || request.page >= meta.totalPages
                }
                onClick={() => setRequest((r) => ({ ...r, page: r.page + 1 }))}
              >
                Next results
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
      {selected.length ? (
        <div className="flex flex-wrap gap-2">
          {selected.map((option) => (
            <Badge key={option.id} variant="secondary" className="gap-1.5 py-1">
              {option.label}
              <button
                type="button"
                aria-label={`Remove ${option.label}`}
                onClick={() =>
                  onChange(selected.filter((item) => item.id !== option.id))
                }
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}
