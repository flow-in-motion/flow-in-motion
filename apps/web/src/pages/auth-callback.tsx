import { useAuth } from "react-oidc-context";
import { AlertTriangle, LoaderCircle } from "lucide-react";

import { AuthScreenBackground } from "@/components/layout/auth-screen-background";
import { Heading } from "@/components/typography/heading";

/**
 * Renders while react-oidc-context completes the code exchange with Cognito.
 * Navigation away happens from AppAuthProvider's onSigninCallback, not here.
 */
export default function AuthCallbackPage() {
  const auth = useAuth();

  return (
    <AuthScreenBackground className="flex items-center justify-center px-4 py-8">
      <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-xl border bg-card p-8 text-center shadow-sm sm:p-10">
        {auth.error ? (
          <>
            <span className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive ring-1 ring-destructive/20">
              <AlertTriangle className="h-6 w-6" />
            </span>
            <Heading level="h3">Sign-in failed</Heading>
            <p className="text-sm text-muted-foreground">{auth.error.message}</p>
          </>
        ) : (
          <>
            <span className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
              <LoaderCircle className="h-6 w-6 animate-spin" />
            </span>
            <Heading level="h3">Signing you in…</Heading>
            <p className="text-sm text-muted-foreground">
              Completing sign-in with Cognito. This should only take a moment.
            </p>
          </>
        )}
      </div>
    </AuthScreenBackground>
  );
}
