import { NavLink } from "react-router-dom";

interface WordmarkProps {
  /** Icon-only mark for narrow rails (the compact sidebar) instead of the full text lockup. */
  compact?: boolean;
}

function LogoMark({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={compact
        ? "relative flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/15"
        : "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/15"
      }
    >
      <span className="font-heading text-[1.1rem] font-bold tracking-[-0.04em]" aria-hidden="true">
        R
      </span>
      <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[hsl(var(--brand-secondary))] ring-2 ring-primary" />
    </span>
  );
}

export function Wordmark({ compact = false }: WordmarkProps) {
  if (compact) {
    return (
      <NavLink
        to="/"
        aria-label="Research in Motion"
        title="Research in Motion"
        className="block rounded-[var(--radius)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <LogoMark compact />
      </NavLink>
    );
  }

  return (
    <NavLink
      to="/"
      aria-label="Research in Motion"
      className="group flex items-center gap-3 rounded-lg text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <LogoMark />
      <span className="flex min-w-0 flex-col leading-none">
        <span className="truncate text-[0.9rem] font-semibold tracking-[-0.015em]">Research in Motion</span>
        <span className="mt-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.13em] text-primary/65">Research workspace</span>
      </span>
    </NavLink>
  );
}
