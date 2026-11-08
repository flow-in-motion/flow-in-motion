import { useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Sidebar } from "./sidebar";
import { CompactSidebar } from "./compact-sidebar";

/** Hides the menu without changing its theme, navigation or default layout. */
export function CollapsibleSidebar({ compact = false }: { compact?: boolean }) {
  const [closed, setClosed] = useState(false);
  return (
    <div className="sticky top-0 hidden h-screen shrink-0 lg:block">
      <div id="desktop-menu" hidden={closed}>
        {compact ? <CompactSidebar /> : <Sidebar />}
      </div>
      {closed ? (
        <div
          aria-hidden="true"
          className="app-sidebar h-screen w-10 border-r"
        />
      ) : null}
      <button
        type="button"
        aria-label={closed ? "Expand menu" : "Close menu"}
        title={closed ? "Expand menu" : "Close menu"}
        aria-expanded={!closed}
        aria-controls="desktop-menu"
        onClick={() => setClosed((value) => !value)}
        className="absolute right-0 top-1/2 z-40 inline-flex h-6 w-6 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md border border-border bg-card text-muted-foreground shadow-sm hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {closed ? (
          <PanelLeftOpen className="h-3.5 w-3.5" />
        ) : (
          <PanelLeftClose className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}
