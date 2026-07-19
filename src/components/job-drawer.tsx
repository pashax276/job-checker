"use client";

import { ArrowRight, ExternalLink, MessageSquare, Trash2 } from "lucide-react";
import { useState } from "react";
import { DueBadge, StatusBadge, TierBadge } from "@/components/badges";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { StageJourney } from "@/components/stage-journey";
import {
  useDeleteJob,
  useJob,
  useJobExtras,
  useUpdateJob,
} from "@/hooks/use-jobs";
import { STATUSES, TIERS, type Status, type Tier } from "@/lib/constants";
import {
  daysInCurrentStage,
  daysSinceApplied,
  isFollowUpDue,
  toLocalIsoDate,
} from "@/lib/dates";
import { jobPatchSchema } from "@/lib/schemas";
import type {
  ActivityEntry,
  Contact,
  JobDetail,
  StatusHistoryEntry,
} from "@/lib/types";

interface JobDrawerProps {
  jobId: string | null;
  onClose: () => void;
}

interface DraftState {
  company: string;
  role: string;
  priorityTier: Tier;
  status: Status;
  dateApplied: string;
  followUpDate: string;
  compNotes: string;
  nextAction: string;
  contact: string;
  postingUrl: string;
  resumeVersion: string;
  notes: string;
}

function toDraft(job: JobDetail): DraftState {
  return {
    company: job.company,
    role: job.role,
    priorityTier: job.priorityTier,
    status: job.status,
    dateApplied: job.dateApplied ?? "",
    followUpDate: job.followUpDate ?? "",
    compNotes: job.compNotes ?? "",
    nextAction: job.nextAction ?? "",
    contact: job.contact ?? "",
    postingUrl: job.postingUrl ?? "",
    resumeVersion: job.resumeVersion ?? "",
    notes: job.notes ?? "",
  };
}

function formatStamp(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function ContactsSection({
  jobId,
  contacts,
}: {
  jobId: string;
  contacts: Contact[];
}) {
  const { addContact, touchContact, removeContact } = useJobExtras(jobId);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  return (
    <div className="space-y-1.5">
      {contacts.map((contact) => (
        <div
          key={contact.id}
          className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">
              {contact.name}
              {contact.role ? (
                <span className="ml-1.5 font-normal text-muted-foreground">
                  {contact.role}
                </span>
              ) : null}
            </span>
            {contact.email ? (
              <a
                href={`mailto:${contact.email}`}
                className="block truncate text-muted-foreground hover:text-primary hover:underline"
              >
                {contact.email}
              </a>
            ) : null}
          </span>
          <span className="font-data shrink-0 text-[10px] text-muted-foreground">
            {contact.lastTouch ? `touched ${contact.lastTouch}` : "never touched"}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[10px]"
            disabled={touchContact.isPending}
            onClick={() =>
              touchContact.mutate({
                id: contact.id,
                lastTouch: toLocalIsoDate(new Date()),
              })
            }
          >
            Touch
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-destructive hover:text-destructive"
            aria-label={`Remove ${contact.name}`}
            onClick={() => removeContact.mutate(contact.id)}
          >
            <Trash2 className="size-3" aria-hidden />
          </Button>
        </div>
      ))}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          addContact.mutate(
            { name: name.trim(), ...(email.trim() ? { email: email.trim() } : {}) },
            {
              onSuccess: () => {
                setName("");
                setEmail("");
              },
            },
          );
        }}
      >
        <Input
          placeholder="Name"
          className="h-7 text-xs"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          placeholder="Email (optional)"
          type="email"
          className="h-7 text-xs"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button
          type="submit"
          size="sm"
          variant="outline"
          className="h-7 shrink-0 text-xs"
          disabled={addContact.isPending || !name.trim()}
        >
          Add
        </Button>
      </form>
    </div>
  );
}

type TimelineItem =
  | { kind: "status"; ts: string; status: StatusHistoryEntry }
  | { kind: "note"; ts: string; note: ActivityEntry };

function Timeline({ job }: { job: JobDetail }) {
  const { addActivity, removeActivity } = useJobExtras(job.id);
  const [draft, setDraftNote] = useState("");

  const items: TimelineItem[] = [
    ...job.statusHistory.map<TimelineItem>((entry) => ({
      kind: "status",
      ts: entry.changedAt,
      status: entry,
    })),
    ...job.activityLog.map<TimelineItem>((entry) => ({
      kind: "note",
      ts: entry.createdAt,
      note: entry,
    })),
  ].sort((a, b) => b.ts.localeCompare(a.ts));

  return (
    <div className="space-y-2">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          addActivity.mutate(draft.trim(), {
            onSuccess: () => setDraftNote(""),
          });
        }}
      >
        <Input
          placeholder="Log a note — “phone screen went well, asked about…”"
          className="h-7 text-xs"
          value={draft}
          onChange={(e) => setDraftNote(e.target.value)}
        />
        <Button
          type="submit"
          size="sm"
          variant="outline"
          className="h-7 shrink-0 text-xs"
          disabled={addActivity.isPending || !draft.trim()}
        >
          Log
        </Button>
      </form>
      <ol className="space-y-1.5">
        {items.map((item) =>
          item.kind === "status" ? (
            <li
              key={`s-${item.status.id}`}
              className="flex items-center gap-2 text-xs"
            >
              <span className="font-data w-24 shrink-0 text-muted-foreground">
                {formatStamp(item.ts)}
              </span>
              {item.status.fromStatus ? (
                <>
                  <StatusBadge status={item.status.fromStatus} />
                  <ArrowRight
                    className="size-3 text-muted-foreground"
                    aria-hidden
                  />
                </>
              ) : (
                <span className="text-muted-foreground">created as</span>
              )}
              <StatusBadge status={item.status.toStatus} />
            </li>
          ) : (
            <li
              key={`n-${item.note.id}`}
              className="group flex items-start gap-2 text-xs"
            >
              <span className="font-data w-24 shrink-0 pt-px text-muted-foreground">
                {formatStamp(item.ts)}
              </span>
              <MessageSquare
                className="mt-0.5 size-3 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span className="min-w-0 flex-1 whitespace-pre-wrap">
                {item.note.note}
              </span>
              <button
                type="button"
                aria-label="Delete note"
                className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                onClick={() => removeActivity.mutate(item.note.id)}
              >
                <Trash2 className="size-3" aria-hidden />
              </button>
            </li>
          ),
        )}
      </ol>
    </div>
  );
}

export function JobDrawer({ jobId, onClose }: JobDrawerProps) {
  const { data: job } = useJob(jobId);
  const updateJob = useUpdateJob();
  const deleteJob = useDeleteJob();
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draftKey, setDraftKey] = useState<string | null>(null);

  // Reset the draft during render whenever a different job (or fresher copy)
  // arrives — React's documented alternative to setState-in-effect.
  const incomingKey = job ? `${job.id}:${job.updatedAt}` : null;
  if (incomingKey !== draftKey) {
    setDraftKey(incomingKey);
    setDraft(job ? toDraft(job) : null);
    setError(null);
  }

  const set = <K extends keyof DraftState>(key: K, value: DraftState[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  const save = () => {
    if (!job || !draft) return;
    const parsed = jobPatchSchema.safeParse(draft);
    if (!parsed.success) {
      setError(
        parsed.error.issues
          .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
          .join("; "),
      );
      return;
    }
    setError(null);
    updateJob.mutate(
      { id: job.id, patch: parsed.data },
      { onSuccess: onClose },
    );
  };

  const today = new Date();
  const lastChange = job?.statusHistory.at(-1)?.changedAt ?? job?.createdAt;
  const due = isFollowUpDue(job?.followUpDate ?? null, today);
  const applied = daysSinceApplied(job?.dateApplied ?? null, today);

  return (
    <Sheet open={jobId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg">
        {job && draft ? (
          <>
            <SheetHeader className="space-y-2 pb-2">
              <div className="flex items-center gap-2">
                <TierBadge tier={job.priorityTier} />
                <StatusBadge status={job.status} />
                {due ? <DueBadge /> : null}
              </div>
              <SheetTitle className="text-base leading-tight">
                {job.company} — {job.role}
              </SheetTitle>
              <SheetDescription>
                <span className="font-data flex gap-4 text-xs text-muted-foreground">
                  {applied !== null ? <span>applied {applied}d ago</span> : null}
                  <span>
                    {daysInCurrentStage(lastChange ?? job.createdAt, today)}d in{" "}
                    {job.status}
                  </span>
                  {job.postingUrl ? (
                    <a
                      href={job.postingUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      posting <ExternalLink className="size-3" aria-hidden />
                    </a>
                  ) : null}
                </span>
              </SheetDescription>
            </SheetHeader>

            <div className="grid grid-cols-2 gap-3 px-4 pb-4">
              <div className="space-y-1">
                <Label htmlFor="d-company">Company</Label>
                <Input
                  id="d-company"
                  value={draft.company}
                  onChange={(e) => set("company", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="d-role">Role</Label>
                <Input
                  id="d-role"
                  value={draft.role}
                  onChange={(e) => set("role", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Priority tier</Label>
                <Select
                  value={draft.priorityTier}
                  onValueChange={(v) => set("priorityTier", v as Tier)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIERS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select
                  value={draft.status}
                  onValueChange={(v) => set("status", v as Status)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="d-applied">Date applied</Label>
                <Input
                  id="d-applied"
                  type="date"
                  value={draft.dateApplied}
                  onChange={(e) => set("dateApplied", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="d-followup">Follow-up date</Label>
                <Input
                  id="d-followup"
                  type="date"
                  value={draft.followUpDate}
                  onChange={(e) => set("followUpDate", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="d-comp">Comp notes</Label>
                <Input
                  id="d-comp"
                  value={draft.compNotes}
                  onChange={(e) => set("compNotes", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="d-contact">Contact</Label>
                <Input
                  id="d-contact"
                  value={draft.contact}
                  onChange={(e) => set("contact", e.target.value)}
                />
              </div>
              <div className="col-span-2 space-y-1">
                <Label htmlFor="d-next">Next action</Label>
                <Input
                  id="d-next"
                  value={draft.nextAction}
                  onChange={(e) => set("nextAction", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="d-url">Posting URL</Label>
                <Input
                  id="d-url"
                  type="url"
                  value={draft.postingUrl}
                  onChange={(e) => set("postingUrl", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="d-resume">Resume version</Label>
                <Input
                  id="d-resume"
                  placeholder="e.g. v3-platform"
                  value={draft.resumeVersion}
                  onChange={(e) => set("resumeVersion", e.target.value)}
                />
              </div>
              <div className="col-span-2 space-y-1">
                <Label htmlFor="d-notes">Notes</Label>
                <Textarea
                  id="d-notes"
                  rows={4}
                  value={draft.notes}
                  onChange={(e) => set("notes", e.target.value)}
                />
              </div>
              {error ? (
                <p role="alert" className="col-span-2 text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <div className="col-span-2 flex items-center justify-between pt-1">
                <AlertDialog>
                  <AlertDialogTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-destructive hover:text-destructive"
                      />
                    }
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    Delete
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this job?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {job.company} — {job.role} and its status history will be
                        removed permanently.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() =>
                          deleteJob.mutate(job.id, { onSuccess: onClose })
                        }
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={save} disabled={updateJob.isPending}>
                    {updateJob.isPending ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              </div>
            </div>

            <Separator />
            <div className="space-y-2 p-4 pb-0">
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Journey
              </h3>
              <StageJourney
                history={job.statusHistory}
                currentStatus={job.status}
              />
            </div>
            <div className="space-y-2 p-4 pb-0">
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Contacts
              </h3>
              <ContactsSection jobId={job.id} contacts={job.contacts} />
            </div>

            <div className="space-y-2 p-4">
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Timeline
              </h3>
              <Timeline job={job} />
            </div>
          </>
        ) : (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        )}
      </SheetContent>
    </Sheet>
  );
}
