import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronRight } from "lucide-react";

import { navGroups, type NavEntry } from "@/config/nav-items";
import { cn } from "@/lib/utils";

function isChildActive(pathname: string, entry: NavEntry) {
  return entry.children?.some((child) => pathname.startsWith(child.to)) ?? false;
}

function computeAutoExpanded(pathname: string) {
  const expanded = new Set<string>();
  for (const group of navGroups) {
    for (const item of group.items) {
      if (item.children && isChildActive(pathname, item)) {
        expanded.add(item.to);
      }
    }
  }
  return expanded;
}

function computeAutoExpandedGroups(pathname: string) {
  return new Set(
    navGroups
      .filter((group) =>
        group.items.some(
          (item) =>
            pathname === item.to ||
            pathname.startsWith(`${item.to}/`) ||
            isChildActive(pathname, item),
        ),
      )
      .map((group) => group.label),
  );
}

interface NavTreeProps {
  /** Called after a link is clicked — used to close the mobile Sheet. */
  onNavigate?: () => void;
}

/**
 * Grouped, expandable nav shared by the desktop sidebar and the mobile
 * Sheet drawer. Nested entries (e.g. Daily Notes > Input/Output) collapse
 * by default and auto-expand when a descendant route is active.
 */
export function NavTree({ onNavigate }: NavTreeProps) {
  const location = useLocation();
  const [expanded, setExpanded] = useState<Set<string>>(() =>
    computeAutoExpanded(location.pathname),
  );
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() =>
    computeAutoExpandedGroups(location.pathname),
  );

  useEffect(() => {
    setExpanded((prev) => new Set([...prev, ...computeAutoExpanded(location.pathname)]));
    setExpandedGroups((prev) =>
      new Set([...prev, ...computeAutoExpandedGroups(location.pathname)]),
    );
  }, [location.pathname]);

  function toggle(to: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(to)) {
        next.delete(to);
      } else {
        next.add(to);
      }
      return next;
    });
  }

  function toggleGroup(label: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  return (
    <nav className="flex flex-col gap-6">
      {navGroups.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          {group.label ? (
            group.collapsible ? (
              <button
                type="button"
                onClick={() => toggleGroup(group.label)}
                aria-expanded={expandedGroups.has(group.label)}
                className="mb-1 flex items-center justify-between rounded-lg px-3 py-1.5 text-left text-[0.625rem] font-bold uppercase tracking-[0.15em] text-primary/65 transition-colors hover:bg-white/45 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-white/[0.05]"
              >
                {group.label}
                <ChevronRight
                  className={cn(
                    "h-3.5 w-3.5 transition-transform",
                    expandedGroups.has(group.label) && "rotate-90",
                  )}
                />
              </button>
            ) : (
              <span className="mb-1.5 px-3 text-[0.625rem] font-bold uppercase tracking-[0.15em] text-primary/65">
                {group.label}
              </span>
            )
          ) : null}
          {!group.collapsible || expandedGroups.has(group.label) ? (
          <div className="flex flex-col gap-1">
            {group.items.map((item) => {
              const hasChildren = Boolean(item.children?.length);
              const isOpen = expanded.has(item.to);

              return (
                <div key={item.to}>
                  <div className="flex items-center">
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          "group relative flex min-h-10 flex-1 items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 text-[0.8125rem] font-medium text-muted-foreground transition-all before:absolute before:bottom-2 before:left-0 before:top-2 before:w-[3px] before:rounded-r-full before:bg-transparent hover:border-primary/10 hover:bg-white/55 hover:text-foreground dark:hover:bg-white/[0.06]",
                          isActive && "border-primary/15 bg-white/80 font-semibold text-primary shadow-[var(--shadow-sm)] before:bg-primary hover:bg-white/80 hover:text-primary dark:bg-white/[0.08] dark:hover:bg-white/[0.08] [&_.nav-icon]:border-primary [&_.nav-icon]:bg-primary [&_.nav-icon]:text-primary-foreground",
                        )
                      }
                    >
                      {item.icon ? (
                        <span className="nav-icon flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-primary/10 bg-white/45 text-muted-foreground transition-colors dark:bg-white/[0.05]">
                          <item.icon className="h-4 w-4" strokeWidth={1.8} />
                        </span>
                      ) : null}
                      <span className="flex-1">{item.label}</span>
                    </NavLink>
                    {hasChildren ? (
                      <button
                        type="button"
                        onClick={() => toggle(item.to)}
                        aria-expanded={isOpen}
                        aria-label={isOpen ? `Collapse ${item.label}` : `Expand ${item.label}`}
                        className="ml-1 rounded-lg border border-transparent p-2 text-muted-foreground transition-colors hover:border-primary/10 hover:bg-white/55 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-white/[0.06]"
                      >
                        <ChevronRight
                          className={cn("h-4 w-4 transition-transform", isOpen && "rotate-90")}
                        />
                      </button>
                    ) : null}
                  </div>
                  {hasChildren && isOpen ? (
                    <div className="ml-5 flex flex-col gap-0.5 border-l border-primary/15 pl-3 pt-1">
                      {item.children!.map((child) => (
                        <NavLink
                          key={child.to}
                          to={child.to}
                          onClick={onNavigate}
                          className={({ isActive }) =>
                            cn(
                              "rounded-md border border-transparent px-3 py-1.5 text-[0.8125rem] text-muted-foreground transition-colors hover:border-primary/10 hover:bg-white/55 hover:text-foreground dark:hover:bg-white/[0.06]",
                              isActive && "border-primary/10 bg-white/70 font-semibold text-primary hover:bg-white/70 hover:text-primary dark:bg-white/[0.07] dark:hover:bg-white/[0.07]",
                            )
                          }
                        >
                          {child.label}
                        </NavLink>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          ) : null}
        </div>
      ))}
    </nav>
  );
}
