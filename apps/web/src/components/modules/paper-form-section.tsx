import { useId, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function PaperFormSection({
  number,
  title,
  description,
  optional = false,
  children,
}: {
  number: number;
  title: string;
  description?: string;
  optional?: boolean;
  children: ReactNode;
}) {
  const headingId = useId();
  const heading = (
    <>
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-primary">
        {number}
      </span>
      <h3 id={headingId} className="text-base font-semibold">
        {title}
      </h3>
      {description ? (
        <span className="text-sm text-muted-foreground">{description}</span>
      ) : null}
    </>
  );

  if (optional) {
    return (
      <details
        className="group/paper-section rounded-lg border"
        aria-labelledby={headingId}
        onInvalidCapture={(event) => {
          event.currentTarget.open = true;
        }}
      >
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 rounded-lg bg-muted/30 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          {heading}
          <span className="ml-auto rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
            Optional
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open/paper-section:rotate-180" />
        </summary>
        <div className="grid gap-4 p-4">{children}</div>
      </details>
    );
  }

  return (
    <section aria-labelledby={headingId} className="grid gap-5 border-b pb-6">
      <div className="flex flex-wrap items-center gap-3">{heading}</div>
      {children}
    </section>
  );
}
