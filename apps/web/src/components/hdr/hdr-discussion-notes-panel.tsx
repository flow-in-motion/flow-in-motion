import { useState, type FormEvent } from "react";
import { useHdrNoteMutation, useHdrDiscussionNotes } from "@/api/hdr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { SearchInput } from "@/components/shared/search-input";

export function HdrDiscussionNotesPanel({
  tenantId,
  personId,
}: {
  tenantId: string;
  personId: string;
}) {
  const query = useHdrDiscussionNotes(tenantId, personId);
  const notes = query.data ?? [];
  const [text, setText] = useState("");
  const [editingId, setEditingId] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const searchTerm = search.trim().toLocaleLowerCase();
  const visibleNotes = searchTerm
    ? notes.filter((note) => note.content.toLocaleLowerCase().includes(searchTerm))
    : notes;
  const mutation = useHdrNoteMutation(tenantId, personId);
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
        <CardTitle>Discussion notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={(event) => void submit(event)} className="space-y-3">
          <label htmlFor="hdr-discussion-note" className="text-sm font-medium">
            {editingId ? "Edit note" : "New note"}
          </label>
          <Textarea
            id="hdr-discussion-note"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            className="min-h-72 resize-y"
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
        <SearchInput
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onClear={() => setSearch("")}
          clearLabel="Clear discussion notes search"
          aria-label="Search discussion notes"
          placeholder="Search discussion notes…"
        />
        {query.isPending ? (
          <p role="status" className="text-sm text-muted-foreground">
            Loading discussion notes…
          </p>
        ) : query.isError ? (
          <div role="alert" className="text-sm text-destructive">
            Discussion notes could not be loaded.{" "}
            <Button
              type="button"
              variant="outline"
              onClick={() => void query.refetch()}
            >
              Retry
            </Button>
          </div>
        ) : visibleNotes.length ? (
          visibleNotes.map((note) => (
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
              <p
                id={`hdr-note-${note.id}`}
                className={`whitespace-pre-wrap break-words text-sm${expanded.has(note.id) ? "" : " line-clamp-3"}`}
              >
                {note.content}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-expanded={expanded.has(note.id)}
                aria-controls={`hdr-note-${note.id}`}
                onClick={() => setExpanded((previous) => {
                  const next = new Set(previous);
                  if (next.has(note.id)) next.delete(note.id);
                  else next.add(note.id);
                  return next;
                })}
              >
                {expanded.has(note.id) ? "Show less" : "Read more"}
              </Button>
            </article>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">{searchTerm ? "No matching discussion notes." : "No notes yet."}</p>
        )}
      </CardContent>
    </Card>
  );
}
