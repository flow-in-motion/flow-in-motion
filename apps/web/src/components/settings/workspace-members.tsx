import { Users } from "lucide-react";

import { useCurrentWorkspace, useMe } from "@/api/hooks";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** Workspaces are single-owner — there's no invite/join flow, so this is a
 * read-only confirmation rather than a member list with management actions. */
export function WorkspaceMembers({
  className = "mx-auto mt-6 grid w-full max-w-5xl gap-6",
}: {
  className?: string;
}) {
  const me = useMe();
  const workspace = useCurrentWorkspace();

  if (!workspace.data) return null;

  return (
    <section
      aria-labelledby="workspace-members"
      className={className}
    >
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-primary/10 p-2 text-primary">
              <Users className="h-5 w-5" />
            </span>
            <div>
              <CardTitle id="workspace-members">Workspace members</CardTitle>
              <CardDescription>
                Each workspace has a single owner — there's no invite or sharing option.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            You are the sole owner of{" "}
            <span className="font-medium text-foreground">{workspace.data.name}</span>
            {me.data ? (
              <>
                {" "}
                as <span className="font-medium text-foreground">{me.data.displayName}</span>
              </>
            ) : null}
            .
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
