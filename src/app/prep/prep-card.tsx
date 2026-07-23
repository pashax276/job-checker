"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Pencil, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PrepRail } from "@/app/prep/prep-rail";
import { countdown, fmtDay, type BookedStep } from "@/app/prep/types";
import { StatusBadge } from "@/components/badges";
import { PrepMarkdown } from "@/components/prep-markdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { toLocalIsoDate } from "@/lib/dates";
import { splitPrepNotes } from "@/lib/prep-notes";
import { parseStoredSkillMatch } from "@/lib/skill-match";
import type { Job } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Shared by PrepCard (Stack view) and the Agenda view's detail pane. */
export function usePrepNotesSave(step: BookedStep) {
  const qc = useQueryClient();
  return useMutation({
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
}

export function PrepNotes({
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const skipNextAutoFocus = useRef(true);
  useEffect(() => {
    if (skipNextAutoFocus.current) {
      skipNextAutoFocus.current = false;
      return;
    }
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  if (!editing) {
    // The "Questions to ask" portion (if any) renders in the card's rail
    // as an independent, structured list — see PrepRail — so only the
    // main narrative goes here.
    const { main } = splitPrepNotes(initial);
    return (
      <div className="group relative rounded-md border bg-muted/20 p-3">
        <Button
          size="sm"
          variant="ghost"
          className="absolute top-1.5 right-1.5 h-6 gap-1 text-[10px] opacity-0 transition-opacity group-hover:opacity-100"
          onClick={() => {
            setValue(initial);
            setEditing(true);
          }}
        >
          <Pencil className="size-3" aria-hidden />
          Edit
        </Button>
        <PrepMarkdown text={main} />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Textarea
        ref={textareaRef}
        rows={4}
        placeholder={
          "Questions to ask, stories to have ready, topics to review…\n" +
          "• Why this company / why now\n• STAR story for an incident\n• Their stack questions"
        }
        className="field-sizing-content min-h-24 resize-y text-sm"
        value={value}
        onChange={(e) => setValue(e.target.value)}
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

export function PrepCard({
  step,
  jobs,
  onOpen,
  past,
  aiEnabled,
  highlighted,
}: {
  step: BookedStep;
  jobs: Job[];
  onOpen: (id: string) => void;
  past?: boolean;
  aiEnabled?: boolean;
  highlighted?: boolean;
}) {
  const qc = useQueryClient();
  const todayIso = toLocalIsoDate(new Date());
  const job = jobs.find((j) => j.id === step.jobId);
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
    <Card
      data-job-id={step.jobId}
      className={cn(
        past && "opacity-70",
        highlighted && "ring-2 ring-primary transition-shadow",
      )}
    >
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
      <CardContent className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_240px]">
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
      </CardContent>
    </Card>
  );
}
