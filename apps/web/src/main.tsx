import { StrictMode, useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { ApiAuthBridge } from "@/api/api-auth-bridge";
import { createQueryClient } from "@/api/query-client";
import { AppAuthProvider, useAuth } from "@/auth/auth-provider";
import { AppErrorBoundary } from "@/components/shared/error-boundary";
import { installGlobalErrorHandlers } from "@/lib/client-error-reporter";
import { ColorThemeProvider } from "@/theme/color-theme";
import { AppearanceThemeProvider } from "@/theme/appearance-theme";
import { DesignThemeProvider } from "@/theme/design-theme";
import { TextSizeProvider } from "@/theme/text-size";
import { PreferencesProvider } from "@/preferences/preferences-provider";
import App from "./App";
import "./index.css";

installGlobalErrorHandlers();

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary label="Research in Motion" className="min-h-screen">
    <AppearanceThemeProvider>
      <TextSizeProvider>
        <DesignThemeProvider>
          <ColorThemeProvider>
            <BrowserRouter>
              <AppAuthProvider>
                <AuthenticatedQueryRoot />
              </AppAuthProvider>
            </BrowserRouter>
          </ColorThemeProvider>
        </DesignThemeProvider>
      </TextSizeProvider>
    </AppearanceThemeProvider>
  </AppErrorBoundary>,
);

export function AuthenticatedQueryRoot() {
  const auth = useAuth();

  return (
    <SubjectQueryRoot key={auth.user?.id ?? "signed-out"}>
      <StrictMode>
        <ApiAuthBridge>
          <PreferencesProvider>
            <App />
          </PreferencesProvider>
        </ApiAuthBridge>
      </StrictMode>
    </SubjectQueryRoot>
  );
}

export function SubjectQueryRoot({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
