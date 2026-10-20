import { ChevronDown, ChevronUp, GripVertical, RotateCcw, SlidersHorizontal } from "lucide-react";
import { useState, type DragEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface DashboardWidgetOption<T extends string> {
  id: T;
  label: string;
  description: string;
  group: "Insights" | "Tables";
}

interface CustomizeDashboardDialogProps<T extends string> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  widgets: readonly DashboardWidgetOption<T>[];
  visibleWidgets: ReadonlySet<T>;
  onToggle: (widget: T) => void;
  onMove: (widget: T, direction: "up" | "down") => void;
  onReorder: (draggedWidget: T, targetWidget: T) => void;
  onReset: () => void;
}

export function CustomizeDashboardDialog<T extends string>({
  open,
  onOpenChange,
  widgets,
  visibleWidgets,
  onToggle,
  onMove,
  onReorder,
  onReset,
}: CustomizeDashboardDialogProps<T>) {
  const [draggedId, setDraggedId] = useState<T | null>(null);
  const [dragOverId, setDragOverId] = useState<T | null>(null);

  function handleDragStart(event: DragEvent<HTMLDivElement>, id: T) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);
    setDraggedId(id);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>, id: T) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (id !== draggedId) setDragOverId(id);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>, id: T) {
    event.preventDefault();
    const sourceId = draggedId ?? (event.dataTransfer.getData("text/plain") as T);
    if (sourceId && sourceId !== id) onReorder(sourceId, id);
    setDraggedId(null);
    setDragOverId(null);
  }

  function handleDragEnd() {
    setDraggedId(null);
    setDragOverId(null);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5" />
            Customise dashboard
          </DialogTitle>
          <DialogDescription>
            Choose which insights and tables are visible, then drag or reorder any widget anywhere on the dashboard.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[calc(100dvh-15rem)] space-y-2 overflow-y-auto pr-1">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Dashboard widgets
            </h3>
            <span className="text-xs tabular-nums text-muted-foreground">
              {widgets.filter((widget) => visibleWidgets.has(widget.id)).length}/{widgets.length} visible
            </span>
          </div>
          <div className="grid gap-2">
            {widgets.map((widget, index) => (
              <div
                key={widget.id}
                draggable
                onDragStart={(event) => handleDragStart(event, widget.id)}
                onDragOver={(event) => handleDragOver(event, widget.id)}
                onDrop={(event) => handleDrop(event, widget.id)}
                onDragEnd={handleDragEnd}
                className={cn(
                  "flex cursor-grab items-center gap-3 rounded-lg border border-border bg-muted/20 p-3 transition-colors active:cursor-grabbing",
                  draggedId === widget.id && "opacity-45",
                  dragOverId === widget.id && "border-primary bg-primary/5 ring-2 ring-primary/30",
                )}
              >
                <GripVertical
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={visibleWidgets.has(widget.id)}
                    onChange={() => onToggle(widget.id)}
                    className="mt-1 h-4 w-4 shrink-0 accent-primary"
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-medium">{widget.label}</span>
                      <span className="shrink-0 rounded-full border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {widget.group === "Insights" ? "Insight" : "Table"}
                      </span>
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {widget.description}
                    </span>
                  </span>
                </label>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={index === 0}
                    aria-label={`Move ${widget.label} up`}
                    onClick={() => onMove(widget.id, "up")}
                  >
                    <ChevronUp />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={index === widgets.length - 1}
                    aria-label={`Move ${widget.label} down`}
                    onClick={() => onMove(widget.id, "down")}
                  >
                    <ChevronDown />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="border-t pt-4 sm:justify-between">
          <Button type="button" variant="ghost" onClick={onReset}>
            <RotateCcw />
            Reset layout
          </Button>
          <DialogClose asChild>
            <Button type="button">Done</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
