import { Archive, RotateCcw, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";

import {
  useArchivedProjects,
  useCurrentWorkspace,
  usePermanentlyDeleteProject,
  useRestoreProject,
} from "@/api/hooks";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeading } from "@/components/typography/heading";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function deletionDate(archivedAt: string | null) {
  if (!archivedAt) return "—";
  const date = new Date(archivedAt);
  date.setDate(date.getDate() + 14);
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ProjectArchivePage() {
  const workspace = useCurrentWorkspace();
  const tenantId = workspace.data?.id ?? "";
  const archivedProjects = useArchivedProjects(tenantId);
  const restoreProject = useRestoreProject(tenantId);
  const permanentlyDeleteProject = usePermanentlyDeleteProject(tenantId);

  if (workspace.isPending || archivedProjects.isPending) {
    return <LoadingState title="Loading archive" className="min-h-[50vh]" />;
  }

  if (archivedProjects.isError) {
    return (
      <ErrorState
        title="Project archive could not be loaded"
        description={archivedProjects.error.message}
        onRetry={() => void archivedProjects.refetch()}
      />
    );
  }

  const projects = archivedProjects.data ?? [];

  async function handlePermanentDelete(projectId: string, title: string) {
    if (
      !window.confirm(
        `Permanently delete "${title}" and everything still stored in it? This cannot be undone.`,
      )
    ) {
      return;
    }
    await permanentlyDeleteProject.mutateAsync(projectId);
  }

  return (
    <div className="page-stack">
      <PageHeading
        icon={Archive}
        tone="blue"
        eyebrow="Projects"
        title="Archive"
        description="Restore archived projects within 14 days or permanently delete them now."
        actions={
          <Button asChild variant="outline">
            <Link to="/projects">Back to Projects</Link>
          </Button>
        }
      />

      {projects.length === 0 ? (
        <EmptyState
          title="No archived projects"
          description="Projects you archive will remain available here for 14 days."
          action={
            <Button asChild variant="outline">
              <Link to="/projects">Back to Projects</Link>
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Papers</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Permanent deletion</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell className="font-medium">{project.title}</TableCell>
                  <TableCell>{project.paperCount}</TableCell>
                  <TableCell>{project.noteCount}</TableCell>
                  <TableCell>{deletionDate(project.archivedAt)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void restoreProject.mutateAsync(project.id)}
                        disabled={restoreProject.isPending}
                      >
                        <RotateCcw />
                        Restore
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() =>
                          void handlePermanentDelete(project.id, project.title)
                        }
                        disabled={permanentlyDeleteProject.isPending}
                      >
                        <Trash2 />
                        Delete permanently
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
