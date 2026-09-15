import {
  useProjectCollaborators,
  useRemoveProjectCollaborator,
  type Membership,
} from "@/api/hooks";
import { CollaboratorRoster } from "@/components/sharing/collaborator-roster";
import { LoadingState } from "@/components/shared/loading-state";

interface ProjectCollaboratorsProps {
  tenantId: string;
  projectId: string;
  ownerUserId: string | undefined;
  members: Membership[];
  entityTitle: string;
  canManage: boolean;
}

export function ProjectCollaborators({
  tenantId,
  projectId,
  ownerUserId,
  members,
  entityTitle,
  canManage,
}: ProjectCollaboratorsProps) {
  const collaboratorsQuery = useProjectCollaborators(tenantId, projectId);
  const removeCollaborator = useRemoveProjectCollaborator(tenantId, projectId);

  if (collaboratorsQuery.isPending) {
    return <LoadingState title="Loading collaborators" className="min-h-32" />;
  }

  const collaborators = (collaboratorsQuery.data ?? []).map((collaborator) => ({
    id: collaborator.id,
    userId: collaborator.userId,
    displayName: collaborator.displayName,
    email: collaborator.email,
    affiliation: collaborator.affiliation,
    role: collaborator.role,
  }));

  return (
    <CollaboratorRoster
      target="project"
      tenantId={tenantId}
      entityId={projectId}
      entityTitle={entityTitle}
      ownerUserId={ownerUserId}
      members={members}
      collaborators={collaborators}
      onRemoveCollaborator={(userId) => removeCollaborator.mutate(userId)}
      isRemoving={removeCollaborator.isPending}
      canManage={canManage}
    />
  );
}
