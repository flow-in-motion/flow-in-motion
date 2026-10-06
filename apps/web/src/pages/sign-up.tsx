import { useState, type FormEvent } from "react";
import { CheckCircle2, Eye, EyeOff, UserPlus } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "@/auth/auth-provider";
import { AuthScreenBackground } from "@/components/layout/auth-screen-background";
import { Wordmark } from "@/components/layout/wordmark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SignUpPage() {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [confirmationSent, setConfirmationSent] = useState(false);
  const requestedReturnTo =
    (location.state as { returnTo?: string } | null)?.returnTo ?? "/";
  const returnTo =
    requestedReturnTo.startsWith("/") && !requestedReturnTo.startsWith("//")
      ? requestedReturnTo
      : "/";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);

    if (password.length < 12) {
      setFormError("Use at least 12 characters for your password.");
      return;
    }
    if (password !== confirmation) {
      setFormError("The passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await auth.signUpWithPassword(email, password, returnTo);
      if (result.requiresEmailConfirmation) {
        setConfirmationSent(true);
      } else {
        navigate(returnTo, { replace: true });
      }
    } catch {
      // The auth provider exposes a safe, user-facing error message.
    } finally {
      setIsSubmitting(false);
    }
  }

  if (confirmationSent) {
    return (
      <AuthScreenBackground className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-primary/15 bg-card/95 p-8 text-center shadow-[var(--shadow-md)] sm:p-10">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-300">
            <CheckCircle2 className="h-6 w-6" />
          </span>
          <h1 className="font-heading text-2xl font-semibold tracking-[-0.035em]">
            Check your email
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            We sent a confirmation link to{" "}
            <strong className="text-foreground">{email.trim()}</strong>. Open it
            to activate your account and continue to your workspace.
          </p>
          <Button asChild variant="outline" className="mt-2 w-full">
            <Link to="/sign-in" state={{ returnTo }}>
              Back to sign in
            </Link>
          </Button>
        </div>
      </AuthScreenBackground>
    );
  }

  return (
    <AuthScreenBackground className="flex min-h-screen flex-col items-center justify-center px-4 py-10 sm:px-8">
      <div className="mb-8">
        <Wordmark />
      </div>
      <div className="relative flex w-full max-w-[27rem] flex-col items-center gap-6 overflow-hidden rounded-2xl border border-primary/15 bg-card/95 p-8 text-center shadow-[var(--shadow-md)] before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-primary sm:p-10">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary shadow-sm">
          <UserPlus className="h-5 w-5" />
        </span>
        <div>
          <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-primary/70">
            Start your research workspace
          </p>
          <h1 className="mt-2 font-heading text-2xl font-semibold tracking-[-0.035em]">
            Create your account
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Organise projects, tasks, notes, and submissions in one place.
          </p>
        </div>

        <form className="grid w-full gap-4 text-left" onSubmit={submit}>
          <div className="grid gap-1.5">
            <label htmlFor="sign-up-email" className="text-sm font-medium">
              Email address
            </label>
            <Input
              id="sign-up-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="sign-up-password" className="text-sm font-medium">
              Password
            </label>
            <div className="relative">
              <Input
                id="sign-up-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                minLength={12}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="pr-11"
                required
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide passwords" : "Show passwords"}
                aria-controls="sign-up-password sign-up-confirmation"
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword((shown) => !shown)}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Use at least 12 characters.
            </p>
          </div>
          <div className="grid gap-1.5">
            <label
              htmlFor="sign-up-confirmation"
              className="text-sm font-medium"
            >
              Confirm password
            </label>
            <Input
              id="sign-up-confirmation"
              type={showPassword ? "text" : "password"}
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
          {auth.error ? (
            <p role="alert" className="text-sm text-destructive">
              {auth.error.message}
            </p>
          ) : null}
          <Button
            type="submit"
            size="lg"
            disabled={auth.isLoading || isSubmitting}
          >
            {isSubmitting ? "Creating account…" : "Create account"}
          </Button>
        </form>

        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            to="/sign-in"
            state={{ returnTo }}
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
        <p className="text-xs text-muted-foreground">
          By creating an account, you agree to our{" "}
          <Link
            to="/terms"
            className="font-medium underline underline-offset-2 hover:text-foreground"
          >
            Terms
          </Link>{" "}
          and{" "}
          <Link
            to="/privacy"
            className="font-medium underline underline-offset-2 hover:text-foreground"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </AuthScreenBackground>
  );
}
