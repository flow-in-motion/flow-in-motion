import { useState } from "react";
import { Clock3 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "@/auth/auth-provider";
import { AuthStateFrame } from "@/components/auth/auth-state-frame";
import { Button } from "@/components/ui/button";

function safeReturnTo(value: string | null): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export default function SessionExpiredPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const returnTo = safeReturnTo(searchParams.get("returnTo"));

  async function signInAgain() {
    setIsRedirecting(true);
    try {
      await auth.signOut();
      navigate("/sign-in", { replace: true, state: { returnTo } });
    } catch {
      setIsRedirecting(false);
    }
  }

  return (
    <AuthStateFrame
      icon={Clock3}
      eyebrow="Session ended"
      title="Your session has expired"
      description="For your security, you were signed out after your authentication session ended. Your work is still safe."
      tone="warning"
    >
      <div className="rounded-lg border bg-muted/30 p-4 text-sm leading-6 text-muted-foreground">
        Sign in again to continue to the page you were viewing.
      </div>
      {auth.error ? (
        <p role="alert" className="mt-4 text-center text-sm text-destructive">
          {auth.error.message}
        </p>
      ) : null}
      <Button
        className="mt-5 w-full"
        onClick={signInAgain}
        disabled={isRedirecting}
      >
        {isRedirecting ? "Redirecting to sign in..." : "Sign In Again"}
      </Button>
    </AuthStateFrame>
  );
}
