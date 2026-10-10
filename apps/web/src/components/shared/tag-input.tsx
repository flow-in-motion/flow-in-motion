import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TagInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  suggestions?: string[];
}

function parseTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function TagInput({ id, value, onChange, placeholder, className, suggestions = [] }: TagInputProps) {
  const tags = parseTags(value);
  const [draft, setDraft] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const normalizedTags = new Set(tags.map((tag) => tag.toLocaleLowerCase()));
  const matchingSuggestions = suggestions
    .filter((suggestion) => !normalizedTags.has(suggestion.toLocaleLowerCase()))
    .filter((suggestion) => suggestion.toLocaleLowerCase().includes(draft.trim().toLocaleLowerCase()))
    .slice(0, 8);

  function commitDraft(nextTags: string[] = tags) {
    const trimmed = draft.trim();
    if (trimmed) {
      onChange([...nextTags, trimmed].join(", "));
    } else if (nextTags !== tags) {
      onChange(nextTags.join(", "));
    }
    setDraft("");
  }

  function removeTag(index: number) {
    onChange(tags.filter((_, i) => i !== index).join(", "));
  }

  function addSuggestion(suggestion: string) {
    onChange([...tags, suggestion].join(", "));
    setDraft("");
    document.getElementById(id)?.focus();
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const raw = event.target.value;
    if (!raw.includes(",")) {
      setDraft(raw);
      return;
    }
    const parts = raw.split(",");
    const last = parts.pop() ?? "";
    const newTags = parts.map((part) => part.trim()).filter(Boolean);
    if (newTags.length) {
      onChange([...tags, ...newTags].join(", "));
    }
    setDraft(last);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      commitDraft();
    } else if (event.key === "Backspace" && draft === "" && tags.length > 0) {
      event.preventDefault();
      removeTag(tags.length - 1);
    }
  }

  return (
    <div className="relative">
      <div
        className={cn(
          "flex min-h-[var(--control-height)] w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-card px-2 py-1.5 text-sm transition-colors hover:border-primary/35 focus-within:border-primary focus-within:outline-none focus-within:ring-2 focus-within:ring-ring/15",
          className,
        )}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            document.getElementById(id)?.focus();
          }
        }}
      >
      {tags.map((tag, index) => (
        <Badge key={`${tag}-${index}`} variant="secondary" className="gap-1 py-0.5">
          {tag}
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            onClick={() => removeTag(index)}
            className="rounded-full hover:text-destructive focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <input
        id={id}
        value={draft}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          setIsFocused(false);
          commitDraft();
        }}
        placeholder={tags.length === 0 ? placeholder : undefined}
        className="min-w-[8rem] flex-1 border-0 bg-transparent p-0 text-sm outline-none placeholder:text-muted-foreground/80"
        autoComplete="off"
        role="combobox"
        aria-expanded={isFocused && matchingSuggestions.length > 0}
        aria-controls={`${id}-suggestions`}
      />
      </div>
      {isFocused && matchingSuggestions.length > 0 ? (
        <div id={`${id}-suggestions`} role="listbox" className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          {matchingSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              role="option"
              aria-selected="false"
              className="flex w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => addSuggestion(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
