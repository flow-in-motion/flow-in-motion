import { useMemo, useState } from "react";
import {
  useConference,
  useCreateConference,
  useMe,
  usePresentationConferenceOptions,
  type ApiConferenceLinkOption,
} from "@/api/hooks";
import { SubmissionFormDialog } from "@/components/conferences/conference-submissions-panel";
import { ConferenceSubmissionDialog } from "@/components/dashboard/conference-submission-dialog";
import { SearchInput } from "@/components/shared/search-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function PaperConferenceSubmissionAdder({
  tenantId,
  moduleId,
  paperTitle,
  onClose,
}: {
  tenantId: string;
  moduleId: string;
  paperTitle: string;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [conferenceId, setConferenceId] = useState("");
  const [creating, setCreating] = useState(false);
  // Existing lightweight endpoint returns every owned conference, not the first page.
  const options = usePresentationConferenceOptions(
    tenantId,
    moduleId,
    !conferenceId && !creating,
  );
  const conference = useConference(
    tenantId,
    conferenceId,
    Boolean(conferenceId),
  );
  const me = useMe();
  const create = useCreateConference(tenantId);
  const fixedPaper = useMemo<ApiConferenceLinkOption>(
    () => ({
      kind: "paper",
      id: moduleId,
      label: paperTitle,
      displayId: null,
      projectId: null,
      projectTitle: null,
    }),
    [moduleId, paperTitle],
  );
  const term = search.trim().toLocaleLowerCase();
  const matches = (options.data ?? []).filter((event) =>
    [event.name, event.acronym, event.location]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase()
      .includes(term),
  );
  if (creating)
    return (
      <ConferenceSubmissionDialog
        open
        tenantId={tenantId}
        onOpenChange={(open) => {
          if (!open) setCreating(false);
        }}
        onSave={async (input) => {
          // The submission form reuses a paper link if the event creation added one.
          const created = await create.mutateAsync(input);
          setConferenceId(created.id);
          setCreating(false);
        }}
      />
    );
  if (
    conferenceId &&
    conference.data &&
    conference.data.ownerUserId === me.data?.id
  )
    return (
      <SubmissionFormDialog
        key={conferenceId}
        open
        tenantId={tenantId}
        conferenceId={conferenceId}
        conferenceDue={conference.data.submissionDue}
        submission={
          conference.data.submissions?.find(
            (submission) =>
              submission.kind === "paper" && submission.moduleId === moduleId,
          ) ?? null
        }
        fixedPaper={fixedPaper}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      />
    );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add conference submission</DialogTitle>
          <DialogDescription>
            Select a conference for {paperTitle}.
          </DialogDescription>
        </DialogHeader>
        {conferenceId ? (
          <>
            {conference.isPending || me.isPending ? (
              <p role="status">Loading conference…</p>
            ) : (
              <p role="alert">
                This conference could not be opened for editing.
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => setConferenceId("")}
            >
              Choose another conference
            </Button>
          </>
        ) : (
          <>
            <SearchInput
              aria-label="Search your conferences"
              placeholder="Search your conferences…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onClear={() => setSearch("")}
              clearLabel="Clear conference search"
            />
            {options.isPending ? (
              <p role="status">Loading conferences…</p>
            ) : options.isError ? (
              <p role="alert">
                Conferences could not be loaded.{" "}
                <button
                  type="button"
                  className="underline"
                  onClick={() => void options.refetch()}
                >
                  Retry
                </button>
              </p>
            ) : (
              <div className="max-h-72 overflow-y-auto rounded-md border">
                {matches.length ? (
                  matches.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => setConferenceId(event.id)}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
                    >
                      <span className="font-medium">
                        {event.acronym ? `${event.acronym} · ` : ""}
                        {event.name}
                      </span>
                      {event.location ? (
                        <span className="block text-xs text-muted-foreground">
                          {event.location}
                        </span>
                      ) : null}
                    </button>
                  ))
                ) : (
                  <p className="p-3 text-sm text-muted-foreground">
                    No matching conferences.
                  </p>
                )}
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreating(true)}
            >
              Create conference / event
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
