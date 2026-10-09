import {
  CalendarClock,
  DollarSign,
  Link2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Unlink,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  type FundingInput,
  useAttachFundingNote,
  useAttachFundingTask,
  useCreateNote,
  useCreateTask,
  useCurrentWorkspace,
  useDeleteFunding,
  useDetachFundingNote,
  useDetachFundingTask,
  useFunding,
  useMe,
  useModules,
  useNotes,
  useProjects,
  useTasks,
  useUpdateFunding,
} from "@/api/hooks";
import { FundingDialog } from "@/components/funding/funding-dialog";
import { NoteDialog, type NoteFormInput } from "@/components/notes/note-dialog";
import { BackButton } from "@/components/shared/back-button";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { TaskDialog, type TaskFormInput } from "@/components/tasks/task-dialog";
import { PageHeading } from "@/components/typography/heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { paperDisplayTitle } from "@/lib/paper-title";

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function formatAmount(amount: string | null, currency: string | null) {
  if (!amount) return "—";
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount))
    return [currency, amount].filter(Boolean).join(" ");
  if (currency) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(numericAmount);
    } catch {
      return `${currency} ${numericAmount.toLocaleString()}`;
    }
  }
  return numericAmount.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function DetailItem({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 font-medium">{children}</div>
    </div>
  );
}

interface AttachmentOption {
  id: string;
  displayId: string | null;
  title: string;
}

function AttachmentDialog({
  open,
  onOpenChange,
  kind,
  search,
  onSearchChange,
  options,
  isSearching,
  onAttach,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: "note" | "task";
  search: string;
  onSearchChange: (value: string) => void;
  options: AttachmentOption[];
  isSearching: boolean;
  onAttach: (id: string) => Promise<void>;
}) {
  const label = kind === "note" ? "note" : "task";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Attach existing {label}</DialogTitle>
          <DialogDescription>
            Search all {label}s you can access. Its existing project or paper
            link will not change.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={`Search all accessible ${label}s…`}
            className="pl-9"
            autoFocus
          />
        </div>
        <div className="max-h-72 overflow-y-auto rounded-lg border p-1">
          {!search.trim() ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              Type to search all accessible {label}s.
            </p>
          ) : isSearching ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              Searching all {label}s…
            </p>
          ) : options.length ? (
            options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => void onAttach(option.id)}
                className="flex w-full flex-col items-start rounded-md px-3 py-2 text-left hover:bg-accent focus:bg-accent focus:outline-none"
              >
                <span className="text-sm font-medium">{option.title}</span>
                {option.displayId ? (
                  <span className="text-xs text-muted-foreground">
                    {option.displayId}
                  </span>
                ) : null}
              </button>
            ))
          ) : (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              No matching {label}s available to attach.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function FundingDetailPage() {
  const { fundingId = "" } = useParams();
  const navigate = useNavigate();
  const workspace = useCurrentWorkspace();
  const tenantId = workspace.data?.id ?? "";
  const fundingQuery = useFunding(tenantId, fundingId);
  const meQuery = useMe();
  const updateFunding = useUpdateFunding(tenantId);
  const deleteFunding = useDeleteFunding(tenantId);
  const attachNote = useAttachFundingNote(tenantId, fundingId);
  const detachNote = useDetachFundingNote(tenantId, fundingId);
  const attachTask = useAttachFundingTask(tenantId, fundingId);
  const detachTask = useDetachFundingTask(tenantId, fundingId);
  const createNote = useCreateNote(tenantId);
  const createTask = useCreateTask(tenantId);

  const [isEditing, setIsEditing] = useState(false);
  const [isNotePickerOpen, setIsNotePickerOpen] = useState(false);
  const [isTaskPickerOpen, setIsTaskPickerOpen] = useState(false);
  const [isNewNoteOpen, setIsNewNoteOpen] = useState(false);
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [noteSearch, setNoteSearch] = useState("");
  const [noteRequestSearch, setNoteRequestSearch] = useState("");
  const [taskSearch, setTaskSearch] = useState("");
  const [taskRequestSearch, setTaskRequestSearch] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setNoteRequestSearch(noteSearch.trim()),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [noteSearch]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setTaskRequestSearch(taskSearch.trim()),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [taskSearch]);

  const notesQuery = useNotes(
    tenantId,
    undefined,
    1,
    isNotePickerOpen && Boolean(noteRequestSearch),
    {
      pageSize: "all",
      search: noteRequestSearch,
    },
  );
  const tasksQuery = useTasks(
    tenantId,
    undefined,
    1,
    isTaskPickerOpen && Boolean(taskRequestSearch),
    {
      pageSize: "all",
      search: taskRequestSearch,
    },
  );
  const projectsQuery = useProjects(tenantId, 1, isNewTaskOpen, {
    pageSize: "all",
  });
  const modulesQuery = useModules(tenantId, undefined, 1, isNewTaskOpen, {
    pageSize: "all",
  });

  if (workspace.isPending || fundingQuery.isPending || meQuery.isPending) {
    return <LoadingState title="Loading funding" className="min-h-[50vh]" />;
  }
  if (fundingQuery.isError) {
    return (
      <ErrorState
        title="Funding could not be loaded"
        description={fundingQuery.error.message}
        onRetry={() => void fundingQuery.refetch()}
      />
    );
  }

  const funding = fundingQuery.data;
  if (!funding) {
    return (
      <EmptyState
        title="Funding not found"
        description="This funding record does not exist, or you no longer have access to it."
        action={
          <Button asChild variant="outline">
            <Link to="/funding">Back to Funding</Link>
          </Button>
        }
      />
    );
  }

  const canManage = funding.ownerUserId === meQuery.data?.id;
  const linkedNoteIds = new Set(
    (funding.linkedNotes ?? []).map((note) => note.id),
  );
  const linkedTaskIds = new Set((funding.tasks ?? []).map((task) => task.id));
  const noteOptions = (notesQuery.data?.data ?? [])
    .filter((note) => !linkedNoteIds.has(note.id))
    .map((note) => ({
      id: note.id,
      displayId: note.displayId,
      title: note.title,
    }));
  const taskOptions = (tasksQuery.data?.data ?? [])
    .filter((task) => !linkedTaskIds.has(task.id))
    .map((task) => ({
      id: task.id,
      displayId: task.displayId,
      title: task.title,
    }));
  const projects = [
    ...(projectsQuery.data?.generalProject
      ? [projectsQuery.data.generalProject]
      : []),
    ...(projectsQuery.data?.data ?? []),
  ];
  const modules = modulesQuery.data?.data ?? [];

  async function update(input: FundingInput) {
    await updateFunding.mutateAsync({ fundingId, input });
    setIsEditing(false);
  }

  async function remove() {
    if (
      !window.confirm(
        `Delete "${funding.fundingBody}"? This action cannot be undone.`,
      )
    )
      return;
    setActionError(null);
    try {
      await deleteFunding.mutateAsync(funding.id);
      navigate("/funding");
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "The funding record could not be deleted.",
      );
    }
  }

  async function attachExistingNote(noteId: string) {
    setActionError(null);
    try {
      await attachNote.mutateAsync(noteId);
      setIsNotePickerOpen(false);
      setNoteSearch("");
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "The note could not be attached.",
      );
    }
  }

  async function attachExistingTask(taskId: string) {
    setActionError(null);
    try {
      await attachTask.mutateAsync(taskId);
      setIsTaskPickerOpen(false);
      setTaskSearch("");
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "The task could not be attached.",
      );
    }
  }

  async function detachExistingNote(noteId: string) {
    setActionError(null);
    try {
      await detachNote.mutateAsync(noteId);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "The note could not be detached.",
      );
    }
  }

  async function detachExistingTask(taskId: string) {
    setActionError(null);
    try {
      await detachTask.mutateAsync(taskId);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "The task could not be detached.",
      );
    }
  }

  async function createAndAttachNote(input: NoteFormInput) {
    const note = await createNote.mutateAsync({
      title: input.title || "Untitled note",
      content: input.content || undefined,
      projectId: input.linkTarget === "project" ? input.projectId : undefined,
      moduleId: input.linkTarget === "module" ? input.moduleId : undefined,
      visibility: input.visibility,
      followUpDate: input.followUpDate || undefined,
    });
    await attachNote.mutateAsync(note.id);
  }

  async function createAndAttachTask(input: TaskFormInput) {
    const task = await createTask.mutateAsync({
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
    await attachTask.mutateAsync(task.id);
  }

  return (
    <div className="page-stack">
      <BackButton fallback="/funding" label="Back" />
      <PageHeading
        icon={DollarSign}
        tone="emerald"
        eyebrow={funding.scheme ?? undefined}
        title={funding.fundingBody}
        description={funding.partners ?? undefined}
        actions={
          canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <Pencil /> Edit Funding
              </Button>
              <Button variant="destructive" onClick={() => void remove()}>
                <Trash2 /> Delete Funding
              </Button>
            </div>
          ) : (
            <Badge variant="outline">View only</Badge>
          )
        }
      />

      {actionError ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {actionError}
        </p>
      ) : null}

      <FundingDialog
        open={isEditing}
        onOpenChange={setIsEditing}
        tenantId={tenantId}
        funding={funding}
        onSave={update}
      />
      <NoteDialog
        open={isNewNoteOpen}
        onOpenChange={setIsNewNoteOpen}
        tenantId={tenantId}
        projects={[]}
        modules={[]}
        onSave={createAndAttachNote}
      />
      <TaskDialog
        open={isNewTaskOpen}
        onOpenChange={setIsNewTaskOpen}
        tenantId={tenantId}
        projects={projects}
        modules={modules}
        onSave={createAndAttachTask}
      />
      <AttachmentDialog
        open={isNotePickerOpen}
        onOpenChange={setIsNotePickerOpen}
        kind="note"
        search={noteSearch}
        onSearchChange={setNoteSearch}
        options={noteOptions}
        isSearching={
          notesQuery.isFetching || noteSearch.trim() !== noteRequestSearch
        }
        onAttach={attachExistingNote}
      />
      <AttachmentDialog
        open={isTaskPickerOpen}
        onOpenChange={setIsTaskPickerOpen}
        kind="task"
        search={taskSearch}
        onSearchChange={setTaskSearch}
        options={taskOptions}
        isSearching={
          tasksQuery.isFetching || taskSearch.trim() !== taskRequestSearch
        }
        onAttach={attachExistingTask}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Funding overview</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 text-sm sm:grid-cols-2">
            <DetailItem label="Scheme / opportunity">
              {funding.scheme ?? "—"}
            </DetailItem>
            <DetailItem label="Status">
              <Badge variant="outline">{funding.status ?? "—"}</Badge>
            </DetailItem>
            <DetailItem label="Amount">
              {formatAmount(funding.amount, funding.currency)}
            </DetailItem>
            <DetailItem label="Partners">{funding.partners ?? "—"}</DetailItem>
            <DetailItem label="Application deadline">
              {formatDate(funding.applicationDeadline)}
            </DetailItem>
            <DetailItem label="Follow-up date">
              <span className="inline-flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
                {formatDate(funding.followUpDate)}
              </span>
            </DetailItem>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {funding.description ?? funding.notes ?? "—"}
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Linked projects or papers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {funding.projects.length === 0 && funding.papers.length === 0 ? (
                <span className="text-sm text-muted-foreground">—</span>
              ) : null}
              {funding.projects.map((project) => (
                <Link
                  key={project.id}
                  to={`/projects/${project.id}`}
                  className="rounded-xl border border-border bg-muted/20 p-4 transition-colors hover:border-primary/40 hover:bg-accent"
                >
                  <span className="font-mono text-xs text-muted-foreground">
                    {project.displayId}
                  </span>
                  <span className="mt-1 block font-semibold">
                    {project.title}
                  </span>
                </Link>
              ))}
              {funding.papers.map((paper) => (
                <Link
                  key={paper.id}
                  to={`/modules/${paper.id}`}
                  className="rounded-xl border border-border bg-muted/20 p-4 transition-colors hover:border-primary/40 hover:bg-accent"
                >
                  <span className="font-mono text-xs text-muted-foreground">
                    {paper.displayId}
                  </span>
                  <span className="mt-1 block font-semibold">
                    {paperDisplayTitle(paper)}
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle>Notes ({funding.linkedNotes?.length ?? 0})</CardTitle>
            {canManage ? (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsNotePickerOpen(true)}
                >
                  <Link2 /> Attach existing
                </Button>
                <Button size="sm" onClick={() => setIsNewNoteOpen(true)}>
                  <Plus /> New Note
                </Button>
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="grid gap-2">
            {(funding.linkedNotes ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No notes attached.
              </p>
            ) : (
              (funding.linkedNotes ?? []).map((note) => (
                <div
                  key={note.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <Link
                    to={`/daily-notes/${note.id}`}
                    className="min-w-0 hover:underline"
                  >
                    <span className="block truncate font-medium">
                      {note.title}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {note.displayId ?? formatTimestamp(note.createdAt)}
                    </span>
                  </Link>
                  {canManage ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Detach ${note.title}`}
                      onClick={() => void detachExistingNote(note.id)}
                    >
                      <Unlink />
                    </Button>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle>Tasks ({funding.tasks?.length ?? 0})</CardTitle>
            {canManage ? (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsTaskPickerOpen(true)}
                >
                  <Link2 /> Attach existing
                </Button>
                <Button size="sm" onClick={() => setIsNewTaskOpen(true)}>
                  <Plus /> New Task
                </Button>
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="grid gap-2">
            {(funding.tasks ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No tasks attached.
              </p>
            ) : (
              (funding.tasks ?? []).map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <Link
                    to={`/tasks/${task.id}`}
                    className="min-w-0 hover:underline"
                  >
                    <span className="block truncate font-medium">
                      {task.title}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {task.dueDate
                        ? `Due ${formatDate(task.dueDate)}`
                        : (task.displayId ?? formatTimestamp(task.createdAt))}
                    </span>
                  </Link>
                  {canManage ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Detach ${task.title}`}
                      onClick={() => void detachExistingTask(task.id)}
                    >
                      <Unlink />
                    </Button>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
