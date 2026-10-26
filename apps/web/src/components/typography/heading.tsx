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
 * Compact header shared by every route: icon, optional eyebrow (a section
 * label, or the item's ID on detail pages), title, a one-line description and
 * the page's actions. It sits directly on the page canvas rather than in its
 * own card, so each page's content starts near the top of the screen.
 * `tone` is kept for API compatibility and exposed as data-tone.
 */
const PageHeading = React.forwardRef<HTMLDivElement, PageHeadingProps>(
  ({ className, title, description, eyebrow, icon: Icon, actions, tone = "blue", children, ...props }, ref) => (
    <div
      ref={ref}
      data-tone={tone}
      className={cn("flex flex-col gap-4", className)}
      {...props}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {Icon ? (
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/10 text-primary">
              <Icon className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.8} aria-hidden="true" />
            </span>
          ) : null}
          <div className="min-w-0">
            {eyebrow ? (
              <div className="text-[0.6875rem] font-semibold uppercase leading-4 tracking-[0.12em] text-primary/75">
                {eyebrow}
              </div>
            ) : null}
            <Heading level="h1" className="break-words text-[1.375rem] leading-tight sm:text-2xl">
              {title}
            </Heading>
            {description ? (
              <p className="mt-0.5 max-w-3xl text-sm leading-5 text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
      {children ? <div>{children}</div> : null}
    </div>
  ),
);
PageHeading.displayName = "PageHeading";

export { Heading, PageHeading };
