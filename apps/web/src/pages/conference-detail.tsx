import { useMemo, useState, type ReactNode } from "react";
import { CalendarDays, MapPin, Pencil, Presentation, Trash2 } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  useConference,
  useCurrentWorkspace,
  useDeleteConference,
  useMe,
  useModules,
  useProjects,
  useUpdateConference,
} from "@/api/hooks";
import { ConferenceSubmissionDialog, type ConferenceSubmissionInput } from "@/components/dashboard/conference-submission-dialog";
import { BackButton } from "@/components/shared/back-button";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeading } from "@/components/typography/heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "long", year: "numeric" })
    .format(new Date(year, month - 1, day));
}

function DetailItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 font-medium">{children}</div>
    </div>
  );
}

function deadlineLabel(daysRemaining: number) {
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
  const projectsQuery = useProjects(tenantId);
  const projects = projectsQuery.data?.data ?? [];
  const modulesQuery = useModules(tenantId);
  const modules = modulesQuery.data?.data ?? [];
  const meQuery = useMe();
  const updateConference = useUpdateConference(tenantId);
  const deleteConference = useDeleteConference(tenantId);
  const [isEditing, setIsEditing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const ownedProjects = useMemo(
    () => projects.filter((project) =>
      project.userId === meQuery.data?.id || project.role?.toLowerCase() === "owner",
    ),
    [meQuery.data?.id, projects],
  );

  const ownedModules = useMemo(() => {
    const ownedProjectIds = new Set(ownedProjects.map((project) => project.id));
    return modules.filter((module) => module.projectId && ownedProjectIds.has(module.projectId));
  }, [modules, ownedProjects]);

  if (workspace.isPending || conferenceQuery.isPending || projectsQuery.isPending || modulesQuery.isPending || meQuery.isPending) {
    return <LoadingState title="Loading conference" className="min-h-[50vh]" />;
  }

  if (conferenceQuery.isError) {
    return <ErrorState title="Conference could not be loaded" description={conferenceQuery.error.message} onRetry={() => void conferenceQuery.refetch()} />;
  }

  const conference = conferenceQuery.data;
  if (!conference) {
    return <EmptyState title="Conference not found" description="This conference does not exist, or you no longer have access to it."
      action={<Button asChild variant="outline"><Link to="/conferences">Back to Conferences</Link></Button>} />;
  }

  const canManage = conference.ownerUserId === meQuery.data?.id;

  async function update(input: ConferenceSubmissionInput) {
    await updateConference.mutateAsync({ conferenceId, input });
    setIsEditing(false);
  }

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
        eyebrow={conference.acronym}
        title={conference.name}
        description={`${conference.location} · ${formatDate(conference.startDate)} – ${formatDate(conference.endDate)}`}
        actions={canManage ? <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setIsEditing(true)}><Pencil /> Edit Conference</Button>
          <Button variant="destructive" onClick={() => void remove()}><Trash2 /> Delete Conference</Button>
        </div> : <Badge variant="outline">View only</Badge>}
      />

      {actionError ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{actionError}</p> : null}

      <ConferenceSubmissionDialog
        open={isEditing}
        onOpenChange={setIsEditing}
        projects={ownedProjects}
        modules={ownedModules}
        conference={conference}
        onSave={update}
      />

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Conference overview</CardTitle></CardHeader>
          <CardContent className="grid gap-5 text-sm sm:grid-cols-2">
            <DetailItem label="Location"><span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />{conference.location}</span></DetailItem>
            <DetailItem label="Submission type"><Badge variant="outline">{conference.submissionType ?? "—"}</Badge></DetailItem>
            <DetailItem label="Conference starts"><span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-muted-foreground" />{formatDate(conference.startDate)}</span></DetailItem>
            <DetailItem label="Conference ends">{formatDate(conference.endDate)}</DetailItem>
          </CardContent>
        </Card>

        <Card className={conference.daysRemaining <= 7 ? "border-rose-300 dark:border-rose-900" : undefined}>
          <CardHeader><CardTitle>Submission deadline</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatDate(conference.submissionDue)}</p>
            <p className={conference.daysRemaining <= 7 ? "mt-2 text-sm font-medium text-destructive" : "mt-2 text-sm text-muted-foreground"}>
              {deadlineLabel(conference.daysRemaining)}
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Linked projects or modules/papers</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {conference.projects.map((project) => (
                <Link key={project.id} to={`/projects/${project.id}`}
                  className="rounded-xl border border-border bg-muted/20 p-4 transition-colors hover:border-primary/40 hover:bg-accent">
                  {project.displayId ? <span className="font-mono text-xs text-muted-foreground">{project.displayId}</span> : null}
                  <span className="mt-1 block font-semibold">{project.title}</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
