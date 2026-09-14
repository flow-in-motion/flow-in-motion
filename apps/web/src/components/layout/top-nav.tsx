import { useState } from "react";
import { ChevronDown, Menu } from "lucide-react";
import { Link, NavLink } from "react-router-dom";

import { navGroups } from "@/config/nav-items";
import { cn } from "@/lib/utils";
import { NavTree } from "@/components/layout/nav-tree";
import { UserMenu } from "@/components/layout/user-menu";
import { Wordmark } from "@/components/layout/wordmark";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const [primaryGroup, ...moreGroups] = navGroups;

/**
 * Executive design theme's horizontal navigation bar — replaces the sidebar
 * entirely. Primary items render inline; the remaining nav groups collapse
 * into a "More" dropdown to keep the bar from overflowing. Below xl, falls
 * back to the same hamburger + Sheet + NavTree pattern SiteHeader uses.
 */
export function TopNav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="app-topbar sticky top-0 z-40 border-b backdrop-blur-xl">
      <div className="container flex h-[4.5rem] items-center gap-7">
        <Wordmark />

        <nav className="hidden flex-1 items-center gap-1 xl:flex">
          {primaryGroup.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 rounded-lg border border-transparent px-3 py-2 text-[0.8125rem] font-medium text-[hsl(var(--nav-muted))] transition-colors hover:border-primary/10 hover:bg-white/55 hover:text-[hsl(var(--nav-foreground))] dark:hover:bg-white/[0.06]",
                  isActive && "border-primary/15 bg-white/80 font-semibold text-primary shadow-[var(--shadow-sm)] hover:bg-white/80 dark:bg-white/[0.08] dark:hover:bg-white/[0.08]",
                )
              }
            >
              {item.icon ? <item.icon className="h-4 w-4 shrink-0" /> : null}
              {item.label}
            </NavLink>
          ))}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 rounded-lg border border-transparent px-3 py-2 text-[0.8125rem] font-medium text-[hsl(var(--nav-muted))] transition-colors hover:border-primary/10 hover:bg-white/55 hover:text-[hsl(var(--nav-foreground))] dark:hover:bg-white/[0.06]"
              >
                More
                <ChevronDown className="h-4 w-4 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
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

        <div className="hidden w-56 shrink-0 xl:block">
          <UserMenu />
        </div>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Open menu" className="ml-auto xl:hidden">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="app-sidebar flex w-3/4 flex-col overflow-y-auto border-r sm:max-w-xs">
            <SheetHeader className="border-b pb-5">
              <SheetTitle>Research in Motion</SheetTitle>
            </SheetHeader>
            <div className="mt-6 flex flex-col gap-6">
              <NavTree onNavigate={() => setMobileOpen(false)} />
              <div className="border-t pt-4">
                <UserMenu />
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
