import { useId, useState } from "react";
import { Link } from "react-router-dom";

import { useModuleConferencePresentations } from "@/api/hooks";
import { PanelToggleButton } from "@/components/shared/linked-items-panels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { statusBadgeClass } from "@/lib/tones";
import { cn } from "@/lib/utils";

function formatDate(iso: string | null) {
  if (!iso) return null;
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

/**
 * Where this paper has been submitted to conferences, with each
 * submission's type and status. These are the same records shown on each
 * conference's page, which is where they're added and changed.
 */
export function PaperConferenceSubmissions({
  tenantId,
  moduleId,
}: {
  tenantId: string;
  moduleId: string;
}) {
  const contentId = useId();
  const [visible, setVisible] = useState(true);
  // Shares its request with the conference presentation history below.
  const history = useModuleConferencePresentations(tenantId, moduleId);
  const submissions = history.data?.submissions ?? [];

  return (
    <Card role="region" aria-label="Conference submissions">
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle>Conference submissions ({submissions.length})</CardTitle>
        <PanelToggleButton
          visible={visible}
          onToggle={() => setVisible((current) => !current)}
          label="conference submissions"
          controls={contentId}
        />
      </CardHeader>
      {visible ? (
        <CardContent id={contentId}>
          {history.isPending ? (
            <p className="text-sm text-muted-foreground">Loading conference submissions…</p>
          ) : submissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              This paper hasn&apos;t been added to any conference yet. Add it from a
              conference&apos;s page under{" "}
              <Link to="/conferences" className="underline hover:text-foreground">
                Conferences/Events
              </Link>
              .
            </p>
          ) : (
            <ul className="grid gap-2">
              {submissions.map((submission) => {
                const details = [
                  submission.submissionType,
                  submission.submissionDue
                    ? `Due ${formatDate(submission.submissionDue)}`
                    : null,
                  submission.presentedDate
                    ? `Presented ${formatDate(submission.presentedDate)}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <li
                    key={submission.id}
                    className="flex items-start gap-2 rounded-md border border-border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-muted/40"
                  >
                    <Link
                      to={`/conferences/${submission.conferenceId}`}
                      className="min-w-0 flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="block text-sm font-semibold">
                        {submission.acronym
                          ? `${submission.acronym} · ${submission.conferenceName}`
                          : submission.conferenceName}
                      </span>
                      {details ? (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {details}
                        </span>
                      ) : null}
                    </Link>
                    {submission.status ? (
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center whitespace-nowrap rounded-md border px-1.5 py-px text-[0.6875rem] font-medium leading-4",
                          statusBadgeClass(submission.status),
                        )}
                      >
                        <span className="sr-only">Status: </span>
                        {submission.status}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      ) : null}
    </Card>
  );
}
