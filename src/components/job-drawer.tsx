"use client";

import { ArrowRight, Copy, ExternalLink, MessageSquare, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { JobFormFields } from "@/components/job-form-fields";
import { StageJourney } from "@/components/stage-journey";
import {
  useDeleteJob,
  useJob,
  useJobExtras,
  useUpdateJob,
} from "@/hooks/use-jobs";
import {
  daysInCurrentStage,
  daysSinceApplied,
  isFollowUpDue,
  toLocalIsoDate,
} from "@/lib/dates";
import { followUpEmail } from "@/lib/follow-up-email";
import {
  jobToFormValues,
  validateJobForm,
  type JobFormErrors,
  type JobFormValues,
} from "@/lib/job-form";
import { cn } from "@/lib/utils";
import { jobPatchSchema } from "@/lib/schemas";
import { SCHEDULABLE_STAGES } from "@/lib/constants";
import type {
  ActivityEntry,
  Contact,
  JobDetail,
  StageScheduleEntry,
  StatusHistoryEntry,
} from "@/lib/types";

interface JobDrawerProps {
  jobId: string | null;
  onClose: () => void;
}

function formatStamp(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const CONTACT_ROLES = [
  "Recruiter",
  "HR",
  "Hiring Manager",
  "Director of Engineering",
  "Engineer",
  "Founder",
];

function ContactsSection({
  jobId,
  contacts,
}: {
  jobId: string;
  contacts: Contact[];
}) {
  const { addContact, touchContact, removeContact } = useJobExtras(jobId);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

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
            {contact.phone ? (
              <a
                href={`tel:${contact.phone}`}
                className="font-data block truncate text-muted-foreground hover:text-primary hover:underline"
              >
                {contact.phone}
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
        className="grid grid-cols-2 gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          addContact.mutate(
            {
              name: name.trim(),
              ...(role.trim() ? { role: role.trim() } : {}),
              ...(email.trim() ? { email: email.trim() } : {}),
              ...(phone.trim() ? { phone: phone.trim() } : {}),
            },
            {
              onSuccess: () => {
                setName("");
                setRole("");
                setEmail("");
                setPhone("");
              },
            },
          );
        }}
      >
        <Input
          placeholder="Name"
          aria-label="Contact name"
          className="h-7 text-xs"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          placeholder="Position — HR, Director of Eng…"
          aria-label="Contact position"
          list="contact-roles"
          className="h-7 text-xs"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        />
        <datalist id="contact-roles">
          {CONTACT_ROLES.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
        <Input
          placeholder="Email (optional)"
          aria-label="Contact email"
          type="email"
          className="h-7 text-xs"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div className="flex gap-1.5">
          <Input
            placeholder="Phone (optional)"
            aria-label="Contact phone"
            type="tel"
            className="h-7 text-xs"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
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
        </div>
      </form>
    </div>
  );
}

function ScheduleSection({
  jobId,
  schedule,
}: {
  jobId: string;
  schedule: StageScheduleEntry[];
}) {
  const { setSchedule, clearSchedule } = useJobExtras(jobId);
  const byStage = new Map(schedule.map((s) => [s.stage, s.scheduledFor]));

  return (
    <div className="space-y-1">
      {SCHEDULABLE_STAGES.map((stage) => {
        const booked = byStage.get(stage) ?? "";
        return (
          <div key={stage} className="flex items-center gap-2">
            <span className="w-28 shrink-0">
              <StatusBadge status={stage} />
            </span>
            <Input
              type="date"
              aria-label={`${stage} date`}
              className="h-7 flex-1 text-xs"
              value={booked}
              onChange={(e) => {
                const v = e.target.value;
                if (v) setSchedule.mutate({ stage, scheduledFor: v });
                else if (booked) clearSchedule.mutate(stage);
              }}
            />
            {booked ? (
              <button
                type="button"
                aria-label={`Clear ${stage} date`}
                className="text-muted-foreground hover:text-destructive"
                onClick={() => clearSchedule.mutate(stage)}
              >
                <Trash2 className="size-3" aria-hidden />
              </button>
            ) : (
              <span className="w-3" aria-hidden />
            )}
          </div>
        );
      })}
    </div>
  );
}

function FollowUpEmailSection({ job }: { job: JobDetail }) {
  const [expanded, setExpanded] = useState(false);
  const contactName = job.contacts[0]?.name.split(" ")[0] ?? null;
  const draft = followUpEmail(job, contactName);
  const due = isFollowUpDue(job.followUpDate, new Date());

  const copy = () => {
    void navigator.clipboard.writeText(
      `Subject: ${draft.subject}\n\n${draft.body}`,
    );
    toast.success("Follow-up email copied");
  };

  return (
    <div className="space-y-1.5 rounded-md border p-2.5">
      <div className="flex items-center gap-2">
        {due ? <DueBadge /> : null}
        <span className="min-w-0 flex-1 truncate text-xs font-medium">
          {draft.subject}
        </span>
        <Button
          size="sm"
          variant="outline"
          className="h-6 gap-1 text-[10px]"
          onClick={copy}
        >
          <Copy className="size-3" aria-hidden />
          Copy
        </Button>
      </div>
      <button
        type="button"
        className="w-full text-left"
        onClick={() => setExpanded((e) => !e)}
      >
        <p
          className={cn(
            "text-xs whitespace-pre-wrap text-muted-foreground",
            !expanded && "line-clamp-3",
          )}
        >
          {draft.body}
        </p>
        <span className="text-[10px] text-primary">
          {expanded ? "collapse" : "expand"}
        </span>
      </button>
      <p className="text-[10px] text-muted-foreground">
        Matched to the current status
        {contactName ? `, addressed to ${contactName}` : ""} — tweak before
        sending.
      </p>
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
  const [draft, setDraft] = useState<JobFormValues | null>(null);
  const [errors, setErrors] = useState<JobFormErrors>({});
  const [draftKey, setDraftKey] = useState<string | null>(null);

  // Reset the draft during render whenever a different job (or fresher copy)
  // arrives — React's documented alternative to setState-in-effect.
  const incomingKey = job ? `${job.id}:${job.updatedAt}` : null;
  if (incomingKey !== draftKey) {
    setDraftKey(incomingKey);
    setDraft(job ? jobToFormValues(job) : null);
    setErrors({});
  }

  const set = <K extends keyof JobFormValues>(
    key: K,
    value: JobFormValues[K],
  ) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  const dirty =
    job !== undefined &&
    draft !== null &&
    JSON.stringify(draft) !== JSON.stringify(jobToFormValues(job));

  const save = () => {
    if (!job || !draft || !dirty) return;
    const result = validateJobForm(draft);
    if (!result.data) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    const { id: _seedId, ...fields } = result.data;
    updateJob.mutate(
      { id: job.id, patch: jobPatchSchema.parse(fields) },
      { onSuccess: onClose },
    );
  };

  const today = new Date();
  const lastChange = job?.statusHistory.at(-1)?.changedAt ?? job?.createdAt;
  const due = isFollowUpDue(job?.followUpDate ?? null, today);
  const applied = daysSinceApplied(job?.dateApplied ?? null, today);

  return (
    <Sheet open={jobId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto data-[side=right]:sm:max-w-xl data-[side=right]:lg:max-w-4xl">
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

            <div className="grid lg:grid-cols-[5fr_4fr]">
            <div
              className="space-y-3 px-4 pb-4 lg:border-r"
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  save();
                }
              }}
            >
              <JobFormFields
                values={draft}
                errors={errors}
                onChange={set}
                idPrefix="edit"
                hiddenFields={["dateApplied"]}
              />
              <div className="flex items-center justify-between pt-1">
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
                <div className="flex items-center gap-2">
                  {dirty ? (
                    <span className="text-[11px] text-muted-foreground">
                      unsaved changes
                    </span>
                  ) : null}
                  <Button variant="ghost" size="sm" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={save}
                    disabled={updateJob.isPending || !dirty}
                  >
                    {updateJob.isPending ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              </div>
            </div>

            <div className="border-t lg:border-t-0">
              <div className="space-y-2 p-4 pb-0">
                <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Journey
                </h3>
                <StageJourney
                  history={job.statusHistory}
                  currentStatus={job.status}
                  schedule={Object.fromEntries(
                    job.schedule.map((s) => [s.stage, s.scheduledFor]),
                  )}
                />
              </div>
              <div className="space-y-2 p-4 pb-0">
                <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Scheduled steps
                </h3>
                <ScheduleSection jobId={job.id} schedule={job.schedule} />
              </div>
              <div className="space-y-2 p-4 pb-0">
                <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Contacts
                </h3>
                <ContactsSection jobId={job.id} contacts={job.contacts} />
              </div>
              <div className="space-y-2 p-4 pb-0">
                <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Follow-up email
                </h3>
                <FollowUpEmailSection job={job} />
              </div>
              <div className="space-y-2 p-4">
                <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Timeline
                </h3>
                <Timeline job={job} />
              </div>
            </div>
            </div>
          </>
        ) : (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        )}
      </SheetContent>
    </Sheet>
  );
}
