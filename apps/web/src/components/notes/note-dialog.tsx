import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Search, X } from "lucide-react";

import {
  useUserSearch,
  type ApiModule,
  type ApiProject,
  type ApiUserSearchResult,
} from "@/api/hooks";
import { Badge } from "@/components/ui/badge";
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
import type { LinkTargetType } from "@/lib/link-target";
import { paperDisplayTitle } from "@/lib/paper-title";
import { cn } from "@/lib/utils";

const VISIBILITY_OPTIONS = ["Private", "Shared"] as const;
const LINK_TARGET_OPTIONS: { value: LinkTargetType; label: string }[] = [
  { value: "project", label: "Project" },
  { value: "module", label: "Paper" },
  { value: "none", label: "General" },
];

export interface NoteFormInput {
  title: string;
  content: string;
  linkTarget: LinkTargetType;
  projectId: string;
  moduleId: string;
  visibility: string;
  followUpDate: string;
  /** Applied by the caller after creation, since a brand-new note has no id yet. */
  collaboratorUserIds: string[];
}

interface NoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: ApiProject[];
  modules: ApiModule[];
  /** Pre-links a new note to this project when the dialog is opened. */
  initialProjectId?: string;
  /** Pre-links a new note to this module when the dialog is opened. */
  initialModuleId?: string;
  onSave: (input: NoteFormInput) => Promise<void> | void;
}

const INITIAL_FORM: NoteFormInput = {
  title: "",
  content: "",
  linkTarget: "none",
  projectId: "",
  moduleId: "",
  visibility: "Private",
  followUpDate: "",
  collaboratorUserIds: [],
};

function FormField({ label, htmlFor, required, children }: {
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

function linkTargetPillClass(selected: boolean) {
  return cn(
    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
    selected
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
  );
}

export function NoteDialog({
  open,
  onOpenChange,
  projects,
  modules,
  initialProjectId,
  initialModuleId,
  onSave,
}: NoteDialogProps) {
  const [form, setForm] = useState<NoteFormInput>(INITIAL_FORM);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberPickerOpen, setMemberPickerOpen] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<ApiUserSearchResult[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initialModuleId) {
      setForm({ ...INITIAL_FORM, linkTarget: "module", moduleId: initialModuleId });
    } else if (initialProjectId) {
      setForm({ ...INITIAL_FORM, linkTarget: "project", projectId: initialProjectId });
    } else {
      setForm(INITIAL_FORM);
    }
    setMemberSearch("");
    setMemberPickerOpen(false);
    setSelectedMembers([]);
    setSaveError(null);
  }, [open, initialProjectId, initialModuleId]);

  const userSearchQuery = useUserSearch(memberSearch, memberPickerOpen);
  const matchingMembers = useMemo(() => {
    const selectedIds = new Set(selectedMembers.map((member) => member.id));
    return (userSearchQuery.data ?? []).filter((member) => !selectedIds.has(member.id));
  }, [userSearchQuery.data, selectedMembers]);

  function setLinkTarget(linkTarget: LinkTargetType) {
    setForm((prev) => ({
      ...prev,
      linkTarget,
      projectId: linkTarget === "project" ? prev.projectId : "",
      moduleId: linkTarget === "module" ? prev.moduleId : "",
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (form.linkTarget === "project" && !form.projectId) return;
    if (form.linkTarget === "module" && !form.moduleId) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave({
        ...form,
        title: form.title.trim(),
        content: form.content.trim(),
        collaboratorUserIds: selectedMembers.map((member) => member.id),
      });
      onOpenChange(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "The note could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Create a new note</DialogTitle>
          <DialogDescription>
            Capture a research update, then link it to a project or paper, or keep it general.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void handleSubmit(event)} className="grid gap-5">
          <FormField label="Note title" htmlFor="note-title" required>
            <Input
              id="note-title"
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Enter a note title"
              autoFocus
              required
            />
          </FormField>

          <FormField label="Link to" htmlFor="note-link-target">
            <div className="flex flex-wrap gap-2" id="note-link-target">
              {LINK_TARGET_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setLinkTarget(option.value)}
                  aria-pressed={form.linkTarget === option.value}
                  className={linkTargetPillClass(form.linkTarget === option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </FormField>

          {form.linkTarget === "project" ? (
            <FormField label="Project" htmlFor="note-project" required>
              <Select
                value={form.projectId}
                onValueChange={(value) => setForm((prev) => ({ ...prev, projectId: value }))}
                required
              >
                <SelectTrigger id="note-project"><SelectValue placeholder="Select a project" /></SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>{project.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          ) : null}

          {form.linkTarget === "module" ? (
            <FormField label="Paper" htmlFor="note-module" required>
              <Select
                value={form.moduleId}
                onValueChange={(value) => setForm((prev) => ({ ...prev, moduleId: value }))}
                required
              >
                <SelectTrigger id="note-module"><SelectValue placeholder="Select a paper" /></SelectTrigger>
                <SelectContent>
                  {modules.map((module) => (
                    <SelectItem key={module.id} value={module.id}>{paperDisplayTitle(module)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Visibility" htmlFor="note-visibility">
              <Select
                value={form.visibility}
                onValueChange={(value) => setForm((prev) => ({ ...prev, visibility: value }))}
              >
                <SelectTrigger id="note-visibility"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VISIBILITY_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Follow-up date" htmlFor="note-follow-up-date">
              <DatePickerInput
                id="note-follow-up-date"
                label="Follow-up date"
                value={form.followUpDate}
                onChange={(value) => setForm((prev) => ({ ...prev, followUpDate: value }))}
              />
            </FormField>
          </div>

          <FormField label="Note" htmlFor="note-content">
            <Textarea
              id="note-content"
              value={form.content}
              onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
              placeholder="Write the note…"
              rows={6}
            />
          </FormField>

          {form.visibility === "Shared" ? (
            <FormField label="Share with" htmlFor="note-members">
              <div
                className="relative"
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    setMemberPickerOpen(false);
                  }
                }}
              >
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="note-members"
                  role="combobox"
                  aria-expanded={memberPickerOpen}
                  aria-controls="note-new-member-options"
                  aria-autocomplete="list"
                  value={memberSearch}
                  onFocus={() => setMemberPickerOpen(true)}
                  onChange={(event) => {
                    setMemberSearch(event.target.value);
                    setMemberPickerOpen(true);
                  }}
                  placeholder="Type a name or email to search all users"
                  className="pl-9"
                  autoComplete="off"
                />
                {memberPickerOpen && memberSearch.trim() ? (
                  <div
                    id="note-new-member-options"
                    role="listbox"
                    className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-lg"
                  >
                    {userSearchQuery.isPending ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">
                        Searching…
                      </p>
                    ) : matchingMembers.length ? (
                      matchingMembers.map((member) => (
                        <button
                          key={member.id}
                          type="button"
                          role="option"
                          aria-selected="false"
                          className="flex w-full items-center justify-between gap-3 rounded-sm px-3 py-2 text-left hover:bg-accent focus:bg-accent focus:outline-none"
                          onClick={() => {
                            setSelectedMembers((current) => [...current, member]);
                            setMemberSearch("");
                          }}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">
                              {member.displayName}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {member.email}
                            </span>
                            {member.affiliation ? (
                              <span className="block truncate text-xs text-muted-foreground">
                                {member.affiliation}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      ))
                    ) : (
                      <p className="px-3 py-2 text-sm text-muted-foreground">
                        No matching users.
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
              {selectedMembers.length ? (
                <div className="mt-2 flex flex-wrap gap-2" aria-label="Selected note members">
                  {selectedMembers.map((member) => (
                    <Badge key={member.id} variant="secondary" className="gap-1.5 py-1">
                      {member.displayName}
                      <button
                        type="button"
                        aria-label={`Remove ${member.displayName}`}
                        onClick={() =>
                          setSelectedMembers((current) =>
                            current.filter((item) => item.id !== member.id),
                          )
                        }
                        className="rounded-full hover:text-destructive focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : null}
              <p className="mt-2 text-xs text-muted-foreground">
                Selected users receive access directly when the note is created. No email invitation is sent.
              </p>
            </FormField>
          ) : null}

          {saveError ? (
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {saveError}
            </p>
          ) : null}

          <DialogFooter className="border-t pt-4">
            <DialogClose asChild><Button type="button" variant="outline" disabled={isSaving}>Cancel</Button></DialogClose>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving…" : "Create Note"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
