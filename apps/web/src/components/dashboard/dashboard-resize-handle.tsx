import { GripVertical } from "lucide-react";
import { useRef } from "react";

interface DashboardResizeHandleProps {
  label: string;
  width: number;
  onPreview: (width: number | null) => void;
  onCommit: (width: number) => void;
}

interface ResizeStart {
  pointerId: number;
  clientX: number;
  widgetWidth: number;
  containerWidth: number;
  gap: number;
}

function clampWidth(value: number) {
  return Math.min(100, Math.max(25, Math.round(value)));
}

export function DashboardResizeHandle({
  label,
  width,
  onPreview,
  onCommit,
}: DashboardResizeHandleProps) {
  const startRef = useRef<ResizeStart | null>(null);
  const draftRef = useRef(width);

  function cancelResize() {
    if (!startRef.current) return;
    startRef.current = null;
    onPreview(null);
  }

  return (
    <button
      type="button"
      role="slider"
      aria-label={`Resize ${label}`}
      aria-orientation="horizontal"
      aria-valuemin={25}
      aria-valuemax={100}
      aria-valuenow={width}
      aria-valuetext={`${width}% width`}
      title="Drag to resize. Use arrow keys to adjust the width."
      className="absolute -right-2 top-1/2 z-10 hidden h-14 w-5 -translate-y-1/2 touch-none cursor-ew-resize items-center justify-center rounded-full border border-primary/40 bg-background text-primary shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring xl:flex"
      onPointerDown={(event) => {
        if (event.button !== 0) return;

        const widget = event.currentTarget.parentElement;
        const container = widget?.parentElement;
        if (!widget || !container) return;

        const containerWidth = container.getBoundingClientRect().width;
        if (containerWidth <= 0) return;

        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.focus();

        startRef.current = {
          pointerId: event.pointerId,
          clientX: event.clientX,
          widgetWidth: widget.getBoundingClientRect().width,
          containerWidth,
          gap: Number.parseFloat(
            window.getComputedStyle(container).columnGap,
          ) || 0,
        };
        draftRef.current = width;
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const start = startRef.current;
        if (!start || start.pointerId !== event.pointerId) return;

        const pixelWidth =
          start.widgetWidth + event.clientX - start.clientX;
        const nextWidth = clampWidth(
          ((pixelWidth + start.gap) /
            (start.containerWidth + start.gap)) * 100,
        );

        draftRef.current = nextWidth;
        onPreview(nextWidth);
      }}
      onPointerUp={(event) => {
        const start = startRef.current;
        if (!start || start.pointerId !== event.pointerId) return;

        startRef.current = null;
        onCommit(draftRef.current);

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerCancel={cancelResize}
      onLostPointerCapture={cancelResize}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          cancelResize();
          return;
        }

        const step = event.shiftKey ? 1 : 5;
        let nextWidth: number;

        switch (event.key) {
          case "ArrowLeft":
          case "ArrowDown":
            nextWidth = width - step;
            break;
          case "ArrowRight":
          case "ArrowUp":
            nextWidth = width + step;
            break;
          case "Home":
            nextWidth = 25;
            break;
          case "End":
            nextWidth = 100;
            break;
          default:
            return;
        }

        event.preventDefault();
        onCommit(clampWidth(nextWidth));
      }}
    >
      <GripVertical className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}