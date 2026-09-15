import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { cn } from "@/lib/utils";

export interface SortableHeaderProps<TColumn extends string> {
  label: string;
  column: TColumn;
  sortColumn: TColumn;
  sortDirection: "asc" | "desc";
  onSort: (column: TColumn) => void;
}

export function SortableHeader<TColumn extends string>({
  label,
  column,
  sortColumn,
  sortDirection,
  onSort,
}: SortableHeaderProps<TColumn>) {
  const active = column === sortColumn;
  const Icon = active ? (sortDirection === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      aria-label={`Sort by ${label}`}
      className={cn(
        "flex items-center gap-1 text-left transition-colors",
        active ? "text-foreground" : "hover:text-foreground",
      )}
    >
      {label}
      <Icon className={cn("h-3 w-3", active ? "text-primary" : "opacity-30")} />
    </button>
  );
}
