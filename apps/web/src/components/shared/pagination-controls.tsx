import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PaginationControlsProps {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  isPending?: boolean;
  compact?: boolean;
  onPageChange: (page: number) => void;
  selectedPageSize?: number | "all";
  onPageSizeChange?: (pageSize: number | "all") => void;
}

export function PaginationControls({
  page,
  pageSize,
  totalItems,
  totalPages,
  isPending = false,
  compact = false,
  onPageChange,
  onPageSizeChange,
  selectedPageSize,
}: PaginationControlsProps) {
  if (totalItems === 0) {
    return null;
  }

  const safeTotalPages = Math.max(totalPages, 1);
  const firstItem = (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, totalItems);

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        "flex flex-col gap-3 border-t pt-4",
        !compact && "sm:flex-row sm:items-center sm:justify-between",
      )}
    >
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Showing {firstItem}–{lastItem} of {totalItems}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        {onPageSizeChange ? (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Show
            <select
              aria-label="Items per page"
              className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
              value={String(selectedPageSize ?? pageSize)}
              disabled={isPending}
              onChange={(event) => {
                const value = event.target.value;
                onPageSizeChange(value === "all" ? "all" : Number(value));
              }}
            >
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="all" disabled={totalItems > 5000}>All{totalItems > 5000 ? " (limit 5,000)" : ""}</option>
            </select>
          </label>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1 || isPending}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>

        <span className="text-sm tabular-nums text-muted-foreground">
          Page {page} of {safeTotalPages}
        </span>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= safeTotalPages || isPending}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
