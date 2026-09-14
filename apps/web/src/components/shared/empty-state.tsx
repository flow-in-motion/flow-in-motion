import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-52 flex-col items-center justify-center rounded-lg border border-dashed bg-card p-8 text-center",
        className,
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-muted text-muted-foreground ring-1 ring-border">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 text-base font-semibold">{title}</p>
      <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
