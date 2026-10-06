import { useEffect, useRef } from "react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { AlertTriangle, CheckCircle2, LoaderCircle } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "@/auth/auth-provider";
import { AuthScreenBackground } from "@/components/layout/auth-screen-background";
import { Button } from "@/components/ui/button";

export default function ConfirmSignUpPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedReturnTo = searchParams.get("returnTo") ?? "/";
  const returnTo =
    requestedReturnTo.startsWith("/") && !requestedReturnTo.startsWith("//")
      ? requestedReturnTo
      : "/";
  // The confirmation email links back here with a token_hash instead of
  // Supabase's own /auth/v1/verify URL, since that raw endpoint requires an
  // API key a plain email-client click can't supply. We verify it ourselves
  // through supabase-js, which attaches the key automatically.
  const tokenHash = searchParams.get("token_hash");
  const otpType = (searchParams.get("type") ?? "signup") as EmailOtpType;
  const hasAttemptedVerification = useRef(false);

  useEffect(() => {
    if (!tokenHash || hasAttemptedVerification.current) return;
    hasAttemptedVerification.current = true;
    void auth.confirmEmail(tokenHash, otpType).catch(() => {
      // auth.error already carries a user-facing message for the view below.
    });
  }, [auth, otpType, tokenHash]);

  useEffect(() => {
    if (auth.isAuthenticated) {
      const timeout = window.setTimeout(
        () => navigate(returnTo, { replace: true }),
        900,
      );
      return () => window.clearTimeout(timeout);
    }
  }, [auth.isAuthenticated, navigate, returnTo]);

  return (
    <AuthScreenBackground className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-primary/15 bg-card/95 p-8 text-center shadow-[var(--shadow-md)] sm:p-10">
        {auth.error && !auth.isLoading ? (
          <>
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive ring-1 ring-destructive/20">
              <AlertTriangle className="h-6 w-6" />
            </span>
            <h1 className="font-heading text-2xl font-semibold">
              Confirmation failed
            </h1>
            <p className="text-sm leading-6 text-muted-foreground">
              {auth.error.message}
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link to="/sign-in" state={{ returnTo }}>
                Return to sign in
              </Link>
            </Button>
          </>
        ) : auth.isAuthenticated ? (
          <>
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-300">
              <CheckCircle2 className="h-6 w-6" />
            </span>
            <h1 className="font-heading text-2xl font-semibold">
              Email confirmed
            </h1>
            <p className="text-sm text-muted-foreground">
              Taking you to your workspace…
            </p>
          </>
        ) : (
          <>
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
              <LoaderCircle className="h-6 w-6 animate-spin" />
            </span>
            <h1 className="font-heading text-2xl font-semibold">
              Confirming your email…
            </h1>
            <p className="text-sm text-muted-foreground">
              This should only take a moment.
            </p>
          </>
        )}
      </div>
    </AuthScreenBackground>
  );
}
