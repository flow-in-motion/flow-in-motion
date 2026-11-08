import { useState, type FormEvent } from "react";
import {
  useSaveReview,
  type ReviewInput,
  type ReviewKind,
  type ReviewRecord,
} from "@/api/reviews";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fieldsFor } from "./review-fields";

export function ReviewForm({
  tenantId,
  kind,
  record,
  onSaved,
  onCancel,
}: {
  tenantId: string;
  kind: ReviewKind;
  record?: ReviewRecord;
  onSaved: (record: { id: string }) => void;
  onCancel: () => void;
}) {
  const fields = fieldsFor(kind);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map(({ key }) => [key, record?.[key] ?? ""])),
  );
  const [initialNote, setInitialNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const save = useSaveReview(tenantId, kind);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (save.isPending) return;
    setError(null);
    const input = Object.fromEntries(
      fields.map(({ key }) => [key, values[key]?.trim() || null]),
    ) as ReviewInput;
    if (!record) input.initialNote = initialNote.trim() || null;
    try {
      onSaved(await save.mutateAsync({ id: record?.id, input }));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "This record could not be saved.",
      );
    }
  }
  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      <fieldset disabled={save.isPending} className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => {
          const id = `${kind}-${field.key}`;
          return (
            <div
              key={field.key}
              className={
                field.type === "textarea"
                  ? "space-y-1.5 sm:col-span-2"
                  : "space-y-1.5"
              }
            >
              <label htmlFor={id} className="text-sm font-medium">
                {field.label}
                {field.required ? (
                  <span className="text-destructive"> *</span>
                ) : null}
              </label>
              {field.type === "degree" ? (
                <select
                  id={id}
                  value={values[field.key]}
                  onChange={(e) =>
                    setValues({ ...values, [field.key]: e.target.value })
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Not specified</option>
                  {["PhD", "MRes", "Masters", "Other"].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              ) : field.type === "textarea" ? (
                <Textarea
                  id={id}
                  value={values[field.key]}
                  onChange={(e) =>
                    setValues({ ...values, [field.key]: e.target.value })
                  }
                  maxLength={field.maxLength}
                  rows={4}
                />
              ) : (
                <Input
                  id={id}
                  type={field.type === "date" ? "date" : "text"}
                  value={values[field.key]}
                  onChange={(e) =>
                    setValues({ ...values, [field.key]: e.target.value })
                  }
                  required={field.required}
                  maxLength={field.maxLength}
                  min={
                    field.key === "dueOn"
                      ? values.requestedOn || undefined
                      : undefined
                  }
                  autoFocus={field.required}
                />
              )}
            </div>
          );
        })}
        {!record ? (
          <div className="space-y-1.5 sm:col-span-2">
            <label
              htmlFor={`${kind}-initial-note`}
              className="text-sm font-medium"
            >
              Notes
            </label>
            <Textarea
              id={`${kind}-initial-note`}
              value={initialNote}
              onChange={(e) => setInitialNote(e.target.value)}
              rows={3}
              maxLength={20000}
            />
          </div>
        ) : null}
      </fieldset>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <DialogFooter className="border-t pt-4">
        <Button
          type="button"
          variant="outline"
          disabled={save.isPending}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={
            save.isPending ||
            !values[
              kind === "examination" ? "studentName" : "manuscriptTitle"
            ]?.trim()
          }
        >
          {save.isPending
            ? "Saving…"
            : record
              ? "Save changes"
              : kind === "examination"
                ? "Add examination"
                : "Add review"}
        </Button>
      </DialogFooter>
    </form>
  );
}
