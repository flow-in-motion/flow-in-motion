import {
  useMe,
  useNoteMembers,
  useRemoveNoteMember,
  type Membership,
} from "@/api/hooks";
import { CollaboratorRoster } from "@/components/sharing/collaborator-roster";
import { LoadingState } from "@/components/shared/loading-state";

interface NoteMembersManagerProps {
  tenantId: string;
  noteId: string;
  noteTitle: string;
  /** The note's creator — shown as the Owner row and the only one who can manage collaborators. */
  ownerUserId?: string;
  /** Workspace members, used to look up the owner's display details. */
  members?: Membership[];
}

export function NoteMembersManager({
  tenantId,
  noteId,
  noteTitle,
  ownerUserId,
  members = [],
}: NoteMembersManagerProps) {
  const noteMembersQuery = useNoteMembers(tenantId, noteId);
  const removeMember = useRemoveNoteMember(tenantId, noteId);
  const me = useMe();

  if (noteMembersQuery.isPending) {
    return <LoadingState title="Loading members" className="min-h-32" />;
  }

  const collaborators = (noteMembersQuery.data ?? []).map((member) => ({
    id: member.id,
    userId: member.userId,
    displayName: member.displayName,
    email: member.email,
    affiliation: member.affiliation,
  }));

  return (
    <CollaboratorRoster
      target="note"
      tenantId={tenantId}
      entityId={noteId}
      entityTitle={noteTitle}
      ownerUserId={ownerUserId}
      members={members}
      collaborators={collaborators}
      onRemoveCollaborator={(userId) => removeMember.mutate(userId)}
      isRemoving={removeMember.isPending}
      canManage={Boolean(ownerUserId) && me.data?.id === ownerUserId}
      noCollaboratorsMessage="No one else has access to this note yet."
    />
  );
}
