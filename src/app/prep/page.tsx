"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarPlus,
  ExternalLink,
  GraduationCap,
  Newspaper,
  Pencil,
  Sparkles,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/badges";
import { JobDrawer } from "@/components/job-drawer";
import { PrepMarkdown } from "@/components/prep-markdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAiStatus } from "@/hooks/use-jobs";
import { api } from "@/lib/api-client";
import { toLocalIsoDate } from "@/lib/dates";
import { buildTrackerCalendar } from "@/lib/ics";
import { splitPrepNotes } from "@/lib/prep-notes";
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
  outcome: "passed" | "failed" | null;
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

function downloadStepIcs(step: BookedStep) {
  const ics = buildTrackerCalendar(
    [],
    [
      {
        jobId: step.jobId,
        company: step.company,
        role: step.role,
        stage: step.stage,
        scheduledFor: step.scheduledFor,
      },
    ],
  );
  const blob = new Blob([ics], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${step.company.replace(/\W+/g, "-")}-${step.stage.replace(/\W+/g, "-")}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

function ResearchLinks({ company }: { company: string }) {
  const q = encodeURIComponent(company);
  const links = [
    {
      label: "News",
      icon: Newspaper,
      href: `https://news.google.com/search?q=${q}`,
    },
    {
      label: "People",
      icon: Users,
      href: `https://www.linkedin.com/search/results/people/?keywords=${q}`,
    },
    {
      label: "Reviews",
      icon: ExternalLink,
      href: `https://www.glassdoor.com/Search/results.htm?keyword=${q}`,
    },
  ];
  return (
    <span className="flex items-center gap-1">
      {links.map(({ label, icon: Icon, href }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 rounded-sm border px-1.5 py-px text-[10px] text-muted-foreground transition-colors hover:border-ring/50 hover:text-foreground"
        >
          <Icon className="size-2.5" aria-hidden />
          {label}
        </a>
      ))}
    </span>
  );
}

function PrepCard({
  step,
  jobs,
  onOpen,
  past,
  aiEnabled,
}: {
  step: BookedStep;
  jobs: Job[];
  onOpen: (id: string) => void;
  past?: boolean;
  aiEnabled?: boolean;
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

  const generateQuestions = useMutation({
    mutationFn: () =>
      api<{ text: string }>(`/api/jobs/${step.jobId}/ai`, {
        method: "POST",
        body: JSON.stringify({ kind: "prep", stage: step.stage }),
      }),
    onSuccess: ({ text }) => {
      const merged = [step.prepNotes, text].filter(Boolean).join("\n\n---\n\n");
      save.mutate(merged);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const setOutcome = useMutation({
    mutationFn: (outcome: "passed" | "failed" | null) =>
      api(`/api/jobs/${step.jobId}/schedule`, {
        method: "PATCH",
        body: JSON.stringify({ stage: step.stage, outcome }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["schedule"] });
      void qc.invalidateQueries({ queryKey: ["stats"] });
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
        {past ? (
          <span className="flex shrink-0 gap-1">
            <Button
              size="sm"
              variant={step.outcome === "passed" ? "default" : "outline"}
              className="h-6 px-2 text-[10px]"
              disabled={setOutcome.isPending}
              onClick={() =>
                setOutcome.mutate(step.outcome === "passed" ? null : "passed")
              }
            >
              Passed
            </Button>
            <Button
              size="sm"
              variant={step.outcome === "failed" ? "destructive" : "outline"}
              className="h-6 px-2 text-[10px]"
              disabled={setOutcome.isPending}
              onClick={() =>
                setOutcome.mutate(step.outcome === "failed" ? null : "failed")
              }
            >
              Failed
            </Button>
          </span>
        ) : null}
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
        <div className="flex flex-wrap items-center gap-2">
          <ResearchLinks company={step.company} />
          <button
            type="button"
            onClick={() => downloadStepIcs(step)}
            className="inline-flex items-center gap-1 rounded-sm border px-1.5 py-px text-[10px] text-muted-foreground transition-colors hover:border-ring/50 hover:text-foreground"
          >
            <CalendarPlus className="size-2.5" aria-hidden />
            .ics
          </button>
        </div>
        {job?.jdSnapshot ? (
          <details>
            <summary className="cursor-pointer text-[10px] text-primary hover:underline">
              job description snapshot
            </summary>
            <p className="mt-1 max-h-48 overflow-y-auto rounded-md border bg-muted/40 p-2 text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
              {job.jdSnapshot}
            </p>
          </details>
        ) : null}
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
        {aiEnabled ? (
          <Button
            size="sm"
            variant="outline"
            className="h-6 gap-1 text-[10px]"
            disabled={generateQuestions.isPending}
            onClick={() => generateQuestions.mutate()}
          >
            <Sparkles className="size-3" aria-hidden />
            {generateQuestions.isPending
              ? "Thinking…"
              : "Generate likely questions (AI)"}
          </Button>
        ) : null}
        <PrepNotes
          key={`${step.prepNotes?.length ?? 0}`}
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
  // Freshly-generated or pasted-in briefs are meant to be read, not edited —
  // default to a rendered view and drop into the raw textarea on demand.
  // Blank notes go straight to editing since there's nothing to read yet.
  const [editing, setEditing] = useState(initial.trim().length === 0);
  const [value, setValue] = useState(initial);
  const dirty = value.trim() !== initial.trim();

  if (!editing) {
    const { main, sidebar } = splitPrepNotes(initial);
    return (
      <div className="group relative rounded-md border bg-muted/20 p-3">
        <Button
          size="sm"
          variant="ghost"
          className="absolute top-1.5 right-1.5 h-6 gap-1 text-[10px] opacity-0 transition-opacity group-hover:opacity-100"
          onClick={() => setEditing(true)}
        >
          <Pencil className="size-3" aria-hidden />
          Edit
        </Button>
        <div
          className={
            sidebar
              ? "grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]"
              : undefined
          }
        >
          <PrepMarkdown text={main} />
          {sidebar ? (
            <div className="border-t pt-2 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-4">
              <PrepMarkdown text={sidebar} />
            </div>
          ) : null}
        </div>
      </div>
    );
  }

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
        autoFocus={initial.trim().length === 0}
      />
      <div className="flex justify-end gap-2">
        {initial.trim().length > 0 ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => {
              setValue(initial);
              setEditing(false);
            }}
          >
            Cancel
          </Button>
        ) : null}
        <Button
          size="sm"
          className="h-7 text-xs"
          disabled={disabled || !dirty}
          onClick={() => {
            onSave(value.trim());
            setEditing(false);
          }}
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
  const { data: aiStatus } = useAiStatus();

  if (isLoading || !steps) {
    return <div className="p-6 text-sm text-muted-foreground">Loading prep…</div>;
  }

  const todayIso = toLocalIsoDate(new Date());
  const upcoming = steps.filter((s) => s.scheduledFor >= todayIso);
  const pastSteps = steps
    .filter((s) => s.scheduledFor < todayIso)
    .reverse();

  return (
    <div className="max-w-6xl space-y-4 p-4">
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
              aiEnabled={aiStatus?.enabled}
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
                aiEnabled={aiStatus?.enabled}
              />
            ))}
          </div>
        </>
      ) : null}

      <JobDrawer jobId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
