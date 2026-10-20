import { useMemo, useState, type FormEvent } from "react";
import { Mail, Search, Trash2, X } from "lucide-react";

import {
  useCollaboratorInvitations,
  useCreateDraftInvitation,
  useSendInvitation,
  useRevokeCollaboratorInvitation,
  useUserSearch,
  type ApiInvitation,
  type InvitationTarget,
  type Membership,
  useMe,
} from "@/api/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSessionListState } from "@/hooks/use-session-list-state";

const SHOW_INVITE_ACTION = false;
export interface RosterCollaborator {
  id: string;
  userId: string;
  displayName?: string | null;
  email?: string | null;
  affiliation?: string | null;
  role?: string | null;
}

interface CollaboratorRosterProps {
  target: InvitationTarget;
  tenantId: string;
  entityId: string;
  /** Shown in the invite email's subject/body — the project/paper/task/note title. */
  entityTitle: string;
  ownerUserId?: string;
  /** Workspace members, used to look up the owner's display details when they aren't already an explicit collaborator. */
  members: Membership[];
  collaborators: RosterCollaborator[];
  onRemoveCollaborator: (userId: string) => void;
  isRemoving?: boolean;
  canManage: boolean;
  /**
   * Load and list added (draft/pending) collaborators even when the roster is
   * read-only. Defaults to `canManage`. The API only lets the owner list them.
   */
  showInvitations?: boolean;
  noCollaboratorsMessage?: string;
}

/** Builds a mailto: link pre-filled with a sample invite message, so the
 * sender's own email client composes and sends the actual message. */
function buildInvitationMailto(input: {
  email: string;
  name?: string | null;
  entityTitle: string;
  target: InvitationTarget;
  acceptanceUrl: string;
  expiresAt?: string | null;
}) {
  const subject = `Invitation to collaborate on ${input.entityTitle}`;
  const greeting = input.name ? `Hi ${input.name},` : "Hello,";
  const expiry = input.expiresAt
    ? new Date(input.expiresAt).toLocaleDateString()
    : null;
  const body = [
    greeting,
    "",
    `You've been invited to collaborate on the ${input.target} "${input.entityTitle}".`,
    "",
    "Accept your invitation using this link:",
    input.acceptanceUrl,
    "",
    expiry ? `This invitation expires ${expiry}.` : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  return `mailto:${encodeURIComponent(input.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function formatContactLine(entry: {
  displayName?: string | null;
  email?: string | null;
  affiliation?: string | null;
}) {
  const name = entry.displayName ?? "Unnamed collaborator";
  return (
    <span className="flex min-w-0 items-baseline gap-1.5">
      <span className="shrink-0 truncate text-sm font-medium">{name}</span>
      {entry.email ? (
        <>
          <span className="shrink-0 text-muted-foreground">·</span>
          <span className="truncate text-xs text-muted-foreground">
            {entry.email}
          </span>
        </>
      ) : null}
      {entry.affiliation ? (
        <>
          <span className="shrink-0 text-muted-foreground">·</span>
          <span className="truncate text-xs text-muted-foreground">
            {entry.affiliation}
          </span>
        </>
      ) : null}
    </span>
  );
}

export function CollaboratorRoster({
  target,
  tenantId,
  entityId,
  entityTitle,
  ownerUserId,
  members,
  collaborators,
  onRemoveCollaborator,
  isRemoving = false,
  canManage,
  showInvitations = canManage,
  noCollaboratorsMessage = "No additional collaborators yet.",
}: CollaboratorRosterProps) {
  const me = useMe();
  const invitationsQuery = useCollaboratorInvitations(
    target,
    tenantId,
    entityId,
    showInvitations,
  );
  const createDraft = useCreateDraftInvitation(target, tenantId, entityId);
  const sendInvitation = useSendInvitation(target, tenantId, entityId);
  const revokeInvitation = useRevokeCollaboratorInvitation(
    target,
    tenantId,
    entityId,
  );
  const [sendingId, setSendingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [activePicker, setActivePicker] = useState<"name" | "email" | null>(
    null,
  );
  const searchQuery =
    activePicker === "name" ? name : activePicker === "email" ? email : "";
  const userSearch = useUserSearch(searchQuery, activePicker !== null);
  const [filterQuery, setFilterQuery] = useSessionListState<string>(
    me.data?.id,
    tenantId,
    `collaborators:${target}:${entityId}:search`,
    "",
  );

  const memberByUserId = useMemo(() => {
    const map = new Map<string, Membership>();
    for (const member of members) map.set(member.userId, member);
    return map;
  }, [members]);

  const owner = ownerUserId ? memberByUserId.get(ownerUserId) : undefined;
  const ownerIsCollaborator = collaborators.some(
    (collaborator) => collaborator.userId === ownerUserId,
  );
  const showOwnerRow = !ownerIsCollaborator && Boolean(owner);

  const trimmedFilterQuery = filterQuery.trim().toLowerCase();
  const filteredCollaborators = trimmedFilterQuery
    ? collaborators.filter((collaborator) =>
        [
          collaborator.displayName,
          collaborator.email,
          collaborator.affiliation,
        ].some((value) => value?.toLowerCase().includes(trimmedFilterQuery)),
      )
    : collaborators;

  const invitations = showInvitations ? (invitationsQuery.data ?? []) : [];
  const drafts = invitations.filter(
    (invitation) => invitation.status === "draft",
  );
  const pending = invitations.filter(
    (invitation) => invitation.status === "pending",
  );

  const collaboratorEmails = new Set(
    collaborators
      .map((collaborator) => collaborator.email?.toLowerCase())
      .filter(Boolean),
  );
  const pendingEmails = new Set(
    [...drafts, ...pending]
      .map((invitation) => invitation.email?.toLowerCase())
      .filter(Boolean),
  );
  const ownerEmail = (
    owner?.email ?? (me.data?.id === ownerUserId ? me.data?.email : undefined)
  )?.toLowerCase();
  const collaboratorUserIds = new Set(
    collaborators.map((collaborator) => collaborator.userId),
  );
  // People added by name only can't be matched by email, so match by name.
  const nameOnlyNames = new Set(
    [
      ...collaborators.map((collaborator) => ({
        name: collaborator.displayName,
        email: collaborator.email,
      })),
      ...drafts,
      ...pending,
    ]
      .filter((entry) => !entry.email?.trim() && entry.name?.trim())
      .map((entry) => entry.name!.trim().toLowerCase()),
  );
  const existingNames = new Set(
    [
      ...collaborators.map((collaborator) => collaborator.displayName),
      ...drafts.map((invitation) => invitation.name),
      ...pending.map((invitation) => invitation.name),
    ]
      .filter((name): name is string => Boolean(name?.trim()))
      .map((name) => name.trim().toLowerCase()),
  );
  const availableUsers = (userSearch.data ?? []).filter((user) => {
    const userName = user.displayName.trim().toLowerCase();
    if (user.id === ownerUserId || collaboratorUserIds.has(user.id)) {
      return false;
    }
    // A suggestion without an email can only be matched by name.
    if (!user.email?.trim()) return !existingNames.has(userName);

    const userEmail = user.email.trim().toLowerCase();
    return (
      userEmail !== ownerEmail &&
      !collaboratorEmails.has(userEmail) &&
      !pendingEmails.has(userEmail) &&
      !nameOnlyNames.has(userName)
    );
  });

  const hasNothingToShow =
    !showOwnerRow &&
    collaborators.length === 0 &&
    drafts.length === 0 &&
    pending.length === 0;
  const filterMatchesNothing =
    trimmedFilterQuery.length > 0 &&
    filteredCollaborators.length === 0 &&
    !showOwnerRow &&
    drafts.length === 0 &&
    pending.length === 0;

  function resetForm() {
    setName("");
    setEmail("");
    setAffiliation("");
    setActivePicker(null);
    setAddError(null);
  }

  async function handleAddDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // A name on its own is enough; email and affiliation can be added later.
    if (!name.trim() && !email.trim()) return;

    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail) {
      if (ownerEmail && normalizedEmail === ownerEmail) {
        setAddError("That's the owner, who is already included.");
        return;
      }
      if (
        collaboratorEmails.has(normalizedEmail) ||
        pendingEmails.has(normalizedEmail)
      ) {
        setAddError("This person has already been added as a collaborator.");
        return;
      }
    }

    setAddError(null);
    try {
      await createDraft.mutateAsync({
        email: email.trim() || undefined,
        name: name.trim() || undefined,
        affiliation: affiliation.trim() || undefined,
      });
      resetForm();
    } catch {
      // The server's reason is shown under the form via createDraft.error.
    }
  }

  async function handleSend(invitation: ApiInvitation) {
    if (!invitation.email) return;
    setSendingId(invitation.id);
    try {
      const result = await sendInvitation.mutateAsync(invitation.id);
      const acceptanceUrl = `${window.location.origin}/invitations/${encodeURIComponent(result.acceptanceToken)}`;
      window.location.href = buildInvitationMailto({
        email: result.invitation.email ?? invitation.email,
        name: result.invitation.name,
        entityTitle,
        target,
        acceptanceUrl,
        expiresAt: result.invitation.expiresAt,
      });
    } finally {
      setSendingId(null);
    }
  }

  function selectUser(user: (typeof availableUsers)[number]) {
    setEmail(user.email ?? "");
    setName(user.displayName);
    setAffiliation(user.affiliation ?? "");
    setActivePicker(null);
  }

  function renderUserPicker(id: string, label: string) {
    return (
      <div
        id={id}
        role="listbox"
        aria-label={label}
        ref={(element) => element?.scrollIntoView?.({ block: "nearest" })}
        className="mt-1 max-h-60 w-full overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-sm"
      >
        {userSearch.isPending ? (
          <p className="px-3 py-2 text-sm text-muted-foreground">Searching…</p>
        ) : availableUsers.length ? (
          availableUsers.map((user) => (
            <button
              key={user.id}
              type="button"
              role="option"
              aria-selected="false"
              className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left hover:bg-accent focus:bg-accent focus:outline-none"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectUser(user)}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {user.displayName}
                </span>
                {user.email ? (
                  <span className="block truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                ) : null}
                {user.affiliation ? (
                  <span className="block truncate text-xs text-muted-foreground">
                    {user.affiliation}
                  </span>
                ) : null}
              </span>
            </button>
          ))
        ) : (
          <p className="px-3 py-2 text-sm text-muted-foreground">
            No matching collaborators. You can still enter their details.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {collaborators.length > 0 ? (
        <Input
          value={filterQuery}
          onChange={(event) => setFilterQuery(event.target.value)}
          placeholder="Search by name, email, or affiliation…"
          aria-label="Search collaborators by name, email, or affiliation"
          className="sm:max-w-xs"
        />
      ) : null}
      <div className="flex flex-col gap-2">
        {showOwnerRow ? (
          <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-3">
            {formatContactLine(owner!)}
            <Badge variant="outline">Owner</Badge>
          </div>
        ) : null}

        {filteredCollaborators.map((collaborator) => (
          <div
            key={collaborator.id}
            className="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-3"
          >
            {formatContactLine(collaborator)}
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {collaborator.role ?? "Collaborator"}
              </Badge>
              {canManage && collaborator.userId !== ownerUserId ? (
                <button
                  type="button"
                  aria-label={`Remove ${collaborator.displayName ?? "collaborator"}`}
                  onClick={() => onRemoveCollaborator(collaborator.userId)}
                  disabled={isRemoving}
                  className="rounded-full p-1 text-muted-foreground hover:text-destructive focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          </div>
        ))}

        {drafts.map((invitation) => (
          <div
            key={invitation.id}
            className="flex items-center justify-between gap-3 rounded-md border border-dashed border-border bg-muted/20 p-3"
          >
            {formatContactLine({
              displayName: invitation.name ?? invitation.email,
              email: invitation.name ? invitation.email : null,
              affiliation: invitation.affiliation,
            })}
                        <div className="flex items-center gap-2">

              {canManage ? (
                <>
                  {SHOW_INVITE_ACTION ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void handleSend(invitation)}
                      disabled={
                        sendingId === invitation.id || !invitation.email
                      }
                      title={
                        invitation.email
                          ? undefined
                          : "Add an email address to send an invitation"
                      }
                    >
                      <Mail className="h-3.5 w-3.5" />
                      {sendingId === invitation.id ? "Sending…" : "Invite"}
                    </Button>
                  ) : null}

                  <button
                    type="button"
                    aria-label={`Remove draft for ${invitation.email ?? invitation.name ?? "collaborator"}`}
                    onClick={() => revokeInvitation.mutate(invitation.id)}
                    disabled={revokeInvitation.isPending}
                    className="rounded-full p-1 text-muted-foreground hover:text-destructive focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : null}
            </div>
          </div>
        ))}

        {pending.map((invitation) => (
          <div
            key={invitation.id}
            className="flex items-center justify-between gap-3 rounded-md border bg-amber-50/60 p-3 dark:bg-amber-950/10"
          >
            <div className="min-w-0">
              {formatContactLine({
                displayName: invitation.name ?? invitation.email,
                email: invitation.name ? invitation.email : null,
                affiliation: invitation.affiliation,
              })}
              <p className="mt-0.5 text-xs text-muted-foreground">
                Awaiting acceptance
                {invitation.expiresAt
                  ? ` · expires ${new Date(invitation.expiresAt).toLocaleDateString()}`
                  : ""}
              </p>
            </div>
            {canManage ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`Revoke invitation for ${invitation.email ?? invitation.name ?? "collaborator"}`}
                onClick={() => revokeInvitation.mutate(invitation.id)}
                disabled={revokeInvitation.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        ))}

        {filterMatchesNothing ? (
          <p className="text-sm text-muted-foreground">
            No collaborators match &quot;{filterQuery.trim()}&quot;.
          </p>
        ) : hasNothingToShow ? (
          <p className="text-sm text-muted-foreground">
            {noCollaboratorsMessage}
          </p>
        ) : null}
      </div>

      {canManage ? (
        <form
          onSubmit={(event) => void handleAddDraft(event)}
          className="grid gap-3 border-t border-border/70 pt-4"
        >
          <div>
            <p className="text-sm font-semibold">Add a collaborator</p>
            <p className="mt-1 text-xs text-muted-foreground">
              A name is enough. Email and affiliation are optional and can
              be added later — an email is only needed to send them an
              invitation.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div
              className="relative"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setActivePicker(null);
                }
              }}
            >
              <Input
                role="combobox"
                value={name}
                onFocus={() => setActivePicker("name")}
                onChange={(event) => {
                  setName(event.target.value);
                  setActivePicker("name");
                }}
                placeholder="Name"
                aria-label="Collaborator name"
                aria-expanded={activePicker === "name" && Boolean(name.trim())}
                aria-controls="collaborator-roster-name-options"
                aria-autocomplete="list"
                autoComplete="off"
              />

              {activePicker === "name" && name.trim()
                ? renderUserPicker(
                    "collaborator-roster-name-options",
                    "Available collaborator names",
                  )
                : null}
            </div>

            <div
              className="relative"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setActivePicker(null);
                }
              }}
            >
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />

              <Input
                type="email"
                role="combobox"
                value={email}
                onFocus={() => setActivePicker("email")}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setAddError(null);
                  setActivePicker("email");
                }}
                placeholder="Email"
                aria-label="Collaborator email"
                aria-expanded={
                  activePicker === "email" && Boolean(email.trim())
                }
                aria-controls="collaborator-roster-email-options"
                aria-autocomplete="list"
                autoComplete="off"
                className="pl-9"
              />

              {activePicker === "email" && email.trim()
                ? renderUserPicker(
                    "collaborator-roster-email-options",
                    "Available collaborator emails",
                  )
                : null}
            </div>
            <Input
              value={affiliation}
              onChange={(event) => setAffiliation(event.target.value)}
              placeholder="Affiliation"
              aria-label="Collaborator affiliation"
            />
          </div>
          <Button
            type="submit"
            size="sm"
            className="w-fit"
            disabled={createDraft.isPending || (!name.trim() && !email.trim())}
          >
            {createDraft.isPending ? "Adding…" : "Add collaborator"}
          </Button>
          {addError ? (
            <p role="alert" className="text-xs text-destructive">
              {addError}
            </p>
          ) : createDraft.isError ? (
            <p role="alert" className="text-xs text-destructive">
              {createDraft.error.message}
            </p>
          ) : null}
          {sendInvitation.isError ? (
            <p className="text-xs text-destructive">
              {sendInvitation.error.message}
            </p>
          ) : null}
          {revokeInvitation.isError ? (
            <p className="text-xs text-destructive">
              {revokeInvitation.error.message}
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
