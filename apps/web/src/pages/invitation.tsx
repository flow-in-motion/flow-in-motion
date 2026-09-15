import { ArrowRight, CheckCircle2, Mail, ShieldCheck } from "lucide-react";
import { useAuth } from "react-oidc-context";
import { useNavigate, useParams } from "react-router-dom";

import { useAcceptInvitation, useInvitationPreview } from "@/api/hooks";
import { AuthScreenBackground } from "@/components/layout/auth-screen-background";
import { Wordmark } from "@/components/layout/wordmark";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function InvitationPage() {
  const { token = "" } = useParams();
  const auth = useAuth();
  const navigate = useNavigate();
  const preview = useInvitationPreview(token);
  const accept = useAcceptInvitation(token);

  if (preview.isPending) {
    return (
      <AuthScreenBackground>
        <LoadingState title="Loading invitation" className="min-h-screen" />
      </AuthScreenBackground>
    );
  }

  if (preview.isError) {
    return (
      <AuthScreenBackground className="flex items-center justify-center p-6">
        <ErrorState
          title="Invitation unavailable"
          description="This invitation link is invalid, expired, or has already been used."
          className="w-full max-w-lg"
        />
      </AuthScreenBackground>
    );
  }

  const invitation = preview.data;
  const entityTitle =
    invitation.projectTitle ??
    invitation.moduleTitle ??
    invitation.taskTitle ??
    invitation.noteTitle ??
    `Shared ${invitation.type}`;
  const destination = {
    project: `/projects/${invitation.projectId}`,
    module: `/modules/${invitation.moduleId}`,
    task: `/tasks/${invitation.taskId}`,
    note: `/daily-notes/${invitation.noteId}`,
  }[invitation.type];

  async function acceptInvitation() {
    await accept.mutateAsync();
  }

  return (
    <AuthScreenBackground className="flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-xl overflow-hidden shadow-sm">
        <div className="h-1 bg-primary" />
        <CardHeader className="items-center gap-4 text-center">
          <Wordmark />
          <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-primary ring-1 ring-border">
            <Mail className="h-6 w-6" />
          </span>
          <div>
            <Badge variant="secondary" className="mb-3 capitalize">{invitation.type} invitation</Badge>
            <CardTitle className="text-2xl">Collaborate on {entityTitle}</CardTitle>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              This invitation was sent to <span className="font-medium text-foreground">{invitation.email}</span>.
              Accept it to add the {invitation.type} to your workspace views.
            </p>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 pb-8">
          <div className="flex items-start gap-3 rounded-xl border bg-muted/35 p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <p className="text-sm text-muted-foreground">
              Sign in with the invited email address. The link is single-use{invitation.expiresAt ? ` and expires on ${new Date(invitation.expiresAt).toLocaleDateString()}` : ""}.
            </p>
          </div>

          {accept.isSuccess ? (
            <div className="grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
              <p className="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="h-5 w-5" /> Invitation accepted
              </p>
              <Button onClick={() => navigate(destination)}>
                Open {invitation.type}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          ) : auth.isAuthenticated ? (
            <Button size="lg" onClick={() => void acceptInvitation()} disabled={accept.isPending}>
              {accept.isPending ? "Accepting…" : "Accept invitation"}
            </Button>
          ) : (
            <Button
              size="lg"
              onClick={() => auth.signinRedirect({ state: { returnTo: `/invitations/${token}` } })}
              disabled={auth.isLoading}
            >
              Sign in to accept
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}

          {accept.isError ? (
            <p className="text-center text-sm text-destructive">{accept.error.message}</p>
          ) : null}
        </CardContent>
      </Card>
    </AuthScreenBackground>
  );
}
