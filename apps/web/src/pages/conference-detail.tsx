import { useState, type ReactNode } from "react";
import { CalendarDays, Link2, MapPin, Pencil, Presentation, Trash2, Unlink } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  useConference,
  useCurrentWorkspace,
  useDeleteConference,
  useMe,
  useUpdateConference,
  type ApiConference,
} from "@/api/hooks";
import { ConferenceSubmissionDialog, type ConferenceSubmissionInput } from "@/components/dashboard/conference-submission-dialog";
import { ConferenceSubmissionsPanel } from "@/components/conferences/conference-submissions-panel";
import { BackButton } from "@/components/shared/back-button";
import { PanelToggleButton } from "@/components/shared/linked-items-panels";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeading } from "@/components/typography/heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "long", year: "numeric" })
    .format(new Date(year, month - 1, day));
}

function formatDateRange(startDate: string | null, endDate: string | null) {
  if (!startDate) return formatDate(endDate);
  if (!endDate || startDate === endDate) return formatDate(startDate);
  return `${formatDate(startDate)} – ${formatDate(endDate)}`;
}

function DetailItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 font-medium">{children}</div>
    </div>
  );
}

interface LinkedRecord {
  id: string;
  displayId: string | null;
  title: string;
  href: string;
}

/**
 * One kind of linked record (projects or papers) in its own panel, laid out
 * like the Papers, Tasks and Notes panels on a project page.
 */
function ConferenceLinksPanel({
  title,
  noun,
  contentId,
  items,
  visible,
  onToggleVisible,
  onEditLinks,
  onUnlink,
}: {
  title: string;
  /** Plural, lower case: "projects" or "papers". */
  noun: string;
  contentId: string;
  items: LinkedRecord[];
  visible: boolean;
  onToggleVisible: () => void;
  /** Shown to the conference owner only. */
  onEditLinks?: () => void;
  onUnlink?: (item: LinkedRecord) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle>{title} ({items.length})</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          {onEditLinks ? (
            <Button variant="outline" size="sm" onClick={onEditLinks}>
              <Link2 />
              Link {noun}
            </Button>
          ) : null}
          <PanelToggleButton
            visible={visible}
            onToggle={onToggleVisible}
            label={noun}
            controls={contentId}
          />
        </div>
      </CardHeader>
      {visible ? (
        <CardContent id={contentId}>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No {noun} are linked to this conference.
            </p>
          ) : (
            <div className="grid gap-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-1 rounded-md border border-border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-muted/40"
                >
                  <Link
                    to={item.href}
                    className="min-w-0 flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {item.displayId ? (
                      <span className="block font-mono text-[10px] text-muted-foreground">
                        {item.displayId}
                      </span>
                    ) : null}
                    <span className="block text-sm font-semibold">{item.title}</span>
                  </Link>
                  {onUnlink ? (
                    <button
                      type="button"
                      onClick={() => onUnlink(item)}
                      aria-label={`Unlink ${item.title} from this conference`}
                      title="Unlink"
                      className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Unlink className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      ) : null}
    </Card>
  );
}

/** The conference as saved, ready to send back with changed links. */
function conferenceInput(conference: ApiConference): ConferenceSubmissionInput {
  return {
    name: conference.name,
    acronym: conference.acronym,
    location: conference.location,
    notes: conference.notes,
    submissionDue: conference.submissionDue,
    startDate: conference.startDate,
    endDate: conference.endDate,
    submissionType: conference.submissionType,
    intents: conference.intents,
    projectIds: conference.projects.map((project) => project.id),
    moduleIds: (conference.papers ?? []).map((paper) => paper.id),
  };
}

function deadlineLabel(daysRemaining: number | null) {
  if (daysRemaining === null) return "No deadline added.";
  if (daysRemaining < 0) return `${Math.abs(daysRemaining)} day${daysRemaining === -1 ? "" : "s"} overdue`;
  if (daysRemaining === 0) return "Due today";
  return `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining`;
}

export default function ConferenceDetailPage() {
  const { conferenceId = "" } = useParams();
  const navigate = useNavigate();
  const workspace = useCurrentWorkspace();
  const tenantId = workspace.data?.id ?? "";
  const conferenceQuery = useConference(tenantId, conferenceId);
  const meQuery = useMe();
  const updateConference = useUpdateConference(tenantId);
  const deleteConference = useDeleteConference(tenantId);
  const [isEditing, setIsEditing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isProjectsVisible, setIsProjectsVisible] = useState(true);

  if (workspace.isPending || conferenceQuery.isPending || meQuery.isPending) {
    return <LoadingState title="Loading conference" layout="detail" />;
  }

  if (conferenceQuery.isError) {
    return <ErrorState title="Conference could not be loaded" description={conferenceQuery.error.message} onRetry={() => void conferenceQuery.refetch()} />;
  }

  const conference = conferenceQuery.data;
  if (!conference) {
    return <EmptyState title="Conference not found" description="This conference does not exist, or you no longer have access to it."
      action={<Button asChild variant="outline"><Link to="/conferences">Back to Conferences/Events</Link></Button>} />;
  }

  const canManage = conference.ownerUserId === meQuery.data?.id;
  const knownDates = conference.startDate || conference.endDate
    ? formatDateRange(conference.startDate, conference.endDate)
    : null;
  const headingDescription = [conference.location, knownDates]
    .filter(Boolean)
    .join(" · ") || undefined;

  async function update(input: ConferenceSubmissionInput) {
    await updateConference.mutateAsync({ conferenceId, input });
    setIsEditing(false);
  }

  async function unlinkProject(item: LinkedRecord) {
    if (!window.confirm(`Unlink "${item.title}" from this conference? The project itself won't be deleted.`)) return;
    setActionError(null);
    const input = conferenceInput(conference);
    try {
      await updateConference.mutateAsync({
        conferenceId,
        input: { ...input, projectIds: input.projectIds.filter((id) => id !== item.id) },
      });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The project could not be unlinked.");
    }
  }

  const linkedProjects: LinkedRecord[] = conference.projects.map((project) => ({
    id: project.id,
    displayId: project.displayId,
    title: project.title,
    href: `/projects/${project.id}`,
  }));

  async function remove() {
    if (!window.confirm(`Delete "${conference.name}"? This action cannot be undone.`)) return;
    setActionError(null);
    try {
      await deleteConference.mutateAsync(conference.id);
      navigate("/conferences");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The conference could not be deleted.");
    }
  }

  return (
    <div className="page-stack">
      <BackButton fallback="/conferences" label="Back" />

      <PageHeading
        icon={Presentation}
        tone="rose"
        eyebrow={conference.acronym ?? undefined}
        title={conference.name}
        description={headingDescription}
        actions={canManage ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => void remove()}
              disabled={deleteConference.isPending}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 /> Delete Conference
            </Button>
            <Button type="button" onClick={() => setIsEditing(true)}>
              <Pencil /> Edit Conference
            </Button>
          </div>
        ) : (
          <Badge variant="outline">View only</Badge>
        )}
      />

      {actionError ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{actionError}</p> : null}

      <ConferenceSubmissionDialog
        open={isEditing}
        onOpenChange={setIsEditing}
        tenantId={tenantId}
        conference={conference}
        onSave={update}
      />

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Conference overview</CardTitle></CardHeader>
          <CardContent className="grid gap-5 text-sm sm:grid-cols-2">
            <DetailItem label="Location"><span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />{conference.location ?? "—"}</span></DetailItem>
            <DetailItem label="Submission type"><Badge variant="outline">{conference.submissionType ?? "—"}</Badge></DetailItem>
            <DetailItem label="Intent"><span className="flex flex-wrap gap-1">{conference.intents.length > 0 ? conference.intents.map((intent) => <Badge key={intent} variant="secondary">{intent}</Badge>) : "—"}</span></DetailItem>
            <DetailItem label="Conference starts"><span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-muted-foreground" />{formatDate(conference.startDate)}</span></DetailItem>
            <DetailItem label="Conference ends">{formatDate(conference.endDate)}</DetailItem>
          </CardContent>
        </Card>

        <Card className={conference.daysRemaining !== null && conference.daysRemaining <= 7 ? "border-rose-300 dark:border-rose-900" : undefined}>
          <CardHeader><CardTitle>Submission deadline</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatDate(conference.submissionDue)}</p>
            <p className={conference.daysRemaining !== null && conference.daysRemaining <= 7 ? "mt-2 text-sm font-medium text-destructive" : "mt-2 text-sm text-muted-foreground"}>
              {deadlineLabel(conference.daysRemaining)}
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Notes / abstract</CardTitle>
          </CardHeader>
          <CardContent>
            {conference.notes ? (
              <p className="whitespace-pre-wrap break-words text-sm leading-7">
                {conference.notes}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No notes or abstract added.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <ConferenceLinksPanel
        title="Projects"
        noun="projects"
        contentId="conference-projects-content"
        items={linkedProjects}
        visible={isProjectsVisible}
        onToggleVisible={() => setIsProjectsVisible((visible) => !visible)}
        onEditLinks={canManage ? () => setIsEditing(true) : undefined}
        onUnlink={canManage ? (item) => void unlinkProject(item) : undefined}
      />

      <ConferenceSubmissionsPanel
        tenantId={tenantId}
        conferenceId={conference.id}
        conferenceDue={conference.submissionDue}
        submissions={conference.submissions ?? []}
        canManage={canManage}
      />
    </div>
  );
}
