import { useEffect, useMemo, useState } from "react";

import {
  useArchiveProject,
  useProjectArchiveImpact,
  useProjects,
  type ApiProject,
} from "@/api/hooks";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProjectArchiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  project: ApiProject | null;
  projects: ApiProject[];
  currentUserId?: string;
  onArchived?: () => void;
}

export function ProjectArchiveDialog({
  open,
  onOpenChange,
  tenantId,
  project,
  projects,
  currentUserId,
  onArchived,
}: ProjectArchiveDialogProps) {
  const [contentAction, setContentAction] = useState<"archive" | "move">(
    "archive",
  );
  const [destinationProjectId, setDestinationProjectId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const archiveProject = useArchiveProject(tenantId);
  const allProjectsQuery = useProjects(tenantId, 1, open, "all");
  const impact = useProjectArchiveImpact(
    tenantId,
    project?.id ?? "",
    open && Boolean(project),
  );

  const destinations = useMemo(
    () =>
      (allProjectsQuery.data?.data ?? projects).filter(
        (candidate) =>
          candidate.id !== project?.id &&
          !candidate.archivedAt &&
          candidate.userId === currentUserId,
      ),
    [allProjectsQuery.data?.data, currentUserId, project?.id, projects],
  );

  useEffect(() => {
    if (!open) return;
    setContentAction("archive");
    setDestinationProjectId("");
    setError(null);
  }, [open, project?.id]);

  async function handleArchive() {
    if (!project) return;
    if (contentAction === "move" && !destinationProjectId) {
      setError("Choose the project that should receive the linked content.");
      return;
    }

    setError(null);
    try {
      await archiveProject.mutateAsync({
        projectId: project.id,
        contentAction,
        destinationProjectId:
          contentAction === "move" ? destinationProjectId : undefined,
      });
      onOpenChange(false);
      onArchived?.();
    } catch (archiveError) {
      setError(
        archiveError instanceof Error
          ? archiveError.message
          : "The project could not be archived.",
      );
    }
  }

  const counts = impact.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive {project?.title ?? "project"}</DialogTitle>
          <DialogDescription>
            Choose what should happen to the content linked to this project.
            Archived projects can be restored for 14 days.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
          {impact.isPending ? (
            <span className="text-muted-foreground">Checking linked content…</span>
          ) : impact.isError ? (
            <span className="text-destructive">{impact.error.message}</span>
          ) : (
            <span>
              {counts?.papers ?? 0} papers, {counts?.tasks ?? 0} tasks and{" "}
              {counts?.notes ?? 0} notes are linked to this project.
            </span>
          )}
        </div>

        <div className="space-y-3">
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4">
            <input
              type="radio"
              name="archive-content-action"
              value="archive"
              checked={contentAction === "archive"}
              onChange={() => setContentAction("archive")}
              className="mt-0.5 h-4 w-4 accent-primary"
            />
            <span>
              <span className="block text-sm font-medium">
                Archive the project and everything in it
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Papers, tasks and notes will be hidden now, restored together,
                and permanently deleted with the project after 14 days.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4">
            <input
              type="radio"
              name="archive-content-action"
              value="move"
              checked={contentAction === "move"}
              onChange={() => setContentAction("move")}
              className="mt-0.5 h-4 w-4 accent-primary"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">
                Move everything to another project
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                The content stays active and only the empty project is archived.
              </span>
            </span>
          </label>

          {contentAction === "move" ? (
            <Select
              value={destinationProjectId}
              onValueChange={setDestinationProjectId}
            >
              <SelectTrigger aria-label="Destination project">
                <SelectValue placeholder="Select destination project" />
              </SelectTrigger>
              <SelectContent>
                {destinations.map((destination) => (
                  <SelectItem key={destination.id} value={destination.id}>
                    {destination.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void handleArchive()}
            disabled={archiveProject.isPending || impact.isPending}
          >
            {archiveProject.isPending ? "Archiving…" : "Archive project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
