import { useState } from "react";
import { Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export interface LinkExistingOption {
  id: string;
  label: string;
  sublabel?: string;
}

interface LinkExistingFieldProps {
  id: string;
  placeholder: string;
  options: LinkExistingOption[];
  selected: LinkExistingOption[];
  onAdd: (option: LinkExistingOption) => void;
  onRemove: (id: string) => void;
  emptyMessage?: string;
}

export function LinkExistingField({
  id,
  placeholder,
  options,
  selected,
  onAdd,
  onRemove,
  emptyMessage = "Nothing found.",
}: LinkExistingFieldProps) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const selectedIds = new Set(selected.map((item) => item.id));
  const query = search.trim().toLowerCase();
  const matches = options
    .filter((option) => !selectedIds.has(option.id))
    .filter(
      (option) =>
        !query ||
        option.label.toLowerCase().includes(query) ||
        (option.sublabel?.toLowerCase().includes(query) ?? false),
    )
    .slice(0, 20);

  return (
    <div>
      <div
        className="relative"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setIsOpen(false);
          }
        }}
      >
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          id={id}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={`${id}-options`}
          aria-autocomplete="list"
          value={search}
          onClick={() => setIsOpen(true)}
          onChange={(event) => {
            setSearch(event.target.value);
            setIsOpen(true);
          }}
          placeholder={placeholder}
          className="pl-9"
          autoComplete="off"
        />
        {isOpen ? (
          <div
            id={`${id}-options`}
            role="listbox"
            className="absolute z-50 mt-1 max-h-[32rem] w-full overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-lg"
          >
            {matches.length ? (
              matches.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected="false"
                  className="flex w-full items-center justify-between gap-3 rounded-sm px-3 py-2 text-left hover:bg-accent focus:bg-accent focus:outline-none"
                  onClick={() => {
                    onAdd(option);
                    setSearch("");
                    setIsOpen(false);
                  }}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {option.label}
                    </span>
                    {option.sublabel ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {option.sublabel}
                      </span>
                    ) : null}
                  </span>
                </button>
              ))
            ) : (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                {emptyMessage}
              </p>
            )}
          </div>
        ) : null}
      </div>
      {selected.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {selected.map((item) => (
            <Badge key={item.id} variant="secondary" className="gap-1.5 py-1">
              {item.label}
              <button
                type="button"
                aria-label={`Remove ${item.label}`}
                onClick={() => onRemove(item.id)}
                className="rounded-full hover:text-destructive focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}
