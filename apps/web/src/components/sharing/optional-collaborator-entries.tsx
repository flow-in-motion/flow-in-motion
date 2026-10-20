import { useId, useState } from "react";
import { Plus, Search, X } from "lucide-react";

import {
  useUserSearch,
  type ApiUserSearchResult,
  type DraftCollaboratorInput,
} from "@/api/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface OptionalCollaboratorEntriesProps {
  value: DraftCollaboratorInput[];
  onChange: (value: DraftCollaboratorInput[]) => void;
  ownerUserId?: string;
  ownerEmail?: string;
  entityLabel: "paper" | "project";
}

/** Stable identity for an entry: its email, or its name when there is no email. */
function entryKey(entry: DraftCollaboratorInput) {
  return entry.email?.trim()
    ? `email:${entry.email.trim().toLowerCase()}`
    : `name:${entry.name?.trim().toLowerCase() ?? ""}`;
}

export function OptionalCollaboratorEntries({
  value,
  onChange,
  ownerUserId,
  ownerEmail,
  entityLabel,
}: OptionalCollaboratorEntriesProps) {
  const pickerId = useId();
  const nameOptionsId = `${pickerId}-name-options`;
  const emailOptionsId = `${pickerId}-email-options`;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [activePicker, setActivePicker] = useState<
    "name" | "email" | null
  >(null);
  const [entryError, setEntryError] = useState<string | null>(null);

  const searchQuery =
    activePicker === "name"
      ? name
      : activePicker === "email"
        ? email
        : "";

  const userSearch = useUserSearch(
    searchQuery,
    activePicker !== null,
  );

  const usedEmails = new Set(
    value.flatMap((entry) =>
      entry.email?.trim() ? [entry.email.trim().toLowerCase()] : [],
    ),
  );
  const normalizedOwnerEmail = ownerEmail?.trim().toLowerCase();
  // Entries added by name only can't be matched by email, so match by name.
  const usedNameOnlyNames = new Set(
    value.flatMap((entry) =>
      !entry.email?.trim() && entry.name?.trim()
        ? [entry.name.trim().toLowerCase()]
        : [],
    ),
  );

  const availableUsers = (userSearch.data ?? []).filter((user) => {
    const normalizedEmail = user.email.trim().toLowerCase();

    return (
      user.id !== ownerUserId &&
      normalizedEmail !== normalizedOwnerEmail &&
      !usedEmails.has(normalizedEmail) &&
      !usedNameOnlyNames.has(user.displayName.trim().toLowerCase())
    );
  });

  function resetEntry() {
    setName("");
    setEmail("");
    setAffiliation("");
    setActivePicker(null);
    setEntryError(null);
  }

  function selectUser(user: ApiUserSearchResult) {
    setName(user.displayName);
    setEmail(user.email);
    setAffiliation(user.affiliation ?? "");
    setActivePicker(null);
    setEntryError(null);
  }

  function addEntry() {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const normalizedEmail = trimmedEmail.toLowerCase();

    if (!trimmedName && !trimmedEmail) {
      setEntryError("Enter a name before adding a collaborator.");
      return;
    }

    const isDuplicate = trimmedEmail
      ? usedEmails.has(normalizedEmail)
      : value.some(
          (entry) =>
            !entry.email &&
            entry.name?.trim().toLowerCase() === trimmedName.toLowerCase(),
        );

    if (isDuplicate) {
      setEntryError("This collaborator has already been added.");
      return;
    }

    if (trimmedEmail && normalizedOwnerEmail === normalizedEmail) {
      setEntryError(
        "You are already the owner and cannot be added as a collaborator.",
      );
      return;
    }

    onChange([
      ...value,
      {
        email: trimmedEmail || undefined,
        name: trimmedName || undefined,
        affiliation: affiliation.trim() || undefined,
      },
    ]);
    resetEntry();
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
          <p className="px-3 py-2 text-sm text-muted-foreground">
            Searching…
          </p>
        ) : userSearch.isError ? (
          <p role="alert" className="px-3 py-2 text-sm text-destructive">
            Search could not be loaded. You can enter the details manually.
          </p>
        ) : availableUsers.length > 0 ? (
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
                <span className="block truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
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
            No matching saved contacts. You can enter the details manually.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-3 rounded-lg border p-4">
      <div>
        <p className="text-sm font-medium">Collaborators (optional)</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Add collaborators now or leave this blank. You can manage them
          after the {entityLabel} is created.
        </p>
      </div>

      {value.length > 0 ? (
        <div className="flex flex-col gap-2">
          {value.map((entry) => (
            <div
              key={entryKey(entry)}
              className="flex items-center justify-between gap-3 rounded-md border bg-card p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {entry.name ?? entry.email}
                </p>
                {entry.name && entry.email ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {entry.email}
                  </p>
                ) : null}
                {entry.affiliation ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {entry.affiliation}
                  </p>
                ) : null}
              </div>

              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`Remove ${entry.name ?? entry.email}`}
                onClick={() =>
                  onChange(
                    value.filter(
                      (candidate) => entryKey(candidate) !== entryKey(entry),
                    ),
                  )
                }
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}

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
              setEntryError(null);
              setActivePicker("name");
            }}
            placeholder="Name"
            aria-label="Collaborator name"
            aria-expanded={
              activePicker === "name" && Boolean(name.trim())
            }
            aria-controls={nameOptionsId}
            aria-autocomplete="list"
            autoComplete="off"
          />

          {activePicker === "name" && name.trim()
            ? renderUserPicker(
                nameOptionsId,
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
              setEntryError(null);
              setActivePicker("email");
            }}
            placeholder="Email"
            aria-label="Collaborator email"
            aria-expanded={
              activePicker === "email" && Boolean(email.trim())
            }
            aria-controls={emailOptionsId}
            aria-autocomplete="list"
            autoComplete="off"
            className="pl-9"
          />

          {activePicker === "email" && email.trim()
            ? renderUserPicker(
                emailOptionsId,
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

      {entryError ? (
        <p role="alert" className="text-xs text-destructive">
          {entryError}
        </p>
      ) : null}

      <div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={addEntry}
        >
          <Plus className="h-4 w-4" />
          Add collaborator
        </Button>
      </div>
    </div>
  );
}