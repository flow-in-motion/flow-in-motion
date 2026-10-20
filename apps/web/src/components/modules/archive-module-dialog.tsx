import { useMemo, useState } from "react";

import {
  useArchiveMyModuleWithOptions,
  useMyModuleArchiveDestinations,
  useMyModuleArchiveImpact,
  type ApiModule,
  type ModuleArchiveMode,
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
import { paperDisplayTitle } from "@/lib/paper-title";

interface ArchiveModuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paper: ApiModule;
  onArchived?: () => void;
}

export function ArchiveModuleDialog({
  open,
  onOpenChange,
  paper,
  onArchived,
}: ArchiveModuleDialogProps) {
  const [mode, setMode] =
    useState<ModuleArchiveMode>("archive_contents");
  const [destination, setDestination] =
    useState<LinkExistingOption | null>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const impactQuery = useMyModuleArchiveImpact(paper.id, open);
  const destinationsQuery = useMyModuleArchiveDestinations(
    paper.id,
    open && mode === "move_contents",
  );
  const archive = useArchiveMyModuleWithOptions();

  const isSaving = isSubmitting || archive.isPending;

  const destinationOptions = useMemo(
    () =>
      (destinationsQuery.data ?? [])
        .filter((candidate) => candidate.id !== paper.id)
        .map((candidate) => ({
          id: candidate.id,
          label: paperDisplayTitle(candidate),
          sublabel: candidate.displayId ?? undefined,
        })),
    [destinationsQuery.data, paper.id],
  );

  const impactReady =
    Boolean(impactQuery.data) &&
    !impactQuery.isPending &&
    !impactQuery.isError;

  const destinationReady =
    mode !== "move_contents" ||
    (destination !== null &&
      !destinationsQuery.isPending &&
      !destinationsQuery.isError &&
      destinationOptions.some((option) => option.id === destination.id));

  async function submitArchive() {
    if (isSaving || !impactReady) return;

    if (!destinationReady) {
      setError("Select the paper that should receive the linked work.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      await archive.mutateAsync({
        moduleId: paper.id,
        mode,
        ...(mode === "move_contents" && destination
          ? { destinationModuleId: destination.id }
          : {}),
      });

      onOpenChange(false);
      onArchived?.();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The paper could not be deleted.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isSaving) onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Delete {paperDisplayTitle(paper)}?</DialogTitle>
          <DialogDescription>
            {impactQuery.isPending
              ? "Checking linked work…"
              : impactQuery.isError
                ? "Linked work could not be checked."
                : impactQuery.data
                  ? `${impactQuery.data.tasks} tasks and ${impactQuery.data.notes} notes are linked to this paper.`
                  : "Checking linked work…"}{" "}
            Deleted items are permanently removed after 14 days.
          </DialogDescription>
        </DialogHeader>

        {impactQuery.isError ? (
          <div className="space-y-2">
            <p role="alert" className="text-sm text-destructive">
              {impactQuery.error.message}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void impactQuery.refetch()}
            >
              Retry linked-work check
            </Button>
          </div>
        ) : null}

        <fieldset className="space-y-3" disabled={isSaving}>
          <legend className="sr-only">Paper deletion options</legend>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4">
            <input
              type="radio"
              name="paper-archive-mode"
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
                Delete paper and linked work
              </span>
              <span className="block text-sm text-muted-foreground">
                Tasks and notes will be hidden with the paper and return if
                it is restored.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4">
            <input
              type="radio"
              name="paper-archive-mode"
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
                Move linked work, then delete paper
              </span>
              <span className="block text-sm text-muted-foreground">
                Move all linked tasks and notes to another paper you own
                before deleting this one.
              </span>
            </span>
          </label>

          {mode === "move_contents" ? (
            <div className="space-y-2">
              <label
                htmlFor="archive-destination-paper"
                className="text-sm font-medium"
              >
                Destination paper
              </label>

              {destinationsQuery.isError ? (
                <div className="space-y-2">
                  <p role="alert" className="text-sm text-destructive">
                    {destinationsQuery.error.message}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void destinationsQuery.refetch()}
                  >
                    Retry destination papers
                  </Button>
                </div>
              ) : (
                <LinkExistingField
                  id="archive-destination-paper"
                  placeholder="Search papers…"
                  options={destinationOptions}
                  selected={destination ? [destination] : []}
                  onAdd={(option) => {
                    setDestination(option);
                    setError("");
                  }}
                  onRemove={() => setDestination(null)}
                  emptyMessage={
                    destinationsQuery.isPending
                      ? "Loading papers…"
                      : "No other owned active papers are available."
                  }
                  inlineResults
                />
              )}
            </div>
          ) : null}
        </fieldset>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isSaving || !impactReady || !destinationReady}
            onClick={() => void submitArchive()}
          >
            {isSaving ? "Deleting…" : "Delete Paper"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
