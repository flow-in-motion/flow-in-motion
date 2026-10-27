import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  Boxes,
  CheckSquare2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  FolderKanban,
  GitBranch,
  Network,
  NotebookPen,
  Search,
} from "lucide-react";
import { Link } from "react-router-dom";

import {
  useCurrentWorkspace,
  useModules,
  useNotes,
  useProjects,
  useTasks,
  type ApiModule,
  type ApiNote,
  type ApiProject,
  type ApiTask,
  useMe,
} from "@/api/hooks";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeading } from "@/components/typography/heading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { paperDisplayTitle } from "@/lib/paper-title";
import { statusBadgeClass, TONE_FILL_CLASSES, toneFor } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { useSessionListState } from "@/hooks/use-session-list-state";

type LinkedItem = ApiTask | ApiNote;
type MapView = "tree" | "bubbles";

type BubbleNode = {
  key: string;
  sourceId: string;
  kind: "project" | "module" | "task" | "note";
  title: string;
  href: string;
  status?: string | null;
};

type BubblePosition = BubbleNode & { x: number; y: number };

type Point = { x: number; y: number };
/** Where the viewer has dragged each bubble, keyed by bubble key. */
type BubbleLayout = Record<string, Point>;

/** The map is never narrower than this; narrower screens scroll sideways. */
const BUBBLE_MAP_MIN_WIDTH = 1100;
/** The map is never shorter than this. */
const BUBBLE_MAP_MIN_HEIGHT = 520;
/** Vertical room each bubble in a column gets, name included. */
const BUBBLE_ROW_SPACING = 105;
/** Room a bubble needs between its centre and the map's edge, name included. */
const BUBBLE_EDGE_ROOM = 90;
/** How far out a bubble can be dragged, so the map can't grow without limit. */
const BUBBLE_MAP_MAX_SIZE = 6000;
/** Column centres as a share of the map width: projects, papers, then tasks and notes. */
const BUBBLE_COLUMN_SHARES = [340 / 1100, 650 / 1100, 970 / 1100] as const;
const BUBBLE_ROOT_KEY = "root";
/** How far (in map units) the pointer must move before a press becomes a drag. */
const DRAG_THRESHOLD = 4;

/** Reads a saved layout, ignoring anything malformed. */
function parseBubbleLayout(saved: string): BubbleLayout {
  if (!saved) return {};
  try {
    const parsed: unknown = JSON.parse(saved);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const layout: BubbleLayout = {};
    for (const [key, value] of Object.entries(parsed)) {
      const point = value as Partial<Point> | null;
      if (
        point &&
        typeof point.x === "number" &&
        typeof point.y === "number" &&
        Number.isFinite(point.x) &&
        Number.isFinite(point.y)
      ) {
        layout[key] = { x: point.x, y: point.y };
      }
    }
    return layout;
  } catch {
    return {};
  }
}

/**
 * Keeps a bubble off the map's top and left edges. Bubbles can go as far
 * right or down as needed (within reason): the map grows to fit them.
 */
function keepOnMap(point: Point): Point {
  return {
    x: Math.min(Math.max(point.x, 50), BUBBLE_MAP_MAX_SIZE),
    y: Math.min(Math.max(point.y, 50), BUBBLE_MAP_MAX_SIZE),
  };
}

function matchesSearch(value: string | null | undefined, search: string) {
  return !search || value?.toLowerCase().includes(search);
}

/** Selected = solid primary. Inactive = white pill, light-grey border. Matches the Pipeline page's View toggle. */
function controlPillClass(selected: boolean) {
  return cn(
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
    selected
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
  );
}

/** A small status label, coloured by what the status means (see lib/tones). */
function StatusBadge({
  status,
  className,
}: {
  status: string | null | undefined;
  className?: string;
}) {
  if (!status) return null;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-md border px-1.5 py-px text-[0.6875rem] font-medium leading-4",
        statusBadgeClass(status),
        className,
      )}
    >
      <span className="sr-only">Status: </span>
      {status}
    </span>
  );
}

function bubbleAccessibleName(label: string, title: string, status?: string | null) {
  return status ? `${label}: ${title}, ${status}` : `${label}: ${title}`;
}

function bubbleStatusLabel(status: string) {
  return status.length > 13 ? `${status.slice(0, 12)}…` : status;
}

/**
 * The +/− button on a bubble that can hold others (the workspace, projects
 * and papers). When nothing is linked under it yet, it stays visible but
 * greyed out, so every bubble of that kind looks the same.
 */
function BubbleCollapseToggle({
  kind,
  title,
  isCollapsed,
  hasChildren,
  radius,
  onToggle,
}: {
  kind: "workspace" | "project" | "paper";
  title: string;
  isCollapsed: boolean;
  hasChildren: boolean;
  radius: number;
  onToggle: () => void;
}) {
  const offset = Math.round(radius * 0.74);
  const label = `${isCollapsed ? "Expand" : "Collapse"} ${kind} ${title}`;
  if (!hasChildren) {
    return (
      <g
        role="button"
        aria-label={label}
        aria-disabled="true"
        className="cursor-default"
        transform={`translate(${offset} ${-offset})`}
      >
        <title>Nothing is linked to this {kind} yet</title>
        <circle
          r="11"
          className="fill-muted stroke-border/70"
          strokeWidth="1.5"
        />
        <text
          textAnchor="middle"
          y="4"
          className="select-none fill-muted-foreground/50 text-xs font-bold"
        >
          −
        </text>
      </g>
    );
  }
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-expanded={!isCollapsed}
      className="cursor-pointer outline-none"
      transform={`translate(${offset} ${-offset})`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggle();
        }
      }}
    >
      <title>{isCollapsed ? "Show" : "Hide"} what's linked to this {kind}</title>
      <circle
        r="11"
        className="fill-card stroke-border transition hover:stroke-primary focus-visible:stroke-ring"
        strokeWidth="1.5"
      />
      <text
        textAnchor="middle"
        y="4"
        className="select-none fill-foreground text-xs font-bold"
      >
        {isCollapsed ? "+" : "−"}
      </text>
    </g>
  );
}

function ItemNode({
  item,
  kind,
  status,
}: {
  item: LinkedItem;
  kind: "task" | "note";
  status?: string | null;
}) {
  const Icon = kind === "task" ? CheckSquare2 : NotebookPen;
  const href =
    kind === "task" ? `/tasks/${item.id}` : `/daily-notes/${item.id}`;
  return (
    <Link
      to={href}
      className={cn(
        "group flex min-w-48 items-start gap-2 rounded-lg border bg-card px-3 py-2.5 text-left transition-colors hover:border-primary/30 hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        kind === "task"
          ? "border-amber-200 dark:border-amber-900"
          : "border-emerald-200 dark:border-emerald-900",
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          kind === "task" ? "text-amber-600" : "text-emerald-600",
        )}
      />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium group-hover:text-primary">
          {item.title}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span className="capitalize">{kind}</span>
          <StatusBadge status={status} />
        </span>
      </span>
    </Link>
  );
}

function LeafCollection({
  tasks,
  notes,
}: {
  tasks: ApiTask[];
  notes: ApiNote[];
}) {
  if (tasks.length === 0 && notes.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
        No linked tasks or notes
      </p>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {tasks.map((task) => (
        <ItemNode key={task.id} item={task} kind="task" status={task.status} />
      ))}
      {notes.map((note) => (
        <ItemNode key={note.id} item={note} kind="note" />
      ))}
    </div>
  );
}

function Branch({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative ml-4 border-l-2 border-border/80 pl-6 before:absolute before:left-0 before:top-6 before:w-6 before:border-t-2 before:border-border/80",
        className,
      )}
    >
      {children}
    </div>
  );
}

function bubbleLabel(title: string) {
  return title.length > 20 ? `${title.slice(0, 18)}…` : title;
}

const bubbleStyles = {
  project: {
    circle: "fill-blue-100 stroke-blue-600 dark:fill-blue-950",
    text: "fill-blue-800 dark:fill-blue-200",
    label: "Project",
  },
  module: {
    circle: "fill-violet-100 stroke-violet-600 dark:fill-violet-950",
    text: "fill-violet-800 dark:fill-violet-200",
    label: "Paper",
  },
  task: {
    circle: "fill-amber-100 stroke-amber-500 dark:fill-amber-950",
    text: "fill-amber-800 dark:fill-amber-200",
    label: "Task",
  },
  note: {
    circle: "fill-emerald-100 stroke-emerald-600 dark:fill-emerald-950",
    text: "fill-emerald-800 dark:fill-emerald-200",
    label: "Note",
  },
} as const;

function BubbleRelationshipMap({
  workspaceName,
  projects,
  modules,
  tasks,
  notes,
  projectFilter,
  search,
  layout,
  onMoveBubble,
  onResetLayout,
}: {
  workspaceName: string;
  projects: ApiProject[];
  modules: ApiModule[];
  tasks: ApiTask[];
  notes: ApiNote[];
  projectFilter: string;
  search: string;
  layout: BubbleLayout;
  onMoveBubble: (key: string, point: Point) => void;
  onResetLayout: () => void;
}) {
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set());
  const svgRef = useRef<SVGSVGElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  // The width available on screen, so the map can use all of it.
  const [availableWidth, setAvailableWidth] = useState(BUBBLE_MAP_MIN_WIDTH);
  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    if (frame.clientWidth > 0) setAvailableWidth(frame.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.floor(entry?.contentRect.width ?? 0);
      if (width > 0) setAvailableWidth(width);
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);
  const dragRef = useRef<{
    key: string;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    origin: Point;
    current: Point | null;
  } | null>(null);
  // A drag ends with the browser's click on the same bubble; this stops that
  // click from opening the record.
  const suppressClickRef = useRef(false);
  const [dragPreview, setDragPreview] = useState<
    ({ key: string } & Point) | null
  >(null);

  function toggleCollapse(key: string) {
    setCollapsedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const projectScope = new Set(
    projects
      .filter(
        (project) => projectFilter === "all" || project.id === projectFilter,
      )
      .map((project) => project.id),
  );
  const scopedProjects = projects.filter((project) =>
    projectScope.has(project.id),
  );
  const scopedModules = modules.filter((module) =>
    module.projectId
      ? projectScope.has(module.projectId)
      : projectFilter === "all",
  );
  const scopedModuleIds = new Set(scopedModules.map((module) => module.id));
  const scopedTasks = tasks.filter(
    (task) =>
      projectFilter === "all" ||
      (task.projectId
        ? projectScope.has(task.projectId)
        : Boolean(task.moduleId && scopedModuleIds.has(task.moduleId))),
  );
  const scopedNotes = notes.filter(
    (note) =>
      projectFilter === "all" ||
      (note.projectId
        ? projectScope.has(note.projectId)
        : Boolean(note.moduleId && scopedModuleIds.has(note.moduleId))),
  );

  const directlyMatchedProjects = new Set(
    scopedProjects
      .filter((project) => matchesSearch(project.title, search))
      .map((project) => project.id),
  );
  const directlyMatchedModules = new Set(
    scopedModules
      .filter((module) => matchesSearch(paperDisplayTitle(module), search))
      .map((module) => module.id),
  );
  const directlyMatchedTasks = new Set(
    scopedTasks
      .filter((task) => matchesSearch(task.title, search))
      .map((task) => task.id),
  );
  const directlyMatchedNotes = new Set(
    scopedNotes
      .filter((note) => matchesSearch(note.title, search))
      .map((note) => note.id),
  );

  const visibleTasks = scopedTasks.filter(
    (task) =>
      directlyMatchedTasks.has(task.id) ||
      Boolean(task.projectId && directlyMatchedProjects.has(task.projectId)) ||
      Boolean(task.moduleId && directlyMatchedModules.has(task.moduleId)),
  );
  const visibleNotes = scopedNotes.filter(
    (note) =>
      directlyMatchedNotes.has(note.id) ||
      Boolean(note.projectId && directlyMatchedProjects.has(note.projectId)) ||
      Boolean(note.moduleId && directlyMatchedModules.has(note.moduleId)),
  );
  const visibleTaskModuleIds = new Set(
    visibleTasks
      .map((task) => task.moduleId)
      .filter((id): id is string => Boolean(id)),
  );
  const visibleNoteModuleIds = new Set(
    visibleNotes
      .map((note) => note.moduleId)
      .filter((id): id is string => Boolean(id)),
  );
  const visibleModules = scopedModules.filter(
    (module) =>
      directlyMatchedModules.has(module.id) ||
      Boolean(
        module.projectId && directlyMatchedProjects.has(module.projectId),
      ) ||
      visibleTaskModuleIds.has(module.id) ||
      visibleNoteModuleIds.has(module.id),
  );
  const visibleModuleIds = new Set(visibleModules.map((module) => module.id));
  const visibleModuleById = new Map(
    visibleModules.map((module) => [module.id, module]),
  );
  const visibleProjects = scopedProjects.filter(
    (project) =>
      directlyMatchedProjects.has(project.id) ||
      visibleModules.some((module) => module.projectId === project.id) ||
      visibleTasks.some(
        (task) =>
          task.projectId === project.id ||
          Boolean(
            task.moduleId &&
            visibleModuleIds.has(task.moduleId) &&
            visibleModuleById.get(task.moduleId)?.projectId === project.id,
          ),
      ) ||
      visibleNotes.some(
        (note) =>
          note.projectId === project.id ||
          Boolean(
            note.moduleId &&
            visibleModuleIds.has(note.moduleId) &&
            visibleModuleById.get(note.moduleId)?.projectId === project.id,
          ),
      ),
  );

  const projectHasChildren = new Set<string>();
  const moduleHasChildren = new Set<string>();
  for (const module of visibleModules) {
    if (module.projectId) projectHasChildren.add(module.projectId);
  }
  for (const task of visibleTasks) {
    if (task.moduleId) moduleHasChildren.add(task.moduleId);
    else if (task.projectId) projectHasChildren.add(task.projectId);
  }
  for (const note of visibleNotes) {
    if (note.moduleId) moduleHasChildren.add(note.moduleId);
    else if (note.projectId) projectHasChildren.add(note.projectId);
  }

  function expandAll() {
    setCollapsedKeys(new Set());
  }

  function collapseAll() {
    const keys = new Set<string>();
    for (const projectId of projectHasChildren)
      keys.add(`project-${projectId}`);
    for (const moduleId of moduleHasChildren) keys.add(`module-${moduleId}`);
    setCollapsedKeys(keys);
  }

  const isWorkspaceCollapsed = collapsedKeys.has(BUBBLE_ROOT_KEY);
  const workspaceHasChildren =
    visibleProjects.length > 0 ||
    visibleModules.length > 0 ||
    visibleTasks.length > 0 ||
    visibleNotes.length > 0;

  function isCollapsedDescendant(
    moduleId?: string | null,
    projectId?: string | null,
  ) {
    if (isWorkspaceCollapsed) return true;
    if (moduleId) {
      if (collapsedKeys.has(`module-${moduleId}`)) return true;
      const parentProjectId = visibleModuleById.get(moduleId)?.projectId;
      return Boolean(
        parentProjectId && collapsedKeys.has(`project-${parentProjectId}`),
      );
    }
    if (projectId) return collapsedKeys.has(`project-${projectId}`);
    return false;
  }

  const displayedModules = visibleModules.filter(
    (module) =>
      !isWorkspaceCollapsed &&
      !(module.projectId && collapsedKeys.has(`project-${module.projectId}`)),
  );
  const displayedTasks = visibleTasks.filter(
    (task) => !isCollapsedDescendant(task.moduleId, task.projectId),
  );
  const displayedNotes = visibleNotes.filter(
    (note) => !isCollapsedDescendant(note.moduleId, note.projectId),
  );

  const displayedProjects = isWorkspaceCollapsed ? [] : visibleProjects;
  const projectNodes: BubbleNode[] = displayedProjects.map((project) => ({
    key: `project-${project.id}`,
    sourceId: project.id,
    kind: "project",
    title: project.title,
    href: `/projects/${project.id}`,
    status: project.status,
  }));
  const moduleNodes: BubbleNode[] = displayedModules.map((module) => ({
    key: `module-${module.id}`,
    sourceId: module.id,
    kind: "module",
    title: paperDisplayTitle(module),
    href: `/modules/${module.id}`,
    status: module.status,
  }));
  const leafNodes: BubbleNode[] = [
    ...displayedTasks.map((task) => ({
      key: `task-${task.id}`,
      sourceId: task.id,
      kind: "task" as const,
      title: task.title,
      href: `/tasks/${task.id}`,
      status: task.status,
    })),
    ...displayedNotes.map((note) => ({
      key: `note-${note.id}`,
      sourceId: note.id,
      kind: "note" as const,
      title: note.title,
      href: `/daily-notes/${note.id}`,
    })),
  ];
  // Size the map by everything that matches, collapsed or not, so hiding a
  // branch doesn't shrink the map and move the bubble you just clicked.
  const rowCount = Math.max(
    visibleProjects.length,
    visibleModules.length,
    visibleTasks.length + visibleNotes.length,
    4,
  );
  // The columns fill the width on screen and get taller as they fill up.
  const baseWidth = Math.max(BUBBLE_MAP_MIN_WIDTH, availableWidth);
  const baseHeight = Math.max(
    BUBBLE_MAP_MIN_HEIGHT,
    rowCount * BUBBLE_ROW_SPACING + 80,
  );
  const [projectColumnX, paperColumnX, leafColumnX] = BUBBLE_COLUMN_SHARES.map(
    (share) => Math.round(baseWidth * share),
  );

  function positionColumn(nodes: BubbleNode[], x: number): BubblePosition[] {
    const step = baseHeight / (nodes.length + 1);
    return nodes.map((node, index) => ({ ...node, x, y: step * (index + 1) }));
  }

  // A bubble the viewer has moved stays where they put it; the rest keep
  // their column layout.
  function placeFor(key: string, fallback: Point): Point {
    const point =
      dragPreview?.key === key ? dragPreview : (layout[key] ?? fallback);
    return keepOnMap(point);
  }

  const positioned = [
    ...positionColumn(projectNodes, projectColumnX),
    ...positionColumn(moduleNodes, paperColumnX),
    ...positionColumn(leafNodes, leafColumnX),
  ].map((node) => ({ ...node, ...placeFor(node.key, node) }));
  const positionByKey = new Map(positioned.map((node) => [node.key, node]));
  const rootKey = BUBBLE_ROOT_KEY;
  const root = placeFor(rootKey, { x: 90, y: baseHeight / 2 });
  // Grow the map to take in any bubble dragged past its edge.
  const mapWidth = Math.ceil(
    positioned.reduce(
      (widest, node) => Math.max(widest, node.x + BUBBLE_EDGE_ROOM),
      Math.max(baseWidth, root.x + BUBBLE_EDGE_ROOM),
    ),
  );
  const mapHeight = Math.ceil(
    positioned.reduce(
      (tallest, node) => Math.max(tallest, node.y + BUBBLE_EDGE_ROOM),
      Math.max(baseHeight, root.y + BUBBLE_EDGE_ROOM),
    ),
  );
  // Draw the bubble being dragged last so it sits on top of the others.
  const drawOrder = dragPreview
    ? [
        ...positioned.filter((node) => node.key !== dragPreview.key),
        ...positioned.filter((node) => node.key === dragPreview.key),
      ]
    : positioned;
  const hasMovedBubbles = Object.keys(layout).length > 0;

  /** Map units per screen pixel (the page may be zoomed). */
  function mapScale() {
    const matrix = svgRef.current?.getScreenCTM?.();
    return matrix && matrix.a > 0 ? 1 / matrix.a : 1;
  }

  function startDrag(
    event: ReactPointerEvent<SVGGElement>,
    key: string,
    origin: Point,
  ) {
    if (event.button !== 0) return;
    // The +/− button collapses a branch; pressing it shouldn't move the bubble.
    if ((event.target as Element).closest?.('[role="button"]')) return;
    // Stops the browser starting its own link drag or selecting text.
    event.preventDefault();
    suppressClickRef.current = false;
    dragRef.current = {
      key,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      origin,
      current: null,
    };
  }

  function moveDrag(event: ReactPointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const scale = mapScale();
    const dx = (event.clientX - drag.startClientX) * scale;
    const dy = (event.clientY - drag.startClientY) * scale;
    if (!drag.current && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!drag.current) {
      // Capture only once it's really a drag. Capturing on press would send
      // the click of a plain press to the map rather than the bubble's link,
      // so the bubble would no longer open.
      try {
        svgRef.current?.setPointerCapture?.(event.pointerId);
      } catch {
        // The pointer may already be gone; the drag still works without it.
      }
    }
    drag.current = keepOnMap({
      x: drag.origin.x + dx,
      y: drag.origin.y + dy,
    });
    setDragPreview({ key: drag.key, ...drag.current });
  }

  function endDrag(event: ReactPointerEvent<SVGSVGElement>, keep: boolean) {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    dragRef.current = null;
    if (drag.current) {
      suppressClickRef.current = true;
      if (keep) onMoveBubble(drag.key, drag.current);
    }
    setDragPreview(null);
  }
  const rootLabel = `Workspace: ${workspaceName}`;
  const labelByKey = new Map<string, string>([[rootKey, rootLabel]]);
  for (const node of positioned) {
    labelByKey.set(node.key, `${bubbleStyles[node.kind].label}: ${node.title}`);
  }

  function parentKeyFor(moduleId?: string | null, projectId?: string | null) {
    if (moduleId) return `module-${moduleId}`;
    if (projectId) return `project-${projectId}`;
    return rootKey;
  }

  const edges: {
    from: { x: number; y: number };
    to: { x: number; y: number };
    key: string;
    label: string;
  }[] = [];

  function addEdge(edgeKey: string, parentKey: string, targetKey: string) {
    const target = positionByKey.get(targetKey);
    const parent = parentKey === rootKey ? root : positionByKey.get(parentKey);
    const parentLabel = labelByKey.get(parentKey);
    const targetLabel = labelByKey.get(targetKey);
    if (target && parent && parentLabel && targetLabel) {
      edges.push({
        from: parent,
        to: target,
        key: edgeKey,
        label: `${parentLabel} → ${targetLabel}`,
      });
    }
  }

  for (const project of displayedProjects) {
    addEdge(`root-project-${project.id}`, rootKey, `project-${project.id}`);
  }
  for (const module of displayedModules) {
    addEdge(
      `module-${module.id}`,
      parentKeyFor(null, module.projectId),
      `module-${module.id}`,
    );
  }
  for (const task of displayedTasks) {
    addEdge(
      `task-${task.id}`,
      parentKeyFor(task.moduleId, task.projectId),
      `task-${task.id}`,
    );
  }
  for (const note of displayedNotes) {
    addEdge(
      `note-${note.id}`,
      parentKeyFor(note.moduleId, note.projectId),
      `note-${note.id}`,
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <p className="mr-auto text-xs text-muted-foreground">
          Drag a bubble to move it. Click it to open.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onResetLayout}
          disabled={!hasMovedBubbles}
        >
          Reset layout
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={expandAll}>
          Expand all
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={collapseAll}>
          Collapse all
        </Button>
      </div>
      <div
        ref={frameRef}
        className="overflow-x-auto rounded-lg border bg-muted/10"
      >
        {/* Drawn at 1 map unit per pixel: the map grows with its content and
            scrolls sideways when it's wider than the screen. */}
        <svg
          ref={svgRef}
          role="group"
          aria-label="Bubble relationship map"
          viewBox={`0 0 ${mapWidth} ${mapHeight}`}
          className="block"
          style={{ width: mapWidth, height: mapHeight }}
          onPointerMove={moveDrag}
          onPointerUp={(event) => endDrag(event, true)}
          onPointerCancel={(event) => endDrag(event, false)}
        >
          <title>Bubble relationship map for {workspaceName}</title>
          {edges.map((edge) => {
            const dir = edge.to.x >= edge.from.x ? 1 : -1;
            const path = `M ${edge.from.x + 40 * dir} ${edge.from.y} C ${edge.from.x + 120 * dir} ${edge.from.y}, ${edge.to.x - 120 * dir} ${edge.to.y}, ${edge.to.x - 40 * dir} ${edge.to.y}`;
            return (
              <g key={edge.key} className="group/edge" aria-hidden="true">
                <path
                  d={path}
                  fill="none"
                  className="stroke-muted-foreground/40 transition-all duration-150 group-hover/edge:stroke-primary group-hover/edge:drop-shadow-sm"
                  strokeWidth="2"
                />
                <path
                  d={path}
                  fill="none"
                  className="cursor-pointer stroke-transparent [pointer-events:stroke]"
                  strokeWidth="18"
                >
                  <title>{edge.label}</title>
                </path>
              </g>
            );
          })}

          <g
            transform={`translate(${root.x} ${root.y})`}
            className={cn(
              "touch-none",
              dragPreview?.key === rootKey ? "cursor-grabbing" : "cursor-grab",
            )}
            onPointerDown={(event) => startDrag(event, rootKey, root)}
          >
            <circle
              r="44"
              className="fill-violet-600 stroke-violet-700"
              strokeWidth="3"
            />
            <text
              textAnchor="middle"
              y="4"
              className="fill-white text-[10px] font-semibold uppercase"
            >
              Workspace
            </text>
            <text
              textAnchor="middle"
              y="64"
              className="fill-foreground text-xs font-semibold"
            >
              {bubbleLabel(workspaceName)}
            </text>
            <BubbleCollapseToggle
              kind="workspace"
              title={workspaceName}
              isCollapsed={isWorkspaceCollapsed}
              hasChildren={workspaceHasChildren}
              radius={44}
              onToggle={() => toggleCollapse(BUBBLE_ROOT_KEY)}
            />
          </g>

          {drawOrder.map((node) => {
            const style = bubbleStyles[node.kind];
            const isCollapsed = collapsedKeys.has(node.key);
            const holdsOthers =
              node.kind === "project" || node.kind === "module";
            const hasChildren =
              node.kind === "project"
                ? projectHasChildren.has(node.sourceId)
                : moduleHasChildren.has(node.sourceId);
            return (
              <g
                key={node.key}
                transform={`translate(${node.x} ${node.y})`}
                className={cn(
                  "touch-none",
                  dragPreview?.key === node.key
                    ? "cursor-grabbing"
                    : "cursor-grab",
                )}
                onPointerDown={(event) => startDrag(event, node.key, node)}
              >
                <Link
                  to={node.href}
                  onClick={(event) => {
                    if (suppressClickRef.current) {
                      event.preventDefault();
                      suppressClickRef.current = false;
                    }
                  }}
                  onDragStart={(event) => event.preventDefault()}
                  aria-label={bubbleAccessibleName(
                    style.label,
                    node.title,
                    node.status,
                  )}
                >
                  <g className="group focus:outline-none">
                    <title>
                      {bubbleAccessibleName(
                        style.label,
                        node.title,
                        node.status,
                      )}
                    </title>
                    <circle
                      r="38"
                      className={cn(
                        "transition group-hover:brightness-95 group-focus:stroke-[4px]",
                        style.circle,
                      )}
                      strokeWidth="3"
                    />
                    <text
                      textAnchor="middle"
                      y={node.status ? "-3" : "4"}
                      className={cn(
                        "text-[10px] font-semibold uppercase",
                        style.text,
                      )}
                    >
                      {style.label}
                    </text>
                    {node.status ? (
                      <text
                        textAnchor="middle"
                        y="12"
                        className={cn(
                          "text-[9px] font-medium",
                          TONE_FILL_CLASSES[toneFor(node.status)],
                        )}
                      >
                        {bubbleStatusLabel(node.status)}
                      </text>
                    ) : null}
                    <text
                      textAnchor="middle"
                      y="58"
                      className="fill-foreground text-xs font-medium"
                    >
                      {bubbleLabel(node.title)}
                    </text>
                  </g>
                </Link>
                {holdsOthers ? (
                  <BubbleCollapseToggle
                    kind={node.kind === "project" ? "project" : "paper"}
                    title={node.title}
                    isCollapsed={isCollapsed}
                    hasChildren={hasChildren}
                    radius={38}
                    onToggle={() => toggleCollapse(node.key)}
                  />
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function ModuleBranch({
  module,
  tasks,
  notes,
  isExpanded,
  onToggleExpanded,
}: {
  module: ApiModule;
  tasks: ApiTask[];
  notes: ApiNote[];
  isExpanded: boolean;
  onToggleExpanded: () => void;
}) {
  return (
    <Branch>
      <div className="rounded-lg border bg-muted/30 p-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            aria-label={`${isExpanded ? "Collapse" : "Expand"} ${paperDisplayTitle(module)}`}
            aria-expanded={isExpanded}
            onClick={onToggleExpanded}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
          <Link
            to={`/modules/${module.id}`}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white">
              <Boxes className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold hover:text-primary">
                {paperDisplayTitle(module)}
              </span>
              <span className="block text-xs text-muted-foreground">
                Paper · {tasks.length} tasks · {notes.length} notes
              </span>
            </span>
            <StatusBadge status={module.status} className="ml-auto" />
          </Link>
        </div>
        {isExpanded ? (
          <div className="mt-3 border-t pt-3">
            <LeafCollection tasks={tasks} notes={notes} />
          </div>
        ) : null}
      </div>
    </Branch>
  );
}

function ProjectTree({
  project,
  modules,
  tasks,
  notes,
  search,
  isExpanded,
  onToggleExpanded,
  isModuleExpanded,
  onToggleModuleExpanded,
}: {
  project: ApiProject;
  modules: ApiModule[];
  tasks: ApiTask[];
  notes: ApiNote[];
  search: string;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  isModuleExpanded: (moduleId: string) => boolean;
  onToggleModuleExpanded: (moduleId: string) => void;
}) {
  const projectMatches = matchesSearch(project.title, search);
  const directTasks = tasks.filter(
    (task) =>
      task.projectId === project.id &&
      !task.moduleId &&
      (projectMatches || matchesSearch(task.title, search)),
  );
  const directNotes = notes.filter(
    (note) =>
      note.projectId === project.id &&
      !note.moduleId &&
      (projectMatches || matchesSearch(note.title, search)),
  );
  const visibleModules = modules.filter((module) => {
    if (module.projectId !== project.id) return false;
    if (projectMatches || matchesSearch(paperDisplayTitle(module), search))
      return true;
    return (
      tasks.some(
        (task) =>
          task.moduleId === module.id && matchesSearch(task.title, search),
      ) ||
      notes.some(
        (note) =>
          note.moduleId === module.id && matchesSearch(note.title, search),
      )
    );
  });

  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          aria-label={`${isExpanded ? "Collapse" : "Expand"} ${project.title}`}
          aria-expanded={isExpanded}
          onClick={onToggleExpanded}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
        <Link
          to={`/projects/${project.id}`}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
            <FolderKanban className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold hover:text-primary">
              {project.title}
            </span>
            <span className="block text-xs text-muted-foreground">
              Project · {visibleModules.length} papers
            </span>
          </span>
          <StatusBadge status={project.status} className="ml-auto" />
        </Link>
      </div>

      {isExpanded ? (
        <div className="mt-3 space-y-3">
          {directTasks.length > 0 || directNotes.length > 0 ? (
            <Branch>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Directly linked to project
                </p>
                <LeafCollection tasks={directTasks} notes={directNotes} />
              </div>
            </Branch>
          ) : null}
          {visibleModules.map((module) => (
            <ModuleBranch
              key={module.id}
              module={module}
              tasks={tasks.filter(
                (task) =>
                  task.moduleId === module.id &&
                  (projectMatches ||
                    matchesSearch(paperDisplayTitle(module), search) ||
                    matchesSearch(task.title, search)),
              )}
              notes={notes.filter(
                (note) =>
                  note.moduleId === module.id &&
                  (projectMatches ||
                    matchesSearch(paperDisplayTitle(module), search) ||
                    matchesSearch(note.title, search)),
              )}
              isExpanded={isModuleExpanded(module.id)}
              onToggleExpanded={() => onToggleModuleExpanded(module.id)}
            />
          ))}
          {visibleModules.length === 0 &&
          directTasks.length === 0 &&
          directNotes.length === 0 ? (
            <p className="ml-10 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              No matching connections in this project.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export default function MindMapPage() {
  const workspace = useCurrentWorkspace();
  const tenantId = workspace.data?.id ?? "";
  const me = useMe();
  // The map shows the whole workspace, so load every item rather than the
  // first page of each list.
  const projectsQuery = useProjects(tenantId, 1, true, { pageSize: "all" });
  const modulesQuery = useModules(tenantId, undefined, 1, true, {
    pageSize: "all",
  });
  const tasksQuery = useTasks(tenantId, undefined, 1, true, {
    pageSize: "all",
  });
  const notesQuery = useNotes(tenantId, undefined, 1, true, {
    pageSize: "all",
  });
  // The API returns the workspace's General project separately from the
  // research projects. List it last so papers, tasks and notes filed under
  // General still appear on the map.
  const allProjects = useMemo(() => {
    const researchProjects = projectsQuery.data?.data ?? [];
    const generalProject = projectsQuery.data?.generalProject;
    return generalProject
      ? [...researchProjects, generalProject]
      : researchProjects;
  }, [projectsQuery.data]);
  const modules = useMemo(
    () => modulesQuery.data?.data ?? [],
    [modulesQuery.data],
  );
  const tasks = useMemo(() => tasksQuery.data?.data ?? [], [tasksQuery.data]);
  const notes = useMemo(() => notesQuery.data?.data ?? [], [notesQuery.data]);
  const [search, setSearch] = useSessionListState<string>(
    me.data?.id,
    tenantId,
    "mind-map:search",
    "",
  );

  const [projectFilter, setProjectFilter] = useSessionListState<string>(
    me.data?.id,
    tenantId,
    "mind-map:project",
    "all",
  );

  const [view, setView] = useSessionListState<MapView>(
    me.data?.id,
    tenantId,
    "mind-map:view",
    "tree",
  );
  // Saved as text because session preferences hold simple values only.
  const [savedBubbleLayout, setSavedBubbleLayout] =
    useSessionListState<string>(
      me.data?.id,
      tenantId,
      "mind-map:bubble-layout",
      "",
    );
  const bubbleLayout = useMemo(
    () => parseBubbleLayout(savedBubbleLayout),
    [savedBubbleLayout],
  );
  const [collapsedTreeKeys, setCollapsedTreeKeys] = useState<Set<string>>(
    new Set(),
  );
  const normalizedSearch = search.trim().toLowerCase();

  function toggleTreeKey(key: string) {
    setCollapsedTreeKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function isProjectExpanded(projectId: string) {
    return !collapsedTreeKeys.has(`project-${projectId}`);
  }

  function isModuleExpanded(moduleId: string) {
    return !collapsedTreeKeys.has(`module-${moduleId}`);
  }

  function expandAllTree() {
    setCollapsedTreeKeys(new Set());
  }

  function collapseAllTree() {
    const keys = new Set<string>();
    for (const project of allProjects) keys.add(`project-${project.id}`);
    for (const module of modules) keys.add(`module-${module.id}`);
    setCollapsedTreeKeys(keys);
  }

  const projects = useMemo(
    () =>
      allProjects.filter((project) => {
        if (projectFilter !== "all" && project.id !== projectFilter)
          return false;
        if (!normalizedSearch || matchesSearch(project.title, normalizedSearch))
          return true;
        const moduleIds = new Set(
          modules
            .filter((module) => module.projectId === project.id)
            .map((module) => module.id),
        );
        return (
          modules.some(
            (module) =>
              module.projectId === project.id &&
              matchesSearch(paperDisplayTitle(module), normalizedSearch),
          ) ||
          tasks.some(
            (task) =>
              (task.projectId === project.id ||
                (task.moduleId && moduleIds.has(task.moduleId))) &&
              matchesSearch(task.title, normalizedSearch),
          ) ||
          notes.some(
            (note) =>
              (note.projectId === project.id ||
                (note.moduleId && moduleIds.has(note.moduleId))) &&
              matchesSearch(note.title, normalizedSearch),
          )
        );
      }),
    [modules, normalizedSearch, notes, projectFilter, allProjects, tasks],
  );

  const independentModules = modules.filter(
    (module) =>
      !module.projectId &&
      (matchesSearch(paperDisplayTitle(module), normalizedSearch) ||
        tasks.some(
          (task) =>
            task.moduleId === module.id &&
            matchesSearch(task.title, normalizedSearch),
        ) ||
        notes.some(
          (note) =>
            note.moduleId === module.id &&
            matchesSearch(note.title, normalizedSearch),
        )),
  );
  const unassignedTasks = tasks.filter(
    (task) =>
      !task.projectId &&
      !task.moduleId &&
      matchesSearch(task.title, normalizedSearch),
  );
  const unassignedNotes = notes.filter(
    (note) =>
      !note.projectId &&
      !note.moduleId &&
      matchesSearch(note.title, normalizedSearch),
  );
  const showStandalone = projectFilter === "all";

  if (
    workspace.isPending ||
    projectsQuery.isPending ||
    modulesQuery.isPending ||
    tasksQuery.isPending ||
    notesQuery.isPending
  ) {
    return <LoadingState title="Building mind map" layout="canvas" />;
  }

  if (
    projectsQuery.isError ||
    modulesQuery.isError ||
    tasksQuery.isError ||
    notesQuery.isError
  ) {
    const error =
      projectsQuery.error ??
      modulesQuery.error ??
      tasksQuery.error ??
      notesQuery.error;
    return (
      <ErrorState
        title="Mind map could not be loaded"
        description={error?.message ?? "Please try again."}
        onRetry={() =>
          void Promise.all([
            projectsQuery.refetch(),
            modulesQuery.refetch(),
            tasksQuery.refetch(),
            notesQuery.refetch(),
          ])
        }
      />
    );
  }

  return (
    <div className="page-stack">
      <PageHeading
        icon={Network}
        tone="violet"
        eyebrow="Relationships"
        title="Mind map"
        description="Explore how projects, papers, tasks, and notes connect. Select any node to open its details."
      />

      <div className="surface-toolbar flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            View
          </span>
          <button
            type="button"
            aria-pressed={view === "tree"}
            onClick={() => setView("tree")}
            className={controlPillClass(view === "tree")}
          >
            <GitBranch className="h-3.5 w-3.5" /> Tree
          </button>
          <button
            type="button"
            aria-pressed={view === "bubbles"}
            onClick={() => setView("bubbles")}
            className={controlPillClass(view === "bubbles")}
          >
            <CircleDot className="h-3.5 w-3.5" /> Bubbles
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search the map"
              aria-label="Search the mind map"
              className="pl-9"
            />
          </div>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger
              aria-label="Filter mind map by project"
              className="sm:w-56"
            >
              <SelectValue placeholder="Filter by project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {allProjects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div
        role="group"
        className="flex flex-wrap items-center gap-4 rounded-xl border border-dashed bg-muted/20 px-4 py-3 text-xs text-muted-foreground"
        aria-label="Mind map legend"
      >
        <span className="font-semibold uppercase tracking-wide">Key:</span>
        <span className="inline-flex items-center gap-1.5">
          <Network className="h-4 w-4 text-violet-600" /> Workspace
        </span>
        <span className="inline-flex items-center gap-1.5">
          <FolderKanban className="h-4 w-4 text-blue-600" /> Project
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Boxes className="h-4 w-4 text-violet-600" /> Paper
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CheckSquare2 className="h-4 w-4 text-amber-600" /> Task
        </span>
        <span className="inline-flex items-center gap-1.5">
          <NotebookPen className="h-4 w-4 text-emerald-600" /> Note
        </span>
      </div>

      {view === "bubbles" ? (
        <BubbleRelationshipMap
          workspaceName={workspace.data?.name ?? "Workspace"}
          projects={allProjects}
          modules={modules}
          tasks={tasks}
          notes={notes}
          projectFilter={projectFilter}
          search={normalizedSearch}
          layout={bubbleLayout}
          onMoveBubble={(key, point) =>
            setSavedBubbleLayout(
              JSON.stringify({ ...bubbleLayout, [key]: point }),
            )
          }
          onResetLayout={() => setSavedBubbleLayout("")}
        />
      ) : (
        <div className="relative space-y-4 rounded-lg border bg-muted/10 p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-white">
              <Network className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-semibold">
                {workspace.data?.name ?? "Workspace"}
              </span>
              <span className="block text-xs text-muted-foreground">
                Research workspace
              </span>
            </span>
            <div className="ml-auto flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={expandAllTree}
              >
                Expand all
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={collapseAllTree}
              >
                Collapse all
              </Button>
            </div>
          </div>

          <div className="ml-5 space-y-4 border-l-2 border-border pl-5 sm:ml-8 sm:pl-8">
            {projects.map((project) => (
              <ProjectTree
                key={project.id}
                project={project}
                modules={modules}
                tasks={tasks}
                notes={notes}
                search={normalizedSearch}
                isExpanded={isProjectExpanded(project.id)}
                onToggleExpanded={() => toggleTreeKey(`project-${project.id}`)}
                isModuleExpanded={isModuleExpanded}
                onToggleModuleExpanded={(moduleId) =>
                  toggleTreeKey(`module-${moduleId}`)
                }
              />
            ))}

            {showStandalone &&
              independentModules.map((module) => (
                <ModuleBranch
                  key={module.id}
                  module={module}
                  tasks={tasks.filter(
                    (task) =>
                      task.moduleId === module.id &&
                      (matchesSearch(
                        paperDisplayTitle(module),
                        normalizedSearch,
                      ) ||
                        matchesSearch(task.title, normalizedSearch)),
                  )}
                  notes={notes.filter(
                    (note) =>
                      note.moduleId === module.id &&
                      (matchesSearch(
                        paperDisplayTitle(module),
                        normalizedSearch,
                      ) ||
                        matchesSearch(note.title, normalizedSearch)),
                  )}
                  isExpanded={isModuleExpanded(module.id)}
                  onToggleExpanded={() => toggleTreeKey(`module-${module.id}`)}
                />
              ))}

            {showStandalone &&
            (unassignedTasks.length > 0 || unassignedNotes.length > 0) ? (
              <Branch className="ml-0">
                <div className="rounded-lg border bg-card p-4">
                  <p className="mb-3 font-semibold">Unassigned items</p>
                  <LeafCollection
                    tasks={unassignedTasks}
                    notes={unassignedNotes}
                  />
                </div>
              </Branch>
            ) : null}

            {projects.length === 0 &&
            (!showStandalone ||
              (independentModules.length === 0 &&
                unassignedTasks.length === 0 &&
                unassignedNotes.length === 0)) ? (
              <div className="rounded-lg border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">
                No connections match the current filters.
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
