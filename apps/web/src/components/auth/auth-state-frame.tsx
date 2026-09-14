import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { AuthScreenBackground } from "@/components/layout/auth-screen-background";
import { Wordmark } from "@/components/layout/wordmark";
import { Heading } from "@/components/typography/heading";
import { cn } from "@/lib/utils";

interface AuthStateFrameProps {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
  tone?: "primary" | "warning" | "danger";
}

const toneClasses = {
  primary: "bg-primary/10 text-primary ring-1 ring-primary/20",
  warning:
    "bg-amber-100 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900",
  danger: "bg-destructive/10 text-destructive ring-1 ring-destructive/20",
};

export function AuthStateFrame({
  icon: Icon,
  eyebrow,
  title,
  description,
  children,
  tone = "primary",
}: AuthStateFrameProps) {
  return (
    <AuthScreenBackground>
      <header className="border-b bg-background/95 px-4 py-4 backdrop-blur sm:px-8">
        <div className="mx-auto max-w-6xl">
          <Wordmark />
        </div>
      </header>

      <main className="flex min-h-[calc(100vh-65px)] items-center justify-center px-4 py-8 sm:py-12">
        <section className="w-full max-w-xl rounded-xl border bg-card p-6 shadow-sm sm:p-9">
          <div className="flex flex-col items-center text-center">
            <span
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-full sm:h-16 sm:w-16",
                toneClasses[tone],
              )}
            >
              <Icon className="h-7 w-7 sm:h-8 sm:w-8" aria-hidden="true" />
            </span>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {eyebrow}
            </p>
            <Heading level="h1" className="mt-2 text-2xl sm:text-3xl">
              {title}
            </Heading>
            <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground sm:text-base">
              {description}
            </p>
          </div>

          {children ? <div className="mt-7">{children}</div> : null}
        </section>
      </main>
    </AuthScreenBackground>
  );
}
