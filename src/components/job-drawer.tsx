"use client";

import { ArrowRight, ExternalLink, Trash2 } from "lucide-react";
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
import { useDeleteJob, useJob, useUpdateJob } from "@/hooks/use-jobs";
import { STATUSES, TIERS, type Status, type Tier } from "@/lib/constants";
import {
  daysInCurrentStage,
  daysSinceApplied,
  isFollowUpDue,
} from "@/lib/dates";
import { jobPatchSchema } from "@/lib/schemas";
import type { JobDetail } from "@/lib/types";

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
              <div className="col-span-2 space-y-1">
                <Label htmlFor="d-url">Posting URL</Label>
                <Input
                  id="d-url"
                  type="url"
                  value={draft.postingUrl}
                  onChange={(e) => set("postingUrl", e.target.value)}
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
            <div className="space-y-2 p-4">
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Status history
              </h3>
              <ol className="space-y-1.5">
                {[...job.statusHistory].reverse().map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center gap-2 text-xs"
                  >
                    <span className="font-data w-24 shrink-0 text-muted-foreground">
                      {formatStamp(entry.changedAt)}
                    </span>
                    {entry.fromStatus ? (
                      <>
                        <StatusBadge status={entry.fromStatus} />
                        <ArrowRight
                          className="size-3 text-muted-foreground"
                          aria-hidden
                        />
                      </>
                    ) : (
                      <span className="text-muted-foreground">created as</span>
                    )}
                    <StatusBadge status={entry.toStatus} />
                  </li>
                ))}
              </ol>
            </div>
          </>
        ) : (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        )}
      </SheetContent>
    </Sheet>
  );
}
