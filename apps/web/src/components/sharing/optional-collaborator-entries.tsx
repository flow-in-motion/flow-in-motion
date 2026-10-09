import { useState } from "react";
import { Plus, Search, X } from "lucide-react";

import {
  useUserSearch,
  type DraftCollaboratorInput,
} from "@/api/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface OptionalCollaboratorEntriesProps {
  value: DraftCollaboratorInput[];
  onChange: (value: DraftCollaboratorInput[]) => void;
  ownerUserId?: string;
  ownerEmail?: string;
  entityLabel: "paper" | "project";
}

export function OptionalCollaboratorEntries({
  value,
  onChange,
  ownerUserId,
  ownerEmail,
  entityLabel,
}: OptionalCollaboratorEntriesProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [entryError, setEntryError] = useState<string | null>(null);
  const userSearch = useUserSearch(email, pickerOpen);

  const usedEmails = new Set(value.map((entry) => entry.email.toLowerCase()));
  const availableUsers = (userSearch.data ?? []).filter(
    (user) =>
      user.id !== ownerUserId && !usedEmails.has(user.email.toLowerCase()),
  );

  function resetEntry() {
    setName("");
    setEmail("");
    setAffiliation("");
    setPickerOpen(false);
    setEntryError(null);
  }

  function addEntry() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setEntryError("Enter an email address before adding a collaborator.");
      return;
    }
    if (usedEmails.has(trimmedEmail.toLowerCase())) {
      setEntryError("This collaborator has already been added.");
      return;
    }
    if (ownerEmail && trimmedEmail.toLowerCase() === ownerEmail.toLowerCase()) {
      setEntryError("You are already the owner and cannot be added as a collaborator.");
      return;
    }

    onChange([
      ...value,
      {
        email: trimmedEmail,
        name: name.trim() || undefined,
        affiliation: affiliation.trim() || undefined,
      },
    ]);
    resetEntry();
  }

  return (
    <div className="grid gap-3 rounded-lg border p-4">
      <div>
        <p className="text-sm font-medium">Collaborators (optional)</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Add collaborators now or leave this blank. Invitations are saved as
          drafts after the {entityLabel} is created; nothing is sent
          automatically.
        </p>
      </div>

      {value.length ? (
        <div className="flex flex-col gap-2">
          {value.map((entry) => (
            <div
              key={entry.email.toLowerCase()}
              className="flex items-center justify-between gap-3 rounded-md border bg-card p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {entry.name ?? entry.email}
                </p>
                {entry.name ? (
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
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="secondary">Draft</Badge>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Remove ${entry.name ?? entry.email}`}
                  onClick={() =>
                    onChange(
                      value.filter(
                        (candidate) => candidate.email !== entry.email,
                      ),
                    )
                  }
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-3">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Name"
          aria-label="Collaborator name"
        />
        <div
          className="relative"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setPickerOpen(false);
            }
          }}
        >
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="email"
            role="combobox"
            value={email}
            onFocus={() => setPickerOpen(true)}
            onChange={(event) => {
              setEmail(event.target.value);
              setEntryError(null);
              setPickerOpen(true);
            }}
            placeholder="Email"
            aria-label="Collaborator email"
            aria-expanded={pickerOpen && Boolean(email.trim())}
            aria-controls="optional-collaborator-email-options"
            aria-autocomplete="list"
            autoComplete="off"
            className="pl-9"
          />
          {pickerOpen && email.trim() ? (
            <div
              id="optional-collaborator-email-options"
              role="listbox"
              aria-label="Available collaborator emails"
              className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg"
            >
              {userSearch.isPending ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  Searching…
                </p>
              ) : availableUsers.length ? (
                availableUsers.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    role="option"
                    aria-selected="false"
                    className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left hover:bg-accent focus:bg-accent focus:outline-none"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setEmail(user.email);
                      setName(user.displayName);
                      setAffiliation(user.affiliation ?? "");
                      setPickerOpen(false);
                    }}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {user.displayName}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {user.email}
                      </span>
                    </span>
                  </button>
                ))
              ) : (
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  No matching saved contacts. You can still use this email.
                </p>
              )}
            </div>
          ) : null}
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
        <Button type="button" size="sm" variant="outline" onClick={addEntry}>
          <Plus className="h-4 w-4" />
          Add collaborator
        </Button>
      </div>
    </div>
  );
}
