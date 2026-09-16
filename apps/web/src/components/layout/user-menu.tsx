import {
  Building2,
  Check,
  ChevronsUpDown,
  CircleAlert,
  LogOut,
  Moon,
  Settings,
  Sun,
  MessageSquareText,
} from "lucide-react";
import { useAuth } from "@/auth/auth-provider";
import { Link } from "react-router-dom";

import {
  useCurrentWorkspace,
  useMe,
  useSwitchWorkspace,
  useWorkspaces,
} from "@/api/hooks";
import { useSignOut } from "@/auth/sign-out";
import { useAppearanceTheme } from "@/theme/appearance-theme";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { FeedbackDialog } from "@/components/feedback/feedback-dialog";

interface UserMenuProps {
  /** Icon-only trigger for narrow rails (the compact sidebar) instead of the full name/workspace row. */
  compact?: boolean;
}

/** Account + workspace switcher, shown at the bottom of the nav. Renders nothing when signed out. */
export function UserMenu({ compact = false }: UserMenuProps) {
  const auth = useAuth();
  const me = useMe(auth.isAuthenticated);
  const workspace = useCurrentWorkspace();
  const workspaces = useWorkspaces();
  const workspaceOptions = workspaces.data?.data ?? [];
  const switchWorkspace = useSwitchWorkspace();
  const signOut = useSignOut();
  const appearance = useAppearanceTheme();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  if (!auth.isAuthenticated) {
    return null;
  }

  const displayName = me.data?.displayName ?? auth.user?.email ?? "Account";
  const workspaceName = workspace.data?.name ?? "Current workspace";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {compact ? (
            <button
              type="button"
              aria-label={`${displayName} — account menu`}
              title={displayName}
              className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Avatar name={displayName} />
            </button>
          ) : (
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-md p-1.5 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Avatar name={displayName} />

              <span className="min-w-0 flex-1">
                <span
                  className="block truncate text-sm font-medium text-foreground"
                  title={displayName}
                >
                  {displayName}
                </span>

                <span
                  className="block truncate text-xs text-muted-foreground"
                  title={workspaceName}
                >
                  {workspaceName}
                </span>
              </span>

              <ChevronsUpDown
                className="h-4 w-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            </button>
          )}
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          side={compact ? "right" : "top"}
          className="w-64"
        >
          <DropdownMenuLabel className="text-foreground">
            {displayName}
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>

          {workspaceOptions.map((option) => {
            const isCurrent = option.id === workspace.data?.id;

            return (
              <DropdownMenuItem
                key={option.id}
                disabled={isCurrent || switchWorkspace.isPending}
                onSelect={(event) => {
                  event.preventDefault();

                  if (!isCurrent) {
                    void switchWorkspace.mutateAsync(option.id);
                  }
                }}
              >
                <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />

                <span className="flex-1 truncate">{option.name}</span>

                {isCurrent ? (
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                ) : null}
              </DropdownMenuItem>
            );
          })}

          <DropdownMenuSeparator />

          <DropdownMenuItem onSelect={() => setFeedbackOpen(true)}>
            <MessageSquareText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="flex-1">Feedback</span>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link to="/settings">
              <Settings className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1">Settings</span>

              {me.data?.profileComplete === false ? (
                <CircleAlert
                  className="h-4 w-4 shrink-0 text-amber-500"
                  aria-label="Profile incomplete"
                />
              ) : null}
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              appearance.toggleTheme();
            }}
          >
            {appearance.theme === "dark" ? (
              <Sun className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <Moon className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}

            {appearance.theme === "dark" ? "Use light theme" : "Use dark theme"}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onSelect={() => void signOut()}>
            <LogOut className="h-4 w-4 shrink-0 text-muted-foreground" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <FeedbackDialog
        open={feedbackOpen}
        tenantId={workspace.data?.id ?? ""}
        onOpenChange={setFeedbackOpen}
      />
    </>
  );
}
