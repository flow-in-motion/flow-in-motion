import { useId, useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import {
  useDeleteConferencePresentation,
  useModuleConferencePresentations,
  usePresentationConferenceOptions,
  useSaveConferencePresentation,
  type ApiConferencePresentation,
  type ConferencePresentationInput,
} from "@/api/hooks";
import { PanelToggleButton } from "@/components/shared/linked-items-panels";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  tenantId: string;
  moduleId: string;
  defaultPaperTitle: string;
}

function formatDate(value: string | null) {
  return value ? value.split("-").reverse().join("/") : "—";
}

function PresentationForm({
  tenantId,
  moduleId,
  presentation,
  existingConferenceIds,
  defaultPaperTitle,
  saving,
  onSave,
  onCancel,
}: Props & {
  presentation: ApiConferencePresentation | null;
  existingConferenceIds: Set<string>;
  saving: boolean;
  onSave: (
    conferenceId: string,
    input: ConferencePresentationInput,
  ) => Promise<void>;
  onCancel: () => void;
}) {
  const fieldId = useId();
  const options = usePresentationConferenceOptions(
    tenantId,
    moduleId,
    !presentation,
  );

  const [form, setForm] = useState({
    conferenceId: presentation?.conferenceId ?? "",
    presentedDate: presentation?.presentedDate ?? "",
    presentationType: presentation?.presentationType ?? "",
    paperTitle: presentation?.paperTitle ?? defaultPaperTitle,
    abstract: presentation?.abstract ?? "",
    notes: presentation?.notes ?? "",
  });
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setError(null);

    if (!form.conferenceId || !form.presentedDate) {
      setError("Choose a conference and enter the presentation date.");
      return;
    }

    try {
      await onSave(form.conferenceId, {
        presentedDate: form.presentedDate,
        presentationType: form.presentationType.trim() || null,
        paperTitle: form.paperTitle.trim() || null,
        abstract: form.abstract.trim() || null,
        notes: form.notes.trim() || null,
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The presentation could not be saved.",
      );
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <DialogHeader>
        <DialogTitle>
          {presentation ? "Edit conference presentation" : "Log conference presentation"}
        </DialogTitle>
        <DialogDescription>
          Record where this paper was presented and the details used for
          that conference.
        </DialogDescription>
      </DialogHeader>

      <fieldset disabled={saving} className="grid gap-4">
        {presentation ? (
          <div>
            <p className="text-sm text-muted-foreground">Conference</p>
            <p className="mt-1 font-medium">{presentation.conferenceName}</p>
          </div>
        ) : (
          <div className="grid gap-1.5">
            <label htmlFor={`${fieldId}-conference`} className="text-sm font-medium">
              Conference *
            </label>
            <select
              id={`${fieldId}-conference`}
              value={form.conferenceId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  conferenceId: event.target.value,
                }))
              }
              required
              disabled={options.isPending || options.isError}
              className="h-[var(--control-height)] w-full rounded-md border border-input bg-card px-3 text-sm"
            >
              <option value="">
                {options.isPending ? "Loading conferences…" : "Choose a conference"}
              </option>
              {(options.data ?? []).map((conference) => (
                <option
                  key={conference.id}
                  value={conference.id}
                  disabled={existingConferenceIds.has(conference.id)}
                >
                  {conference.name}
                  {existingConferenceIds.has(conference.id)
                    ? " — already recorded"
                    : ""}
                </option>
              ))}
            </select>

            {options.isError ? (
              <div role="alert" className="text-sm text-destructive">
                <p>{options.error.message}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void options.refetch()}
                >
                  Retry conferences
                </Button>
              </div>
            ) : null}

            {!options.isPending &&
            !options.isError &&
            options.data?.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No owned conferences are available. Add a conference on the
                Conferences page first, then return to this paper.
              </p>
            ) : null}
          </div>
        )}

        <div className="grid gap-1.5">
          <label htmlFor={`${fieldId}-date`} className="text-sm font-medium">
            Presentation date *
          </label>
          <Input
            id={`${fieldId}-date`}
            type="date"
            value={form.presentedDate}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                presentedDate: event.target.value,
              }))
            }
            required
          />
        </div>

        {[
          ["presentationType", "Presentation type", 80, "Talk, poster, workshop…"],
          ["paperTitle", "Presented paper title", 1000, ""],
        ].map(([key, label, maxLength, placeholder]) => {
          const field = key as "presentationType" | "paperTitle";

          return (
            <div key={field} className="grid gap-1.5">
              <label htmlFor={`${fieldId}-${field}`} className="text-sm font-medium">
                {label}
              </label>
              <Input
                id={`${fieldId}-${field}`}
                value={form[field]}
                maxLength={Number(maxLength)}
                placeholder={String(placeholder)}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    [field]: event.target.value,
                  }))
                }
              />
            </div>
          );
        })}

        {([
          ["abstract", "Presented abstract", 7],
          ["notes", "Notes", 4],
        ] as const).map(([field, label, rows]) => (
          <div key={field} className="grid gap-1.5">
            <label htmlFor={`${fieldId}-${field}`} className="text-sm font-medium">
              {label}
            </label>
            <Textarea
              id={`${fieldId}-${field}`}
              value={form[field]}
              rows={rows}
              maxLength={50000}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  [field]: event.target.value,
                }))
              }
            />
          </div>
        ))}
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
          disabled={saving}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={
            saving ||
            (!presentation &&
              (options.isPending || options.isError || !form.conferenceId))
          }
        >
          {saving ? "Saving…" : "Save presentation"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ConferencePresentationHistory(props: Props) {
  const { tenantId, moduleId } = props;
  const contentId = useId();
  const history = useModuleConferencePresentations(tenantId, moduleId);
  const save = useSaveConferencePresentation(tenantId, moduleId);
  const remove = useDeleteConferencePresentation(tenantId, moduleId);

  const [visible, setVisible] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ApiConferencePresentation | null>(null);
  const [removing, setRemoving] = useState<ApiConferencePresentation | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const presentations = history.data?.data ?? [];

  async function savePresentation(
    conferenceId: string,
    input: ConferencePresentationInput,
  ) {
    await save.mutateAsync({
      conferenceId,
      input,
      mode: editing ? "update" : "create",
    });

    setEditorOpen(false);
    setEditing(null);
  }

  async function deletePresentation() {
    if (!removing || remove.isPending) return;

    setDeleteError(null);

    try {
      await remove.mutateAsync(removing.conferenceId);
      setRemoving(null);
    } catch (cause) {
      setDeleteError(
        cause instanceof Error
          ? cause.message
          : "The presentation could not be removed.",
      );
    }
  }

  return (
    <>
      <Card role="region" aria-label="Conference presentation history">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle>
            Conference presentation history ({presentations.length})
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {history.data?.canLogPresentation ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditing(null);
                  setEditorOpen(true);
                }}
              >
                <Plus />
                Log presentation
              </Button>
            ) : null}
            <PanelToggleButton
              visible={visible}
              onToggle={() => setVisible((current) => !current)}
              label="conference presentation history"
              controls={contentId}
            />
          </div>
        </CardHeader>

        {visible ? (
          <CardContent id={contentId}>
            {history.isPending ? (
              <p className="text-sm text-muted-foreground">
                Loading conference presentations…
              </p>
            ) : history.isError ? (
              <div role="alert" className="space-y-3">
                <p className="text-sm text-destructive">
                  {history.error.message}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void history.refetch()}
                >
                  Retry history
                </Button>
              </div>
            ) : presentations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No conference presentations logged yet for this paper.
              </p>
            ) : (
              <div className="space-y-3">
                {presentations.map((presentation) => (
                  <article
                    key={presentation.id}
                    aria-label={`Presentation at ${presentation.conferenceName}`}
                    className="rounded-lg border p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold">
                          {presentation.conferenceName}
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {[
                            formatDate(presentation.presentedDate),
                            presentation.presentationType,
                            presentation.location,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>

                      {presentation.canManage ? (
                        <div className="flex shrink-0 gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Edit presentation at ${presentation.conferenceName}`}
                            onClick={() => {
                              setEditing(presentation);
                              setEditorOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Remove presentation at ${presentation.conferenceName}`}
                            onClick={() => {
                              setDeleteError(null);
                              setRemoving(presentation);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : null}
                    </div>

                    {presentation.paperTitle ? (
                      <p className="mt-3 text-sm italic">
                        {presentation.paperTitle}
                      </p>
                    ) : null}

                    {([
                      ["Abstract", presentation.abstract],
                      ["Notes", presentation.notes],
                    ] as const).map(([label, value]) =>
                      value ? (
                        <div key={label} className="mt-3">
                          <h4 className="text-xs font-medium text-muted-foreground">
                            {label}
                          </h4>
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm">
                            {value}
                          </p>
                        </div>
                      ) : null,
                    )}
                  </article>
                ))}
              </div>
            )}
          </CardContent>
        ) : null}
      </Card>

      <Dialog
        open={editorOpen}
        onOpenChange={(open) => {
          if (!save.isPending) setEditorOpen(open);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          {editorOpen ? (
            <PresentationForm
              key={editing?.conferenceId ?? "new"}
              {...props}
              presentation={editing}
              existingConferenceIds={
                new Set(presentations.map((item) => item.conferenceId))
              }
              saving={save.isPending}
              onSave={savePresentation}
              onCancel={() => setEditorOpen(false)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(removing)}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) {
            setRemoving(null);
            setDeleteError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove conference presentation?</DialogTitle>
            <DialogDescription>
              Remove the presentation details for {removing?.conferenceName}.
              The conference will remain linked to this paper.
            </DialogDescription>
          </DialogHeader>

          {deleteError ? (
            <p role="alert" className="text-sm text-destructive">
              {deleteError}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              disabled={remove.isPending}
              onClick={() => setRemoving(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => void deletePresentation()}
            >
              {remove.isPending ? "Removing…" : "Remove presentation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
