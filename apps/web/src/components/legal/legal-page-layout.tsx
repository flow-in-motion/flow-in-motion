import type { ReactNode } from "react";

import { AuthScreenBackground } from "@/components/layout/auth-screen-background";
import { Wordmark } from "@/components/layout/wordmark";
import { BackButton } from "@/components/shared/back-button";
import { Heading } from "@/components/typography/heading";

interface LegalPageLayoutProps {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}

export function LegalPageLayout({ title, lastUpdated, children }: LegalPageLayoutProps) {
  return (
    <AuthScreenBackground>
      <header className="border-b bg-background/95 px-4 py-4 backdrop-blur sm:px-8">
        <div className="mx-auto max-w-6xl">
          <Wordmark />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-8 sm:py-14">
        <BackButton fallback="/sign-in" label="Back" className="w-fit" />

        <div className="mt-6 overflow-hidden rounded-xl border bg-card p-6 shadow-sm sm:p-10">
          <p role="alert" className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs leading-5 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            Draft for review — this page has not been reviewed by a lawyer and should not be treated as final or binding.
          </p>
          <Heading level="h1">{title}</Heading>
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Last updated: {lastUpdated}
          </p>
          <div className="prose-legal mt-8 flex flex-col gap-8">{children}</div>
        </div>
      </main>
    </AuthScreenBackground>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <Heading level="h3">{title}</Heading>
      <div className="flex flex-col gap-3 text-sm leading-7 text-muted-foreground">
        {children}
      </div>
    </section>
  );
}
