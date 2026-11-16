import { Input } from "@/components/ui/input";
import {
  journalNames,
  journalPublisherFor,
  type JournalPublisher,
  type PaperReferenceForm,
} from "@/lib/paper-references";

export function JournalPublisherFields({
  id,
  target,
  backup,
  value,
  onChange,
}: {
  id: string;
  target: string;
  backup: string;
  value: JournalPublisher[];
  onChange: (entries: JournalPublisher[]) => void;
}) {
  return journalNames(target, backup).map((name, index) => (
    <div key={name.toLowerCase()} className="flex flex-col gap-1.5">
      <label htmlFor={`${id}-${index}`} className="text-sm font-medium">
        Publisher for {name} (optional)
      </label>
      <Input
        id={`${id}-${index}`}
        value={journalPublisherFor(value, name)}
        maxLength={300}
        onChange={(event) =>
          onChange([
            ...value.filter(
              (entry) => entry.journalName.toLowerCase() !== name.toLowerCase(),
            ),
            { journalName: name, publisher: event.target.value },
          ])
        }
      />
    </div>
  ));
}

export function PaperReferenceFields({
  id,
  value,
  onChange,
}: {
  id: string;
  value: PaperReferenceForm;
  onChange: (patch: Partial<PaperReferenceForm>) => void;
}) {
  return (
    <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-working-date`} className="text-sm font-medium">
          Working date (optional)
        </label>
        <Input
          id={`${id}-working-date`}
          type="date"
          value={value.workingDate}
          onChange={(event) => onChange({ workingDate: event.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-planned-hours`} className="text-sm font-medium">
          Planned duration (hours, optional)
        </label>
        <Input
          id={`${id}-planned-hours`}
          type="number"
          min="0.01"
          max="24"
          step="0.01"
          placeholder="e.g. 1.5"
          value={value.plannedHours}
          onChange={(event) => onChange({ plannedHours: event.target.value })}
        />
      </div>
      {(
        [
          ["manuscriptUrl", "Manuscript URL"],
          ["dataUrl", "Data URL"],
          ["otherFilesUrl", "Other files URL"],
        ] as const
      ).map(([key, label]) => (
        <div key={key} className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor={`${id}-${key}`} className="text-sm font-medium">
            {label} (optional)
          </label>
          <Input
            id={`${id}-${key}`}
            type="url"
            pattern="https?://.+"
            maxLength={2048}
            placeholder="https://"
            value={value[key]}
            onChange={(event) => onChange({ [key]: event.target.value })}
          />
        </div>
      ))}
    </div>
  );
}
