import { useNavigate } from "react-router-dom";

import { useAuth } from "@/auth/auth-provider";

/**
 * Clear the Supabase session locally and remotely, then return to sign-in.
 */
export function useSignOut() {
  const auth = useAuth();
  const navigate = useNavigate();

  return async function signOut() {
    await auth.signOut();
    navigate("/sign-in", { replace: true });
  };
}
