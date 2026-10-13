import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

interface TopScrollAreaProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  /**
   * Keep the scrollbar pinned just below the app's sticky header while the
   * page scrolls, so it stays on screen next to very tall content.
   */
  sticky?: boolean;
}

// Height of whichever sticky app header is currently showing (TopNav, or the
// mobile SiteHeader). Returns 0 when none is visible, e.g. sidebar layout on
// large screens.
function useStickyHeaderOffset(enabled: boolean) {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const measure = () => {
      const headers = Array.from(
        document.querySelectorAll<HTMLElement>("header.app-topbar"),
      );
      const visible = headers.find((el) => el.getClientRects().length > 0);
      setOffset(visible ? visible.getBoundingClientRect().height : 0);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [enabled]);

  return offset;
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
  sticky = false,
}: TopScrollAreaProps) {
  const stickyTop = useStickyHeaderOffset(sticky);
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
        style={sticky ? { top: stickyTop } : undefined}
        className={cn(
          "mb-2 overflow-x-auto overflow-y-hidden py-1",
          // Styled explicitly so it is always visible (macOS otherwise hides
          // scrollbars until you scroll, which makes a standalone bar vanish).
          "[scrollbar-width:thin] [&::-webkit-scrollbar]:h-2.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/35 hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/55 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-muted",
          sticky && "sticky z-30 bg-background/90 backdrop-blur",
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
