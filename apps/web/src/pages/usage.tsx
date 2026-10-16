import { useState } from "react";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileText,
  ListChecks,
  Minus,
  ShieldAlert,
  Users,
} from "lucide-react";

import {
  type ApiAnalyticsSummary,
  useAnalyticsSummary,
  useCurrentWorkspace,
} from "@/api/hooks";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeading } from "@/components/typography/heading";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const WINDOW_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

const HOLDER_LABELS: Record<string, string> = {
  me: "Me",
  collaborator: "Collaborators / coauthors",
  journal: "Journal",
  friendly_reviewer: "Friendly reviewer",
  others: "Others",
  not_set: "Not set",
};

const PAGE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  projects: "Projects",
  papers: "Papers",
  tasks: "Tasks",
  notes: "Notes",
  pipeline: "Pipeline",
  calendar: "Calendar",
  conferences: "Conferences / events",
  funding: "Funding",
  mind_map: "Mind Map",
  future_features: "Future features",
  usage: "Usage",
  settings: "Settings",
  project_archive: "Project archive",
  site_map: "Site map",
  other: "Other",
  legacy_unclassified: "Earlier activity",
};

function formatDay(day: string) {
  return new Date(`${day}T00:00:00`).toLocaleDateString("en-AU", {
    month: "short",
    day: "numeric",
  });
}

function formatLastActive(value: string | null) {
  if (!value) return "No recorded visit";
  return new Date(value).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function MetricCard({
  label,
  metric,
  icon: Icon,
}: {
  label: string;
  metric: { current: number; previous: number };
  icon: typeof Activity;
}) {
  const difference = metric.current - metric.previous;
  const comparison =
    difference === 0
      ? "No change from previous period"
      : `${difference > 0 ? "+" : ""}${difference} from previous period`;

  return (
    <Card>
      <CardHeader className="space-y-2 pb-4">
        <div className="flex items-center justify-between gap-3">
          <CardDescription>{label}</CardDescription>
          <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </div>
        <CardTitle className="text-3xl tabular-nums">
          {metric.current}
        </CardTitle>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          {difference === 0 ? (
            <Minus className="h-3 w-3" aria-hidden="true" />
          ) : null}
          {comparison}
        </p>
      </CardHeader>
    </Card>
  );
}

function EmptyTableRow({
  children,
  columns,
}: {
  children: string;
  columns: number;
}) {
  return (
    <TableRow>
      <TableCell
        colSpan={columns}
        className="py-8 text-center text-muted-foreground"
      >
        {children}
      </TableCell>
    </TableRow>
  );
}

function SubmissionSummary({
  data,
}: {
  data: ApiAnalyticsSummary["submissions"];
}) {
  const metrics = [
    ["Logged", data.logged],
    ["Accepted", data.accepted],
    ["Rejected", data.rejected],
    ["Withdrawn", data.withdrawn],
    ["Awaiting decision", data.awaitingDecision],
    [
      "Acceptance rate",
      data.acceptanceRate === null ? "—" : `${data.acceptanceRate}%`,
    ],
    [
      "Median decision time",
      data.medianDecisionDays === null
        ? "—"
        : `${data.medianDecisionDays} days`,
    ],
    [
      "Oldest awaiting",
      data.oldestAwaitingDays === null
        ? "—"
        : `${data.oldestAwaitingDays} days`,
    ],
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
      {metrics.map(([label, value]) => (
        <div key={label}>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
        </div>
      ))}
    </div>
  );
}

export default function UsagePage() {
  const workspace = useCurrentWorkspace();
  const tenantId = workspace.data?.id ?? "";
  const isOwner = workspace.data?.membershipRole === "owner";
  const [days, setDays] = useState(30);
  const summary = useAnalyticsSummary(tenantId, days, isOwner);

  if (workspace.isPending) {
    return <LoadingState title="Loading workspace" className="min-h-[50vh]" />;
  }

  if (!isOwner) {
    return (
      <div className="page-stack">
        <PageHeading
          icon={Activity}
          tone="cyan"
          eyebrow="Insights"
          title="Usage"
          description="Research progress and workspace activity."
        />
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <ShieldAlert className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Only the workspace owner can view usage analytics.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (summary.isPending) {
    return <LoadingState title="Loading insights" className="min-h-[50vh]" />;
  }

  if (summary.isError) {
    return (
      <ErrorState
        title="Insights could not be loaded"
        description={summary.error.message}
        onRetry={() => void summary.refetch()}
      />
    );
  }

  const data = summary.data;
  const maxDailyVisits = Math.max(
    1,
    ...data.team.dailyActivity.map((row) => row.pageVisits),
  );
  const maxPipelineCount = Math.max(
    1,
    ...data.pipelineNow.map((row) => row.papers),
  );
  const awardedFunding =
    data.work.fundingByStatus.find((row) => row.status === "Awarded")
      ?.applications ?? 0;
  const unsuccessfulFunding =
    data.work.fundingByStatus.find((row) => row.status === "Unsuccessful")
      ?.applications ?? 0;
  const decidedFunding = awardedFunding + unsuccessfulFunding;
  const fundingSuccessRate =
    decidedFunding === 0
      ? null
      : Math.round((awardedFunding / decidedFunding) * 100);

  const headlineCards = [
    ["Papers moved stage", data.headlines.papersMoved, FileText],
    ["Submissions logged", data.headlines.submissionsLogged, FileCheck2],
    ["Accepted", data.headlines.accepted, CheckCircle2],
    ["Rejected", data.headlines.rejected, FileText],
    ["Revision requests", data.headlines.revisionRequests, ArrowRight],
    ["Tasks completed", data.headlines.tasksCompleted, ListChecks],
    ["Active members", data.headlines.activeMembers, Users],
  ] as const;

  return (
    <div className="page-stack">
      <PageHeading
        icon={Activity}
        tone="cyan"
        eyebrow="Insights"
        title="Usage"
        description="Research progress, outstanding work and workspace activity. Visible only to the workspace owner."
        actions={
          <Select
            value={String(days)}
            onValueChange={(value) => setDays(Number(value))}
          >
            <SelectTrigger className="w-44" aria-label="Time window">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WINDOW_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <section
        aria-labelledby="progress-overview-heading"
        className="space-y-4"
      >
        <div>
          <h2 id="progress-overview-heading" className="text-lg font-semibold">
            Progress overview
          </h2>
          <p className="text-sm text-muted-foreground">
            Activity in the selected period, compared with the preceding period
            of the same length.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {headlineCards.map(([label, metric, icon]) => (
            <MetricCard key={label} label={label} metric={metric} icon={icon} />
          ))}
        </div>
      </section>

      <section aria-labelledby="pipeline-heading" className="space-y-4">
        <div>
          <h2 id="pipeline-heading" className="text-lg font-semibold">
            Paper pipeline
          </h2>
          <p className="text-sm text-muted-foreground">
            Current distribution and recorded stage movements during the
            selected period.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline now</CardTitle>
              <CardDescription>
                Papers and median days in their current stage.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.pipelineNow.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No pipeline stages are available.
                </p>
              ) : (
                data.pipelineNow.map((row) => (
                  <div key={row.stage} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate font-medium">{row.stage}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {row.papers} paper{row.papers === 1 ? "" : "s"}
                        {row.medianDays === null
                          ? ""
                          : ` · ${row.medianDays}d median`}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width: `${(row.papers / maxPipelineCount) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Stage movements</CardTitle>
              <CardDescription>
                Distinct papers moving from one stage to another.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead className="text-right">Papers</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.stageMovements.length === 0 ? (
                    <EmptyTableRow columns={3}>
                      No stage movements have been recorded in this period.
                    </EmptyTableRow>
                  ) : (
                    data.stageMovements.map((row) => (
                      <TableRow key={`${row.fromStage}-${row.toStage}`}>
                        <TableCell>{row.fromStage}</TableCell>
                        <TableCell>{row.toStage}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.papers}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </section>

      <section aria-labelledby="submissions-heading" className="space-y-4">
        <div>
          <h2 id="submissions-heading" className="text-lg font-semibold">
            Submissions and decisions
          </h2>
          <p className="text-sm text-muted-foreground">
            Journal activity and current outstanding decisions.
          </p>
        </div>
        <Card>
          <CardContent className="space-y-6 pt-6">
            <SubmissionSummary data={data.submissions} />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Journal</TableHead>
                  <TableHead className="text-right">Submissions</TableHead>
                  <TableHead className="text-right">Accepted</TableHead>
                  <TableHead className="text-right">Rejected</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.submissions.journals.length === 0 ? (
                  <EmptyTableRow columns={4}>
                    No submissions in this period.
                  </EmptyTableRow>
                ) : (
                  data.submissions.journals.map((row) => (
                    <TableRow key={row.journal}>
                      <TableCell className="font-medium">
                        {row.journal}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.submissions}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.accepted}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.rejected}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="work-heading" className="space-y-4">
        <div>
          <h2 id="work-heading" className="text-lg font-semibold">
            Waiting and upcoming work
          </h2>
          <p className="text-sm text-muted-foreground">
            Where papers are waiting, workload and approaching deadlines.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>Currently with</CardTitle>
              <CardDescription>
                Current holder across active papers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.currentlyWith.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No active papers.
                </p>
              ) : (
                data.currentlyWith.map((row) => (
                  <div
                    key={row.holder}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span>{HOLDER_LABELS[row.holder] ?? row.holder}</span>
                    <span className="font-semibold tabular-nums">
                      {row.papers}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Paper status</CardTitle>
              <CardDescription>
                Current status across active papers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.paperStatuses.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No active papers.
                </p>
              ) : (
                data.paperStatuses.map((row) => (
                  <div
                    key={row.status}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span>{row.status}</span>
                    <span className="font-semibold tabular-nums">
                      {row.papers}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tasks</CardTitle>
              <CardDescription>
                Work created and completed in this period.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              {[
                ["Created", data.work.tasksCreated],
                ["Completed", data.work.tasksCompleted],
                ["Overdue", data.work.overdueTasks],
                ["Open hours", data.work.estimatedOpenHours],
                [
                  "Median completion",
                  data.work.medianTaskCompletionDays === null
                    ? "—"
                    : `${data.work.medianTaskCompletionDays}d`,
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">
                    {value}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upcoming deadlines</CardTitle>
              <CardDescription>Due during the next 30 days.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span>Funding applications</span>
                <span className="font-semibold tabular-nums">
                  {data.work.fundingDeadlines}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span>Conference submissions</span>
                <span className="font-semibold tabular-nums">
                  {data.work.conferenceDeadlines}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span>Conferences added in period</span>
                <span className="font-semibold tabular-nums">
                  {data.work.conferencesAdded}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span>Linked conference papers</span>
                <span className="font-semibold tabular-nums">
                  {data.work.conferencePaperLinks}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Funding pipeline</CardTitle>
              <CardDescription>
                Current applications by status
                {fundingSuccessRate === null
                  ? "."
                  : ` · ${fundingSuccessRate}% success rate.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Applications</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.work.fundingByStatus.length === 0 ? (
                    <EmptyTableRow columns={2}>
                      No funding records.
                    </EmptyTableRow>
                  ) : (
                    data.work.fundingByStatus.map((row) => (
                      <TableRow key={row.status}>
                        <TableCell>{row.status}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.applications}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Funding awarded</CardTitle>
              <CardDescription>
                Awarded amounts grouped by currency.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Currency</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.work.awardedByCurrency.length === 0 ? (
                    <EmptyTableRow columns={2}>
                      No awarded funding recorded.
                    </EmptyTableRow>
                  ) : (
                    data.work.awardedByCurrency.map((row) => (
                      <TableRow key={row.currency}>
                        <TableCell>{row.currency}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.amount.toLocaleString("en-AU")}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </section>

      <section aria-labelledby="team-heading" className="space-y-4">
        <div>
          <h2 id="team-heading" className="text-lg font-semibold">
            Team activity
          </h2>
          <p className="text-sm text-muted-foreground">
            Page visits and research records created by workspace members.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Active members over time</CardTitle>
            <CardDescription>
              Daily members and page visits across {data.team.registeredMembers}{" "}
              registered member
              {data.team.registeredMembers === 1 ? "" : "s"}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.team.dailyActivity.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No page visits recorded in this period.
              </p>
            ) : (
              <div
                role="img"
                aria-label="Daily page visits and active members"
                className="flex h-44 items-end gap-2 overflow-x-auto"
              >
                {data.team.dailyActivity.map((row) => (
                  <div
                    key={row.day}
                    title={`${formatDay(row.day)}: ${row.activeMembers} active member${row.activeMembers === 1 ? "" : "s"}, ${row.pageVisits} page visit${row.pageVisits === 1 ? "" : "s"}`}
                    className="flex min-w-8 flex-1 flex-col items-center justify-end gap-2"
                  >
                    <span className="text-[10px] tabular-nums text-muted-foreground">
                      {row.activeMembers}
                    </span>
                    <div
                      className="w-full rounded-t bg-primary/70"
                      style={{
                        height: `${Math.max(4, (row.pageVisits / maxDailyVisits) * 110)}px`,
                      }}
                    />
                    <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                      {formatDay(row.day)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Pages used</CardTitle>
              <CardDescription>
                Visits and member adoption in this period.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Page</TableHead>
                    <TableHead className="text-right">Visits</TableHead>
                    <TableHead className="text-right">Members</TableHead>
                    <TableHead className="text-right">Adoption</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.team.pages.length === 0 ? (
                    <EmptyTableRow columns={4}>
                      No page visits recorded.
                    </EmptyTableRow>
                  ) : (
                    data.team.pages.map((row) => (
                      <TableRow key={row.page}>
                        <TableCell className="font-medium">
                          {PAGE_LABELS[row.page] ?? row.page.replace(/_/g, " ")}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.visits}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.members}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.adoptionPercent}%
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Member activity</CardTitle>
              <CardDescription>
                Sessions, visits and records added in this period.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead className="text-right">Uses</TableHead>
                    <TableHead className="text-right">Visits</TableHead>
                    <TableHead className="text-right">Projects</TableHead>
                    <TableHead className="text-right">Papers</TableHead>
                    <TableHead className="text-right">Tasks</TableHead>
                    <TableHead className="text-right">Notes</TableHead>
                    <TableHead>Last active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.team.members.length === 0 ? (
                    <EmptyTableRow columns={8}>
                      No registered members.
                    </EmptyTableRow>
                  ) : (
                    data.team.members.map((member) => (
                      <TableRow key={member.userId}>
                        <TableCell>
                          <div className="font-medium">{member.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {member.email}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {member.sessions}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {member.pageVisits}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {member.projectsAdded}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {member.papersAdded}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {member.tasksAdded}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {member.notesAdded}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatLastActive(member.lastActive)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </section>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
        Uses are distinct 30-minute sessions. Progress history begins when this
        release is deployed.
      </p>
    </div>
  );
}
