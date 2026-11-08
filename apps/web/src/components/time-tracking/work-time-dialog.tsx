import type { WorkTimeTarget } from "@/api/work-time-tracking";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WorkTimeCard } from "./work-time-card";
import { WorkTimerControls } from "./work-timer-controls";

export function WorkTimeDialog({
  kind,
  targetId,
  title,
  onClose,
}: WorkTimeTarget & { title: string; onClose: () => void }) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Review time logged on this record.
          </DialogDescription>
        </DialogHeader>
        <WorkTimerControls
          kind={kind}
          targetId={targetId}
          title={title}
          variant="button"
        />
        <WorkTimeCard kind={kind} targetId={targetId} />
      </DialogContent>
    </Dialog>
  );
}
