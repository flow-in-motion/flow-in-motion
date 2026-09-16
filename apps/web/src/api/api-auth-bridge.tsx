import type { ReactNode } from "react";
import { useAuth } from "@/auth/auth-provider";

import { setApiAccessToken } from "@/api/client";
import { useMe } from "@/api/hooks";

export function ApiAuthBridge({ children }: { children: ReactNode }) {
  const auth = useAuth();
  setApiAccessToken(auth.session?.access_token);
  useMe(auth.isAuthenticated);
  return children;
}
