import { useState, type FormEvent } from "react";
import {
  useReviewNoteMutation,
  type ReviewKind,
  type ReviewNote,
} from "@/api/reviews";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export function ReviewNotesPanel({
  tenantId,
  kind,
  recordId,
  notes,
}: {
  tenantId: string;
  kind: ReviewKind;
  recordId: string;
  notes: ReviewNote[];
}) {
  const [text, setText] = useState("");
  const [editingId, setEditingId] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const mutation = useReviewNoteMutation(tenantId, kind, recordId);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim() || mutation.isPending) return;
    setError(null);
    try {
      await mutation.mutateAsync({ noteId: editingId, content: text.trim() });
      setText("");
      setEditingId(undefined);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "The note could not be saved.",
      );
    }
  }
  async function remove(id: string) {
    if (!window.confirm("Delete this note? This cannot be undone.")) return;
    setError(null);
    try {
      await mutation.mutateAsync({ noteId: id, remove: true });
      if (id === editingId) {
        setEditingId(undefined);
        setText("");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "The note could not be deleted.",
      );
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={(event) => void submit(event)} className="space-y-3">
          <label htmlFor="review-note" className="text-sm font-medium">
            {editingId ? "Edit note" : "New note"}
          </label>
          <Textarea
            id="review-note"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={20000}
            disabled={mutation.isPending}
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={!text.trim() || mutation.isPending}>
              {mutation.isPending
                ? "Saving…"
                : editingId
                  ? "Save note"
                  : "Add note"}
            </Button>
            {editingId ? (
              <Button
                type="button"
                variant="outline"
                disabled={mutation.isPending}
                onClick={() => {
                  setEditingId(undefined);
                  setText("");
                }}
              >
                Cancel editing
              </Button>
            ) : null}
          </div>
        </form>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {notes.length ? (
          notes.map((note) => (
            <article key={note.id} className="space-y-2 border-t pt-4">
              <div className="flex items-center justify-between gap-3">
                <time
                  dateTime={note.createdAt}
                  className="text-xs text-muted-foreground"
                >
                  {new Intl.DateTimeFormat(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(note.createdAt))}
                </time>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={mutation.isPending}
                    aria-label={`Edit note from ${note.createdAt}`}
                    onClick={() => {
                      setEditingId(note.id);
                      setText(note.content);
                      setError(null);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={mutation.isPending}
                    aria-label={`Delete note from ${note.createdAt}`}
                    onClick={() => void remove(note.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
              <p className="whitespace-pre-wrap break-words text-sm">
                {note.content}
              </p>
            </article>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
