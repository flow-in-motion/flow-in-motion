import { useState } from "react";
import { Menu } from "lucide-react";

import { NavTree } from "@/components/layout/nav-tree";
import { UserMenu } from "@/components/layout/user-menu";
import { Wordmark } from "@/components/layout/wordmark";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/** Tablet/mobile top bar (hidden from lg up, where the Sidebar takes over). */
export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="app-topbar sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between border-b px-4 backdrop-blur-xl lg:hidden">
      <div>
        <Wordmark />
      </div>
      <div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="app-sidebar flex w-3/4 flex-col overflow-y-auto border-r sm:max-w-xs">
            <SheetHeader className="border-b pb-5">
              <SheetTitle>Research in Motion</SheetTitle>
            </SheetHeader>
            <div className="mt-6 flex flex-col gap-6">
              <NavTree onNavigate={() => setOpen(false)} />
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
