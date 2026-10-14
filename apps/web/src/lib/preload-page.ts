/**
 * Starts downloading the code for the page the visitor opened as soon as the
 * app boots, instead of after the "Loading your account" and "Loading your
 * workspace" checks finish. The router's lazy() imports use the same
 * modules, so the page then renders from the already-downloaded code.
 */
const pageLoaders: Array<[RegExp, () => Promise<unknown>]> = [
  [/^\/$/, () => import("@/pages/dashboard")],
  [/^\/projects\/archive\/?$/, () => import("@/pages/projects-archive")],
  [/^\/projects\/[^/]+\/?$/, () => import("@/pages/project-detail")],
  [/^\/projects\/?$/, () => import("@/pages/projects")],
  [/^\/modules\/[^/]+\/?$/, () => import("@/pages/module-detail")],
  [/^\/modules\/?$/, () => import("@/pages/modules")],
  [/^\/tasks\/[^/]+\/?$/, () => import("@/pages/task-detail")],
  [/^\/tasks\/?$/, () => import("@/pages/tasks")],
  [/^\/daily-notes\/[^/]+\/?$/, () => import("@/pages/daily-note-detail")],
  [/^\/daily-notes\/?$/, () => import("@/pages/daily-notes")],
  [/^\/funding\/[^/]+\/?$/, () => import("@/pages/funding-detail")],
  [/^\/funding\/?$/, () => import("@/pages/funding")],
  [/^\/conferences\/[^/]+\/?$/, () => import("@/pages/conference-detail")],
  [/^\/conferences\/?$/, () => import("@/pages/conferences")],
  [/^\/calendar\/?$/, () => import("@/pages/calendar")],
  [/^\/pipeline\/?$/, () => import("@/pages/pipeline")],
  [/^\/mind-map\/?$/, () => import("@/pages/mind-map")],
  [/^\/settings\/account-audit\/?$/, () => import("@/pages/account-audit")],
  [/^\/settings\/?$/, () => import("@/pages/settings")],
  [/^\/usage\/?$/, () => import("@/pages/usage")],
];

export function preloadPageForPath(pathname: string): void {
  const match = pageLoaders.find(([pattern]) => pattern.test(pathname));
  // Best effort: if this fails, the router simply loads the page as usual.
  if (match) void match[1]().catch(() => undefined);
}
