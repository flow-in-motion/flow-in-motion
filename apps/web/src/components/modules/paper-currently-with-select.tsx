import { ChevronDown } from "lucide-react";

import type { ApiCollaborator, PaperCurrentlyWithType } from "@/api/hooks";
import { PAPER_CURRENTLY_WITH_LABELS } from "@/lib/paper-currently-with";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PaperCurrentlyWithSelectProps {
  id: string;
  currentlyWithType: PaperCurrentlyWithType | null;
  assignedToUserId: string | null;
  currentUserId?: string;
  collaborators: ApiCollaborator[];
  collaboratorsPending?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerClassName?: string;
  ariaLabel?: string;
  disabled?: boolean;
  onChange: (
    currentlyWithType: PaperCurrentlyWithType,
    assignedToUserId: string | null,
  ) => void;
}

export function PaperCurrentlyWithSelect({
  id,
  currentlyWithType,
  assignedToUserId,
  currentUserId,
  collaborators,
  collaboratorsPending = false,
  onOpenChange,
  triggerClassName,
  ariaLabel,
  disabled = false,
  onChange,
}: PaperCurrentlyWithSelectProps) {
  const selectableCollaborators = collaborators.filter(
    (collaborator) => collaborator.userId !== currentUserId,
  );
  const selectedCollaborator = selectableCollaborators.find(
    (collaborator) => collaborator.userId === assignedToUserId,
  );
  const label =
    currentlyWithType === "collaborator"
      ? (selectedCollaborator?.displayName ??
        PAPER_CURRENTLY_WITH_LABELS.collaborator)
      : currentlyWithType
        ? PAPER_CURRENTLY_WITH_LABELS[currentlyWithType]
        : "Not set";

  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-label={ariaLabel}
          className={cn(
            "w-full justify-between font-normal",
            triggerClassName,
          )}
          disabled={disabled}
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="min-w-[var(--radix-dropdown-menu-trigger-width)]"
      >
        <DropdownMenuItem
          onSelect={() => onChange("me", currentUserId ?? null)}
        >
          Me
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            Collaborators/Coauthors
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {collaboratorsPending ? (
              <DropdownMenuItem disabled>Loading collaborators…</DropdownMenuItem>
            ) : selectableCollaborators.length ? (
              selectableCollaborators.map((collaborator) => (
                <DropdownMenuItem
                  key={collaborator.id}
                  onSelect={() => onChange("collaborator", collaborator.userId)}
                >
                  <span className="min-w-0">
                    <span className="block truncate">
                      {collaborator.displayName ?? "Unnamed collaborator"}
                    </span>
                    {collaborator.affiliation ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {collaborator.affiliation}
                      </span>
                    ) : null}
                  </span>
                </DropdownMenuItem>
              ))
            ) : (
              <DropdownMenuItem disabled>
                No collaborators added
              </DropdownMenuItem>
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem onSelect={() => onChange("journal", null)}>
          Journal
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onChange("friendly_reviewer", null)}>
          Friendly reviewer
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
