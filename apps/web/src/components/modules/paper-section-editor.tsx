import { useState, type FormEvent } from "react";
import {
  usePaperVenueSuggestions,
  type ApiModule,
  type UpdateModuleInput,
} from "@/api/hooks";
import {
  JournalPublisherFields,
  PaperReferenceFields,
} from "./paper-reference-fields";
import {
  paperReferenceInput,
  savedJournalPublishers,
} from "@/lib/paper-references";
import { TagInput } from "@/components/shared/tag-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type PaperEditSection =
  "details" | "abstract" | "publishing" | "references";
const TITLES: Record<PaperEditSection, string> = {
  details: "Edit paper details",
  abstract: "Edit abstract",
  publishing: "Edit journals & conferences",
  references: "Edit working date, duration & links",
};

export default function PaperSectionEditor({
  paper,
  tenantId,
  section,
  onSave,
  onClose,
}: {
  paper: ApiModule;
  tenantId: string;
  section: PaperEditSection;
  onSave: (input: UpdateModuleInput) => Promise<unknown>;
  onClose: () => void;
}) {
  const [values, setValues] = useState(() => ({
    title: paper.title ?? "",
    shortTitle: paper.shortTitle ?? "",
    description: paper.description ?? "",
    abstract: paper.abstract ?? "",
    targetJournal: paper.targetJournal ?? "",
    backupJournal: paper.backupJournal ?? "",
    targetConference: paper.targetConference ?? "",
    backupConference: paper.backupConference ?? "",
    workingDate: paper.workingDate ?? "",
    plannedHours: paper.plannedHours ?? "",
    manuscriptUrl: paper.manuscriptUrl ?? "",
    dataUrl: paper.dataUrl ?? "",
    otherFilesUrl: paper.otherFilesUrl ?? "",
    journalPublishers: paper.journalPublishers ?? [],
  }));
  const venues = usePaperVenueSuggestions(
    tenantId,
    section === "publishing" && paper.tenantId === tenantId,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(undefined);
    try {
      let input: UpdateModuleInput;
      if (section === "details")
        input = {
          title: values.title.trim(),
          shortTitle: values.shortTitle.trim(),
          description: values.description.trim(),
        };
      else if (section === "abstract")
        input = { abstract: values.abstract.trim() };
      else if (section === "publishing")
        input = {
          targetJournal: values.targetJournal.trim(),
          backupJournal: values.backupJournal.trim(),
          targetConference: values.targetConference.trim(),
          backupConference: values.backupConference.trim(),
          journalPublishers: savedJournalPublishers(
            values.journalPublishers,
            values.targetJournal,
            values.backupJournal,
          ),
        };
      else {
        const references = paperReferenceInput(values);
        input = {
          workingDate: references.workingDate,
          plannedHours: references.plannedHours,
          manuscriptUrl: references.manuscriptUrl,
          dataUrl: references.dataUrl,
          otherFilesUrl: references.otherFilesUrl,
        };
      }
      await onSave(input);
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Changes could not be saved.",
      );
      setSaving(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{TITLES[section]}</DialogTitle>
          <DialogDescription>
            Save changes to this section of the paper.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void save(event)} className="space-y-4">
          <fieldset disabled={saving} className="grid gap-4">
            {section === "details" ? (
              <>
                <div className="space-y-1.5">
                  <label
                    htmlFor="paper-section-short-title"
                    className="text-sm font-medium"
                  >
                    Short title
                  </label>
                  <Input
                    id="paper-section-short-title"
                    value={values.shortTitle}
                    onChange={(e) =>
                      setValues({ ...values, shortTitle: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="paper-section-title"
                    className="text-sm font-medium"
                  >
                    Formal title
                  </label>
                  <Input
                    id="paper-section-title"
                    required
                    value={values.title}
                    onChange={(e) =>
                      setValues({ ...values, title: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="paper-section-description"
                    className="text-sm font-medium"
                  >
                    Description
                  </label>
                  <Textarea
                    id="paper-section-description"
                    rows={4}
                    value={values.description}
                    onChange={(e) =>
                      setValues({ ...values, description: e.target.value })
                    }
                  />
                </div>
              </>
            ) : section === "abstract" ? (
              <div className="space-y-1.5">
                <label
                  htmlFor="paper-section-abstract"
                  className="text-sm font-medium"
                >
                  Abstract
                </label>
                <Textarea
                  id="paper-section-abstract"
                  rows={10}
                  className="resize-y"
                  value={values.abstract}
                  onChange={(e) =>
                    setValues({ ...values, abstract: e.target.value })
                  }
                />
              </div>
            ) : section === "publishing" ? (
              <>
                {(
                  [
                    ["targetJournal", "Target journals", venues.data?.journals],
                    ["backupJournal", "Backup journals", venues.data?.journals],
                    [
                      "targetConference",
                      "Target conferences",
                      venues.data?.conferences,
                    ],
                    [
                      "backupConference",
                      "Backup conferences",
                      venues.data?.conferences,
                    ],
                  ] as const
                ).map(([key, label, suggestions]) => (
                  <div key={key} className="space-y-1.5">
                    <label
                      htmlFor={`paper-section-${key}`}
                      className="text-sm font-medium"
                    >
                      {label}
                    </label>
                    <TagInput
                      id={`paper-section-${key}`}
                      value={values[key]}
                      onChange={(value) =>
                        setValues({ ...values, [key]: value })
                      }
                      suggestions={suggestions}
                    />
                  </div>
                ))}
                <JournalPublisherFields
                  id="paper-section-publishers"
                  target={values.targetJournal}
                  backup={values.backupJournal}
                  value={values.journalPublishers}
                  onChange={(journalPublishers) =>
                    setValues({ ...values, journalPublishers })
                  }
                />
              </>
            ) : (
              <PaperReferenceFields
                id="paper-section-references"
                value={values}
                onChange={(patch) => setValues({ ...values, ...patch })}
              />
            )}
          </fieldset>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter className="border-t pt-4">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                saving || (section === "details" && !values.title.trim())
              }
            >
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
