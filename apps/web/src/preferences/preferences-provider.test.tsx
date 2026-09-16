import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PreferencesProvider } from "@/preferences/preferences-provider";

const fixtures = vi.hoisted(() => ({
  accountPreferences: null as null | {
    appearanceTheme?: "light" | "dark";
    designTheme?: "modern" | "minimal" | "executive";
    colorTheme?: "ocean" | "violet" | "emerald" | "rose";
    textSize?: "small" | "default" | "large";
  },
  appearanceTheme: "light" as "light" | "dark",
}));

const mutations = vi.hoisted(() => ({
  account: vi.fn(),
  workspace: vi.fn(),
}));

const themeSetters = vi.hoisted(() => ({
  appearance: vi.fn(),
  design: vi.fn(),
  color: vi.fn(),
  textSize: vi.fn(),
}));

vi.mock("@/auth/auth-provider", () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

vi.mock("@/api/hooks", () => ({
  useMe: () => ({ isSuccess: true }),
  useAccountPreferences: () => ({ isSuccess: true, data: fixtures.accountPreferences }),
  useUpdateAccountPreferences: () => ({ mutate: mutations.account }),
  useCurrentWorkspace: () => ({ data: { id: "workspace-1" } }),
  useWorkspacePreferences: () => ({ isSuccess: true, data: null }),
  useUpdateWorkspacePreferences: () => ({ mutate: mutations.workspace }),
}));

vi.mock("@/theme/appearance-theme", () => ({
  useAppearanceTheme: () => ({
    theme: fixtures.appearanceTheme,
    setTheme: themeSetters.appearance,
  }),
}));
vi.mock("@/theme/design-theme", () => ({
  useDesignTheme: () => ({ theme: "modern", setTheme: themeSetters.design }),
}));
vi.mock("@/theme/color-theme", () => ({
  useColorTheme: () => ({ theme: "ocean", setTheme: themeSetters.color }),
}));
vi.mock("@/theme/text-size", () => ({
  useTextSize: () => ({ size: "default", setSize: themeSetters.textSize }),
}));

describe("PreferencesProvider", () => {
  beforeEach(() => {
    fixtures.accountPreferences = null;
    fixtures.appearanceTheme = "light";
    Object.values(mutations).forEach((mock) => mock.mockClear());
    Object.values(themeSetters).forEach((mock) => mock.mockClear());
  });

  it("migrates existing browser theme values when the account has no preferences", async () => {
    render(<PreferencesProvider><span>App</span></PreferencesProvider>);

    await waitFor(() =>
      expect(mutations.account).toHaveBeenCalledWith({
        appearanceTheme: "light",
        designTheme: "modern",
        colorTheme: "ocean",
        textSize: "default",
      }),
    );
  });

  it("applies account preferences returned by the server", async () => {
    fixtures.accountPreferences = {
      appearanceTheme: "dark",
      designTheme: "executive",
      colorTheme: "rose",
      textSize: "large",
    };
    render(<PreferencesProvider><span>App</span></PreferencesProvider>);

    await waitFor(() => {
      expect(themeSetters.appearance).toHaveBeenCalledWith("dark");
      expect(themeSetters.design).toHaveBeenCalledWith("executive");
      expect(themeSetters.color).toHaveBeenCalledWith("rose");
      expect(themeSetters.textSize).toHaveBeenCalledWith("large");
    });
  });

  it("saves the first user change when hydrated values matched the defaults", async () => {
    fixtures.accountPreferences = {
      appearanceTheme: "light",
      designTheme: "modern",
      colorTheme: "ocean",
      textSize: "default",
    };
    const view = render(<PreferencesProvider><span>App</span></PreferencesProvider>);
    await waitFor(() => expect(themeSetters.appearance).toHaveBeenCalledWith("light"));

    fixtures.appearanceTheme = "dark";
    view.rerender(<PreferencesProvider><span>App</span></PreferencesProvider>);

    await waitFor(() =>
      expect(mutations.account).toHaveBeenCalledWith({
        appearanceTheme: "dark",
        designTheme: "modern",
        colorTheme: "ocean",
        textSize: "default",
      }),
    );
  });
});
