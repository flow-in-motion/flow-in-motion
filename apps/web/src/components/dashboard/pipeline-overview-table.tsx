import { useMemo, useState } from "react";
import { Table2 } from "lucide-react";
import { Link } from "react-router-dom";

import { useCurrentWorkspace, useModulePipelineStagePool, useModules, useTasks } from "@/api/hooks";
import {
  PipelineBar,
  PipelineStageRuler,
} from "@/components/dashboard/pipeline-bar";
import { ColumnVisibilityMenu } from "@/components/dashboard/column-visibility-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { paperDisplayTitle } from "@/lib/paper-title";
import { cn } from "@/lib/utils";
import { useColumnVisibility } from "@/hooks/use-column-visibility";

const PIPELINE_COLUMNS = [
  { id: "paper", label: "Paper" },
  { id: "pipeline", label: "Stage Bar" },
  { id: "completion", label: "Progress" },
] as const;

export function PipelineOverviewTable() {
  const workspace = useCurrentWorkspace();
  const tenantId = workspace.data?.id ?? "";
  const modulesQuery = useModules(tenantId);
  const papers = modulesQuery.data?.data ?? [];
  const tasksQuery = useTasks(tenantId);
  const tasks = tasksQuery.data?.data ?? [];
  const pipelineStagesQuery = useModulePipelineStagePool(tenantId);

  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("All");
  const [compactPipeline, setCompactPipeline] = useState(true);
  const columns = useColumnVisibility(
    PIPELINE_COLUMNS.map((column) => column.id),
    "dashboard-pipeline",
  );

  const stages = useMemo(
    () =>
      [...(pipelineStagesQuery.data ?? [])]
        .filter((s) => !s.hidden)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [pipelineStagesQuery.data],
  );
  const stageNames = stages.map((s) => s.value);
  const stageFilterOptions = ["All", "Unassigned", ...stageNames];
  const stageIndexByValue = useMemo(() => {
    const map = new Map<string, number>();
    stages.forEach((s, index) => map.set(s.value, index));
    return map;
  }, [stages]);
  const pipelineWidth = compactPipeline ? undefined : `${Math.max(1280, stageNames.length * 128)}px`;

  const taskCountByPaper = useMemo(() => {
    const counts = new Map<string, { completed: number; total: number }>();
    for (const task of tasks) {
      if (!task.moduleId) continue;
      const entry = counts.get(task.moduleId) ?? { completed: 0, total: 0 };
      entry.total += 1;
      if (task.status === "Complete") entry.completed += 1;
      counts.set(task.moduleId, entry);
    }
    return counts;
  }, [tasks]);

  const paperRows = useMemo(
    () =>
      papers.map((paper) => {
          const counts = taskCountByPaper.get(paper.id) ?? { completed: 0, total: 0 };
          const stageIndex = paper.pipelineStage
            ? stageIndexByValue.get(paper.pipelineStage)
            : undefined;
          return {
            id: paper.id,
            name: paperDisplayTitle(paper),
            stageIndex,
            completion: counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0,
          };
        }),
    [papers, taskCountByPaper, stageIndexByValue],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return paperRows.filter((row) => {
      const rowStage = row.stageIndex === undefined ? "Unassigned" : stageNames[row.stageIndex];
      if (stage !== "All" && rowStage !== stage) return false;
      if (query && !row.name.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [paperRows, search, stage, stageNames]);

  const hasActiveFilters = search !== "" || stage !== "All";

  function clearFilters() {
    setSearch("");
    setStage("All");
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-4 border-b border-primary/10 bg-gradient-to-r from-accent/60 via-card/80 to-card">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Table2 className="h-4 w-4 text-violet-600" />
            Pipeline Paper Overview
          </CardTitle>
          <CardDescription>
            Every paper&rsquo;s individual position on the pipeline, searchable and filterable by stage.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search paper…"
            className="sm:max-w-xs"
          />
          <Select
            value={stage}
            onValueChange={setStage}
          >
            <SelectTrigger className="sm:w-44">
              <SelectValue placeholder="Stage" />
            </SelectTrigger>
            <SelectContent>
              {stageFilterOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option === "All" ? "All stages" : option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCompactPipeline((current) => !current)}
          >
            {compactPipeline ? "Expand pipeline" : "Fit pipeline"}
          </Button>
          <ColumnVisibilityMenu
            columns={PIPELINE_COLUMNS}
            visibleColumns={columns.visibleColumns}
            onToggle={columns.toggleColumn}
          />
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="pt-[var(--card-padding)]">
        <Table className={compactPipeline ? "table-fixed" : undefined}>
          <TableHeader>
            <TableRow>
              {columns.isColumnVisible("paper") ? <TableHead style={compactPipeline ? { width: "25%" } : undefined}>Paper</TableHead> : null}
              {columns.isColumnVisible("pipeline") ? (
                <TableHead style={{ minWidth: pipelineWidth }}>
                  <PipelineStageRuler stages={stageNames} compact={compactPipeline} />
                </TableHead>
              ) : null}
              {columns.isColumnVisible("completion") ? (
                <TableHead style={compactPipeline ? { width: "15%" } : undefined}>Progress</TableHead>
              ) : null}
            </TableRow>
          </TableHeader>

          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.visibleColumns.size}
                  className="h-24 text-center text-muted-foreground"
                >
                  No papers match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow key={row.id}>
                  {columns.isColumnVisible("paper") ? (
                    <TableCell
                      className={cn("max-w-[220px] truncate font-medium")}
                      title={row.name}
                    >
                      <Link
                        to={`/modules/${row.id}`}
                        className="text-primary hover:underline"
                      >
                        {row.name}
                      </Link>
                    </TableCell>
                  ) : null}

                  {columns.isColumnVisible("pipeline") ? (
                    <TableCell style={{ minWidth: pipelineWidth }}>
                      {row.stageIndex === undefined ? (
                        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                          Unassigned — choose a stage in Papers
                        </Badge>
                      ) : (
                        <PipelineBar
                          stageIndex={row.stageIndex}
                          stageCount={stageNames.length}
                        />
                      )}
                    </TableCell>
                  ) : null}

                  {columns.isColumnVisible("completion") ? (
                    <TableCell className="tabular-nums text-muted-foreground">
                      {row.completion}%
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
