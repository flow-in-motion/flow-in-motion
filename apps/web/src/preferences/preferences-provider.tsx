import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useAuth } from "@/auth/auth-provider";

import {
  useAccountPreferences,
  useCurrentWorkspace,
  useMe,
  useUpdateAccountPreferences,
  useUpdateWorkspacePreferences,
  useWorkspacePreferences,
  type DashboardLayoutPreference,
} from "@/api/hooks";
import {
  PreferencesContext,
  type PreferencesContextValue,
} from "@/preferences/preferences-context";
import { useAppearanceTheme } from "@/theme/appearance-theme";
import { useColorTheme } from "@/theme/color-theme";
import { useDesignTheme } from "@/theme/design-theme";
import { useTextSize } from "@/theme/text-size";

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const meQuery = useMe(auth.isAuthenticated);
  const enabled = auth.isAuthenticated && meQuery.isSuccess;
  const { theme: appearanceTheme, setTheme: setAppearanceTheme } = useAppearanceTheme();
  const { theme: designTheme, setTheme: setDesignTheme } = useDesignTheme();
  const { theme: colorTheme, setTheme: setColorTheme } = useColorTheme();
  const { size: textSize, setSize: setTextSize } = useTextSize();
  const accountQuery = useAccountPreferences(enabled);
  const updateAccount = useUpdateAccountPreferences();
  const workspaceQuery = useCurrentWorkspace(enabled);
  const tenantId = workspaceQuery.data?.id ?? "";
  const preferencesQuery = useWorkspacePreferences(tenantId, enabled);
  const updateWorkspace = useUpdateWorkspacePreferences(tenantId);
  const updateAccountPreferences = updateAccount.mutate;
  const updateWorkspacePreferences = updateWorkspace.mutate;
  const accountHydrated = useRef(false);
  const lastSavedAccount = useRef("");

  useEffect(() => {
    if (
      (!accountQuery.isSuccess && !accountQuery.isError) ||
      accountHydrated.current
    ) return;
    const stored = accountQuery.isSuccess ? accountQuery.data : null;
    accountHydrated.current = true;

    if (!stored) {
      return;
    }

    const merged = {
      appearanceTheme: stored.appearanceTheme ?? appearanceTheme,
      designTheme: stored.designTheme ?? designTheme,
      colorTheme: stored.colorTheme ?? colorTheme,
      textSize: stored.textSize ?? textSize,
    };
    lastSavedAccount.current = JSON.stringify(merged);
    setAppearanceTheme(merged.appearanceTheme);
    setDesignTheme(merged.designTheme);
    setColorTheme(merged.colorTheme);
    setTextSize(merged.textSize);
    if (
      !stored.appearanceTheme ||
      !stored.designTheme ||
      !stored.colorTheme ||
      !stored.textSize
    ) {
      updateAccountPreferences(merged);
    }
  }, [
    accountQuery.data,
    accountQuery.isError,
    accountQuery.isSuccess,
    appearanceTheme,
    colorTheme,
    designTheme,
    setAppearanceTheme,
    setColorTheme,
    setDesignTheme,
    setTextSize,
    textSize,
    updateAccountPreferences,
  ]);

  useEffect(() => {
    if (!accountHydrated.current) return;
    const next = { appearanceTheme, designTheme, colorTheme, textSize };
    const serialized = JSON.stringify(next);
    if (serialized === lastSavedAccount.current) return;
    lastSavedAccount.current = serialized;
    updateAccountPreferences(next);
  }, [appearanceTheme, colorTheme, designTheme, textSize, updateAccountPreferences]);

  const updateDashboardLayout = useCallback(
    (dashboardLayout: DashboardLayoutPreference) => {
      if (tenantId) updateWorkspacePreferences({ dashboardLayout });
    },
    [tenantId, updateWorkspacePreferences],
  );

  const updateTableColumns = useCallback(
    (table: string, columns: string[]) => {
      if (tenantId) updateWorkspacePreferences({ tableColumns: { [table]: columns } });
    },
    [tenantId, updateWorkspacePreferences],
  );

  const updatePipelineHiddenStages = useCallback(
    (pipeline: string, stages: string[]) => {
      if (tenantId) {
        updateWorkspacePreferences({ pipelineHiddenStages: { [pipeline]: stages } });
      }
    },
    [tenantId, updateWorkspacePreferences],
  );

  const contextValue = useMemo<PreferencesContextValue>(
    () => ({
      workspaceId: tenantId,
      workspacePreferences: preferencesQuery.isSuccess
        ? preferencesQuery.data
        : preferencesQuery.isError
          ? null
          : undefined,
      updateDashboardLayout,
      updateTableColumns,
      updatePipelineHiddenStages,
    }),
    [
      preferencesQuery.data,
      preferencesQuery.isError,
      preferencesQuery.isSuccess,
      tenantId,
      updateDashboardLayout,
      updatePipelineHiddenStages,
      updateTableColumns,
    ],
  );

  return (
    <PreferencesContext.Provider
      value={contextValue}
    >
      {children}
    </PreferencesContext.Provider>
  );
}
