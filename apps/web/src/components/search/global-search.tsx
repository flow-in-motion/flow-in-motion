import {
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import {
  ClipboardList,
  DollarSign,
  FileStack,
  FolderKanban,
  Loader2,
  NotebookPen,
  Presentation,
  Search,
  X,
} from "lucide-react";

import {
  useConferences,
  useFundings,
  useModules,
  useNotes,
  useProjects,
  useTasks,
} from "@/api/hooks";
import { paperDisplayTitle } from "@/lib/paper-title";

/** How many matches each group shows. */
const RESULTS_PER_GROUP = 5;
/** Searches start once at least this many characters are typed. */
export const MIN_SEARCH_LENGTH = 2;
const DEBOUNCE_MS = 300;

interface SearchResult {
  id: string;
  to: string;
  title: string;
  detail?: string | null;
}

interface SearchGroup {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  results: SearchResult[];
  total: number;
  isFetching: boolean;
  isError: boolean;
}

function joinDetail(...parts: Array<string | null | undefined>) {
  const filled = parts.map((part) => part?.trim()).filter(Boolean);
  return filled.length ? filled.join(" · ") : null;
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

/**
 * One search box for the whole platform: projects, papers, tasks, notes,
 * conferences and funding, using each list's existing server-side search.
 */
export function GlobalSearch({ tenantId }: { tenantId: string }) {
  const panelId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setTerm(query.trim()),
      DEBOUNCE_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [query]);

  // "/" jumps to the search box from anywhere on the dashboard.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey) return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      inputRef.current?.focus();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close when clicking anywhere outside the search.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const enabled = Boolean(tenantId) && term.length >= MIN_SEARCH_LENGTH;
  const listOptions = { pageSize: RESULTS_PER_GROUP, search: term };

  const projects = useProjects(tenantId, 1, enabled, listOptions);
  const papers = useModules(tenantId, undefined, 1, enabled, listOptions);
  const tasks = useTasks(tenantId, undefined, 1, enabled, listOptions);
  const notes = useNotes(tenantId, undefined, 1, enabled, listOptions);
  const conferences = useConferences(tenantId, 1, enabled, { search: term });
  const funding = useFundings(tenantId, 1, enabled, listOptions);

  const groups: SearchGroup[] = [
    {
      key: "projects",
      label: "Projects",
      icon: FolderKanban,
      results: (projects.data?.data ?? []).map((project) => ({
        id: project.id,
        to: `/projects/${project.id}`,
        title: project.title,
        detail: joinDetail(project.displayId, project.description),
      })),
      total: projects.data?.meta.totalItems ?? 0,
      isFetching: projects.isFetching,
      isError: projects.isError,
    },
    {
      key: "papers",
      label: "Papers",
      icon: FileStack,
      results: (papers.data?.data ?? []).map((paper) => ({
        id: paper.id,
        to: `/modules/${paper.id}`,
        title: paperDisplayTitle(paper),
        detail: joinDetail(paper.displayId, paper.pipelineStage),
      })),
      total: papers.data?.meta.totalItems ?? 0,
      isFetching: papers.isFetching,
      isError: papers.isError,
    },
    {
      key: "tasks",
      label: "Tasks",
      icon: ClipboardList,
      results: (tasks.data?.data ?? []).map((task) => ({
        id: task.id,
        to: `/tasks/${task.id}`,
        title: task.title,
        detail: joinDetail(task.displayId, task.status),
      })),
      total: tasks.data?.meta.totalItems ?? 0,
      isFetching: tasks.isFetching,
      isError: tasks.isError,
    },
    {
      key: "notes",
      label: "Notes",
      icon: NotebookPen,
      results: (notes.data?.data ?? []).map((note) => ({
        id: note.id,
        to: `/daily-notes/${note.id}`,
        title: note.title?.trim() || "Untitled note",
        detail: joinDetail(note.displayId, note.content),
      })),
      total: notes.data?.meta.totalItems ?? 0,
      isFetching: notes.isFetching,
      isError: notes.isError,
    },
    {
      key: "conferences",
      label: "Conferences/Events",
      icon: Presentation,
      results: (conferences.data?.data ?? [])
        .slice(0, RESULTS_PER_GROUP)
        .map((conference) => ({
          id: conference.id,
          to: `/conferences/${conference.id}`,
          title: conference.acronym
            ? `${conference.acronym} — ${conference.name}`
            : conference.name,
          detail: joinDetail(conference.location, conference.submissionType),
        })),
      total: conferences.data?.meta.totalItems ?? 0,
      isFetching: conferences.isFetching,
      isError: conferences.isError,
    },
    {
      key: "funding",
      label: "Funding",
      icon: DollarSign,
      results: (funding.data?.data ?? []).map((item) => ({
        id: item.id,
        to: `/funding/${item.id}`,
        title: item.fundingBody,
        detail: joinDetail(item.scheme, item.status, item.notes),
      })),
      total: funding.data?.meta.totalItems ?? 0,
      isFetching: funding.isFetching,
      isError: funding.isError,
    },
  ];

  const groupsWithResults = groups.filter((group) => group.results.length > 0);
  const anyFetching = groups.some((group) => group.isFetching);
  const failedGroups = groups.filter((group) => group.isError);
  const typedEnough = query.trim().length >= MIN_SEARCH_LENGTH;
  const settled = term === query.trim() && !anyFetching;
  const showPanel = open && typedEnough;

  function clear() {
    setQuery("");
    setTerm("");
    inputRef.current?.focus();
  }

  let body: ReactNode;
  if (groupsWithResults.length > 0) {
    body = (
      <div className="flex flex-col gap-3">
        {groupsWithResults.map((group) => (
          <section key={group.key} aria-label={`${group.label} results`}>
            <div className="mb-1 flex items-center justify-between gap-2 px-2">
              <h3 className="flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                <group.icon className="h-3.5 w-3.5" />
                {group.label}
              </h3>
              <span className="text-xs tabular-nums text-muted-foreground">
                {group.total > group.results.length
                  ? `Showing ${group.results.length} of ${group.total}`
                  : `${group.total} ${group.total === 1 ? "match" : "matches"}`}
              </span>
            </div>
            <ul className="flex flex-col">
              {group.results.map((result) => (
                <li key={result.id}>
                  <Link
                    to={result.to}
                    onClick={() => setOpen(false)}
                    className="block rounded-md px-2 py-1.5 hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                  >
                    <span className="block truncate text-sm font-medium text-foreground">
                      {result.title}
                    </span>
                    {result.detail ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {result.detail}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    );
  } else if (!settled) {
    body = (
      <p className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Searching…
      </p>
    );
  } else {
    body = (
      <p className="px-2 py-3 text-sm text-muted-foreground">
        Nothing found for “{query.trim()}”.
      </p>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-label="Search everything"
          aria-expanded={showPanel}
          aria-controls={panelId}
          aria-autocomplete="list"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              if (query) {
                event.preventDefault();
                clear();
              } else {
                setOpen(false);
                inputRef.current?.blur();
              }
            }
          }}
          placeholder="Search projects, papers, tasks, notes, conferences and funding…"
          autoComplete="off"
          className="h-11 w-full rounded-xl border bg-card pl-10 pr-20 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-search-cancel-button]:hidden"
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {anyFetching && enabled ? (
            <Loader2
              aria-hidden="true"
              className="h-4 w-4 animate-spin text-muted-foreground"
            />
          ) : null}
          {query ? (
            <button
              type="button"
              onClick={clear}
              aria-label="Clear search"
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 font-mono text-[0.6875rem] text-muted-foreground sm:inline">
              /
            </kbd>
          )}
        </div>
      </div>

      {showPanel ? (
        <div
          id={panelId}
          role="region"
          aria-label="Search results"
          className="absolute inset-x-0 top-full z-30 mt-2 max-h-[70vh] overflow-y-auto rounded-xl border bg-popover p-2 text-popover-foreground shadow-lg"
        >
          {body}
          {failedGroups.length > 0 ? (
            <p className="mt-2 px-2 text-xs text-destructive">
              Couldn't search{" "}
              {failedGroups.map((group) => group.label).join(", ")}. Try again
              in a moment.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
