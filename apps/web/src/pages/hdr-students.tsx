import { GraduationCap, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { useCurrentWorkspace, useMe } from "@/api/hooks";
import {
  useDeleteHdrPerson,
  useHdrPeople,
  useSaveHdrPerson,
  type HdrCategory,
  type HdrPerson,
  type HdrType,
} from "@/api/hdr";
import { HdrPersonDialog } from "@/components/hdr/hdr-person-dialog";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { SearchInput } from "@/components/shared/search-input";
import { PageHeading } from "@/components/typography/heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useListSearch } from "@/hooks/use-list-search";
import { paperDisplayTitle } from "@/lib/paper-title";

function HdrList({ tenantId, userId }: { tenantId: string; userId: string }) {
  const { search, setSearch, requestSearch, page, setPage } = useListSearch(
    { userId, workspaceId: tenantId, preferenceKey: "hdr" },
    300,
  );
  const [pageSize, setPageSize] = useState<number | "all">(20);
  const [type, setType] = useState<HdrType | "">("");
  const [category, setCategory] = useState<HdrCategory | "">("");
  const [editing, setEditing] = useState<HdrPerson | null | undefined>(
    undefined,
  );
  const [error, setError] = useState<string | null>(null);
  const query = useHdrPeople(tenantId, {
    page,
    pageSize,
    search: requestSearch,
    type: type || undefined,
    category: category || undefined,
  });
  const save = useSaveHdrPerson(tenantId);
  const remove = useDeleteHdrPerson(tenantId);

  async function deletePerson(person: HdrPerson) {
    if (
      !window.confirm(
        `Delete the HDR record for "${person.name}"? Linked papers and projects will not be deleted. This cannot be undone.`,
      )
    )
      return;
    setError(null);
    try {
      await remove.mutateAsync(person.id);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "This record could not be deleted.",
      );
    }
  }

  return (
    <div className="space-y-6">
      <PageHeading
        title="HDR students"
        icon={GraduationCap}
        description="Current and potential students, visiting scholars, and their linked work."
        actions={
          <Button onClick={() => setEditing(null)}>
            <Plus className="h-4 w-4" />
            Add student / scholar
          </Button>
        }
      />
      <p className="text-sm text-muted-foreground">
        Private to your account. Students and visitors cannot see these records.
      </p>
      {query.data ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            [
              "Current students",
              query.data.counts.currentStudents,
              "Current PhD and MRes students",
            ],
            [
              "Potential students",
              query.data.counts.potentialStudents,
              "Potential PhD and MRes students",
            ],
            [
              "Visiting scholars",
              query.data.counts.visitingScholars,
              "Current and potential visitors",
            ],
          ].map(([label, count, caption]) => (
            <Card key={label}>
              <CardHeader>
                <CardTitle>{label}</CardTitle>
                <p className="text-3xl font-semibold tabular-nums">{count}</p>
                <p className="text-xs text-muted-foreground">{caption}</p>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch("")}
          clearLabel="Clear HDR search"
          placeholder="Search students and scholars…"
          aria-label="Search students and scholars"
          maxLength={200}
          className="sm:max-w-sm"
        />
        <select
          aria-label="Filter by type"
          value={type}
          onChange={(e) => {
            setType(e.target.value as HdrType | "");
            setPage(1);
          }}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All types</option>
          <option>PhD</option>
          <option>MRes</option>
          <option>Visiting scholar</option>
        </select>
        <select
          aria-label="Filter by category"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value as HdrCategory | "");
            setPage(1);
          }}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All categories</option>
          <option>Current</option>
          <option>Potential</option>
        </select>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {query.isPending ? (
        <LoadingState title="Loading HDR records" layout="list" />
      ) : query.isError ? (
        <ErrorState
          title="HDR records could not be loaded"
          description={query.error.message}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Linked projects</TableHead>
                <TableHead>Linked papers</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.data.length ? (
                query.data.data.map((person) => (
                  <TableRow key={person.id}>
                    <TableCell className="min-w-48">
                      <button
                        type="button"
                        className="text-left font-medium hover:underline"
                        onClick={() => setEditing(person)}
                      >
                        {person.name}
                      </button>
                      {person.email ? (
                        <p className="text-xs text-muted-foreground">
                          {person.email}
                        </p>
                      ) : null}
                      {person.researchTopic ? (
                        <p className="mt-1 line-clamp-2 max-w-sm text-xs text-muted-foreground">
                          {person.researchTopic}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>{person.type}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{person.category}</Badge>
                    </TableCell>
                    <TableCell className="min-w-40">
                      {person.projects.length ? (
                        <div className="flex flex-col gap-1">
                          {person.projects.map((p) => (
                            <Link
                              key={p.id}
                              className="text-primary hover:underline"
                              to={`/projects/${p.id}`}
                            >
                              {p.title}
                            </Link>
                          ))}
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="min-w-40">
                      {person.papers.length ? (
                        <div className="flex flex-col gap-1">
                          {person.papers.map((p) => (
                            <Link
                              key={p.id}
                              className="text-primary hover:underline"
                              to={`/modules/${p.id}`}
                            >
                              {paperDisplayTitle(p)}
                            </Link>
                          ))}
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${person.name}`}
                          onClick={() => setEditing(person)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${person.name}`}
                          disabled={remove.isPending}
                          onClick={() => void deletePerson(person)}
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
                    colSpan={6}
                    className="py-10 text-center text-muted-foreground"
                  >
                    {requestSearch || type || category
                      ? "No matching students or scholars."
                      : "No students or scholars yet. Add a record to get started."}
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
      {editing !== undefined ? (
        <HdrPersonDialog
          person={editing}
          tenantId={tenantId}
          onClose={() => setEditing(undefined)}
          onSave={(input) => save.mutateAsync({ personId: editing?.id, input })}
        />
      ) : null}
    </div>
  );
}

export default function HdrStudentsPage() {
  const workspace = useCurrentWorkspace();
  const me = useMe();
  if (workspace.isPending || me.isPending)
    return <LoadingState title="Loading HDR" layout="list" />;
  if (!workspace.data || !me.data)
    return (
      <ErrorState
        title="HDR could not be loaded"
        description="Your account or workspace could not be loaded."
        onRetry={() => {
          void workspace.refetch();
          void me.refetch();
        }}
      />
    );
  return (
    <HdrList
      key={`${workspace.data.id}:${me.data.id}`}
      tenantId={workspace.data.id}
      userId={me.data.id}
    />
  );
}
