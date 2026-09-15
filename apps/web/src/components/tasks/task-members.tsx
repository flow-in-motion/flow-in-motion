import {
  useMe,
  useTaskMembers,
  useRemoveTaskMember,
  type Membership,
} from "@/api/hooks";
import { CollaboratorRoster } from "@/components/sharing/collaborator-roster";
import { LoadingState } from "@/components/shared/loading-state";

interface TaskMembersManagerProps {
  tenantId: string;
  taskId: string;
  taskTitle: string;
  /** The task's creator — shown as the Owner row and the only one who can manage collaborators. */
  ownerUserId?: string;
  /** Workspace members, used to look up the owner's display details. */
  members?: Membership[];
}

export function TaskMembersManager({
  tenantId,
  taskId,
  taskTitle,
  ownerUserId,
  members = [],
}: TaskMembersManagerProps) {
  const taskMembersQuery = useTaskMembers(tenantId, taskId);
  const removeMember = useRemoveTaskMember(tenantId, taskId);
  const me = useMe();

  if (taskMembersQuery.isPending) {
    return <LoadingState title="Loading members" className="min-h-32" />;
  }

  const collaborators = (taskMembersQuery.data ?? []).map((member) => ({
    id: member.id,
    userId: member.userId,
    displayName: member.displayName,
    email: member.email,
    affiliation: member.affiliation,
  }));

  return (
    <CollaboratorRoster
      target="task"
      tenantId={tenantId}
      entityId={taskId}
      entityTitle={taskTitle}
      ownerUserId={ownerUserId}
      members={members}
      collaborators={collaborators}
      onRemoveCollaborator={(userId) => removeMember.mutate(userId)}
      isRemoving={removeMember.isPending}
      canManage={Boolean(ownerUserId) && me.data?.id === ownerUserId}
      noCollaboratorsMessage="No one else has access to this task yet."
    />
  );
}
