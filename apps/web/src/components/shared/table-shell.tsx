import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface TableShellProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  filters?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function TableShell({
  title,
  description,
  actions,
  filters,
  children,
  className,
  contentClassName,
}: TableShellProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="gap-4 border-b border-primary/10 bg-gradient-to-r from-accent/60 via-card/80 to-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            {description ? <CardDescription className="mt-1">{description}</CardDescription> : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
        {filters ? <div>{filters}</div> : null}
      </CardHeader>
      <CardContent className={cn("p-0", contentClassName)}>{children}</CardContent>
    </Card>
  );
}
