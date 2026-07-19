"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, GraduationCap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/badges";
import { JobDrawer } from "@/components/job-drawer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { toLocalIsoDate } from "@/lib/dates";
import { parseStoredSkillMatch } from "@/lib/skill-match";
import type { Status } from "@/lib/constants";
import type { Job } from "@/lib/types";

interface BookedStep {
  jobId: string;
  company: string;
  role: string;
  stage: Status;
  scheduledFor: string;
  prepNotes: string | null;
  status: Status;
  postingUrl: string | null;
}

function fmtDay(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function countdown(iso: string, todayIso: string): string {
  const diff = Math.round(
    (new Date(`${iso}T12:00:00`).getTime() -
      new Date(`${todayIso}T12:00:00`).getTime()) /
      86_400_000,
  );
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff > 1) return `in ${diff}d`;
  return `${-diff}d ago`;
}

function PrepCard({
  step,
  jobs,
  onOpen,
  past,
}: {
  step: BookedStep;
  jobs: Job[];
  onOpen: (id: string) => void;
  past?: boolean;
}) {
  const qc = useQueryClient();
  const todayIso = toLocalIsoDate(new Date());
  const job = jobs.find((j) => j.id === step.jobId);
  const missing = job
    ? (parseStoredSkillMatch(job.skillMatch)?.missing ?? [])
    : [];

  const save = useMutation({
    mutationFn: (prepNotes: string | null) =>
      api(`/api/jobs/${step.jobId}/schedule`, {
        method: "PUT",
        body: JSON.stringify({
          stage: step.stage,
          scheduledFor: step.scheduledFor,
          prepNotes,
        }),
      }),
    onSuccess: () => {
      toast.success("Prep notes saved");
      void qc.invalidateQueries({ queryKey: ["schedule"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Card className={past ? "opacity-70" : undefined}>
      <CardHeader className="flex-row items-center gap-3 pb-2">
        <div className="w-24 shrink-0">
          <div className="font-data text-xs text-muted-foreground">
            {fmtDay(step.scheduledFor)}
          </div>
          <div
            className={
              step.scheduledFor === todayIso
                ? "font-data text-xs font-semibold text-primary"
                : "font-data text-xs text-muted-foreground"
            }
          >
            {countdown(step.scheduledFor, todayIso)}
          </div>
        </div>
        <StatusBadge status={step.stage} />
        <CardTitle className="min-w-0 flex-1 truncate text-sm">
          {step.company}
          <span className="ml-2 font-normal text-muted-foreground">
            {step.role}
          </span>
        </CardTitle>
        {step.postingUrl ? (
          <a
            href={step.postingUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-muted-foreground hover:text-primary"
            aria-label="Open posting"
          >
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-xs"
          onClick={() => onOpen(step.jobId)}
        >
          Open job
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {missing.length > 0 ? (
          <p className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
            <span className="mr-1">Study up (JD asks, resume doesn&apos;t):</span>
            {missing.map((skill) => (
              <span
                key={skill}
                className="rounded-sm border border-status-assessment/40 bg-status-assessment/10 px-1 text-[10px] text-status-assessment"
              >
                {skill}
              </span>
            ))}
          </p>
        ) : null}
        <PrepNotes
          initial={step.prepNotes ?? ""}
          disabled={save.isPending}
          onSave={(text) => save.mutate(text || null)}
        />
      </CardContent>
    </Card>
  );
}

function PrepNotes({
  initial,
  disabled,
  onSave,
}: {
  initial: string;
  disabled: boolean;
  onSave: (text: string) => void;
}) {
  const [value, setValue] = useState(initial);
  const dirty = value.trim() !== initial.trim();
  return (
    <div className="space-y-1.5">
      <Textarea
        rows={4}
        placeholder={
          "Questions to ask, stories to have ready, topics to review…\n" +
          "• Why this company / why now\n• STAR story for an incident\n• Their stack questions"
        }
        className="field-sizing-content min-h-24 resize-y text-sm"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <div className="flex justify-end">
        <Button
          size="sm"
          className="h-7 text-xs"
          disabled={disabled || !dirty}
          onClick={() => onSave(value.trim())}
        >
          Save notes
        </Button>
      </div>
    </div>
  );
}

export default function PrepPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: steps, isLoading } = useQuery({
    queryKey: ["schedule"],
    queryFn: () => api<BookedStep[]>("/api/schedule"),
  });
  const { data: jobs } = useQuery({
    queryKey: ["jobs", "list", ""],
    queryFn: () => api<Job[]>("/api/jobs"),
  });

  if (isLoading || !steps) {
    return <div className="p-6 text-sm text-muted-foreground">Loading prep…</div>;
  }

  const todayIso = toLocalIsoDate(new Date());
  const upcoming = steps.filter((s) => s.scheduledFor >= todayIso);
  const pastSteps = steps
    .filter((s) => s.scheduledFor < todayIso)
    .reverse();

  return (
    <div className="max-w-4xl space-y-4 p-4">
      <header className="flex items-center gap-2">
        <GraduationCap className="size-4 text-muted-foreground" aria-hidden />
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            Interview prep
          </h1>
          <p className="text-sm text-muted-foreground">
            One workspace per booked step — book dates in a job&apos;s
            Scheduled steps.
          </p>
        </div>
      </header>

      {upcoming.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing booked ahead. When you schedule a screen or interview on a
          job, it appears here with room for prep notes.
        </p>
      ) : (
        <div className="space-y-3">
          {upcoming.map((step) => (
            <PrepCard
              key={`${step.jobId}-${step.stage}`}
              step={step}
              jobs={jobs ?? []}
              onOpen={setSelectedId}
            />
          ))}
        </div>
      )}

      {pastSteps.length > 0 ? (
        <>
          <h2 className="pt-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Past interviews
          </h2>
          <div className="space-y-3">
            {pastSteps.map((step) => (
              <PrepCard
                key={`${step.jobId}-${step.stage}`}
                step={step}
                jobs={jobs ?? []}
                onOpen={setSelectedId}
                past
              />
            ))}
          </div>
        </>
      ) : null}

      <JobDrawer jobId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
