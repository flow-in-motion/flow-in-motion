import { useState } from "react";
import { Cookie } from "lucide-react";
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
      role="region"
      aria-label="Cookie and storage notice"
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-card/95 p-4 shadow-lg backdrop-blur-sm sm:p-5"
    >
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
            <Cookie className="h-4 w-4" />
          </span>
          <p className="text-sm leading-6 text-muted-foreground">
            We use only strictly-necessary local storage, such as your sign-in session and display
            preferences. While you&apos;re signed in, we also record how you use the app (sections
            visited, key actions and errors) to improve it, and your workspace owner can see a usage
            summary that includes your activity. No third-party trackers, no ads, nothing sold.{" "}
            <Link to="/privacy" className="font-medium text-foreground underline underline-offset-2">
              Privacy Policy
            </Link>
          </p>
        </div>
        <Button size="sm" className="w-full shrink-0 sm:w-auto" onClick={dismiss}>
          Got it
        </Button>
      </div>
    </div>
  );
}
