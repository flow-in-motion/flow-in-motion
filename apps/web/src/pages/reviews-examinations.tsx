import { ClipboardList, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useCurrentWorkspace, useMe } from "@/api/hooks";
import {
  useDeleteReview,
  useReviews,
  type ReviewKind,
  type ReviewSummary,
} from "@/api/reviews";
import { recordTitle, reviewDate } from "@/components/reviews/review-fields";
import { ReviewRecordDialog } from "@/components/reviews/review-record-dialog";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { SearchInput } from "@/components/shared/search-input";
import { PageHeading } from "@/components/typography/heading";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useListSearch } from "@/hooks/use-list-search";

function ReviewTable({
  tenantId,
  userId,
  kind,
}: {
  tenantId: string;
  userId: string;
  kind: ReviewKind;
}) {
  const heading = kind === "examination" ? "HDR examinations" : "Reviews";
  const { search, setSearch, requestSearch, page, setPage } = useListSearch(
    {
      userId,
      workspaceId: tenantId,
      preferenceKey: `academic-reviews-${kind}`,
    },
    300,
  );
  const [pageSize, setPageSize] = useState<number | "all">(20);
  const [selected, setSelected] = useState<{ id?: string; edit?: boolean }>();
  const [error, setError] = useState<string | null>(null);
  const query = useReviews(tenantId, kind, {
    page,
    pageSize,
    search: requestSearch,
  });
  const remove = useDeleteReview(tenantId, kind);
  const columns =
    kind === "examination"
      ? [
          "Student name",
          "University",
          "Degree type",
          "Date request received",
          "Due date for review",
        ]
      : [
          "Manuscript title",
          "Journal name",
          "Manuscript reference",
          "Date request received",
          "Due date",
          "Journal ranking",
        ];
  async function deleteRecord(row: ReviewSummary) {
    if (
      !window.confirm(
        `Delete "${recordTitle(row)}" and its notes? This cannot be undone.`,
      )
    )
      return;
    setError(null);
    try {
      await remove.mutateAsync(row.id);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "This record could not be deleted.",
      );
    }
  }
  return (
    <section aria-label={heading} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{heading}</h2>
        <Button onClick={() => setSelected({})}>
          <Plus className="h-4 w-4" />
          {kind === "examination" ? "Add examination" : "Add review"}
        </Button>
      </div>
      <SearchInput
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onClear={() => setSearch("")}
        clearLabel={`Clear ${heading.toLowerCase()} search`}
        aria-label={`Search ${heading.toLowerCase()}`}
        placeholder={`Search ${heading.toLowerCase()}…`}
        maxLength={200}
        className="sm:max-w-sm"
      />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {query.isPending ? (
        <LoadingState
          title={`Loading ${heading.toLowerCase()}`}
          layout="list"
        />
      ) : query.isError ? (
        <ErrorState
          title={`${heading} could not be loaded`}
          description={query.error.message}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <>
          <Table aria-label={heading}>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead key={column}>{column}</TableHead>
                ))}
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.data.length ? (
                query.data.data.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="min-w-48">
                      <button
                        type="button"
                        className="text-left font-medium hover:underline"
                        onClick={() => setSelected({ id: row.id })}
                      >
                        {recordTitle(row)}
                      </button>
                    </TableCell>
                    <TableCell>
                      {kind === "examination"
                        ? row.universityName || "—"
                        : row.journalName || "—"}
                    </TableCell>
                    <TableCell>
                      {kind === "examination"
                        ? row.degreeType || "—"
                        : row.manuscriptReference || "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {reviewDate(row.requestedOn)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {reviewDate(row.dueOn)}
                    </TableCell>
                    {kind === "journal" ? (
                      <TableCell>{row.journalRanking || "—"}</TableCell>
                    ) : null}
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${recordTitle(row)}`}
                          onClick={() =>
                            setSelected({ id: row.id, edit: true })
                          }
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${recordTitle(row)}`}
                          disabled={remove.isPending}
                          onClick={() => void deleteRecord(row)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length + 1}
                    className="py-10 text-center text-muted-foreground"
                  >
                    {requestSearch
                      ? "No matching records."
                      : `No ${heading.toLowerCase()} yet.`}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <PaginationControls
            {...query.data.meta}
            selectedPageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            isPending={query.isFetching}
          />
        </>
      )}
      {selected ? (
        <ReviewRecordDialog
          tenantId={tenantId}
          kind={kind}
          id={selected.id}
          edit={selected.edit}
          onClose={() => setSelected(undefined)}
        />
      ) : null}
    </section>
  );
}

export default function ReviewsExaminationsPage() {
  const workspace = useCurrentWorkspace();
  const me = useMe();
  if (workspace.isPending || me.isPending)
    return <LoadingState title="Loading reviews" layout="list" />;
  if (!workspace.data || !me.data)
    return (
      <ErrorState
        title="Reviews could not be loaded"
        description="Your account or workspace could not be loaded."
        onRetry={() => {
          void workspace.refetch();
          void me.refetch();
        }}
      />
    );
  return (
    <div className="space-y-6">
      <PageHeading title="Reviews, HDR examinations" icon={ClipboardList} />
      <p className="text-sm text-muted-foreground">Private to your account.</p>
      <ReviewTable
        key={`${workspace.data.id}:${me.data.id}:examination`}
        tenantId={workspace.data.id}
        userId={me.data.id}
        kind="examination"
      />
      <ReviewTable
        key={`${workspace.data.id}:${me.data.id}:journal`}
        tenantId={workspace.data.id}
        userId={me.data.id}
        kind="journal"
      />
    </div>
  );
}
