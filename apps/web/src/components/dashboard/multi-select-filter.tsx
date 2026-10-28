import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface MultiSelectFilterProps {
  options: readonly string[];
  selected: ReadonlySet<string>;
  pluralLabel: string;
  triggerClassName: string;
  onToggle: (value: string) => void;
  onClear: () => void;
}

/**
 * A filter where several options can be ticked at once. Nothing ticked
 * means "All". The menu stays open while ticking.
 */
export function MultiSelectFilter({
  options,
  selected,
  pluralLabel,
  triggerClassName,
  onToggle,
  onClear,
}: MultiSelectFilterProps) {
  const triggerLabel =
    selected.size === 0
      ? `All ${pluralLabel}`
      : selected.size === 1
        ? [...selected][0]
        : `${selected.size} ${pluralLabel}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("justify-between gap-2", triggerClassName)}
          aria-label={`Filter by ${pluralLabel}`}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronDown
            className="h-4 w-4 shrink-0 opacity-50"
            aria-hidden="true"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-72 min-w-64 overflow-y-auto"
      >
        <DropdownMenuCheckboxItem
          checked={selected.size === 0}
          onSelect={(event) => event.preventDefault()}
          onCheckedChange={onClear}
        >
          All {pluralLabel}
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option}
            checked={selected.has(option)}
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={() => onToggle(option)}
          >
            {option}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
