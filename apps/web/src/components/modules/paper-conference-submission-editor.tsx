import { useConference, useMe } from "@/api/hooks";
import { SubmissionFormDialog } from "@/components/conferences/conference-submissions-panel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function PaperConferenceSubmissionEditor({
  tenantId,
  moduleId,
  conferenceId,
  submissionId,
  onClose,
}: {
  tenantId: string;
  moduleId: string;
  conferenceId: string;
  submissionId: string;
  onClose: () => void;
}) {
  // Fetch the original submission only on edit, preserving its own nullable
  // deadline and notes rather than copying the list's inherited deadline.
  const conference = useConference(tenantId, conferenceId);
  const me = useMe();
  const submission = conference.data?.submissions?.find(
    (item) =>
      item.id === submissionId &&
      item.moduleId === moduleId &&
      item.kind === "paper",
  );
  if (
    !conference.isPending &&
    !me.isPending &&
    !conference.isError &&
    conference.data?.ownerUserId === me.data?.id &&
    submission
  ) {
    return (
      <SubmissionFormDialog
        open
        tenantId={tenantId}
        conferenceId={conferenceId}
        conferenceDue={conference.data.submissionDue}
        submission={submission}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      />
    );
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit conference submission</DialogTitle>
          <DialogDescription>
            Update this paper's existing conference submission.
          </DialogDescription>
        </DialogHeader>
        {conference.isPending || me.isPending ? (
          <p role="status">Loading submission…</p>
        ) : conference.isError ? (
          <div role="alert">
            <p>The submission could not be loaded.</p>
            <Button variant="outline" onClick={() => void conference.refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <p role="alert">
            This submission is no longer available for editing.
          </p>
        )}
        <Button type="button" variant="outline" onClick={onClose}>
          Close
        </Button>
      </DialogContent>
    </Dialog>
  );
}
