import { useMemo, useState } from "react";
import { X } from "lucide-react";

import {
  useMe,
  useEnumValues,
  useModuleCollaborators,
  useRemoveModuleCollaborator,
  type Membership,
} from "@/api/hooks";
import { InvitationPanel } from "@/components/sharing/invitation-panel";
import { LoadingState } from "@/components/shared/loading-state";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface ModuleCollaboratorsManagerProps {
  tenantId: string;
  moduleId: string;
  moduleTitle: string;
  members: Membership[];
}

export function ModuleCollaboratorsManager({
  tenantId,
  moduleId,
  moduleTitle,
  members,
}: ModuleCollaboratorsManagerProps) {
  const collaboratorsQuery = useModuleCollaborators(tenantId, moduleId);
  const removeCollaborator = useRemoveModuleCollaborator(tenantId, moduleId);
  const me = useMe();
  const rolesQuery = useEnumValues("project_role");
  const [search, setSearch] = useState("");

  const memberByUserId = useMemo(() => {
    const map = new Map<string, Membership>();
    for (const member of members) map.set(member.userId, member);
    return map;
  }, [members]);

  const roleById = useMemo(
    () => new Map((rolesQuery.data ?? []).map((role) => [role.id, role.value])),
    [rolesQuery.data],
  );
  const isOwner = (collaboratorsQuery.data ?? []).some((collaborator) => {
    const role = collaborator.role ?? roleById.get(collaborator.roleId ?? "");
    return collaborator.userId === me.data?.id && role === "Owner";
  });

  if (collaboratorsQuery.isPending) {
    return <LoadingState title="Loading collaborators" className="min-h-32" />;
  }

  const collaborators = collaboratorsQuery.data ?? [];
  const query = search.trim().toLowerCase();
  const filteredCollaborators = collaborators.filter((collaborator) => {
    if (!query) return true;
  
    const member = memberByUserId.get(collaborator.userId);
    const displayName =
      collaborator.displayName ?? member?.displayName ?? "";
    const email = collaborator.email ?? member?.email ?? "";
    const affiliation =
      collaborator.affiliation ?? member?.affiliation ?? "";
  
    return [displayName, email, affiliation].some((value) =>
      value.toLowerCase().includes(query),
    );
  });

  return (
    <div className="flex flex-col gap-4">
      {collaborators.length > 0 ? (
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name, email, or affiliation…"
          aria-label="Search collaborators by name, email, or affiliation"
          className="sm:max-w-xs"
        />
      ) : null}
      <div className="flex flex-col gap-2">
        {filteredCollaborators.map((collaborator) => {
          const member = memberByUserId.get(collaborator.userId);
          const displayName =
            collaborator.displayName ?? member?.displayName ?? "Unknown collaborator";
          const collaboratorEmail = collaborator.email ?? member?.email;
          const collaboratorAffiliation = collaborator.affiliation ?? member?.affiliation;
          return (
            <div
              key={collaborator.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-3"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {displayName}
                </span>
                {collaboratorEmail ? (
                  <span className="block truncate text-xs text-muted-foreground">
                    {collaboratorEmail}
                  </span>
                ) : null}
                {collaboratorAffiliation ? (
                  <span className="block truncate text-xs text-muted-foreground">
                    {collaboratorAffiliation}
                  </span>
                ) : null}
              </span>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {collaborator.role ?? roleById.get(collaborator.roleId ?? "") ?? "Collaborator"}
                </Badge>
                {isOwner && collaborator.userId !== me.data?.id ? (
                  <button
                    type="button"
                    aria-label={`Remove ${displayName}`}
                    onClick={() => removeCollaborator.mutate(collaborator.userId)}
                    className="rounded-full p-1 text-muted-foreground hover:text-destructive focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
        {collaborators.length === 0 ? (
          <p className="text-sm text-muted-foreground">No collaborators added yet.</p>
        ) : filteredCollaborators.length === 0 ? (
          <p className="text-sm text-muted-foreground">No collaborators match "{search.trim()}".</p>
        ) : null}
      </div>

      {isOwner ? (
        <InvitationPanel
          target="module"
          tenantId={tenantId}
          entityId={moduleId}
          entityTitle={moduleTitle}
          excludedUserIds={(collaboratorsQuery.data ?? []).map(
            (collaborator) => collaborator.userId,
          )}
        />
      ) : (
        <p className="border-t pt-4 text-sm text-muted-foreground">
          Only the paper owner can invite or remove collaborators.
        </p>
      )}
    </div>
  );
}
