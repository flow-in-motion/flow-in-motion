import { useState } from "react";
import {
  useSaveReview,
  type ReviewKind,
  type ReviewStatus,
} from "@/api/reviews";
import { InlineFieldSelect } from "@/components/shared/inline-field-select";
import { REVIEW_STATUSES } from "./review-fields";

export function ReviewStatusSelect({
  tenantId,
  kind,
  id,
  title,
  status,
}: {
  tenantId: string;
  kind: ReviewKind;
  id: string;
  title: string;
  status?: ReviewStatus;
}) {
  const save = useSaveReview(tenantId, kind);
  const [error, setError] = useState<string>();
  return (
    <div className="space-y-1">
      <InlineFieldSelect
        value={status ?? "To do"}
        options={REVIEW_STATUSES}
        fieldLabel="status"
        itemLabel={title}
        onError={setError}
        onChange={(value) => {
          setError(undefined);
          return save.mutateAsync({
            id,
            input: { status: value as ReviewStatus },
          });
        }}
      />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
