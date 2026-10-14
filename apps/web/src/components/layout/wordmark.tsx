import { NavLink } from "react-router-dom";

interface WordmarkProps {
  /** Icon-only mark for narrow rails (the compact sidebar) instead of the full text lockup. */
  compact?: boolean;
}

function LogoMark({ compact = false }: { compact?: boolean }) {
  const size = compact ? "h-9 w-9" : "h-10 w-10";
  return (
    <span className={`relative flex ${size} shrink-0 items-center justify-center`}>
      {/* Navy mark for light themes, white mark for dark themes. */}
      <img
        src="/logo-mark.png"
        alt=""
        aria-hidden="true"
        className="h-full w-full object-contain dark:hidden"
      />
      <img
        src="/logo-mark-light.png"
        alt=""
        aria-hidden="true"
        className="hidden h-full w-full object-contain dark:block"
      />
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
