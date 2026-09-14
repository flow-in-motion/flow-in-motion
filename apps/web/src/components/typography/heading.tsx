import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const headingVariants = cva("font-heading font-semibold tracking-[var(--heading-tracking)] text-foreground", {
  variants: {
    level: {
      h1: "text-[1.875rem] leading-[1.12] sm:text-[2.25rem]",
      h2: "text-xl leading-tight sm:text-[1.625rem]",
      h3: "text-lg leading-snug sm:text-xl",
      h4: "text-base sm:text-lg",
    },
  },
  defaultVariants: {
    level: "h1",
  },
});

export interface HeadingProps
  extends React.HTMLAttributes<HTMLHeadingElement>,
    VariantProps<typeof headingVariants> {
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
}

const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ className, level, as, ...props }, ref) => {
    const Comp = as ?? level ?? "h1";
    return (
      <Comp
        ref={ref}
        className={cn(headingVariants({ level }), className)}
        {...props}
      />
    );
  },
);
Heading.displayName = "Heading";

export interface PageHeadingProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  eyebrow?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  tone?: "blue" | "violet" | "emerald" | "amber" | "rose" | "cyan";
  children?: React.ReactNode;
}

/**
 * Branded workspace header shared by every route. Theme colour provides a
 * consistent folio-like surface while feature tones remain API-compatible.
 */
const PageHeading = React.forwardRef<HTMLDivElement, PageHeadingProps>(
  ({ className, title, description, eyebrow, icon: Icon, actions, tone = "blue", children, ...props }, ref) => (
    <div
      ref={ref}
      data-tone={tone}
      className={cn(
        "relative isolate overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-card via-card to-accent/55 px-5 py-5 shadow-[var(--shadow-sm)] before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-primary sm:px-6 sm:py-6",
        className,
      )}
      {...props}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          {Icon ? (
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary shadow-sm">
              <Icon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
            </span>
          ) : null}
          <div className="min-w-0">
            {eyebrow ? (
              <div className="mb-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-primary/75">
                {eyebrow}
              </div>
            ) : null}
            <Heading level="h1">{title}</Heading>
            {description ? (
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-[0.9375rem]">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
      {children ? <div className="mt-5 border-t border-primary/10 pt-4">{children}</div> : null}
    </div>
  ),
);
PageHeading.displayName = "PageHeading";

export { Heading, PageHeading };
