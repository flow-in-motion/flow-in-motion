import { useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";

import {
  useArchivedModules,
  useArchivedProjects,
  useCurrentWorkspace,
  usePermanentlyDeleteModule,
  usePermanentlyDeleteProject,
  useProjects,
  useRestoreModule,
  useRestoreProject,
  type ApiModule,
  type ApiProject,
} from "@/api/hooks";
import { BackButton } from "@/components/shared/back-button";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeading } from "@/components/typography/heading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { paperDisplayTitle } from "@/lib/paper-title";

function formatArchiveDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(value),
  );
}

function deletionDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + 14);
  return formatArchiveDate(date.toISOString());
}

interface ArchiveTableProps<T extends ApiProject | ApiModule> {
  title: string;
  rows: T[];
  name: (row: T) => string;
  context?: (row: T) => string;
  onRestore: (row: T) => Promise<unknown>;
  onDelete: (row: T) => Promise<unknown>;
  restoring: boolean;
  deleting: boolean;
}

function ArchiveTable<T extends ApiProject | ApiModule>({
  title,
  rows,
  name,
  context,
  onRestore,
  onDelete,
  restoring,
  deleting,
}: ArchiveTableProps<T>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState
            title={`No deleted ${title.toLowerCase()}`}
            description={`Deleted ${title.toLowerCase()} will appear here for 14 days.`}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-3 font-medium">Name</th>
                  <th className="px-3 py-3 font-medium">Archived</th>
                  <th className="px-3 py-3 font-medium">Deletes permanently</th>
                  <th className="px-3 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="px-3 py-4">
                      <span className="block font-medium">{name(row)}</span>
                      {context ? (
                        <span className="block text-xs text-muted-foreground">
                          {context(row)}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-4 text-muted-foreground">
                      {formatArchiveDate(row.archivedAt)}
                    </td>
                    <td className="px-3 py-4 text-muted-foreground">
                      {deletionDate(row.archivedAt)}
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={restoring || deleting}
                          onClick={() => void onRestore(row)}
                        >
                          <RotateCcw />
                          Restore
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={restoring || deleting}
                          onClick={() => void onDelete(row)}
                        >
                          <Trash2 />
                          Delete permanently
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ProjectsArchivePage() {
  const workspace = useCurrentWorkspace();
  const tenantId = workspace.data?.id ?? "";
  const projectsQuery = useArchivedProjects(tenantId);
  const papersQuery = useArchivedModules(tenantId);
  const activeProjectsQuery = useProjects(tenantId, 1, Boolean(tenantId), {
    pageSize: "all",
  });
  const restoreProject = useRestoreProject(tenantId);
  const permanentlyDeleteProject = usePermanentlyDeleteProject(tenantId);
  const restorePaper = useRestoreModule(tenantId);
  const permanentlyDeletePaper = usePermanentlyDeleteModule(tenantId);
  const [isEmptying, setIsEmptying] = useState(false);
  const [emptyError, setEmptyError] = useState<string | null>(null);

  if (workspace.isPending || projectsQuery.isPending || papersQuery.isPending) {
    return <LoadingState title="Loading trash" className="min-h-[50vh]" />;
  }

  if (projectsQuery.isError || papersQuery.isError) {
    const error = projectsQuery.error ?? papersQuery.error;
    return (
      <ErrorState
        title="Trash could not be loaded"
        description={
          error instanceof Error ? error.message : "Please try again."
        }
        onRetry={() => {
          void projectsQuery.refetch();
          void papersQuery.refetch();
        }}
      />
    );
  }

  const activeProjects = [
    ...(activeProjectsQuery.data?.generalProject
      ? [activeProjectsQuery.data.generalProject]
      : []),
    ...(activeProjectsQuery.data?.data ?? []),
  ];
  const projectNames = new Map(
    activeProjects.map((project) => [project.id, project.title]),
  );

  async function deleteProject(project: ApiProject) {
    if (
      !window.confirm(
        `Permanently delete "${project.title}" and its linked papers, tasks, and notes? This cannot be undone.`,
      )
    ) {
      return;
    }
    await permanentlyDeleteProject.mutateAsync(project.id);
  }

  async function deletePaper(paper: ApiModule) {
    if (
      !window.confirm(
        `Permanently delete "${paperDisplayTitle(paper)}" and its linked tasks and notes? This cannot be undone.`,
      )
    ) {
      return;
    }
    await permanentlyDeletePaper.mutateAsync(paper.id);
  }

  async function emptyTrash() {
    const projects = projectsQuery.data ?? [];
    const papers = papersQuery.data ?? [];
    const total = projects.length + papers.length;
    if (total === 0) return;

    if (
      !window.confirm(
        `Permanently delete all ${total} item${total === 1 ? "" : "s"} in the trash? This cannot be undone.`,
      )
    ) {
      return;
    }

    setEmptyError(null);
    setIsEmptying(true);
    try {
      const results = await Promise.allSettled([
        ...projects.map((project) =>
          permanentlyDeleteProject.mutateAsync(project.id),
        ),
        ...papers.map((paper) => permanentlyDeletePaper.mutateAsync(paper.id)),
      ]);
      const failed = results.filter(
        (result) => result.status === "rejected",
      ).length;
      if (failed > 0) {
        setEmptyError(
          `${failed} of ${total} item${total === 1 ? "" : "s"} could not be deleted. Please try again.`,
        );
      }
    } finally {
      setIsEmptying(false);
    }
  }

  const totalInTrash = (projectsQuery.data?.length ?? 0) + (papersQuery.data?.length ?? 0);
  const anyActionPending =
    restoreProject.isPending ||
    permanentlyDeleteProject.isPending ||
    restorePaper.isPending ||
    permanentlyDeletePaper.isPending;

  return (
    <div className="page-stack">
      <BackButton fallback="/projects" label="Back to Projects" />
      <PageHeading
        icon={Trash2}
        tone="blue"
        eyebrow="Projects"
        title="Trash"
        description="Restore deleted projects and papers before they are permanently removed after 14 days."
        actions={
          totalInTrash > 0 ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => void emptyTrash()}
              disabled={isEmptying || anyActionPending}
            >
              <Trash2 />
              {isEmptying ? "Emptying Trash…" : "Empty Trash"}
            </Button>
          ) : undefined
        }
      />

      {emptyError ? (
        <p role="alert" className="text-sm text-destructive">
          {emptyError}
        </p>
      ) : null}

      <ArchiveTable
        title="Projects"
        rows={projectsQuery.data ?? []}
        name={(project) => project.title}
        context={() => "Includes linked papers, tasks, and notes"}
        onRestore={(project) => restoreProject.mutateAsync(project.id)}
        onDelete={deleteProject}
        restoring={restoreProject.isPending}
        deleting={permanentlyDeleteProject.isPending}
      />

      <ArchiveTable
        title="Papers"
        rows={papersQuery.data ?? []}
        name={paperDisplayTitle}
        context={(paper) =>
          paper.projectId
            ? `Project: ${projectNames.get(paper.projectId) ?? "Unknown project"}`
            : "No project"
        }
        onRestore={(paper) => restorePaper.mutateAsync(paper.id)}
        onDelete={deletePaper}
        restoring={restorePaper.isPending}
        deleting={permanentlyDeletePaper.isPending}
      />
    </div>
  );
}
