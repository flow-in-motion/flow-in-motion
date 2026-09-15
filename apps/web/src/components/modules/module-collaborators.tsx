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

  const collaborators = collaboratorRows.map((collaborator) => ({
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
