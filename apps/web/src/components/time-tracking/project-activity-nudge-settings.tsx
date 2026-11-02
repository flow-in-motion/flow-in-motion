import {
  useAccountPreferences,
  useUpdateAccountPreferences,
} from "@/api/hooks";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const THRESHOLDS = [3, 7, 14] as const;

export function ProjectActivityNudgeSettingsCard() {
  const preferences = useAccountPreferences();
  const update = useUpdateAccountPreferences();
  const settings = {
    enabled: true,
    inactiveDays: 3 as 3 | 7 | 14,
    ...preferences.data?.projectActivityNudges,
  };

  function save(patch: Partial<typeof settings>) {
    update.mutate({ projectActivityNudges: { ...settings, ...patch } });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project activity nudges</CardTitle>
        <CardDescription>
          Get a gentle prompt when no visible time has been logged on a project
          or its papers.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          type="button"
          variant={settings.enabled ? "default" : "outline"}
          aria-pressed={settings.enabled}
          disabled={update.isPending || !preferences.isSuccess}
          onClick={() => save({ enabled: !settings.enabled })}
        >
          {settings.enabled ? "Nudges on" : "Nudges off"}
        </Button>
        <div>
          <p className="mb-2 text-sm font-medium">After full inactive days</p>
          <div className="flex flex-wrap gap-2">
            {THRESHOLDS.map((days) => (
              <Button
                key={days}
                type="button"
                variant={settings.inactiveDays === days ? "default" : "outline"}
                aria-pressed={settings.inactiveDays === days}
                disabled={update.isPending || !preferences.isSuccess}
                onClick={() => save({ inactiveDays: days })}
              >
                {days} days
              </Button>
            ))}
          </div>
        </div>
        {update.isError ? (
          <p role="alert" className="text-sm text-destructive">
            Couldn’t save the nudge settings. Please try again.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
