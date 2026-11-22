import { WorkTimeCard } from "@/components/time-tracking/work-time-card";
import { WorkTimerControls } from "@/components/time-tracking/work-timer-controls";
import { useState, type FormEvent } from "react";

import { HdrDiscussionNotesPanel } from "./hdr-discussion-notes-panel";
import type {
  SupervisionType,
  HdrCategory,
  HdrInput,
  HdrPerson,
  HdrType,
} from "@/api/hdr";
import {
  HdrWorkPicker,
  type HdrWorkOption,
} from "@/components/hdr/hdr-work-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { paperDisplayTitle } from "@/lib/paper-title";

// Mounted only while open, and keyed by the owner/workspace on the parent page.
export function HdrPersonDialog({
  tenantId,
  person,
  onClose,
  onSave,
}: {
  tenantId: string;
  person: HdrPerson | null;
  onClose: () => void;
  onSave: (input: HdrInput) => Promise<unknown>;
}) {
  const [name, setName] = useState(person?.name ?? "");
  const [type, setType] = useState<HdrType>(person?.type ?? "PhD");
  const [category, setCategory] = useState<HdrCategory>(
    person?.category ?? "Current",
  );
  const [email, setEmail] = useState(person?.email ?? "");
  const [researchTopic, setResearchTopic] = useState(
    person?.researchTopic ?? "",
  );
  const [supervisionType, setSupervisionType] = useState<SupervisionType | "">(
    person?.supervisionType ?? "",
  );
  const [startDate, setStartDate] = useState(person?.startDate ?? "");
  const [submissionDueDate, setSubmissionDueDate] = useState(
    person?.submissionDueDate ?? "",
  );
  const [conferences, setConferences] = useState(person?.conferences ?? "");
  const [initialDiscussionNote, setInitialDiscussionNote] = useState("");
  const [selectedProjects, setProjects] = useState<HdrWorkOption[]>(
    () => person?.projects.map((p) => ({ id: p.id, label: p.title })) ?? [],
  );
  const [selectedPapers, setPapers] = useState<HdrWorkOption[]>(
    () =>
      person?.papers.map((p) => ({ id: p.id, label: paperDisplayTitle(p) })) ??
      [],
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        type,
        category,
        email: email.trim() || null,
        researchTopic: researchTopic.trim() || null,
        supervisionType: supervisionType || null,
        startDate: startDate || null,
        submissionDueDate: submissionDueDate || null,
        conferences: conferences.trim() || null,
        ...(!person
          ? { initialDiscussionNote: initialDiscussionNote.trim() || null }
          : {}),
        projectIds: selectedProjects.map((p) => p.id),
        paperIds: selectedPapers.map((p) => p.id),
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "This record could not be saved.",
      );
      setSaving(false);
    }
  }

  const formActions = (
    <DialogFooter className={person ? "border-b pb-4" : "border-t pt-4"}>
      <Button
        type="button"
        variant="outline"
        disabled={saving}
        onClick={onClose}
      >
        Cancel
      </Button>
      <Button type="submit" disabled={saving || !name.trim()}>
        {saving ? "Saving…" : person ? "Save changes" : "Add record"}
      </Button>
    </DialogFooter>
  );

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent className="max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {person ? "Edit HDR record" : "Add student or visiting scholar"}
          </DialogTitle>
          <DialogDescription>
            Private to your account. Students and visitors cannot see this
            record. Only a name is needed to start.
          </DialogDescription>
        </DialogHeader>
        {person ? <WorkTimerControls kind="hdr" targetId={person.id} title={person.name} variant="button" /> : null}
        {person?.createdAt ? (
          <p className="text-sm text-muted-foreground">
            Date added:{" "}
            <time dateTime={person.createdAt}>
              {new Date(person.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })}
            </time>
          </p>
        ) : null}
        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          {person ? formActions : null}

          <fieldset disabled={saving} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="hdr-name" className="text-sm font-medium">
                Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="hdr-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={200}
                autoFocus
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="hdr-type" className="text-sm font-medium">
                  Type
                </label>
                <select
                  id="hdr-type"
                  value={type}
                  onChange={(e) => setType(e.target.value as HdrType)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option>PhD</option>
                  <option>MRes</option>
                  <option>Visiting scholar</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="hdr-category" className="text-sm font-medium">
                  Category
                </label>
                <select
                  id="hdr-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as HdrCategory)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option>Current</option>
                  <option>Potential</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="hdr-supervision-type"
                className="text-sm font-medium"
              >
                Supervision type (optional)
              </label>
              <select
                id="hdr-supervision-type"
                value={supervisionType}
                onChange={(e) =>
                  setSupervisionType(e.target.value as SupervisionType | "")
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Not specified</option>
                {[
                  "Primary",
                  "Associate",
                  "Co-supervisor",
                  "Panel",
                  "Other",
                ].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="hdr-start-date" className="text-sm font-medium">
                  Start date (optional)
                </label>
                <Input
                  id="hdr-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="hdr-submission-due"
                  className="text-sm font-medium"
                >
                  Submission due date (optional)
                </label>
                <Input
                  id="hdr-submission-due"
                  type="date"
                  value={submissionDueDate}
                  min={startDate || undefined}
                  onChange={(e) => setSubmissionDueDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="hdr-email" className="text-sm font-medium">
                Email (optional)
              </label>
              <Input
                id="hdr-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={320}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="hdr-topic" className="text-sm font-medium">
                Research topic (optional)
              </label>
              <Textarea
                id="hdr-topic"
                value={researchTopic}
                onChange={(e) => setResearchTopic(e.target.value)}
                rows={6}
                className="min-h-40 resize-y"
                maxLength={10000}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="hdr-conferences" className="text-sm font-medium">
                Conferences (optional)
              </label>
              <Textarea
                id="hdr-conferences"
                value={conferences}
                onChange={(e) => setConferences(e.target.value)}
                rows={3}
                maxLength={10000}
              />
            </div>
            {!person ? (
              <div className="space-y-1.5">
                <label
                  htmlFor="hdr-initial-discussion"
                  className="text-sm font-medium"
                >
                  Discussion notes (optional)
                </label>
                <Textarea
                  id="hdr-initial-discussion"
                  value={initialDiscussionNote}
                  onChange={(e) => setInitialDiscussionNote(e.target.value)}
                  rows={12}
                  className="min-h-72 resize-y"
                  maxLength={20000}
                />
                <p className="text-xs text-muted-foreground">
                  The date is added automatically when saved.
                </p>
              </div>
            ) : null}
            <HdrWorkPicker
              tenantId={tenantId}
              kind="projects"
              selected={selectedProjects}
              onChange={setProjects}
            />
            <HdrWorkPicker
              tenantId={tenantId}
              kind="papers"
              selected={selectedPapers}
              onChange={setPapers}
            />
          </fieldset>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {!person ? formActions : null}
        </form>
        {person ? (
          <HdrDiscussionNotesPanel tenantId={tenantId} personId={person.id} />
        ) : null}
        {person ? <WorkTimeCard key={person.id} kind="hdr" targetId={person.id} /> : null}
      </DialogContent>
    </Dialog>
  );
}
