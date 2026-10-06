import { DollarSign, Pencil, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  type ApiFunding,
  type FundingInput,
  useCreateFunding,
  useCurrentWorkspace,
  useDeleteFunding,
  useFundings,
  useMe,
  useUpdateFunding,
} from "@/api/hooks";
import { ColumnVisibilityMenu } from "@/components/dashboard/column-visibility-menu";
import { FundingDialog } from "@/components/funding/funding-dialog";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { PageHeading } from "@/components/typography/heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { paperDisplayTitle } from "@/lib/paper-title";

const FUNDING_COLUMNS = [
  { id: "fundingBody", label: "Funding Body", width: "minmax(220px,1.5fr)" },
  { id: "scheme", label: "Scheme", width: "minmax(180px,1.2fr)" },
  { id: "partners", label: "Partners", width: "minmax(180px,1.2fr)" },
  { id: "amount", label: "Amount", width: "130px" },
  { id: "deadline", label: "Deadline", width: "140px" },
  { id: "status", label: "Status", width: "130px" },
  {
    id: "links",
    label: "Linked Projects/Papers",
    width: "minmax(220px,1.4fr)",
  },
] as const;

function formatDate(value: string | null) {
  if (!value) return "—";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function formatAmount(amount: string | null, currency: string | null) {
  if (!amount) return "—";
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount))
    return [currency, amount].filter(Boolean).join(" ");
  if (currency) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(numericAmount);
    } catch {
      return `${currency} ${numericAmount.toLocaleString()}`;
    }
  }
  return numericAmount.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function FundingPage() {
  const workspace = useCurrentWorkspace();
  const tenantId = workspace.data?.id ?? "";
  const meQuery = useMe();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "all">(20);
  const [search, setSearch] = useState("");
  const [requestSearch, setRequestSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingFunding, setEditingFunding] = useState<ApiFunding | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fundingsQuery = useFundings(tenantId, page, true, {
    pageSize,
    search: requestSearch,
  });
  const createFunding = useCreateFunding(tenantId);
  const updateFunding = useUpdateFunding(tenantId);
  const deleteFunding = useDeleteFunding(tenantId);
  const fundings = fundingsQuery.data?.data ?? [];
  const paginationMeta = fundingsQuery.data?.meta;

  const columns = useColumnVisibility(
    FUNDING_COLUMNS.map((column) => column.id),
    "funding",
  );
  const gridTemplate = FUNDING_COLUMNS.filter((column) =>
    columns.visibleColumns.has(column.id),
  )
    .map((column) => column.width)
    .join(" ");

  useEffect(() => {
    const trimmedSearch = search.trim();
    const timer = window.setTimeout(() => setRequestSearch(trimmedSearch), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [tenantId, requestSearch, pageSize]);

  async function handleCreate(input: FundingInput) {
    setActionError(null);
    await createFunding.mutateAsync(input);
  }

  async function handleUpdate(input: FundingInput) {
    if (!editingFunding) return;
    setActionError(null);
    await updateFunding.mutateAsync({ fundingId: editingFunding.id, input });
    setEditingFunding(null);
  }

  async function handleDelete(funding: ApiFunding) {
    if (
      !window.confirm(
        `Delete the funding record for "${funding.fundingBody}"? This action cannot be undone.`,
      )
    )
      return;
    setActionError(null);
    try {
      await deleteFunding.mutateAsync(funding.id);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "The funding record could not be deleted.",
      );
    }
  }

  if (workspace.isPending || fundingsQuery.isPending || meQuery.isPending) {
    return <LoadingState title="Loading funding" className="min-h-[50vh]" />;
  }

  if (fundingsQuery.isError) {
    return (
      <ErrorState
        title="Funding could not be loaded"
        description={fundingsQuery.error.message}
        onRetry={() => void fundingsQuery.refetch()}
      />
    );
  }

  return (
    <div className="page-stack">
      <PageHeading
        icon={DollarSign}
        tone="emerald"
        eyebrow="Planning"
        title="Funding"
        description="Track funding opportunities and connect them to your projects and papers."
        actions={
          <Button onClick={() => setIsCreateOpen(true)}>Add Funding</Button>
        }
      />

      <FundingDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        tenantId={tenantId}
        onSave={handleCreate}
      />
      <FundingDialog
        open={editingFunding !== null}
        onOpenChange={(open) => {
          if (!open) setEditingFunding(null);
        }}
        tenantId={tenantId}
        funding={editingFunding}
        onSave={handleUpdate}
      />

      {actionError ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <span>{actionError}</span>
          <button
            type="button"
            className="font-medium underline"
            onClick={() => setActionError(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="surface-toolbar flex flex-wrap items-center gap-3">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search funding, partners, projects, or papers…"
            className="pr-9"
          />
          {search ? (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setRequestSearch("");
              }}
              aria-label="Clear funding search"
              className="absolute right-1 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <ColumnVisibilityMenu
          columns={FUNDING_COLUMNS}
          visibleColumns={columns.visibleColumns}
          onToggle={columns.toggleColumn}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border bg-muted/20 p-1">
        <div className="min-w-[1120px]">
          <div
            className="grid gap-4 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            {FUNDING_COLUMNS.filter((column) =>
              columns.visibleColumns.has(column.id),
            ).map((column) => (
              <span key={column.id}>{column.label}</span>
            ))}
          </div>

          <div className="flex flex-col gap-1">
            {fundings.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                {requestSearch
                  ? "No funding records match your search."
                  : "No funding records have been added yet."}
              </div>
            ) : (
              fundings.map((funding) => {
                const canManage = funding.ownerUserId === meQuery.data?.id;
                return (
                  <div
                    key={funding.id}
                    className="grid items-center gap-4 rounded-md border border-transparent bg-card px-4 py-3.5 transition-colors hover:bg-muted/45"
                    style={{ gridTemplateColumns: gridTemplate }}
                  >
                    {columns.isColumnVisible("fundingBody") ? (
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-foreground">
                          {funding.fundingBody}
                        </span>
                        {canManage ? (
                          <span className="flex shrink-0">
                            <button
                              type="button"
                              aria-label={`Edit ${funding.fundingBody}`}
                              title="Edit funding"
                              onClick={() => setEditingFunding(funding)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Delete ${funding.fundingBody}`}
                              title="Delete funding"
                              onClick={() => void handleDelete(funding)}
                              disabled={deleteFunding.isPending}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    {columns.isColumnVisible("scheme") ? (
                      <span className="text-sm text-muted-foreground">
                        {funding.scheme ?? "—"}
                      </span>
                    ) : null}
                    {columns.isColumnVisible("partners") ? (
                      <span className="line-clamp-2 text-sm text-muted-foreground">
                        {funding.partners ?? "—"}
                      </span>
                    ) : null}
                    {columns.isColumnVisible("amount") ? (
                      <span className="text-sm font-medium tabular-nums">
                        {formatAmount(funding.amount, funding.currency)}
                      </span>
                    ) : null}
                    {columns.isColumnVisible("deadline") ? (
                      <span className="text-sm text-muted-foreground">
                        {formatDate(funding.applicationDeadline)}
                      </span>
                    ) : null}
                    {columns.isColumnVisible("status") ? (
                      <Badge variant="outline">{funding.status ?? "—"}</Badge>
                    ) : null}
                    {columns.isColumnVisible("links") ? (
                      <div className="flex flex-wrap gap-1">
                        {funding.projects.map((project) => (
                          <Link
                            key={`project-${project.id}`}
                            to={`/projects/${project.id}`}
                            className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary ring-1 ring-inset ring-primary/15 hover:bg-primary/15 hover:underline"
                          >
                            {project.displayId ?? project.title}
                          </Link>
                        ))}
                        {funding.papers.map((paper) => (
                          <Link
                            key={`paper-${paper.id}`}
                            to={`/modules/${paper.id}`}
                            className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary ring-1 ring-inset ring-primary/15 hover:bg-primary/15 hover:underline"
                          >
                            {paper.displayId ?? paperDisplayTitle(paper)}
                          </Link>
                        ))}
                        {funding.projects.length === 0 &&
                        funding.papers.length === 0 ? (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>

          {paginationMeta ? (
            <PaginationControls
              page={paginationMeta.page}
              pageSize={paginationMeta.pageSize}
              totalItems={paginationMeta.totalItems}
              totalPages={paginationMeta.totalPages}
              selectedPageSize={pageSize}
              isPending={fundingsQuery.isFetching}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
