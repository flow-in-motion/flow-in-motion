import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface AuthScreenBackgroundProps {
  children: ReactNode;
  className?: string;
}

export function AuthScreenBackground({ children, className }: AuthScreenBackgroundProps) {
  return (
    <div className="app-canvas min-h-screen">
      <div className={cn("auth-stage min-h-screen", className)}>{children}</div>
    </div>
  );
}
