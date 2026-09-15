import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  LinkExistingField,
  type LinkExistingOption,
} from "@/components/shared/link-existing-field";

interface LinkExistingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  fieldId: string;
  placeholder: string;
  options: LinkExistingOption[];
  emptyMessage?: string;
  confirmLabel: string;
  onConfirm: (selectedIds: string[]) => Promise<void>;
}

export function LinkExistingDialog({
  open,
  onOpenChange,
  title,
  description,
  fieldId,
  placeholder,
  options,
  emptyMessage,
  confirmLabel,
  onConfirm,
}: LinkExistingDialogProps) {
  const [selected, setSelected] = useState<LinkExistingOption[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelected([]);
    setSaveError(null);
  }, [open]);

  async function handleSubmit() {
    if (!selected.length) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await onConfirm(selected.map((item) => item.id));
      onOpenChange(false);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "These items could not be linked.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] min-h-[20rem] overflow-y-auto max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <LinkExistingField
          id={fieldId}
          placeholder={placeholder}
          options={options}
          selected={selected}
          onAdd={(option) => setSelected((current) => [...current, option])}
          onRemove={(id) =>
            setSelected((current) => current.filter((item) => item.id !== id))
          }
          emptyMessage={emptyMessage}
        />

        {saveError ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {saveError}
          </p>
        ) : null}

        <DialogFooter className="border-t pt-4">
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isSaving}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            disabled={isSaving || !selected.length}
            onClick={() => void handleSubmit()}
          >
            {isSaving ? "Linking…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
