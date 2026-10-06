import { useEffect, useState, type FormEvent } from "react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { AlertTriangle, KeyRound, LoaderCircle } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "@/auth/auth-provider";
import { AuthScreenBackground } from "@/components/layout/auth-screen-background";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Heading } from "@/components/typography/heading";

/**
 * Supabase invitation and recovery links finish their exchange here. Some
 * link to this app with a token_hash (verified below via supabase-js,
 * which attaches the project's API key automatically — unlike a plain
 * browser navigation to Supabase's own /auth/v1/verify URL, which 500s
 * without one); others arrive already carrying a PKCE code or session that
 * supabase-js's detectSessionInUrl picks up on its own. Either way, these
 * flows require the user to choose a password before entering the app.
 */
export default function AuthCallbackPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tokenHash = searchParams.get("token_hash");
  const otpType = searchParams.get("type") as EmailOtpType | null;
  const [hasAttemptedVerification, setHasAttemptedVerification] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string>();

  useEffect(() => {
    if (!tokenHash || !otpType || hasAttemptedVerification) return;
    setHasAttemptedVerification(true);
    void auth.confirmEmail(tokenHash, otpType).catch(() => {
      // auth.error already carries a user-facing message for the view below.
    });
  }, [auth, hasAttemptedVerification, otpType, tokenHash]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);
    if (password.length < 12) {
      setFormError("Use at least 12 characters.");
      return;
    }
    if (password !== confirmation) {
      setFormError("The passwords do not match.");
      return;
    }
    setIsSubmitting(true);
    try {
      await auth.updatePassword(password);
      navigate("/", { replace: true });
    } catch {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthScreenBackground className="flex items-center justify-center px-4 py-8">
      <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-xl border bg-card p-8 text-center shadow-sm sm:p-10">
        {auth.error && !auth.isLoading ? (
          <>
            <span className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive ring-1 ring-destructive/20">
              <AlertTriangle className="h-6 w-6" />
            </span>
            <Heading level="h3">Sign-in failed</Heading>
            <p className="text-sm text-muted-foreground">
              {auth.error.message}
            </p>
          </>
        ) : auth.isLoading || !auth.isAuthenticated ? (
          <>
            <span className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
              <LoaderCircle className="h-6 w-6 animate-spin" />
            </span>
            <Heading level="h3">Signing you in…</Heading>
            <p className="text-sm text-muted-foreground">
              Verifying your secure Supabase link. This should only take a
              moment.
            </p>
          </>
        ) : (
          <>
            <span className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
              <KeyRound className="h-6 w-6" />
            </span>
            <Heading level="h3">Choose your password</Heading>
            <p className="text-sm text-muted-foreground">
              Finish activating or recovering your Flow in Motion account.
            </p>
            <form
              className="mt-3 grid w-full gap-4 text-left"
              onSubmit={submit}
            >
              <div className="grid gap-1.5">
                <label htmlFor="new-password" className="text-sm font-medium">
                  New password
                </label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <label
                  htmlFor="confirm-password"
                  className="text-sm font-medium"
                >
                  Confirm password
                </label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  required
                />
              </div>
              {formError ? (
                <p role="alert" className="text-sm text-destructive">
                  {formError}
                </p>
              ) : null}
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving…" : "Save password and continue"}
              </Button>
            </form>
          </>
        )}
      </div>
    </AuthScreenBackground>
  );
}
