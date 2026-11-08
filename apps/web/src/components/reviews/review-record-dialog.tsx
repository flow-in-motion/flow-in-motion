import { Pencil } from "lucide-react";
import { useState } from "react";
import { useReview, type ReviewKind } from "@/api/reviews";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fieldsFor, labelFor, recordTitle, reviewDate } from "./review-fields";
import { ReviewForm } from "./review-form";
import { ReviewNotesPanel } from "./review-notes-panel";

export function ReviewRecordDialog({
  tenantId,
  kind,
  id,
  edit = false,
  onClose,
}: {
  tenantId: string;
  kind: ReviewKind;
  id?: string;
  edit?: boolean;
  onClose: () => void;
}) {
  const [recordId, setRecordId] = useState(id);
  const [editing, setEditing] = useState(!id || edit);
  const query = useReview(tenantId, kind, recordId);
  const record = query.data;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {editing
              ? `${recordId ? "Edit" : "Add"} ${kind === "examination" ? "HDR examination" : "review"}`
              : record
                ? recordTitle(record)
                : labelFor(kind)}
          </DialogTitle>
          <DialogDescription>
            Private to your account.{" "}
            {kind === "examination"
              ? "Only the student name is required."
              : "Only the manuscript title is required."}
          </DialogDescription>
        </DialogHeader>
        {recordId && query.isPending ? (
          <LoadingState title="Loading record" layout="list" />
        ) : recordId && query.isError ? (
          <ErrorState
            title="Record could not be loaded"
            description={query.error.message}
            onRetry={() => void query.refetch()}
          />
        ) : editing ? (
          <ReviewForm
            key={recordId ?? "new"}
            tenantId={tenantId}
            kind={kind}
            record={record}
            onSaved={(saved) => {
              setRecordId(saved.id);
              setEditing(false);
            }}
            onCancel={() => {
              if (recordId) setEditing(false);
              else onClose();
            }}
          />
        ) : record ? (
          <div className="space-y-6">
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4" />
                {kind === "examination" ? "Edit examination" : "Edit review"}
              </Button>
            </div>
            <dl className="grid gap-4 sm:grid-cols-2">
              {fieldsFor(kind)
                .filter(({ key }) => key !== "abstract")
                .map((field) => (
                  <div key={field.key}>
                    <dt className="text-sm text-muted-foreground">
                      {field.label}
                    </dt>
                    <dd className="mt-1 whitespace-pre-wrap break-words text-sm font-medium">
                      {field.type === "date"
                        ? reviewDate(record[field.key])
                        : record[field.key] || "—"}
                    </dd>
                  </div>
                ))}
            </dl>
            {record.abstract ? (
              <section className="space-y-2">
                <h3 className="font-semibold">Abstract</h3>
                <p className="whitespace-pre-wrap break-words text-sm">
                  {record.abstract}
                </p>
              </section>
            ) : null}
            <ReviewNotesPanel
              tenantId={tenantId}
              kind={kind}
              recordId={record.id}
              notes={record.notes}
            />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
