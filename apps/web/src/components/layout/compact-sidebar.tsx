import { MoreHorizontal } from "lucide-react";
import { Link, NavLink } from "react-router-dom";

import { navGroups } from "@/config/nav-items";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/layout/user-menu";
import { Wordmark } from "@/components/layout/wordmark";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const [primaryGroup, ...moreGroups] = navGroups;

/**
 * The Minimal design theme's navigation — a narrow icon-only rail instead of
 * the full labeled Sidebar, structurally distinct rather than just a
 * restyled version of the same panel. Primary items render as icon buttons
 * (native `title` tooltip); everything else collapses into a "More" dropdown,
 * mirroring the pattern TopNav uses for the same overflow problem.
 */
export function CompactSidebar() {
  return (
    <aside className="app-sidebar sticky top-0 hidden h-screen w-[4.5rem] shrink-0 flex-col items-center gap-5 overflow-hidden border-r py-4 lg:flex">
      <div>
        <Wordmark compact />
      </div>

      <nav className="flex flex-1 flex-col items-center gap-1">
        {primaryGroup.items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            title={item.label}
            aria-label={item.label}
            className={({ isActive }) =>
              cn(
                "relative flex h-10 w-10 items-center justify-center rounded-lg border border-transparent text-muted-foreground transition-all hover:border-primary/10 hover:bg-white/55 hover:text-foreground dark:hover:bg-white/[0.06]",
                isActive && "border-primary/15 bg-white/80 text-primary shadow-[var(--shadow-sm)] after:absolute after:-left-2.5 after:h-5 after:w-1 after:rounded-r-full after:bg-primary dark:bg-white/[0.08]",
              )
            }
          >
            {item.icon ? <item.icon className="h-5 w-5" /> : null}
          </NavLink>
        ))}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="More navigation options"
              title="More"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-transparent text-muted-foreground transition-colors hover:border-primary/10 hover:bg-white/55 hover:text-foreground dark:hover:bg-white/[0.06]"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" className="w-64">
            {moreGroups.map((group, index) => (
              <div key={group.label || index}>
                {index > 0 ? <DropdownMenuSeparator /> : null}
                {group.label ? <DropdownMenuLabel>{group.label}</DropdownMenuLabel> : null}
                {group.items.map((item) => (
                  <DropdownMenuItem key={item.to} asChild>
                    <Link to={item.to}>
                      {item.icon ? <item.icon className="h-4 w-4 shrink-0" /> : null}
                      {item.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>

      <div>
        <UserMenu compact />
      </div>
    </aside>
  );
}
