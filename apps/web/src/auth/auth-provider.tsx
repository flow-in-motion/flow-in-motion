import type { AuthError, Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { supabase } from "@/auth/supabase-client";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isSessionExpired: boolean;
  error: Error | null;
  signInWithPassword(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  clearError(): void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function toError(error: AuthError | Error | null): Error | null {
  return error ? new Error(error.message) : null;
}

export function AppAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      setSession(data.session);
      setError(toError(sessionError));
      setIsLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!active) return;
        setSession(nextSession);
        setIsLoading(false);
      },
    );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      setError(null);
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
      if (signInError) {
        const nextError = toError(signInError)!;
        setError(nextError);
        throw nextError;
      }
      setSession(data.session);
    },
    [],
  );

  const signOut = useCallback(async () => {
    setError(null);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      const nextError = toError(signOutError)!;
      setError(nextError);
      throw nextError;
    }
    setSession(null);
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/auth/callback` },
    );
    if (resetError) {
      const nextError = toError(resetError)!;
      setError(nextError);
      throw nextError;
    }
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      const nextError = toError(updateError)!;
      setError(nextError);
      throw nextError;
    }
  }, []);

  const isSessionExpired = Boolean(
    session?.expires_at && session.expires_at * 1000 <= Date.now(),
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isAuthenticated: Boolean(session) && !isSessionExpired,
      isLoading,
      isSessionExpired,
      error,
      signInWithPassword,
      signOut,
      sendPasswordReset,
      updatePassword,
      clearError: () => setError(null),
    }),
    [
      error,
      isLoading,
      isSessionExpired,
      sendPasswordReset,
      session,
      signInWithPassword,
      signOut,
      updatePassword,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AppAuthProvider");
  }
  return context;
}
