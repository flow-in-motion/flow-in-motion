import { NavTree } from "@/components/layout/nav-tree";
import { UserMenu } from "@/components/layout/user-menu";
import { Wordmark } from "@/components/layout/wordmark";

/** Fixed left sidebar, visible from lg breakpoint up — replaces the mobile header. */
export function Sidebar() {
  return (
    <aside className="app-sidebar sticky top-0 hidden h-screen w-[16.5rem] shrink-0 flex-col overflow-hidden border-r lg:flex xl:w-[17rem]">
      <div className="flex h-[4.875rem] shrink-0 items-center border-b px-5">
        <Wordmark />
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-5 [scrollbar-color:hsl(var(--nav-border))_transparent] [scrollbar-width:thin]">
        <NavTree />
      </div>
      <div className="shrink-0 border-t bg-white/25 px-3 py-3 dark:bg-black/10">
        <UserMenu />
      </div>
    </aside>
  );
}
