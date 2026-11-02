import { useState } from "react";

import { useAccountPreferences } from "@/api/hooks";
import { useProjectActivityStreak } from "@/api/time-tracking";
import { useAuth } from "@/auth/auth-provider";

export function ProjectActivityStreak({ projectId }: { projectId: string }) {
  const userId = useAuth().user?.id ?? "";
  const activity = useProjectActivityStreak(projectId);
  const preferences = useAccountPreferences();
  const [dismissedInView, setDismissedInView] = useState<string | null>(null);

  if (activity.isPending) {
    return (
      <p className="mb-4 text-sm text-muted-foreground">
        Loading work activity…
      </p>
    );
  }
  if (activity.isError || !activity.data) {
    return (
      <p className="mb-4 text-sm text-muted-foreground">
        Work activity is unavailable.
      </p>
    );
  }

  const { currentStreakDays, lastActiveDate, inactiveDays } = activity.data;
  const settings = {
    enabled: true,
    inactiveDays: 3,
    ...preferences.data?.projectActivityNudges,
  };
  const storageKey = `project-activity-nudge:${userId}:${projectId}`;
  const marker = lastActiveDate ?? "never-active";
  const dismissed =
    dismissedInView === `${storageKey}:${marker}` ||
    (typeof window !== "undefined" &&
      window.localStorage.getItem(storageKey) === marker);
  const showNudge =
    preferences.isSuccess &&
    settings.enabled &&
    inactiveDays >= settings.inactiveDays &&
    !dismissed;

  function dismiss() {
    window.localStorage.setItem(storageKey, marker);
    setDismissedInView(`${storageKey}:${marker}`);
  }

  return (
    <section
      aria-label="Project work activity"
      className="mb-4 rounded-md border border-border/70 bg-muted/20 px-3 py-2.5"
    >
      <p className="text-sm font-medium">
        {currentStreakDays > 0
          ? `${currentStreakDays}-day visible work streak`
          : "No current visible work streak"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {lastActiveDate
          ? `Last work logged: ${lastActiveDate}`
          : "No time logged on this project yet."}
      </p>
      {showNudge ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <span>
            No visible work has been logged here for {inactiveDays} full days. A short
            session could get things moving.
          </span>
          <button
            type="button"
            onClick={dismiss}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Dismiss
          </button>
        </div>
      ) : null}
    </section>
  );
}
