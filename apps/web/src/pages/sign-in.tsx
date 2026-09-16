import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  FlaskConical,
  FolderKanban,
  MessagesSquare,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";

import { Wordmark } from "@/components/layout/wordmark";
import { useAuth } from "@/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const HIGHLIGHTS = [
  { icon: FlaskConical, text: "Track every project from idea to acceptance" },
  {
    icon: Users,
    text: "Share projects, papers, tasks, notes with collaborators",
  },
  {
    icon: TrendingUp,
    text: "See your pipeline, tasks and deadlines at a glance",
  },
];

const RESEARCH_FLOW = [
  { icon: FolderKanban, label: "Project" },
  { icon: FileText, label: "Paper" },
  { icon: MessagesSquare, label: "Review" },
  { icon: CheckCircle2, label: "Published" },
];

export default function SignInPage() {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const returnTo =
    (location.state as { returnTo?: string } | null)?.returnTo ?? "/";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await auth.signInWithPassword(email, password);
      navigate(returnTo, { replace: true });
    } catch {
      setIsSubmitting(false);
    }
  }

  async function resetPassword() {
    if (!email) return;
    setIsSubmitting(true);
    try {
      await auth.sendPasswordReset(email);
      setResetSent(true);
    } catch {
      // The auth provider exposes a safe, user-facing error message.
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="app-canvas grid min-h-screen lg:grid-cols-[minmax(0,1.08fr)_minmax(26rem,0.92fr)]">
      <div className="hidden border-r border-primary/15 bg-[hsl(var(--nav-background))] lg:flex lg:flex-col lg:px-12 lg:py-10 xl:px-16">
        <Wordmark />

        <div className="my-auto max-w-xl py-10">
          <p className="mb-4 flex items-center gap-3 text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-primary">
            <span className="h-px w-8 bg-primary/45" aria-hidden="true" />
            Research operations, organised
          </p>
          <h1 className="max-w-lg font-heading text-4xl font-semibold leading-[1.08] tracking-[-0.045em] text-foreground xl:text-5xl">
            Where your research momentum lives
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground text-balance">
            One place to plan projects, assign tasks, organise notes, and follow
            your pipeline from first idea to acceptance.
          </p>

          <div className="mt-8 rounded-2xl border border-primary/15 bg-card/75 p-5 shadow-[var(--shadow-md)] ring-1 ring-white/60 dark:ring-white/[0.03]">
            <div className="mb-4 flex items-center justify-between gap-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary/70">
                One connected workflow
              </p>
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[0.625rem] font-semibold text-primary">
                Live workspace
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              {RESEARCH_FLOW.map(({ icon: Icon, label }, index) => (
                <div key={label} className="contents">
                  <div className="flex min-w-0 flex-1 flex-col items-center gap-2 rounded-xl border border-primary/10 bg-white/55 px-2 py-3 text-center dark:bg-white/[0.04]">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-[0.6875rem] font-semibold text-foreground">
                      {label}
                    </span>
                  </div>
                  {index < RESEARCH_FLOW.length - 1 ? (
                    <ArrowRight
                      className="h-3.5 w-3.5 shrink-0 text-primary/40"
                      aria-hidden="true"
                    />
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <ul className="mt-6 grid gap-3 sm:grid-cols-3">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li
                key={text}
                className="flex items-start gap-2.5 rounded-xl border border-primary/10 bg-white/35 p-3 text-xs font-medium leading-5 text-foreground/80 dark:bg-white/[0.03]"
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center gap-2 border-t border-primary/15 pt-5 text-xs font-medium text-muted-foreground">
          <ShieldCheck className="h-4 w-4" />
          Secure access · Your session stays private
        </div>
      </div>

      <div className="flex flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div className="mb-8 lg:hidden">
          <Wordmark />
        </div>
        <div className="relative flex w-full max-w-[27rem] flex-col items-center gap-7 overflow-hidden rounded-2xl border border-primary/15 bg-card/95 p-8 text-center shadow-[var(--shadow-md)] before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-primary sm:p-10">
          <div className="flex flex-col items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-primary/70">
                Secure workspace access
              </p>
              <h2 className="mt-2 font-heading text-2xl font-semibold tracking-[-0.035em] text-foreground">
                Welcome back
              </h2>
            </div>
            <p className="max-w-xs text-sm leading-6 text-muted-foreground">
              Continue to your projects, papers, tasks, pipeline, and notes.
            </p>
          </div>
          <form className="grid w-full gap-4 text-left" onSubmit={submit}>
            <div className="grid gap-1.5">
              <label htmlFor="sign-in-email" className="text-sm font-medium">
                Email address
              </label>
              <Input
                id="sign-in-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="sign-in-password" className="text-sm font-medium">
                Password
              </label>
              <Input
                id="sign-in-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={auth.isLoading || isSubmitting}
            >
              {isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
            <button
              type="button"
              className="text-center text-xs font-medium text-primary underline-offset-4 hover:underline disabled:opacity-50"
              onClick={() => void resetPassword()}
              disabled={!email || isSubmitting}
            >
              Forgot your password?
            </button>
          </form>
          {auth.error ? (
            <p role="alert" className="text-xs text-destructive">
              {auth.error.message}
            </p>
          ) : null}
          {resetSent ? (
            <p role="status" className="text-xs text-emerald-700">
              If that account exists, a password-reset email has been sent.
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            By signing in, you agree to our{" "}
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
      </div>
    </div>
  );
}
