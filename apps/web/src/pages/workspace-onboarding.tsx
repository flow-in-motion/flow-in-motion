import { useForm } from "react-hook-form";
import { Building2, Check, CheckCircle2, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";

import { useCreateWorkspace } from "@/api/hooks";
import { AuthScreenBackground } from "@/components/layout/auth-screen-background";
import { Wordmark } from "@/components/layout/wordmark";
import { Heading } from "@/components/typography/heading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const workspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Use at least 2 characters.")
    .max(100, "Use 100 characters or fewer."),
});

type WorkspaceForm = z.infer<typeof workspaceSchema>;

const onboardingSteps = [
  {
    title: "Account secured",
    description: "Your Supabase account is ready.",
    icon: ShieldCheck,
    complete: true,
  },
  {
    title: "Create your workspace",
    description: "Name the research space you'll use.",
    icon: Building2,
    complete: false,
  },
];

export default function WorkspaceOnboardingPage() {
  const navigate = useNavigate();
  const createWorkspace = useCreateWorkspace();
  const form = useForm<WorkspaceForm>({ defaultValues: { name: "" } });

  async function submit(values: WorkspaceForm) {
    const parsed = workspaceSchema.safeParse(values);
    if (!parsed.success) {
      form.setError("name", { message: parsed.error.issues[0]?.message });
      return;
    }
    await createWorkspace.mutateAsync(parsed.data.name).catch(() => undefined);
  }

  return (
    <AuthScreenBackground>
      <header className="border-b bg-background/95 px-5 py-4 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Wordmark />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            First-time setup
          </span>
        </div>
      </header>

      <main className="mx-auto grid min-h-[calc(100vh-65px)] max-w-6xl gap-10 px-5 py-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:px-8">
        <aside className="hidden rounded-xl border bg-card p-8 lg:block">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Welcome aboard
          </span>
          <Heading level="h1" className="mt-3 max-w-lg text-4xl leading-tight">
            Set up a focused home for your research.
          </Heading>
          <p className="mt-4 max-w-md text-base leading-7 text-muted-foreground">
            Your workspace keeps your projects, tasks, and notes together in one
            place, with clear ownership boundaries.
          </p>

          <ol className="mt-9 grid gap-5">
            {onboardingSteps.map((step, index) => {
              const Icon = step.icon;
              const active = index === 1 && !createWorkspace.data;
              return (
                <li key={step.title} className="flex items-start gap-4">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${
                      step.complete || active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground"
                    }`}
                  >
                    {step.complete ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </span>
                  <div className="pt-0.5">
                    <p className="text-sm font-semibold">{step.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </aside>

        <section className="mx-auto w-full max-w-2xl rounded-xl border bg-card p-6 shadow-sm sm:p-8">
          {createWorkspace.data ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <CheckCircle2 className="h-7 w-7" />
              </span>
              <Heading level="h2" className="mt-5">
                Your workspace is ready
              </Heading>
              <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {createWorkspace.data.name}
                </span>{" "}
                has been set up. You can now begin adding projects, tasks, and
                notes.
              </p>
              <Button
                className="mt-7 min-w-44"
                onClick={() => navigate("/", { replace: true })}
              >
                Open Workspace
              </Button>
            </div>
          ) : (
            <>
              <div className="border-b pb-6">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Step 1 of 1
                </span>
                <Heading level="h2" className="mt-2">
                  Create your workspace
                </Heading>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  These details identify your workspace to you and future
                  collaborators.
                </p>
              </div>

              <form
                onSubmit={form.handleSubmit(submit)}
                className="mt-6 grid gap-5"
              >
                <div className="grid gap-2">
                  <label
                    htmlFor="onboarding-workspace-name"
                    className="text-sm font-medium"
                  >
                    Workspace name <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="onboarding-workspace-name"
                    {...form.register("name")}
                    placeholder="e.g. Translational Research Lab"
                    className="h-11"
                    autoFocus
                    required
                  />
                  {form.formState.errors.name ? (
                    <p role="alert" className="text-xs text-destructive">
                      {form.formState.errors.name.message}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-lg border bg-muted/35 p-4">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div>
                      <p className="text-sm font-semibold">
                        You will be the workspace owner
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Each workspace has a single owner. You can still share
                        individual projects, tasks, and notes with other people
                        separately.
                      </p>
                    </div>
                  </div>
                </div>

                {createWorkspace.isError ? (
                  <p role="alert" className="text-sm text-destructive">
                    {createWorkspace.error.message}
                  </p>
                ) : null}
                <Button
                  type="submit"
                  size="lg"
                  className="mt-1 w-full"
                  disabled={createWorkspace.isPending}
                >
                  {createWorkspace.isPending
                    ? "Creating Workspace…"
                    : "Create Workspace"}
                </Button>
              </form>
            </>
          )}
        </section>
      </main>
    </AuthScreenBackground>
  );
}
