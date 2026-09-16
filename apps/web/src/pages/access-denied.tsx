import { ShieldX } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/auth/auth-provider";
import { AuthStateFrame } from "@/components/auth/auth-state-frame";
import { Button } from "@/components/ui/button";

export default function AccessDeniedPage() {
  const auth = useAuth();
  const navigate = useNavigate();

  function continueFromDenied() {
    if (auth.isAuthenticated) {
      navigate("/", { replace: true });
      return;
    }

    navigate("/sign-in", { replace: true, state: { returnTo: "/" } });
  }

  return (
    <AuthStateFrame
      icon={ShieldX}
      eyebrow="Access denied"
      title="You do not have access to this page"
      description="Your account is signed in, but it does not have the workspace role or project permission required to view this content."
      tone="danger"
    >
      <div className="rounded-lg border bg-muted/30 p-4 text-sm leading-6 text-muted-foreground">
        If you think you should have access, ask the workspace owner to review
        your membership and project permissions.
      </div>
      <Button className="mt-5 w-full" onClick={continueFromDenied}>
        {auth.isAuthenticated ? "Return to Workspace" : "Go to Sign In"}
      </Button>
    </AuthStateFrame>
  );
}
