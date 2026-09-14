import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { UserMenu } from "./user-menu";
import type { ReactNode } from "react";

vi.mock("react-oidc-context", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: {
      profile: {
        email: "pilot@example.com",
      },
    },
  }),
}));

vi.mock("@/api/hooks", () => ({
  useMe: () => ({
    data: {
      id: "user-1",
      displayName: "Pilot User",
      profileComplete: true,
    },
  }),

  useCurrentWorkspace: () => ({
    data: {
      id: "tenant-1",
      name: "Pilot Workspace",
    },
  }),

  useWorkspaces: () => ({
    data: {
      data: [
        {
          id: "tenant-1",
          name: "Pilot Workspace",
        },
      ],
      meta: {
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
      },
    },
  }),

  useSwitchWorkspace: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/auth/sign-out", () => ({
  useSignOut: () => vi.fn(),
}));

vi.mock("@/theme/appearance-theme", () => ({
  useAppearanceTheme: () => ({
    theme: "light",
    toggleTheme: vi.fn(),
  }),
}));

vi.mock("@/components/feedback/feedback-dialog", () => ({
  FeedbackDialog: ({
    open,
  }: {
    open: boolean;
  }) =>
    open ? (
      <div role="dialog" aria-label="Share feedback">
        Feedback dialog
      </div>
    ) : null,
}));
vi.mock("@/components/ui/dropdown-menu", () => ({
    DropdownMenu: ({ children }: { children: ReactNode }) => (
      <>{children}</>
    ),
  
    DropdownMenuTrigger: ({ children }: { children: ReactNode }) => (
      <>{children}</>
    ),
  
    DropdownMenuContent: ({ children }: { children: ReactNode }) => (
      <div role="menu">{children}</div>
    ),
  
    DropdownMenuLabel: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
  
    DropdownMenuSeparator: () => <hr />,
  
    DropdownMenuItem: ({
      children,
      onSelect,
      asChild,
    }: {
      children: ReactNode;
      onSelect?: (event: { preventDefault: () => void }) => void;
      asChild?: boolean;
    }) =>
      asChild ? (
        <div role="menuitem">{children}</div>
      ) : (
        <button
          type="button"
          role="menuitem"
          onClick={(event) => onSelect?.(event)}
        >
          {children}
        </button>
      ),
  }));

describe("UserMenu", () => {
    it("shows Feedback immediately before Settings and opens the dialog", () => {
        render(
          <MemoryRouter>
            <UserMenu />
          </MemoryRouter>,
        );
      
        const feedbackItem = screen.getByRole("menuitem", {
          name: "Feedback",
        });
      
        const settingsItem = screen.getByRole("menuitem", {
          name: "Settings",
        });
      
        const menuItems = screen.getAllByRole("menuitem");
      
        expect(menuItems.indexOf(feedbackItem)).toBeLessThan(
          menuItems.indexOf(settingsItem),
        );
      
        fireEvent.click(feedbackItem);
      
        expect(
          screen.getByRole("dialog", {
            name: "Share feedback",
          }),
        ).toBeInTheDocument();
      });
});
