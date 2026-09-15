// import { ActivityOverviewChart } from "@/components/dashboard/activity-overview-chart";
import {
  ArrowUpRight,
  ChevronDown,
  FilePenLine,
  FileStack,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  NotebookPen,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { Link } from "react-router-dom";

import {
  useCreateConference,
  useCreateModule,
  useCreateNote,
  useCreateProject,
  useCreateTask,
  useCurrentWorkspace,
  useMe,
  useMembers,
  useModules,
  useProjects,
  useTasks,
  useTrackEvent,
} from "@/api/hooks";
import { ConferenceSubmissionDialog, type ConferenceSubmissionInput } from "@/components/dashboard/conference-submission-dialog";
import { ConferenceSubmissionsTable } from "@/components/dashboard/conference-submissions-table";
import {
  StalledPapersCard,
  PriorityWorkloadCard,
  ProjectProgressCard,
  TaskHealthCard,
} from "@/components/dashboard/dashboard-insights";
import {
  CustomizeDashboardDialog,
  type DashboardWidgetOption,
} from "@/components/dashboard/customize-dashboard-dialog";
import { PipelineOverviewTable } from "@/components/dashboard/pipeline-overview-table";
import { PriorityTasksTable } from "@/components/dashboard/priority-tasks-table";
import { ModuleDialog, type ModuleFormInput } from "@/components/modules/module-dialog";
import { NoteDialog, type NoteFormInput } from "@/components/notes/note-dialog";
import { NewProjectDialog, type NewProjectInput } from "@/components/projects/new-project-dialog";
// import { WorkOnThisNextBanner } from "@/components/dashboard/work-on-this-next-banner";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeading } from "@/components/typography/heading";
import { Button } from "@/components/ui/button";
import { TaskDialog, type TaskFormInput } from "@/components/tasks/task-dialog";
import { usePreferences } from "@/preferences/preferences-context";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function buildSummary(counts: {
  activeProjects: number;
  totalProjects: number;
  openTasks: number;
  totalTasks: number;
  reviewStage: number;
  activeModules: number;
  totalModules: number;
}) {
  return [
    {
      label: "Active Projects",
      description: "Active of all visible projects",
      value: `${counts.activeProjects} of ${counts.totalProjects}`,
      icon: FolderKanban,
      tone: "blue",
      to: "/projects",
    },
    {
      label: "Open Tasks",
      description: "Open of all visible tasks",
      value: `${counts.openTasks} of ${counts.totalTasks}`,
      icon: ListTodo,
      tone: "amber",
      to: "/tasks",
    },
    {
      label: "In Review Stage",
      description: "Papers in the Submitted, Under Review stage",
      value: String(counts.reviewStage),
      icon: FilePenLine,
      tone: "violet",
      to: "/pipeline",
    },
    {
      label: "Active Papers",
      description: "Active of all visible papers",
      value: `${counts.activeModules} of ${counts.totalModules}`,
      icon: FileStack,
      tone: "emerald",
      to: "/modules",
    },
  ];
}

const summaryToneStyles: Record<string, { rail: string; icon: string }> = {
  blue: {
    rail: "bg-primary",
    icon: "border-primary/15 bg-primary/10 text-primary",
  },
  amber: {
    rail: "bg-amber-500",
    icon: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-300",
  },
  violet: {
    rail: "bg-violet-500",
    icon: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/35 dark:text-violet-300",
  },
  emerald: {
    rail: "bg-emerald-500",
    icon: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-300",
  },
};

type DashboardWidgetId =
  | "stalled-papers"
  | "task-health"
  | "priority-workload"
  | "project-progress"
  | "tasks"
  | "pipeline"
  | "conferences";

interface DashboardWidgetDefinition extends DashboardWidgetOption<DashboardWidgetId> {
  component: ComponentType;
  /** Tailwind column-span class applied when widgets share the wide layout grid. */
  span: string;
}

const DASHBOARD_WIDGETS: readonly DashboardWidgetDefinition[] = [
  {
    id: "stalled-papers",
    label: "Stalled papers",
    description: "Papers that haven't moved stage in the longest time.",
    group: "Insights",
    component: StalledPapersCard,
    span: "xl:col-span-3",
  },
  {
    id: "task-health",
    label: "Task health",
    description: "Completion, deadlines, and delivery risk.",
    group: "Insights",
    component: TaskHealthCard,
    span: "xl:col-span-2",
  },
  {
    id: "priority-workload",
    label: "Priority workload",
    description: "Open work grouped by urgency.",
    group: "Insights",
    component: PriorityWorkloadCard,
    span: "xl:col-span-2",
  },
  {
    id: "project-progress",
    label: "Project progress",
    description: "Top project completion based on linked tasks.",
    group: "Insights",
    component: ProjectProgressCard,
    span: "xl:col-span-3",
  },
  {
    id: "tasks",
    label: "Tasks to be done",
    description: "Priority work across projects.",
    group: "Tables",
    component: PriorityTasksTable,
    span: "xl:col-span-5",
  },
  {
    id: "pipeline",
    label: "Pipeline project overview",
    description: "Projects arranged by pipeline stage.",
    group: "Tables",
    component: PipelineOverviewTable,
    span: "xl:col-span-5",
  },
  {
    id: "conferences",
    label: "Upcoming conference submissions",
    description: "Submission deadlines and linked papers.",
    group: "Tables",
    component: () => <ConferenceSubmissionsTable dashboardView />,
    span: "xl:col-span-5",
  },
] as const;

const DEFAULT_WIDGET_ORDER = DASHBOARD_WIDGETS.map((widget) => widget.id);
/** Widgets a first-time (or never-customized) dashboard starts with hidden — available to add back via Customise dashboard. */
const DEFAULT_HIDDEN_WIDGETS: readonly DashboardWidgetId[] = [
  "stalled-papers",
  "task-health",
  "priority-workload",
  "project-progress",
  "tasks",
];
const DASHBOARD_LAYOUT_KEY = "research-in-motion.dashboard-layout.v1";

interface StoredDashboardLayout {
  order: DashboardWidgetId[];
  hidden: DashboardWidgetId[];
}

function isDashboardWidgetId(value: unknown): value is DashboardWidgetId {
  return DEFAULT_WIDGET_ORDER.includes(value as DashboardWidgetId);
}

function loadDashboardLayout(storageKey = DASHBOARD_LAYOUT_KEY): StoredDashboardLayout {
  if (typeof window === "undefined") {
    return { order: [...DEFAULT_WIDGET_ORDER], hidden: [...DEFAULT_HIDDEN_WIDGETS] };
  }

  try {
    const serialized = window.localStorage.getItem(storageKey)
      ?? (storageKey === DASHBOARD_LAYOUT_KEY
        ? null
        : window.localStorage.getItem(DASHBOARD_LAYOUT_KEY));
    const stored = JSON.parse(serialized ?? "null") as {
      order?: unknown;
      hidden?: unknown;
    } | null;
    const savedOrder = Array.isArray(stored?.order)
      ? stored.order.filter(isDashboardWidgetId)
      : [];
    const order = [
      ...new Set(savedOrder),
      ...DEFAULT_WIDGET_ORDER.filter((id) => !savedOrder.includes(id)),
    ];
    const hidden = Array.isArray(stored?.hidden)
      ? [...new Set(stored.hidden.filter(isDashboardWidgetId))]
      : [...DEFAULT_HIDDEN_WIDGETS];

    return { order, hidden };
  } catch {
    return { order: [...DEFAULT_WIDGET_ORDER], hidden: [...DEFAULT_HIDDEN_WIDGETS] };
  }
}

export default function DashboardPage() {
  const workspace = useCurrentWorkspace();
  const tenantId = workspace.data?.id ?? "";
  const projectsQuery = useProjects(tenantId);
  const projects = projectsQuery.data?.data ?? [];
  const tasksQuery = useTasks(tenantId);
  const modulesQuery = useModules(tenantId);
  const tasks = tasksQuery.data?.data ?? [];
  const modules = modulesQuery.data?.data ?? [];
  const me = useMe();
  const createProject = useCreateProject(tenantId);
  const createTask = useCreateTask(tenantId);
  const createModule = useCreateModule(tenantId);
  const createNote = useCreateNote(tenantId);
  const createConference = useCreateConference(tenantId);
  const trackEvent = useTrackEvent(tenantId);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [isNewModuleOpen, setIsNewModuleOpen] = useState(false);
  const [isNewNoteOpen, setIsNewNoteOpen] = useState(false);
  const [isNewConferenceOpen, setIsNewConferenceOpen] = useState(false);
  const membersQuery = useMembers(tenantId, 1, isNewModuleOpen);
  const members = membersQuery.data?.data ?? [];
  const [layout, setLayout] = useState(loadDashboardLayout);
  const preferences = usePreferences();
  const hydratedWorkspace = useRef("");
  const lastSavedLayout = useRef("");
  const isHydratingLayout = useRef(false);

  const ownedProjects = useMemo(
    () => projects.filter(
      (project) => project.userId === me.data?.id || project.role?.toLowerCase() === "owner",
    ),
    [projects, me.data?.id],
  );

  const ownedModules = useMemo(() => {
    const ownedProjectIds = new Set(ownedProjects.map((project) => project.id));
    return modules.filter(
      (module) => module.projectId && ownedProjectIds.has(module.projectId),
    );
  }, [modules, ownedProjects]);

  const summary = useMemo(
    () =>
      buildSummary({
        activeProjects: projects.filter((project) => project.status === "Active")
          .length,
        totalProjects: projects.length,
        openTasks: tasks.filter(
          (task) => task.status !== "Complete",
        ).length,
        totalTasks: tasks.length,
        reviewStage: modules.filter(
          (module) => module.pipelineStage === "Submitted, Under Review",
        ).length,
        activeModules: modules.filter(
          (module) => module.status === "Active",
        ).length,
        totalModules: modules.length,
      }),
    [projects, tasks, modules],
  );
  const visibleWidgets = new Set(
    layout.order.filter((id) => !layout.hidden.includes(id)),
  );
  const visibleOrderedWidgets = layout.order
    .filter((id) => visibleWidgets.has(id))
    .map((id) => DASHBOARD_WIDGETS.find((widget) => widget.id === id)!);

  useEffect(() => {
    if (
      !preferences?.workspaceId ||
      preferences.workspacePreferences === undefined ||
      hydratedWorkspace.current === preferences.workspaceId
    ) return;

    isHydratingLayout.current = true;
    hydratedWorkspace.current = preferences.workspaceId;
    const remote = preferences.workspacePreferences?.dashboardLayout;
    if (remote) {
      const savedOrder = remote.order.filter(isDashboardWidgetId);
      const next = {
        order: [
          ...new Set(savedOrder),
          ...DEFAULT_WIDGET_ORDER.filter((id) => !savedOrder.includes(id)),
        ],
        hidden: [...new Set(remote.hidden.filter(isDashboardWidgetId))],
      };
      lastSavedLayout.current = JSON.stringify(next);
      setLayout(next);
    } else {
      const local = loadDashboardLayout(
        `${DASHBOARD_LAYOUT_KEY}:${preferences.workspaceId}`,
      );
      setLayout(local);
    }
  }, [preferences]);

  useEffect(() => {
    const storageKey = preferences?.workspaceId
      ? `${DASHBOARD_LAYOUT_KEY}:${preferences.workspaceId}`
      : DASHBOARD_LAYOUT_KEY;
    const serialized = JSON.stringify(layout);
    window.localStorage.setItem(storageKey, serialized);
    // Skip the stale render that still holds the pre-hydration layout — the
    // hydration effect above already scheduled the real value via setLayout.
    if (isHydratingLayout.current) {
      isHydratingLayout.current = false;
      return;
    }
    if (!preferences || hydratedWorkspace.current !== preferences.workspaceId) return;
    if (serialized === lastSavedLayout.current) return;
    lastSavedLayout.current = serialized;
    preferences.updateDashboardLayout(layout);
  }, [layout, preferences]);

  function toggleWidget(widgetId: DashboardWidgetId) {
    setLayout((current) => ({
      ...current,
      hidden: current.hidden.includes(widgetId)
        ? current.hidden.filter((id) => id !== widgetId)
        : [...current.hidden, widgetId],
    }));
  }

  function moveWidget(widgetId: DashboardWidgetId, direction: "up" | "down") {
    setLayout((current) => {
      const index = current.order.indexOf(widgetId);
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= current.order.length) return current;
      const order = [...current.order];
      [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
      return { ...current, order };
    });
  }

  function reorderWidgets(draggedId: DashboardWidgetId, targetId: DashboardWidgetId) {
    setLayout((current) => {
      const fromIndex = current.order.indexOf(draggedId);
      const toIndex = current.order.indexOf(targetId);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return current;
      const order = [...current.order];
      order.splice(fromIndex, 1);
      order.splice(toIndex, 0, draggedId);
      return { ...current, order };
    });
  }

  function resetLayout() {
    setLayout({ order: [...DEFAULT_WIDGET_ORDER], hidden: [...DEFAULT_HIDDEN_WIDGETS] });
  }

  async function handleCreateProject(input: NewProjectInput) {
    const project = await createProject.mutateAsync({
      title: input.title,
      description: input.description || undefined,
      researchArea: input.researchArea || undefined,
      status: input.status,
      importance: input.priority,
      scheduledFor: input.scheduledFor || undefined,
      dueDate: input.dueDate || undefined,
      totalBudget: input.totalBudget || undefined,
      targetJournals: input.targetJournals || undefined,
    });
    trackEvent({ name: "project_created" });
    return project;
  }

  async function handleCreateTask(input: TaskFormInput) {
    await createTask.mutateAsync({
      title: input.title,
      description: input.description || undefined,
      projectId: input.linkTarget === "project" ? input.projectId : undefined,
      moduleId: input.linkTarget === "module" ? input.moduleId : undefined,
      status: input.status,
      priority: input.priority,
      visibility: input.visibility,
      estimatedHours: input.estimatedHours || undefined,
      dueDate: input.dueDate || undefined,
    });
    trackEvent({ name: "task_created" });
  }

  async function handleCreateModule(input: ModuleFormInput) {
    const module = await createModule.mutateAsync({
      shortTitle: input.shortTitle,
      title: input.title || undefined,
      description: input.description || undefined,
      abstract: input.abstract || undefined,
      targetJournal: input.targetJournal || undefined,
      backupJournal: input.backupJournal || undefined,
      targetConference: input.targetConference || undefined,
      backupConference: input.backupConference || undefined,
      projectId: input.projectId ?? undefined,
      status: input.status,
      pipelineStage: input.pipelineStage,
      dueDate: input.dueDate || undefined,
      assignedToUserId: input.assignedToUserId ?? undefined,
    });
    trackEvent({ name: "module_created" });
    return module;
  }

  async function handleCreateNote(input: NoteFormInput) {
    await createNote.mutateAsync({
      title: input.title || "Untitled note",
      content: input.content || undefined,
      projectId: input.linkTarget === "project" ? input.projectId : undefined,
      moduleId: input.linkTarget === "module" ? input.moduleId : undefined,
      visibility: input.visibility,
      followUpDate: input.followUpDate || undefined,
    });
    trackEvent({ name: "note_created" });
  }

  async function handleCreateConference(input: ConferenceSubmissionInput) {
    await createConference.mutateAsync(input);
    trackEvent({ name: "conference_created" });
  }

  if (
    workspace.isPending ||
    projectsQuery.isPending ||
    tasksQuery.isPending ||
    modulesQuery.isPending
  ) {
    return <LoadingState title="Loading dashboard" className="min-h-[50vh]" />;
  }

  if (projectsQuery.isError || tasksQuery.isError || modulesQuery.isError) {
    const error = projectsQuery.error ?? tasksQuery.error ?? modulesQuery.error;
    return (
      <ErrorState
        title="Dashboard could not be loaded"
        description={error?.message ?? "Please try again."}
        onRetry={() =>
          void Promise.all([
            projectsQuery.refetch(),
            tasksQuery.refetch(),
            modulesQuery.refetch(),
          ])
        }
      />
    );
  }

  return (
    <div className="page-stack">
      <PageHeading
        icon={LayoutDashboard}
        tone="violet"
        eyebrow="Overview"
        title="Dashboard"
        description="A snapshot of research activity across projects, tasks, daily notes, and project files."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => setIsNewProjectOpen(true)}>
              <Plus />
              Add Project
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  Create
                  <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onSelect={() => setIsNewTaskOpen(true)}>
                  <ListTodo />
                  Add Task
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setIsNewModuleOpen(true)}>
                  <FileStack />
                  Add Paper
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setIsNewNoteOpen(true)}>
                  <NotebookPen />
                  Add Note
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setIsNewConferenceOpen(true)}>
                  <FilePenLine />
                  Add Conference
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" onClick={() => setIsCustomizeOpen(true)}>
              <SlidersHorizontal />
              Customise dashboard
            </Button>
          </div>
        }
      />

      <NewProjectDialog
        open={isNewProjectOpen}
        onOpenChange={setIsNewProjectOpen}
        tenantId={tenantId}
        onCreate={handleCreateProject}
      />
      <TaskDialog
        open={isNewTaskOpen}
        onOpenChange={setIsNewTaskOpen}
        tenantId={tenantId}
        projects={projects}
        modules={modules}
        onSave={handleCreateTask}
      />
      <ModuleDialog
        open={isNewModuleOpen}
        onOpenChange={setIsNewModuleOpen}
        tenantId={tenantId}
        projects={projects}
        members={members}
        onSave={handleCreateModule}
      />
      <NoteDialog
        open={isNewNoteOpen}
        onOpenChange={setIsNewNoteOpen}
        projects={projects}
        modules={modules}
        onSave={handleCreateNote}
      />
      <ConferenceSubmissionDialog
        open={isNewConferenceOpen}
        onOpenChange={setIsNewConferenceOpen}
        projects={ownedProjects}
        modules={ownedModules}
        onSave={handleCreateConference}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summary.map((item) => {
          const tone = summaryToneStyles[item.tone] ?? summaryToneStyles.blue;
          const card = (
            <Card className="group relative h-full overflow-hidden transition-[border-color,box-shadow,transform] hover:-translate-y-px hover:border-primary/25 hover:shadow-[var(--shadow-md)]">
              <span className={cn("absolute inset-x-0 top-0 h-1", tone.rail)} aria-hidden="true" />
              <CardHeader className="min-h-[11.25rem] justify-between gap-4 p-5 pt-6">
                <div className="flex items-start justify-between gap-3">
                  <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border", tone.icon)}>
                    <item.icon className="h-[1.125rem] w-[1.125rem]" />
                  </span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/70 text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </span>
                </div>
                <div>
                  <CardDescription className="font-medium text-foreground/80">
                    {item.label}
                  </CardDescription>
                  <CardTitle className="mt-1.5 text-[1.875rem] font-semibold tabular-nums tracking-[-0.04em] text-foreground">
                    {item.value}
                  </CardTitle>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </CardHeader>
            </Card>
          );

          return item.to ? (
            <Link
              key={item.label}
              to={item.to}
              className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2"
            >
              {card}
            </Link>
          ) : (
            <div key={item.label}>{card}</div>
          );
        })}
      </div>
      {/* <WorkOnThisNextBanner /> */}
      {visibleOrderedWidgets.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          {visibleOrderedWidgets.map((widget) => (
            <div key={widget.id} className={widget.span}>
              <widget.component />
            </div>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-muted-foreground">All dashboard widgets are hidden.</p>
            <Button variant="outline" onClick={() => setIsCustomizeOpen(true)}>
              Customise dashboard
            </Button>
          </CardContent>
        </Card>
      )}
      {/* <ActivityOverviewChart /> */}
      <CustomizeDashboardDialog
        open={isCustomizeOpen}
        onOpenChange={setIsCustomizeOpen}
        widgets={layout.order.map((id) => DASHBOARD_WIDGETS.find((widget) => widget.id === id)!)}
        visibleWidgets={visibleWidgets}
        onToggle={toggleWidget}
        onMove={moveWidget}
        onReorder={reorderWidgets}
        onReset={resetLayout}
      />
    </div>
  );
}
