import { Search, X } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import {
  type ApiFunding,
  type ApiFundingPaper,
  type ApiFundingProject,
  type FundingInput,
  type FundingStatus,
  useModules,
  useProjects,
} from "@/api/hooks";
import { Button } from "@/components/ui/button";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { paperDisplayTitle } from "@/lib/paper-title";

const FUNDING_STATUSES: FundingStatus[] = [
  "Considering",
  "Preparing",
  "Submitted",
  "Awarded",
  "Unsuccessful",
];

interface FundingFormState {
  fundingBody: string;
  scheme: string;
  partners: string;
  amount: string;
  currency: string;
  applicationDeadline: string;
  followUpDate: string;
  status: FundingStatus | "";
  description: string;
}

const INITIAL_FORM: FundingFormState = {
  fundingBody: "",
  scheme: "",
  partners: "",
  amount: "",
  currency: "",
  applicationDeadline: "",
  followUpDate: "",
  status: "",
  description: "",
};

interface FundingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  funding?: ApiFunding | null;
  onSave: (input: FundingInput) => Promise<void> | void;
}

function FormField({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {required ? <span className="ml-1 text-destructive">*</span> : null}
      </label>
      {children}
    </div>
  );
}

function SelectedLink({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary ring-1 ring-inset ring-primary/15">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="rounded-sm p-0.5 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

export function FundingDialog({
  open,
  onOpenChange,
  tenantId,
  funding,
  onSave,
}: FundingDialogProps) {
  const [form, setForm] = useState<FundingFormState>(INITIAL_FORM);
  const [selectedProjects, setSelectedProjects] = useState<ApiFundingProject[]>(
    [],
  );
  const [selectedPapers, setSelectedPapers] = useState<ApiFundingPaper[]>([]);
  const [projectSearch, setProjectSearch] = useState("");
  const [projectRequestSearch, setProjectRequestSearch] = useState("");
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [paperSearch, setPaperSearch] = useState("");
  const [paperRequestSearch, setPaperRequestSearch] = useState("");
  const [paperPickerOpen, setPaperPickerOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const projectQuery = useProjects(
    tenantId,
    1,
    open && projectPickerOpen && projectRequestSearch.length > 0,
    { pageSize: "all", search: projectRequestSearch },
  );
  const projectResults = [
    ...(projectQuery.data?.generalProject
      ? [projectQuery.data.generalProject]
      : []),
    ...(projectQuery.data?.data ?? []),
  ].filter(
    (project) =>
      !selectedProjects.some((selected) => selected.id === project.id),
  );

  const paperQuery = useModules(
    tenantId,
    undefined,
    1,
    open && paperPickerOpen && paperRequestSearch.length > 0,
    { pageSize: "all", search: paperRequestSearch },
  );
  const paperResults = (paperQuery.data?.data ?? []).filter(
    (paper) => !selectedPapers.some((selected) => selected.id === paper.id),
  );

  useEffect(() => {
    if (!open) return;
    setForm(
      funding
        ? {
            fundingBody: funding.fundingBody,
            scheme: funding.scheme ?? "",
            partners: funding.partners ?? "",
            amount: funding.amount ?? "",
            currency: funding.currency ?? "",
            applicationDeadline: funding.applicationDeadline ?? "",
            followUpDate: funding.followUpDate ?? "",
            status: funding.status ?? "",
            description: funding.description ?? funding.notes ?? "",
          }
        : INITIAL_FORM,
    );
    setSelectedProjects(funding?.projects ?? []);
    setSelectedPapers(funding?.papers ?? []);
    setProjectSearch("");
    setProjectRequestSearch("");
    setProjectPickerOpen(false);
    setPaperSearch("");
    setPaperRequestSearch("");
    setPaperPickerOpen(false);
    setFormError(null);
  }, [funding, open]);

  useEffect(() => {
    if (!open || !projectPickerOpen || !projectSearch.trim()) {
      setProjectRequestSearch("");
      return;
    }
    const timer = window.setTimeout(
      () => setProjectRequestSearch(projectSearch.trim()),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [open, projectPickerOpen, projectSearch]);

  useEffect(() => {
    if (!open || !paperPickerOpen || !paperSearch.trim()) {
      setPaperRequestSearch("");
      return;
    }
    const timer = window.setTimeout(
      () => setPaperRequestSearch(paperSearch.trim()),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [open, paperPickerOpen, paperSearch]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.fundingBody.trim()) {
      setFormError("Funding body is required.");
      return;
    }
    setIsSaving(true);
    setFormError(null);
    try {
      await onSave({
        fundingBody: form.fundingBody.trim(),
        scheme: form.scheme.trim() || null,
        partners: form.partners.trim() || null,
        amount: form.amount.trim() || null,
        currency: form.currency.trim().toUpperCase() || null,
        applicationDeadline: form.applicationDeadline || null,
        followUpDate: form.followUpDate || null,
        status: form.status || null,
        description: form.description.trim() || null,
        projectIds: selectedProjects.map((project) => project.id),
        moduleIds: selectedPapers.map((paper) => paper.id),
      });
      onOpenChange(false);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "The funding record could not be saved.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const isEditing = Boolean(funding);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit funding" : "Add funding"}
          </DialogTitle>
          <DialogDescription>
            Add the funding body now and complete the optional details when they
            become available.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Funding body" htmlFor="funding-body" required>
              <Input
                id="funding-body"
                value={form.fundingBody}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    fundingBody: event.target.value,
                  }))
                }
                placeholder="Funding organisation"
                autoFocus
                required
              />
            </FormField>
            <FormField label="Scheme / opportunity" htmlFor="funding-scheme">
              <Input
                id="funding-scheme"
                value={form.scheme}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    scheme: event.target.value,
                  }))
                }
                placeholder="Optional"
              />
            </FormField>
          </div>

          <FormField label="Partners" htmlFor="funding-partners">
            <Input
              id="funding-partners"
              value={form.partners}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  partners: event.target.value,
                }))
              }
              placeholder="Partner names, separated by commas"
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-[1fr_8rem_1fr]">
            <FormField label="Amount" htmlFor="funding-amount">
              <Input
                id="funding-amount"
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    amount: event.target.value,
                  }))
                }
                placeholder="0.00"
              />
            </FormField>
            <FormField label="Currency" htmlFor="funding-currency">
              <Input
                id="funding-currency"
                value={form.currency}
                maxLength={3}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    currency: event.target.value.toUpperCase(),
                  }))
                }
                placeholder="AUD"
              />
            </FormField>
            <FormField label="Application deadline" htmlFor="funding-deadline">
              <DatePickerInput
                id="funding-deadline"
                label="Application deadline"
                allowTyped
                value={form.applicationDeadline}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    applicationDeadline: value,
                  }))
                }
              />
            </FormField>
          </div>

          <FormField label="Status" htmlFor="funding-status">
            <Select
              value={form.status || "not-specified"}
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  status:
                    value === "not-specified" ? "" : (value as FundingStatus),
                }))
              }
            >
              <SelectTrigger id="funding-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="not-specified">Not specified</SelectItem>
                {FUNDING_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Follow-up date" htmlFor="funding-follow-up-date">
            <DatePickerInput
              id="funding-follow-up-date"
              label="Follow-up date"
              allowTyped
              value={form.followUpDate}
              onChange={(value) =>
                setForm((current) => ({ ...current, followUpDate: value }))
              }
            />
          </FormField>

          <FormField label="Linked projects" htmlFor="funding-project-search">
            <div
              className="relative"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget))
                  setProjectPickerOpen(false);
              }}
            >
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="funding-project-search"
                value={projectSearch}
                onFocus={() => setProjectPickerOpen(true)}
                onChange={(event) => {
                  setProjectSearch(event.target.value);
                  setProjectPickerOpen(true);
                }}
                placeholder="Search all accessible projects…"
                autoComplete="off"
                className="pl-9"
              />
              {projectPickerOpen && projectSearch.trim() ? (
                <div className="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg">
                  {projectQuery.isFetching ||
                  projectSearch.trim() !== projectRequestSearch ? (
                    <p className="px-3 py-2 text-sm text-muted-foreground">
                      Searching all projects…
                    </p>
                  ) : projectResults.length ? (
                    projectResults.map((project) => (
                      <button
                        key={project.id}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setSelectedProjects((current) => [
                            ...current,
                            {
                              id: project.id,
                              displayId: project.displayId,
                              title: project.title,
                            },
                          ]);
                          setProjectSearch("");
                          setProjectRequestSearch("");
                        }}
                        className="flex w-full flex-col items-start rounded-md px-3 py-2 text-left hover:bg-accent focus:bg-accent focus:outline-none"
                      >
                        <span className="text-sm font-medium">
                          {project.title}
                        </span>
                        {project.displayId ? (
                          <span className="text-xs text-muted-foreground">
                            {project.displayId}
                          </span>
                        ) : null}
                      </button>
                    ))
                  ) : (
                    <p className="px-3 py-2 text-sm text-muted-foreground">
                      No matching projects.
                    </p>
                  )}
                </div>
              ) : null}
            </div>
            {selectedProjects.length ? (
              <div className="flex flex-wrap gap-1.5">
                {selectedProjects.map((project) => (
                  <SelectedLink
                    key={project.id}
                    label={project.title}
                    onRemove={() =>
                      setSelectedProjects((current) =>
                        current.filter((item) => item.id !== project.id),
                      )
                    }
                  />
                ))}
              </div>
            ) : null}
          </FormField>

          <FormField label="Linked papers" htmlFor="funding-paper-search">
            <div
              className="relative"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget))
                  setPaperPickerOpen(false);
              }}
            >
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="funding-paper-search"
                value={paperSearch}
                onFocus={() => setPaperPickerOpen(true)}
                onChange={(event) => {
                  setPaperSearch(event.target.value);
                  setPaperPickerOpen(true);
                }}
                placeholder="Search all accessible papers…"
                autoComplete="off"
                className="pl-9"
              />
              {paperPickerOpen && paperSearch.trim() ? (
                <div className="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg">
                  {paperQuery.isFetching ||
                  paperSearch.trim() !== paperRequestSearch ? (
                    <p className="px-3 py-2 text-sm text-muted-foreground">
                      Searching all papers…
                    </p>
                  ) : paperResults.length ? (
                    paperResults.map((paper) => (
                      <button
                        key={paper.id}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setSelectedPapers((current) => [
                            ...current,
                            {
                              id: paper.id,
                              displayId: paper.displayId,
                              shortTitle: paper.shortTitle,
                              title: paper.title,
                              projectId: paper.projectId,
                            },
                          ]);
                          setPaperSearch("");
                          setPaperRequestSearch("");
                        }}
                        className="flex w-full flex-col items-start rounded-md px-3 py-2 text-left hover:bg-accent focus:bg-accent focus:outline-none"
                      >
                        <span className="text-sm font-medium">
                          {paperDisplayTitle(paper)}
                        </span>
                        {paper.displayId ? (
                          <span className="text-xs text-muted-foreground">
                            {paper.displayId}
                          </span>
                        ) : null}
                      </button>
                    ))
                  ) : (
                    <p className="px-3 py-2 text-sm text-muted-foreground">
                      No matching papers.
                    </p>
                  )}
                </div>
              ) : null}
            </div>
            {selectedPapers.length ? (
              <div className="flex flex-wrap gap-1.5">
                {selectedPapers.map((paper) => (
                  <SelectedLink
                    key={paper.id}
                    label={paperDisplayTitle(paper)}
                    onRemove={() =>
                      setSelectedPapers((current) =>
                        current.filter((item) => item.id !== paper.id),
                      )
                    }
                  />
                ))}
              </div>
            ) : null}
          </FormField>

          <FormField label="Description" htmlFor="funding-description">
            <Textarea
              id="funding-description"
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              placeholder="Optional funding description"
              rows={3}
            />
          </FormField>

          {formError ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            >
              {formError}
            </p>
          ) : null}

          <DialogFooter className="border-t pt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSaving}>
              {isSaving
                ? "Saving…"
                : isEditing
                  ? "Save Changes"
                  : "Add Funding"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
