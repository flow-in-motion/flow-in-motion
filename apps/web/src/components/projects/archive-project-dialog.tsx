import { useEffect, useMemo, useState } from "react";

import {
  useProjects,
  type ApiProject,
  type ProjectArchiveImpact,
  type ProjectArchiveMode,
} from "@/api/hooks";
import {
  LinkExistingField,
  type LinkExistingOption,
} from "@/components/shared/link-existing-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ArchiveProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ApiProject | null;
  impact: ProjectArchiveImpact | undefined;
  impactPending: boolean;
  onArchive: (input: {
    projectId: string;
    mode: ProjectArchiveMode;
    destinationProjectId?: string;
  }) => Promise<unknown>;
  isPending: boolean;
  onArchived?: () => void;
}

export function ArchiveProjectDialog({
  open,
  onOpenChange,
  project,
  impact,
  impactPending,
  onArchive,
  isPending,
  onArchived,
}: ArchiveProjectDialogProps) {
  const [mode, setMode] = useState<ProjectArchiveMode>("archive_contents");
  const [destination, setDestination] = useState<LinkExistingOption | null>(
    null,
  );
  const [error, setError] = useState("");
  const projectsQuery = useProjects(
    project?.tenantId ?? "",
    1,
    open && Boolean(project),
    { pageSize: "all" },
  );

  useEffect(() => {
    if (!open) {
      setMode("archive_contents");
      setDestination(null);
      setError("");
    }
  }, [open]);

  const destinationOptions = useMemo(
    () =>
      (projectsQuery.data?.data ?? [])
        .filter(
          (candidate) =>
            candidate.id !== project?.id &&
            candidate.userId === project?.userId,
        )
        .map((candidate) => ({
          id: candidate.id,
          label: candidate.title,
          sublabel: candidate.displayId ?? undefined,
        })),
    [project?.id, project?.userId, projectsQuery.data?.data],
  );

  async function submitArchive() {
    if (!project) return;
    if (mode === "move_contents" && !destination) {
      setError("Select the project that should receive the linked work.");
      return;
    }

    setError("");
    try {
      await onArchive({
        projectId: project.id,
        mode,
        ...(destination ? { destinationProjectId: destination.id } : {}),
      });
      onOpenChange(false);
      onArchived?.();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The project could not be archived.",
      );
    }
  }

  const countText = impactPending
    ? "Checking linked work…"
    : `${impact?.papers ?? 0} papers, ${impact?.tasks ?? 0} tasks, and ${impact?.notes ?? 0} notes are linked to this project.`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Archive {project?.title ?? "project"}?</DialogTitle>
          <DialogDescription>
            {countText} Archived items are permanently deleted after 14 days.
          </DialogDescription>
        </DialogHeader>

        <fieldset className="space-y-3" disabled={isPending}>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4">
            <input
              type="radio"
              name="project-archive-mode"
              value="archive_contents"
              checked={mode === "archive_contents"}
              onChange={() => {
                setMode("archive_contents");
                setError("");
              }}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium">
                Archive project and linked work
              </span>
              <span className="block text-sm text-muted-foreground">
                Papers, tasks, and notes will be hidden with the project and
                return if it is restored.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4">
            <input
              type="radio"
              name="project-archive-mode"
              value="move_contents"
              checked={mode === "move_contents"}
              onChange={() => {
                setMode("move_contents");
                setError("");
              }}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium">
                Move linked work, then archive project
              </span>
              <span className="block text-sm text-muted-foreground">
                Move all linked papers, tasks, and notes to another project
                before archiving this one.
              </span>
            </span>
          </label>
        </fieldset>

        {mode === "move_contents" ? (
          <div className="space-y-2">
            <label
              htmlFor="archive-destination-project"
              className="text-sm font-medium"
            >
              Destination project
            </label>
            <LinkExistingField
              id="archive-destination-project"
              placeholder="Search projects…"
              options={destinationOptions}
              selected={destination ? [destination] : []}
              onAdd={(option) => {
                setDestination(option);
                setError("");
              }}
              onRemove={() => setDestination(null)}
              emptyMessage={
                projectsQuery.isPending
                  ? "Loading projects…"
                  : "No other owned projects are available."
              }
            />
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

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
            onClick={() => void submitArchive()}
            disabled={isPending || impactPending}
          >
            {isPending ? "Archiving…" : "Archive Project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
