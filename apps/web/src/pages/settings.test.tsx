import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SettingsPage from "@/pages/settings";

const mockMutate = vi.fn();
const mockMe = {
  id: "user-1",
  email: "researcher@example.com",
  displayName: "Avi Researcher",
  jobTitle: null,
  institution: null,
  department: null,
  phone: null,
  researchInterests: null,
  status: "active",
  profileComplete: false,
  missingProfileFields: ["jobTitle", "institution", "department"],
};

const mockSwitchWorkspace = vi.fn();
const mockCreateWorkspace = vi.fn();
const mockDeleteWorkspace = vi.fn();

vi.mock("@/api/hooks", () => ({
  useMe: () => ({
    data: mockMe,
    isPending: false,
    isError: false,
  }),
  useCurrentWorkspace: () => ({
    data: {
      id: "workspace-1",
      name: "Research Operations",
      slug: "research-operations",
      membershipRole: "owner",
    },
    isPending: false,
  }),
  useWorkspaces: () => ({
    data: {
      data: [
        {
          id: "workspace-1",
          name: "Research Operations",
          slug: "research-operations",
          membershipRole: "owner",
        },
      ],
      useWorkspaces: () => ({
  data: {
    data: [
      {
        id: "workspace-1",
        name: "Research Operations",
        slug: "research-operations",
        membershipRole: "owner",
      },
    ],
    meta: {
      page: 1,
      pageSize: 20,
      totalItems: 1,
      totalPages: 1,
    },
  },
  isPending: false,
  isError: false,
}),
    },
    isPending: false,
    isError: false,
  }),
  useSwitchWorkspace: () => ({
    mutateAsync: mockSwitchWorkspace,
    isPending: false,
    isError: false,
  }),
  useCreateWorkspace: () => ({
    mutateAsync: mockCreateWorkspace,
    isPending: false,
    isError: false,
  }),
  useDeleteWorkspace: () => ({
    mutateAsync: mockDeleteWorkspace,
    isPending: false,
    isError: false,
    variables: undefined,
  }),
  useUpdateMe: () => ({
    mutate: mockMutate,
    isPending: false,
    isError: false,
    isSuccess: false,
  }),
  useModulePipelineStagePool: () => ({
    data: [],
    isPending: false,
    isError: false,
  }),
  useUpdateModulePipelineStage: () => ({ mutate: vi.fn() }),
  useReorderModulePipelineStages: () => ({ mutate: vi.fn() }),
  useResetModulePipelineStages: () => ({ mutate: vi.fn() }),
}));

vi.mock("@/components/settings/workspace-members", () => ({
  WorkspaceMembers: () => null,
}));

const mockSetTheme = vi.hoisted(() => vi.fn());
const mockSetColorTheme = vi.hoisted(() => vi.fn());
const mockSetAppearanceTheme = vi.hoisted(() => vi.fn());
const mockSetTextSize = vi.hoisted(() => vi.fn());

vi.mock("@/theme/design-theme", () => ({
  DESIGN_THEMES: [
    { value: "modern", label: "Modern", description: "The default look.", layout: "sidebar" },
    { value: "minimal", label: "Minimal", description: "A compact icon rail.", layout: "sidebar-compact" },
    { value: "executive", label: "Executive", description: "A top navigation bar.", layout: "topnav" },
  ],
  useDesignTheme: () => ({ theme: "modern", layout: "sidebar", setTheme: mockSetTheme }),
}));

vi.mock("@/theme/color-theme", () => ({
  COLOR_THEMES: [
    { value: "ocean", label: "Ocean Blue" },
    { value: "violet", label: "Violet" },
    { value: "emerald", label: "Emerald" },
    { value: "rose", label: "Rose" },
  ],
  useColorTheme: () => ({ theme: "ocean", setTheme: mockSetColorTheme }),
}));

vi.mock("@/theme/appearance-theme", () => ({
  APPEARANCE_THEMES: [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
  ],
  useAppearanceTheme: () => ({
    theme: "light",
    setTheme: mockSetAppearanceTheme,
    toggleTheme: vi.fn(),
  }),
}));

vi.mock("@/theme/text-size", () => ({
  TEXT_SIZES: [
    { value: "small", label: "Small" },
    { value: "default", label: "Default" },
    { value: "large", label: "Large" },
  ],
  useTextSize: () => ({ size: "default", setSize: mockSetTextSize }),
}));

describe("SettingsPage", () => {
  beforeEach(() => {
    mockMutate.mockClear();
    mockSetTheme.mockClear();
    mockSetColorTheme.mockClear();
    mockSetAppearanceTheme.mockClear();
    mockSetTextSize.mockClear();
    mockSwitchWorkspace.mockReset().mockResolvedValue({ id: "workspace-1" });
    mockCreateWorkspace.mockReset().mockResolvedValue({ id: "workspace-2" });
    mockDeleteWorkspace.mockReset().mockResolvedValue({ id: "workspace-1" });
  });

  it("scrolls straight to the paper pipeline stages section when linked in with a hash", () => {
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;

    render(
      <MemoryRouter initialEntries={["/settings#paper-pipeline-stages"]}>
        <SettingsPage />
      </MemoryRouter>,
    );

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  });

  it("reminds an incomplete user and saves their professional profile", () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Complete your profile");
    expect(screen.getByLabelText(/Job title/)).toBeRequired();
    expect(screen.getByLabelText(/Institution/)).toBeRequired();
    expect(screen.getByLabelText(/Department/)).toBeRequired();
    expect(screen.getByLabelText("Phone")).not.toBeRequired();

    fireEvent.change(screen.getByLabelText(/Job title/), {
      target: { value: "Research Fellow" },
    });
    fireEvent.change(screen.getByLabelText(/Institution/), {
      target: { value: "University of Sydney" },
    });
    fireEvent.change(screen.getByLabelText(/Department/), {
      target: { value: "Medical Sciences" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Profile" }));

    expect(mockMutate).toHaveBeenCalledWith({
      displayName: "Avi Researcher",
      jobTitle: "Research Fellow",
      institution: "University of Sydney",
      department: "Medical Sciences",
      phone: "",
      researchInterests: "",
    });
  });

  it("selects a design theme from the preview picker", () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Executive/ }));

    expect(mockSetTheme).toHaveBeenCalledWith("executive");
  });

  it("selects dark appearance independently of design and color themes", () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Dark" }));
    expect(mockSetAppearanceTheme).toHaveBeenCalledWith("dark");
  });

  it("selects a larger text size", () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Large" }));
    expect(mockSetTextSize).toHaveBeenCalledWith("large");
  });

  it("selects a color theme independently of the design theme", () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Theme" }));
    fireEvent.click(screen.getByRole("option", { name: "Violet" }));

    expect(mockSetColorTheme).toHaveBeenCalledWith("violet");
  });

  it("shows the workspace list and creates a new workspace, all from Settings", async () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Workspaces" })).toBeInTheDocument();
    expect(screen.getByText("Research Operations")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Active workspace/ })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("Workspace name"), {
      target: { value: "New Lab" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create workspace" }));

    await waitFor(() => expect(mockCreateWorkspace).toHaveBeenCalledWith("New Lab"));
  });

  it("deletes a workspace after the user confirms", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Delete workspace/ }));

    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining("Research Operations"),
    );
    await waitFor(() => expect(mockDeleteWorkspace).toHaveBeenCalledWith("workspace-1"));
  });

  it("does not delete a workspace when the user cancels the confirmation", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Delete workspace/ }));

    expect(mockDeleteWorkspace).not.toHaveBeenCalled();
  });
});
