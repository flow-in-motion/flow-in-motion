import type { ReactElement, ReactNode } from "react";

import { cn } from "@/lib/utils";
import { useDesignThemeLayout } from "@/theme/design-theme";

/**
 * Placeholders shaped like the page that's loading, so the real content
 * appears in place instead of replacing a spinner card. Screen readers hear
 * the `title` ("Loading papers"); the grey shapes themselves are hidden.
 */
export type PageSkeletonLayout = "list" | "detail" | "dashboard" | "canvas";

function Bone({ className }: { className?: string }) {
  return <div className={cn("rounded-md bg-muted motion-safe:animate-pulse", className)} />;
}

const PILL_WIDTHS = ["w-24", "w-28", "w-40", "w-32", "w-28"];
const ROW_WIDTHS = ["w-2/5", "w-1/3", "w-1/2", "w-2/5", "w-1/4", "w-1/3"];

function HeaderBones({ withPills = false }: { withPills?: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-6">
        <div className="flex min-w-0 items-start gap-3">
          <Bone className="mt-0.5 h-9 w-9 shrink-0 rounded-lg" />
          <div className="grid gap-2">
            <Bone className="h-3 w-20" />
            <Bone className="h-6 w-48" />
            <Bone className="h-4 w-64 max-w-[55vw]" />
          </div>
        </div>
        <Bone className="hidden h-9 w-28 shrink-0 rounded-lg sm:block" />
      </div>
      {withPills ? (
        <div className="flex flex-wrap gap-2">
          {PILL_WIDTHS.map((width, index) => (
            <Bone key={index} className={cn("h-7 rounded-full", width)} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CardBones({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-xl border bg-card p-4 sm:p-5", className)}>{children}</div>;
}

function ListBones() {
  return (
    <>
      <CardBones className="flex flex-wrap gap-3 p-3 sm:p-4">
        <Bone className="h-9 w-full sm:w-64" />
        <Bone className="h-9 w-36" />
        <Bone className="h-9 w-36" />
        <Bone className="hidden h-9 w-40 md:block" />
      </CardBones>
      <CardBones className="grid gap-1">
        <Bone className="mb-2 h-9 w-full" />
        {ROW_WIDTHS.map((width, index) => (
          <div key={index} className="flex items-center gap-4 py-3">
            <div className="grid flex-1 gap-2">
              <Bone className="h-3 w-16" />
              <Bone className={cn("h-4", width)} />
            </div>
            <Bone className="hidden h-7 w-24 sm:block" />
            <Bone className="hidden h-7 w-24 md:block" />
            <Bone className="h-7 w-28" />
          </div>
        ))}
      </CardBones>
    </>
  );
}

function DetailBones() {
  return (
    <>
      {[3, 2].map((lines, index) => (
        <CardBones key={index} className="grid gap-3">
          <div className="flex items-center justify-between gap-4">
            <Bone className="h-5 w-36" />
            <Bone className="h-8 w-24" />
          </div>
          {Array.from({ length: lines }, (_, line) => (
            <Bone key={line} className={cn("h-4", line % 2 ? "w-1/2" : "w-3/4")} />
          ))}
        </CardBones>
      ))}
    </>
  );
}

function DashboardBones() {
  return (
    <>
      <Bone className="h-11 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <CardBones key={index} className="grid gap-4">
            <Bone className="h-9 w-9 rounded-lg" />
            <Bone className="h-4 w-28" />
            <Bone className="h-8 w-16" />
          </CardBones>
        ))}
      </div>
      <CardBones className="grid gap-3">
        <Bone className="h-5 w-48" />
        <Bone className="h-48 w-full" />
      </CardBones>
    </>
  );
}

function CanvasBones() {
  return (
    <CardBones>
      <Bone className="h-[45vh] w-full" />
    </CardBones>
  );
}

const BODIES: Record<PageSkeletonLayout, () => ReactElement> = {
  list: ListBones,
  detail: DetailBones,
  dashboard: DashboardBones,
  canvas: CanvasBones,
};

function SkeletonContent({ layout }: { layout: PageSkeletonLayout }) {
  const Body = BODIES[layout];
  return (
    <div className="page-stack" aria-hidden="true">
      <HeaderBones withPills={layout === "detail"} />
      <Body />
    </div>
  );
}

export function PageSkeleton({
  title,
  layout = "list",
  className,
}: {
  title: string;
  layout?: PageSkeletonLayout;
  className?: string;
}) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={className}>
      <span className="sr-only">{title}</span>
      <SkeletonContent layout={layout} />
    </div>
  );
}

/**
 * The whole app frame (sidebar or top bar, matching the chosen layout) with a
 * page skeleton inside — shown while the account or workspace is loading,
 * before the real frame can render.
 */
export function AppShellSkeleton({
  title,
  layout = "list",
}: {
  title: string;
  layout?: PageSkeletonLayout;
}) {
  const frame = useDesignThemeLayout();

  const content = (
    <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8 xl:px-10">
      <div className="mx-auto w-full max-w-[1480px]">
        <SkeletonContent layout={layout} />
      </div>
    </main>
  );

  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{title}</span>
      {frame === "topnav" ? (
        <div className="app-canvas flex min-h-screen flex-col" aria-hidden="true">
          <div className="app-topbar flex h-[4.5rem] items-center gap-6 border-b px-6">
            <Bone className="h-8 w-40" />
            <Bone className="hidden h-4 w-72 md:block" />
          </div>
          {content}
        </div>
      ) : (
        <div className="app-canvas flex min-h-screen" aria-hidden="true">
          <div
            className={cn(
              "app-sidebar sticky top-0 hidden h-screen shrink-0 flex-col gap-6 border-r lg:flex",
              frame === "sidebar-compact"
                ? "w-[4.5rem] items-center py-4"
                : "w-[16.5rem] px-5 py-6 xl:w-[17rem]",
            )}
          >
            <Bone className={frame === "sidebar-compact" ? "h-9 w-9" : "h-9 w-40"} />
            <div className="grid gap-3">
              {Array.from({ length: 8 }, (_, index) => (
                <Bone
                  key={index}
                  className={frame === "sidebar-compact" ? "h-8 w-8" : "h-7 w-full"}
                />
              ))}
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col">{content}</div>
        </div>
      )}
    </div>
  );
}
