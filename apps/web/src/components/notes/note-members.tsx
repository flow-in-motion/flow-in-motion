import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import {
  useAddNoteMember,
  useNoteMembers,
  useRemoveNoteMember,
  useUserSearch,
} from "@/api/hooks";
import { LoadingState } from "@/components/shared/loading-state";
import { Input } from "@/components/ui/input";

interface NoteMembersManagerProps {
  tenantId: string;
  noteId: string;
}

export function NoteMembersManager({
  tenantId,
  noteId,
}: NoteMembersManagerProps) {
  const noteMembersQuery = useNoteMembers(tenantId, noteId);
  const addMember = useAddNoteMember(tenantId, noteId);
  const removeMember = useRemoveNoteMember(tenantId, noteId);
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const noteMemberUserIds = useMemo(
    () => new Set((noteMembersQuery.data ?? []).map((member) => member.userId)),
    [noteMembersQuery.data],
  );

  const userSearchQuery = useUserSearch(search, pickerOpen);
  const matchingMembers = useMemo(() => {
    return (userSearchQuery.data ?? []).filter((user) => !noteMemberUserIds.has(user.id));
  }, [noteMemberUserIds, userSearchQuery.data]);

  if (noteMembersQuery.isPending) {
    return <LoadingState title="Loading members" className="min-h-32" />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {(noteMembersQuery.data ?? []).map((member) => {
          const displayName = member.displayName ?? "Unknown user";
          return (
            <div
              key={member.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-2.5"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {displayName}
                </span>
                {member.email ? (
                  <span className="block truncate text-xs text-muted-foreground">
                    {member.email}
                  </span>
                ) : null}
                {member.affiliation ? (
                  <span className="block truncate text-xs text-muted-foreground">
                    {member.affiliation}
                  </span>
                ) : null}
              </span>
              <button
                type="button"
                aria-label={`Remove ${displayName}`}
                onClick={() => removeMember.mutate(member.userId)}
                className="rounded-full p-1 text-muted-foreground hover:text-destructive focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
        {(noteMembersQuery.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No one else has access to this note yet.</p>
        ) : null}
      </div>

      <div
        className="relative"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setPickerOpen(false);
        }}
      >
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          role="combobox"
          aria-expanded={pickerOpen}
          aria-controls="note-member-options"
          aria-autocomplete="list"
          value={search}
          onFocus={() => setPickerOpen(true)}
          onChange={(event) => {
            setSearch(event.target.value);
            setPickerOpen(true);
          }}
          placeholder="Type a name or email to search all users"
          className="pl-9"
          autoComplete="off"
        />
        {pickerOpen && search.trim() ? (
          <div
            id="note-member-options"
            role="listbox"
            className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-lg"
          >
            {userSearchQuery.isPending ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">Searching…</p>
            ) : matchingMembers.length ? (
              matchingMembers.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  role="option"
                  aria-selected="false"
                  className="flex w-full items-center justify-between gap-3 rounded-sm px-3 py-2 text-left hover:bg-accent focus:bg-accent focus:outline-none"
                  onClick={() => {
                    addMember.mutate(member.id);
                    setSearch("");
                  }}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {member.displayName}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {member.email}
                    </span>
                    {member.affiliation ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {member.affiliation}
                      </span>
                    ) : null}
                  </span>
                </button>
              ))
            ) : (
              <p className="px-3 py-2 text-sm text-muted-foreground">No matching users.</p>
            )}
          </div>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Selecting a user grants access immediately. No email invitation is sent.
      </p>
    </div>
  );
}
