"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PrepNotes, usePrepNotesSave } from "@/app/prep/prep-card";
import { PrepRail } from "@/app/prep/prep-rail";
import { fmtDay, type BookedStep } from "@/app/prep/types";
import { StatusBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { toLocalIsoDate } from "@/lib/dates";
import { parseStoredSkillMatch } from "@/lib/skill-match";
import type { Job } from "@/lib/types";
import { cn } from "@/lib/utils";

function stepKey(step: BookedStep): string {
  return `${step.jobId}-${step.stage}`;
}

function StepDetail({
  step,
  job,
  aiEnabled,
  onOpen,
}: {
  step: BookedStep;
  job?: Job;
  aiEnabled?: boolean;
  onOpen: (id: string) => void;
}) {
  const qc = useQueryClient();
  const todayIso = toLocalIsoDate(new Date());
  const past = step.scheduledFor < todayIso;
  const missing = job
    ? (parseStoredSkillMatch(job.skillMatch)?.missing ?? [])
    : [];
  const save = usePrepNotesSave(step);
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
    <div className="rounded-lg border">
      <div className="flex items-center gap-3 border-b p-3">
        <StatusBadge status={step.stage} />
        <p className="min-w-0 flex-1 truncate text-sm font-medium">
          {step.company}
          <span className="ml-2 font-normal text-muted-foreground">
            {step.role}
          </span>
        </p>
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
            className="shrink-0 text-muted-foreground hover:text-primary"
            aria-label="Open posting"
          >
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          className="h-6 shrink-0 text-xs"
          onClick={() => onOpen(step.jobId)}
        >
          Open job
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-4 p-3 lg:grid-cols-[1fr_240px]">
        <div className="min-w-0 space-y-2">
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
        </div>
        <aside className="lg:border-l lg:pl-4">
          <PrepRail step={step} job={job} missing={missing} />
        </aside>
      </div>
    </div>
  );
}

export function AgendaView({
  steps,
  jobs,
  aiEnabled,
  onOpen,
  highlightJobId,
}: {
  steps: BookedStep[];
  jobs: Job[];
  aiEnabled?: boolean;
  onOpen: (id: string) => void;
  highlightJobId?: string | null;
}) {
  const todayIso = toLocalIsoDate(new Date());
  const defaultKey =
    steps.find((s) => s.jobId === highlightJobId) ?? steps[0];
  const [selectedKey, setSelectedKey] = useState<string | undefined>(
    defaultKey ? stepKey(defaultKey) : undefined,
  );
  const selected =
    steps.find((s) => stepKey(s) === selectedKey) ?? steps[0] ?? null;

  if (steps.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing booked. When you schedule a screen or interview on a job, it
        appears here.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
      <div className="space-y-1">
        {steps.map((step) => {
          const active = stepKey(step) === stepKey(selected!);
          const past = step.scheduledFor < todayIso;
          return (
            <button
              key={stepKey(step)}
              type="button"
              onClick={() => setSelectedKey(stepKey(step))}
              className={cn(
                "block w-full rounded-md border p-2 text-left transition-colors hover:border-ring/40",
                active ? "border-primary bg-primary/5" : "border-transparent",
                past && !active && "opacity-60",
              )}
            >
              <span className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    step.scheduledFor === todayIso
                      ? "bg-primary"
                      : "bg-muted-foreground/40",
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {step.company}
                </span>
              </span>
              <p className="font-data pl-3 text-xs text-muted-foreground">
                {fmtDay(step.scheduledFor)} · {step.stage}
              </p>
            </button>
          );
        })}
      </div>
      {selected ? (
        <StepDetail
          key={stepKey(selected)}
          step={selected}
          job={jobs.find((j) => j.id === selected.jobId)}
          aiEnabled={aiEnabled}
          onOpen={onOpen}
        />
      ) : null}
    </div>
  );
}
