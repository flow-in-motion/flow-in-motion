import { useMemo, useState } from "react";
import {
  Calendar as CalendarIcon,
  CalendarDays,
  Boxes,
  CheckSquare2,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  NotebookPen,
  Presentation,
} from "lucide-react";
import { Link } from "react-router-dom";

import {
  useCalendarEvents,
  useCreateCalendarEvent,
  useCurrentWorkspace,
  useConferences,
  useDeleteCalendarEvent,
  useMe,
  useModules,
  useNotes,
  useProjects,
  useTasks,
  useUpdateCalendarEvent,
  type ApiCalendarEvent,
  type ApiProject,
  type ApiTask,
} from "@/api/hooks";
import { CalendarEventDialog, type CalendarEventFormInput } from "@/components/calendar/calendar-event-dialog";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeading } from "@/components/typography/heading";
import { Button } from "@/components/ui/button";
import { paperDisplayTitle } from "@/lib/paper-title";
import { cn } from "@/lib/utils";

type CalendarEvent = {
  id: string;
  kind: "project" | "module" | "task" | "conference" | "event" | "note";
  title: string;
  dueDate: string;
  href: string | null;
  meta: string | null;
};

type CalendarFilter = CalendarEvent["kind"];

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const shortDateFormatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const monthFormatter = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function todayKey() {
  const today = new Date();
  return dateKey(today.getFullYear(), today.getMonth(), today.getDate());
}

function startOfCalendarGrid(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  return new Date(first.getFullYear(), first.getMonth(), 1 - mondayOffset);
}

function buildCalendarDays(month: Date) {
  const start = startOfCalendarGrid(month);
  return Array.from({ length: 42 }, (_, index) =>
    new Date(start.getFullYear(), start.getMonth(), start.getDate() + index),
  );
}

function taskProjectName(task: ApiTask, projectById: Map<string, ApiProject>) {
  if (!task.projectId) return null;
  return projectById.get(task.projectId)?.title ?? null;
}

function kindLabel(kind: CalendarEvent["kind"]) {
  switch (kind) {
    case "project":
      return "Project";
    case "module":
      return "Paper";
    case "conference":
      return "Conference";
    case "event":
      return "Event";
    case "note":
      return "Note";
    default:
      return "Task";
  }
}

function kindPillClass(kind: CalendarEvent["kind"]) {
  switch (kind) {
    case "project":
      return "border-l-blue-600 bg-blue-100 text-blue-900 dark:bg-blue-950/60 dark:text-blue-200";
    case "module":
      return "border-l-violet-600 bg-violet-100 text-violet-950 dark:bg-violet-950/60 dark:text-violet-200";
    case "conference":
      return "border-l-rose-600 bg-rose-100 text-rose-950 dark:bg-rose-950/60 dark:text-rose-200";
    case "event":
      return "border-l-cyan-600 bg-cyan-100 text-cyan-950 dark:bg-cyan-950/60 dark:text-cyan-200";
    case "note":
      return "border-l-emerald-600 bg-emerald-100 text-emerald-950 dark:bg-emerald-950/60 dark:text-emerald-200";
    default:
      return "border-l-amber-500 bg-amber-100 text-amber-950 dark:bg-amber-950/60 dark:text-amber-200";
  }
}

function kindMobileBorderClass(kind: CalendarEvent["kind"]) {
  switch (kind) {
    case "project":
      return "border-blue-200 dark:border-blue-900";
    case "module":
      return "border-violet-200 dark:border-violet-900";
    case "conference":
      return "border-rose-200 dark:border-rose-900";
    case "event":
      return "border-cyan-200 dark:border-cyan-900";
    case "note":
      return "border-emerald-200 dark:border-emerald-900";
    default:
      return "border-amber-200 dark:border-amber-900";
  }
}

export default function CalendarPage() {
  const workspace = useCurrentWorkspace();
  const tenantId = workspace.data?.id ?? "";
  const projectsQuery = useProjects(tenantId);
  const projects = projectsQuery.data?.data ?? [];
  const modulesQuery = useModules(tenantId);
  const modules = modulesQuery.data?.data ?? [];
  const tasksQuery = useTasks(tenantId);
  const tasks = tasksQuery.data?.data ?? [];
  const conferencesQuery = useConferences(tenantId);
  const conferences = conferencesQuery.data?.data ?? [];
  const calendarEventsQuery = useCalendarEvents(tenantId);
  const calendarEvents = calendarEventsQuery.data?.data ?? [];
  const notesQuery = useNotes(tenantId);
  const notes = notesQuery.data?.data ?? [];
  const me = useMe();
  const createCalendarEvent = useCreateCalendarEvent(tenantId);
  const updateCalendarEvent = useUpdateCalendarEvent(tenantId);
  const deleteCalendarEvent = useDeleteCalendarEvent(tenantId);
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [activeFilter, setActiveFilter] = useState<CalendarFilter | null>(null);
  const [isNewEventOpen, setIsNewEventOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ApiCalendarEvent | null>(null);

  const projectById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );

  const calendarEventById = useMemo(
    () => new Map(calendarEvents.map((event) => [event.id, event])),
    [calendarEvents],
  );

  const events = useMemo(() => {
    const rows: CalendarEvent[] = [];
    if (activeFilter === null || activeFilter === "project") {
      for (const project of projects) {
        if (!project.dueDate) continue;
        rows.push({
          id: project.id,
          kind: "project",
          title: project.title,
          dueDate: project.dueDate,
          href: `/projects/${project.id}`,
          meta: project.status,
        });
      }
    }
    if (activeFilter === null || activeFilter === "module") {
      for (const module of modules) {
        if (!module.dueDate) continue;
        rows.push({
          id: module.id,
          kind: "module",
          title: paperDisplayTitle(module),
          dueDate: module.dueDate,
          href: `/modules/${module.id}`,
          meta: module.projectId ? (projectById.get(module.projectId)?.title ?? null) : "Independent paper",
        });
      }
    }
    if (activeFilter === null || activeFilter === "task") {
      for (const task of tasks) {
        if (!task.dueDate) continue;
        rows.push({
          id: task.id,
          kind: "task",
          title: task.title,
          dueDate: task.dueDate,
          href: `/tasks/${task.id}`,
          meta: taskProjectName(task, projectById),
        });
      }
    }
    if (activeFilter === null || activeFilter === "conference") {
      for (const conference of conferences) {
        rows.push({
          id: `${conference.id}-submission`,
          kind: "conference",
          title: `${conference.name} — submission deadline`,
          dueDate: conference.submissionDue,
          href: `/conferences/${conference.id}`,
          meta: "Submission deadline",
        });
        for (
          let date = new Date(`${conference.startDate}T00:00:00`);
          date <= new Date(`${conference.endDate}T00:00:00`);
          date = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
        ) {
          rows.push({
            id: `${conference.id}-event-${dateKey(date.getFullYear(), date.getMonth(), date.getDate())}`,
            kind: "conference",
            title: conference.name,
            dueDate: dateKey(date.getFullYear(), date.getMonth(), date.getDate()),
            href: `/conferences/${conference.id}`,
            meta: conference.location,
          });
        }
      }
    }
    if (activeFilter === null || activeFilter === "event") {
      for (const calendarEvent of calendarEvents) {
        rows.push({
          id: calendarEvent.id,
          kind: "event",
          title: calendarEvent.title,
          dueDate: calendarEvent.eventDate,
          href: null,
          meta: null,
        });
      }
    }
    if (activeFilter === null || activeFilter === "note") {
      for (const note of notes) {
        if (!note.followUpDate) continue;
        rows.push({
          id: note.id,
          kind: "note",
          title: note.title,
          dueDate: note.followUpDate,
          href: `/daily-notes/${note.id}`,
          meta: "Follow up",
        });
      }
    }
    return rows.sort((a, b) => a.title.localeCompare(b.title));
  }, [activeFilter, calendarEvents, conferences, modules, notes, projectById, projects, tasks]);

  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      grouped.set(event.dueDate, [...(grouped.get(event.dueDate) ?? []), event]);
    }
    return grouped;
  }, [events]);

  const days = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);
  const currentTodayKey = todayKey();

  function changeMonth(offset: number) {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  function goToToday() {
    const today = new Date();
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  }

  function toggleFilter(filter: CalendarFilter) {
    setActiveFilter((current) => current === filter ? null : filter);
  }

  async function handleCreateEvent(input: CalendarEventFormInput) {
    await createCalendarEvent.mutateAsync(input);
  }

  async function handleUpdateEvent(input: CalendarEventFormInput) {
    if (!editingEvent) return;
    await updateCalendarEvent.mutateAsync({ eventId: editingEvent.id, input });
  }

  async function handleDeleteEvent() {
    if (!editingEvent) return;
    await deleteCalendarEvent.mutateAsync(editingEvent.id);
  }

  if (workspace.isPending || projectsQuery.isPending || modulesQuery.isPending || tasksQuery.isPending || conferencesQuery.isPending || calendarEventsQuery.isPending || notesQuery.isPending) {
    return <LoadingState title="Loading calendar" className="min-h-[50vh]" />;
  }

  if (projectsQuery.isError || modulesQuery.isError || tasksQuery.isError || conferencesQuery.isError || calendarEventsQuery.isError || notesQuery.isError) {
    const error = projectsQuery.error ?? modulesQuery.error ?? tasksQuery.error ?? conferencesQuery.error ?? calendarEventsQuery.error ?? notesQuery.error;
    return (
      <ErrorState
        title="Calendar could not be loaded"
        description={error?.message ?? "Please try again."}
        onRetry={() => void Promise.all([projectsQuery.refetch(), modulesQuery.refetch(), tasksQuery.refetch(), conferencesQuery.refetch(), calendarEventsQuery.refetch(), notesQuery.refetch()])}
      />
    );
  }

  return (
    <div className="page-stack">
      <PageHeading
        icon={CalendarIcon}
        tone="cyan"
        eyebrow="Planning"
        title="Calendar"
        description="See project, paper, task, conference, and note follow-up dates together, month by month."
        actions={<Button onClick={() => setIsNewEventOpen(true)}>New Event</Button>}
      />

      <CalendarEventDialog
        open={isNewEventOpen}
        onOpenChange={setIsNewEventOpen}
        onSave={handleCreateEvent}
      />
      <CalendarEventDialog
        open={editingEvent !== null}
        onOpenChange={(open) => {
          if (!open) setEditingEvent(null);
        }}
        event={editingEvent}
        onSave={handleUpdateEvent}
        onDelete={handleDeleteEvent}
      />

      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="flex flex-col gap-4 border-b border-primary/10 bg-gradient-to-r from-accent/60 via-card/80 to-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToToday}>Today</Button>
            <Button variant="outline" size="icon" onClick={() => changeMonth(-1)} aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => changeMonth(1)} aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <h2 className="ml-1 text-lg font-semibold sm:text-xl" aria-live="polite">
              {monthFormatter.format(visibleMonth)}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2" aria-label="Calendar filters">
            <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Show</span>
            <button
              type="button"
              aria-pressed={activeFilter === "project"}
              onClick={() => toggleFilter("project")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                activeFilter === "project"
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-border bg-background text-muted-foreground hover:bg-accent",
              )}
            >
              <FolderKanban className="h-3.5 w-3.5" /> Projects
            </button>
            <button
              type="button"
              aria-pressed={activeFilter === "module"}
              onClick={() => toggleFilter("module")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                activeFilter === "module"
                  ? "border-violet-600 bg-violet-600 text-white"
                  : "border-border bg-background text-muted-foreground hover:bg-accent",
              )}
            >
              <Boxes className="h-3.5 w-3.5" /> Papers
            </button>
            <button
              type="button"
              aria-pressed={activeFilter === "task"}
              onClick={() => toggleFilter("task")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                activeFilter === "task"
                  ? "border-amber-500 bg-amber-500 text-white"
                  : "border-border bg-background text-muted-foreground hover:bg-accent",
              )}
            >
              <CheckSquare2 className="h-3.5 w-3.5" /> Tasks
            </button>
            <button
              type="button"
              aria-pressed={activeFilter === "conference"}
              onClick={() => toggleFilter("conference")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                activeFilter === "conference"
                  ? "border-rose-600 bg-rose-600 text-white"
                  : "border-border bg-background text-muted-foreground hover:bg-accent",
              )}
            >
              <Presentation className="h-3.5 w-3.5" /> Conferences
            </button>
            <button
              type="button"
              aria-pressed={activeFilter === "event"}
              onClick={() => toggleFilter("event")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                activeFilter === "event"
                  ? "border-cyan-600 bg-cyan-600 text-white"
                  : "border-border bg-background text-muted-foreground hover:bg-accent",
              )}
            >
              <CalendarDays className="h-3.5 w-3.5" /> Events
            </button>
            <button
              type="button"
              aria-pressed={activeFilter === "note"}
              onClick={() => toggleFilter("note")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                activeFilter === "note"
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-border bg-background text-muted-foreground hover:bg-accent",
              )}
            >
              <NotebookPen className="h-3.5 w-3.5" /> Notes
            </button>
          </div>
        </div>

        <div className="hidden grid-cols-7 border-b border-primary/10 bg-accent/45 md:grid">
          {WEEKDAYS.map((day) => (
            <div key={day} className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {day.slice(0, 3)}
            </div>
          ))}
        </div>

        <div className="hidden grid-cols-7 md:grid">
          {days.map((day) => {
            const key = dateKey(day.getFullYear(), day.getMonth(), day.getDate());
            const dayEvents = eventsByDate.get(key) ?? [];
            const inMonth = day.getMonth() === visibleMonth.getMonth();
            const isToday = key === currentTodayKey;
            return (
              <div
                key={key}
                className={cn(
                  "min-h-32 border-b border-r border-border p-2 last:border-r-0 lg:min-h-36",
                  !inMonth && "bg-muted/20",
                )}
              >
                <div className="mb-1 flex justify-end">
                  <span className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-sm",
                    isToday && "bg-primary font-semibold text-primary-foreground",
                    !inMonth && !isToday && "text-muted-foreground/60",
                  )}>
                    {day.getDate()}
                  </span>
                </div>
                <div className="space-y-1">
                  {dayEvents.map((event) => {
                    const title = `${kindLabel(event.kind)}: ${event.title}`;
                    const pillClassName = cn(
                      "block w-full truncate rounded-md border-l-4 px-2 py-1 text-left text-xs font-medium transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      kindPillClass(event.kind),
                    );
                    const key = `${event.kind}-${event.id}`;

                    if (event.href) {
                      return (
                        <Link key={key} to={event.href} title={title} className={pillClassName}>
                          {event.title}
                        </Link>
                      );
                    }

                    const canEdit = calendarEventById.get(event.id)?.createdBy === me.data?.id;
                    if (!canEdit) {
                      return (
                        <span key={key} title={title} className={cn(pillClassName, "cursor-default")}>
                          {event.title}
                        </span>
                      );
                    }

                    return (
                      <button
                        key={key}
                        type="button"
                        title={title}
                        onClick={() => setEditingEvent(calendarEventById.get(event.id) ?? null)}
                        className={pillClassName}
                      >
                        {event.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="divide-y divide-border md:hidden">
          {days
            .filter((day) => day.getMonth() === visibleMonth.getMonth())
            .map((day) => {
              const key = dateKey(day.getFullYear(), day.getMonth(), day.getDate());
              const dayEvents = eventsByDate.get(key) ?? [];
              if (dayEvents.length === 0) return null;
              return (
                <div key={key} className="grid grid-cols-[5rem_1fr] gap-3 p-4">
                  <div>
                    <div className="text-xs font-semibold uppercase text-muted-foreground">
                      {WEEKDAYS[(day.getDay() + 6) % 7].slice(0, 3)}
                    </div>
                    <div className="text-sm font-semibold">{shortDateFormatter.format(day)}</div>
                  </div>
                  <div className="space-y-2">
                    {dayEvents.map((event) => {
                      const rowClassName = cn(
                        "block w-full rounded-lg border p-2.5 text-left text-sm transition-colors hover:bg-accent",
                        kindMobileBorderClass(event.kind),
                      );
                      const key = `${event.kind}-${event.id}`;
                      const body = (
                        <>
                          <span className="font-medium">{event.title}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {kindLabel(event.kind)}{event.meta ? ` · ${event.meta}` : ""}
                          </span>
                        </>
                      );

                      if (event.href) {
                        return (
                          <Link key={key} to={event.href} className={rowClassName}>
                            {body}
                          </Link>
                        );
                      }

                      const canEdit = calendarEventById.get(event.id)?.createdBy === me.data?.id;
                      if (!canEdit) {
                        return (
                          <div key={key} className={cn(rowClassName, "cursor-default hover:bg-transparent")}>
                            {body}
                          </div>
                        );
                      }

                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setEditingEvent(calendarEventById.get(event.id) ?? null)}
                          className={rowClassName}
                        >
                          {body}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          {events.filter((event) => event.dueDate.startsWith(dateKey(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1).slice(0, 7))).length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No due dates to show this month.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
