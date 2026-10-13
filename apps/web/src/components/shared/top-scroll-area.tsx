import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

interface TopScrollAreaProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

/**
 * Horizontal scroll container whose scrollbar sits at the top instead of the
 * bottom, so it stays reachable when the content is very tall (e.g. a long
 * pipeline column). The two scroll positions are kept in sync, and trackpad /
 * shift+wheel scrolling on the content still works as normal.
 */
export function TopScrollArea({
  children,
  className,
  contentClassName,
}: TopScrollAreaProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scrollWidth, setScrollWidth] = useState(0);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const measure = () => {
      setScrollWidth(content.scrollWidth);
      setOverflowing(content.scrollWidth > content.clientWidth + 1);
    };
    measure();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    if (content.firstElementChild) observer.observe(content.firstElementChild);
    return () => observer.disconnect();
  }, []);

  const sync = (from: HTMLDivElement | null, to: HTMLDivElement | null) => {
    // Only write when the positions differ, so the echoed scroll event from
    // the other element is a no-op and the two can't loop.
    if (!from || !to || to.scrollLeft === from.scrollLeft) return;
    to.scrollLeft = from.scrollLeft;
  };

  return (
    <div className={className}>
      <div
        ref={barRef}
        data-testid="top-scrollbar"
        aria-hidden="true"
        onScroll={() => sync(barRef.current, contentRef.current)}
        className={cn(
          "mb-2 overflow-x-auto overflow-y-hidden",
          !overflowing && "hidden",
        )}
      >
        <div style={{ width: scrollWidth, height: 1 }} />
      </div>
      <div
        ref={contentRef}
        onScroll={() => sync(contentRef.current, barRef.current)}
        className={cn(
          "overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          contentClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
