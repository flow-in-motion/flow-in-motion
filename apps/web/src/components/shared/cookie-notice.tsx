import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

const DISMISSED_KEY = "research-in-motion.cookie-notice-dismissed.v3";

function readDismissed() {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "true";
  } catch {
    return false;
  }
}

export function CookieNotice() {
  const [dismissed, setDismissed] = useState(readDismissed);
  const barRef = useRef<HTMLDivElement>(null);

  // Publish the bar's height so floating buttons (e.g. Share feedback) can
  // sit above it instead of being half-covered; cleared once dismissed.
  useEffect(() => {
    const bar = barRef.current;
    if (dismissed || !bar) return;
    const root = document.documentElement;
    const publish = () =>
      root.style.setProperty("--cookie-notice-height", `${bar.offsetHeight}px`);
    publish();
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(publish);
    observer?.observe(bar);
    return () => {
      observer?.disconnect();
      root.style.removeProperty("--cookie-notice-height");
    };
  }, [dismissed]);

  if (dismissed) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISSED_KEY, "true");
    } catch {
      // Storage may be unavailable (private browsing, disabled site data);
      // the notice will just reappear next visit, which is a fine fallback.
    }
    setDismissed(true);
  }

  return (
    <div
      ref={barRef}
      role="region"
      aria-label="Cookie and storage notice"
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-card/95 px-4 py-2.5 shadow-lg backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="text-[0.8125rem] leading-5 text-muted-foreground">
          We use only necessary storage and record how you use the app to improve it; your
          workspace owner can see a usage summary. No trackers or ads, nothing sold.{" "}
          <Link to="/privacy" className="font-medium text-foreground underline underline-offset-2">
            Privacy Policy
          </Link>
        </p>
        <Button size="sm" className="h-8 w-full shrink-0 sm:w-auto" onClick={dismiss}>
          Got it
        </Button>
      </div>
    </div>
  );
}
