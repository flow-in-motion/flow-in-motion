import {
  useMe,
  useModuleCollaborators,
  useRemoveModuleCollaborator,
  type Membership,
} from "@/api/hooks";
import { CollaboratorRoster } from "@/components/sharing/collaborator-roster";
import { LoadingState } from "@/components/shared/loading-state";

interface ModuleCollaboratorsManagerProps {
  tenantId: string;
  moduleId: string;
  moduleTitle: string;
  members: Membership[];
}

interface ModuleCollaboratorsSummaryProps {
  tenantId: string;
  moduleId: string;
}

export function ModuleCollaboratorsSummary({
  tenantId,
  moduleId,
}: ModuleCollaboratorsSummaryProps) {
  const collaboratorsQuery = useModuleCollaborators(tenantId, moduleId);
  const me = useMe();

  if (collaboratorsQuery.isPending) {
    return <span className="text-muted-foreground">Loading…</span>;
  }

  const collaborators = (collaboratorsQuery.data ?? []).filter(
    (collaborator) => collaborator.userId !== me.data?.id,
  );

  if (collaborators.length === 0) {
    return <span className="text-muted-foreground">None added</span>;
  }

  return (
    <span className="inline-flex flex-wrap gap-x-3 gap-y-1">
      {collaborators.map((collaborator) => (
        <span key={collaborator.id}>
          {collaborator.displayName}
          {collaborator.affiliation ? ` · ${collaborator.affiliation}` : ""}
        </span>
      ))}
    </span>
  );
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

  if (collaboratorsQuery.isPending) {
    return <LoadingState title="Loading collaborators" className="min-h-32" />;
  }

  const collaboratorRows = collaboratorsQuery.data ?? [];
  const owner = collaboratorRows.find((collaborator) => collaborator.role === "Owner");
  const isOwner = owner?.userId === me.data?.id;

  const collaborators = collaboratorRows
    .filter((collaborator) => collaborator.userId !== me.data?.id)
    .map((collaborator) => ({
      id: collaborator.id,
      userId: collaborator.userId,
      displayName: collaborator.displayName,
      email: collaborator.email,
      affiliation: collaborator.affiliation,
      role: collaborator.role,
    }));

  return (
    <CollaboratorRoster
      target="module"
      tenantId={tenantId}
      entityId={moduleId}
      entityTitle={moduleTitle}
      ownerUserId={owner?.userId}
      members={members}
      collaborators={collaborators}
      onRemoveCollaborator={(userId) => removeCollaborator.mutate(userId)}
      isRemoving={removeCollaborator.isPending}
      canManage={isOwner}
    />
  );
}
