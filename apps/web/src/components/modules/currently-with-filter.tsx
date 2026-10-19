import { ChevronDown } from "lucide-react";

import type {
  PaperCurrentlyWithCollaborator,
  PaperCurrentlyWithType,
} from "@/api/hooks";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const CURRENTLY_WITH_FILTER_LABELS: Record<PaperCurrentlyWithType, string> = {
    me: "Me",
    collaborator: "Collaborators/Coauthors",
    journal: "Journal",
    friendly_reviewer: "Friendly reviewer",
    others: "Others",
  };

  interface CurrentlyWithFilterProps {
    selectedTypes: ReadonlySet<string>;
    selectedContactIds: ReadonlySet<string>;
    collaborators: readonly PaperCurrentlyWithCollaborator[];
    isLoading: boolean;
    onOpenChange: (open: boolean) => void;
    onToggleType: (value: PaperCurrentlyWithType) => void;
    onToggleCollaborator: (contactId: string) => void;
    onClear: () => void;
  }

  export function CurrentlyWithFilter({
    selectedTypes,
    selectedContactIds,
    collaborators,
    isLoading,
    onOpenChange,
    onToggleType,
    onToggleCollaborator,
    onClear,
  }: CurrentlyWithFilterProps) {
    const selectionCount = selectedTypes.size + selectedContactIds.size;
    const selectedCollaborator =
      selectedContactIds.size === 1
        ? collaborators.find((item) => selectedContactIds.has(item.id))
        : undefined;
    const onlySelectedType =
      selectedTypes.size === 1 && selectedContactIds.size === 0
        ? ([...selectedTypes][0] as PaperCurrentlyWithType)
        : undefined;
    const triggerLabel =
      selectionCount === 0
        ? "All current holders"
        : selectedCollaborator
          ? (selectedCollaborator.displayName ??
            selectedCollaborator.affiliation ??
            "Unnamed collaborator")
          : onlySelectedType
            ? CURRENTLY_WITH_FILTER_LABELS[onlySelectedType]
            : `${selectionCount} current holders`;
  
    return (
      <DropdownMenu onOpenChange={onOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="justify-between gap-2 sm:w-52"
            aria-label="Filter by current holders"
          >
            <span className="truncate">{triggerLabel}</span>
            <ChevronDown
              className="h-4 w-4 shrink-0 opacity-50"
              aria-hidden="true"
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-64">
          <DropdownMenuCheckboxItem
            checked={selectionCount === 0}
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={onClear}
          >
            All current holders
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={selectedTypes.has("me")}
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={() => onToggleType("me")}
          >
            Me
          </DropdownMenuCheckboxItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="pl-8">
              <span>Collaborators/Coauthors</span>
              {selectedTypes.has("collaborator") ||
              selectedContactIds.size > 0 ? (
                <span className="ml-auto text-xs text-muted-foreground">
                  {selectedTypes.has("collaborator")
                    ? "All"
                    : selectedContactIds.size}
                </span>
              ) : null}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-72 min-w-64 overflow-y-auto">
              <DropdownMenuCheckboxItem
                checked={selectedTypes.has("collaborator")}
                onSelect={(event) => event.preventDefault()}
                onCheckedChange={() => onToggleType("collaborator")}
              >
                All collaborators/coauthors
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              {isLoading ? (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                  Loading collaborators…
                </div>
              ) : collaborators.length ? (
                collaborators.map((collaborator) => (
                  <DropdownMenuCheckboxItem
                    key={collaborator.id}
                    checked={selectedContactIds.has(collaborator.id)}
                    onSelect={(event) => event.preventDefault()}
                    onCheckedChange={() => onToggleCollaborator(collaborator.id)}
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">
                        {collaborator.displayName ?? "Unnamed collaborator"}
                      </span>
                      {collaborator.affiliation ? (
                        <span className="truncate text-xs text-muted-foreground">
                          {collaborator.affiliation}
                        </span>
                      ) : null}
                    </span>
                  </DropdownMenuCheckboxItem>
                ))
              ) : (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                  No collaborators found.
                </div>
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          {(["journal", "friendly_reviewer", "others"] as const).map((option) => (
            <DropdownMenuCheckboxItem
              key={option}
              checked={selectedTypes.has(option)}
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={() => onToggleType(option)}
            >
              {CURRENTLY_WITH_FILTER_LABELS[option]}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
