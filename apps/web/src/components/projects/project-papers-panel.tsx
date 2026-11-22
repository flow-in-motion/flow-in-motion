import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Link2, Plus, Unlink } from "lucide-react";

import { useModulePipelineStagePool, type ApiModule } from "@/api/hooks";
import { hasActiveSubmissionStage } from "@/components/modules/submission-stage";
import { PanelToggleButton } from "@/components/shared/linked-items-panels";
import { SortableHeader } from "@/components/shared/sortable-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { PaperLoggedTime } from "@/components/time-tracking/paper-logged-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatListDate } from "@/lib/list-format";
import { paperCurrentlyWithLabel } from "@/lib/paper-currently-with";
import { buildPaperProgressByStage } from "@/lib/paper-progress";
import { PAPER_STATUSES } from "@/lib/paper-status";
import { paperDisplayTitle } from "@/lib/paper-title";
import { priorityPillClass } from "@/lib/tones";

const COLUMNS = [
  ["paper", "Paper"],
  ["status", "Status"],
  ["priority", "Priority"],
  ["progress", "Progress"],
  ["stage", "Stage"],
  ["submittedTo", "Submitted to"],
  ["logged", "Logged"],
  ["due", "Next Action Date"],
  ["with", "Currently With"],
] as const;
type SortColumn = (typeof COLUMNS)[number][0];
const PRIORITIES = ["Low", "Medium", "High", "Critical"];
const submissionVenue = (paper: ApiModule) =>
  hasActiveSubmissionStage(paper.pipelineStage)
    ? (paper.submittedToJournal?.trim() ?? "")
    : "";

export function ProjectPapersPanel({
  tenantId,
  modules,
  currentUserId,
  visible,
  onToggleVisible,
  onAddModule,
  onLinkExisting,
  onUnlinkModule,
  loading = false,
  error = false,
  onRetry,
}: {
  tenantId: string;
  modules: ApiModule[];
  currentUserId?: string;
  visible: boolean;
  onToggleVisible: () => void;
  onAddModule: () => void;
  onLinkExisting: () => void;
  onUnlinkModule: (paper: ApiModule) => void;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}) {
  const [sortColumn, setSortColumn] = useState<SortColumn>("paper");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const stages = useModulePipelineStagePool(
    tenantId,
    visible && modules.length > 0,
  );
  const progress = useMemo(
    () =>
      buildPaperProgressByStage(
        [...(stages.data ?? [])]
          .filter((stage) => !stage.hidden)
          .sort((a, b) => a.sortOrder - b.sortOrder),
      ),
    [stages.data],
  );
  const percent = (paper: ApiModule) =>
    progress.get(paper.pipelineStage ?? "") ?? 0;
  function handleSort(column: SortColumn) {
    if (sortColumn === column)
      setSortDirection((value) => (value === "asc" ? "desc" : "asc"));
    else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  }
  function compare(a: ApiModule, b: ApiModule) {
    const text = (left: string, right: string) =>
      left.localeCompare(right, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    const rank = (values: readonly string[], value: string | null) => {
      const index = values.indexOf(value ?? "");
      return index < 0 ? values.length : index;
    };
    switch (sortColumn) {
      case "paper":
        return text(paperDisplayTitle(a), paperDisplayTitle(b));
      case "status":
        return rank(PAPER_STATUSES, a.status) - rank(PAPER_STATUSES, b.status);
      case "priority":
        return rank(PRIORITIES, a.priority) - rank(PRIORITIES, b.priority);
      case "progress":
        return percent(a) - percent(b);
      case "stage":
        return text(a.pipelineStage ?? "", b.pipelineStage ?? "");
      case "submittedTo":
        return text(submissionVenue(a), submissionVenue(b));
      case "logged":
        return (a.loggedSeconds ?? 0) - (b.loggedSeconds ?? 0);
      case "due":
        return text(a.dueDate ?? "", b.dueDate ?? "");
      case "with":
        return text(
          paperCurrentlyWithLabel(a, currentUserId),
          paperCurrentlyWithLabel(b, currentUserId),
        );
    }
  }
  const sorted = [...modules].sort(
    (a, b) =>
      compare(a, b) * (sortDirection === "asc" ? 1 : -1) ||
      paperDisplayTitle(a).localeCompare(paperDisplayTitle(b)) ||
      a.id.localeCompare(b.id),
  );
  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle>Papers ({modules.length})</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={onLinkExisting}>
            <Link2 />
            Link existing
          </Button>
          <Button variant="outline" size="sm" onClick={onAddModule}>
            <Plus />
            Add paper
          </Button>
          <PanelToggleButton
            visible={visible}
            onToggle={onToggleVisible}
            label="papers"
            controls="project-papers-content"
          />
        </div>
      </CardHeader>
      {visible ? (
        <CardContent id="project-papers-content">
          {loading ? (
            <p role="status" className="text-sm text-muted-foreground">
              Loading papers…
            </p>
          ) : error ? (
            <div role="alert" className="text-sm text-destructive">
              Papers could not be loaded.{" "}
              <Button variant="outline" size="sm" onClick={onRetry}>
                Retry
              </Button>
            </div>
          ) : !modules.length ? (
            <p className="text-sm text-muted-foreground">
              No papers are linked to this project.
            </p>
          ) : (
            <Table aria-label="Project papers">
              <TableHeader>
                <TableRow>
                  {COLUMNS.map(([column, label]) => (
                    <TableHead
                      key={column}
                      aria-sort={
                        sortColumn === column
                          ? sortDirection === "asc"
                            ? "ascending"
                            : "descending"
                          : undefined
                      }
                    >
                      <SortableHeader
                        label={label}
                        column={column}
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      />
                    </TableHead>
                  ))}
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((paper) => (
                  <TableRow key={paper.id}>
                    <TableCell className="min-w-56 max-w-sm">
                      <Link
                        to={`/modules/${paper.id}`}
                        className="font-semibold hover:text-primary hover:underline"
                      >
                        {paper.displayId ? (
                          <span className="block font-mono text-[10px] text-muted-foreground">
                            {paper.displayId}
                          </span>
                        ) : null}
                        {paperDisplayTitle(paper)}
                      </Link>
                      {paper.description ? (
                        <p className="line-clamp-3 break-words text-xs text-muted-foreground">
                          {paper.description}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={paper.status ?? "—"} />
                    </TableCell>
                    <TableCell>
                      {paper.priority ? (
                        <Badge
                          variant="outline"
                          className={priorityPillClass(paper.priority)}
                        >
                          {paper.priority}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="min-w-24">
                      <div className="flex flex-col gap-1">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${percent(paper)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {percent(paper)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{paper.pipelineStage || "Unassigned"}</TableCell>
                    <TableCell className="min-w-36">
                      {submissionVenue(paper) || "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <PaperLoggedTime paper={paper} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatListDate(paper.dueDate)}
                    </TableCell>
                    <TableCell>
                      {paperCurrentlyWithLabel(paper, currentUserId)}
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => onUnlinkModule(paper)}
                        aria-label={`Unlink ${paperDisplayTitle(paper)} from this project`}
                        title="Unlink"
                        className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Unlink className="h-3.5 w-3.5" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      ) : null}
    </Card>
  );
}
