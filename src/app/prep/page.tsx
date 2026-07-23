"use client";

import { useQuery } from "@tanstack/react-query";
import { GraduationCap } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AgendaView } from "@/app/prep/agenda-view";
import { ChecklistView } from "@/app/prep/checklist-view";
import { PrepCard } from "@/app/prep/prep-card";
import type { BookedStep } from "@/app/prep/types";
import { JobDrawer } from "@/components/job-drawer";
import { Button } from "@/components/ui/button";
import { useAiStatus } from "@/hooks/use-jobs";
import { api } from "@/lib/api-client";
import { toLocalIsoDate } from "@/lib/dates";
import type { Job } from "@/lib/types";
import { cn } from "@/lib/utils";

type ViewMode = "stack" | "agenda" | "checklist";
const VIEW_MODES: Array<{ id: ViewMode; label: string }> = [
  { id: "stack", label: "Stack" },
  { id: "agenda", label: "Agenda" },
  { id: "checklist", label: "Checklist" },
];

function ViewSwitcher({
  view,
  onChange,
}: {
  view: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  return (
    <div className="flex shrink-0 gap-0.5 rounded-md border p-0.5">
      {VIEW_MODES.map((mode) => (
        <button
          key={mode.id}
          type="button"
          onClick={() => onChange(mode.id)}
          className={cn(
            "rounded-sm px-2 py-1 text-xs transition-colors",
            view === mode.id
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}

function PrepView() {
  const searchParams = useSearchParams();
  const jobParam = searchParams.get("job");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("stack");
  const { data: steps, isLoading } = useQuery({
    queryKey: ["schedule"],
    queryFn: () => api<BookedStep[]>("/api/schedule"),
  });
  const { data: jobs } = useQuery({
    queryKey: ["jobs", "list", ""],
    queryFn: () => api<Job[]>("/api/jobs"),
  });
  const { data: aiStatus } = useAiStatus();

  // Deep link from Table/Board's "prep" action: scroll the linked job's
  // card into view once its data (and the DOM node) exist. Only relevant
  // to Stack view — Agenda selects the job directly instead.
  useEffect(() => {
    if (view !== "stack") return;
    if (!jobParam || !steps?.some((s) => s.jobId === jobParam)) return;
    document
      .querySelector(`[data-job-id="${jobParam}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [jobParam, steps, view]);

  if (isLoading || !steps) {
    return <div className="p-6 text-sm text-muted-foreground">Loading prep…</div>;
  }

  const todayIso = toLocalIsoDate(new Date());
  const upcoming = steps.filter((s) => s.scheduledFor >= todayIso);
  const pastSteps = steps
    .filter((s) => s.scheduledFor < todayIso)
    .reverse();
  const linkedJobWithoutStep =
    jobParam && !steps.some((s) => s.jobId === jobParam)
      ? (jobs ?? []).find((j) => j.id === jobParam)
      : undefined;

  return (
    <div className="max-w-6xl space-y-4 p-4">
      <header className="flex items-center gap-2">
        <GraduationCap className="size-4 text-muted-foreground" aria-hidden />
        <div className="flex-1">
          <h1 className="text-lg font-semibold tracking-tight">
            Interview prep
          </h1>
          <p className="text-sm text-muted-foreground">
            One workspace per booked step — book dates in a job&apos;s
            Scheduled steps.
          </p>
        </div>
        <ViewSwitcher view={view} onChange={setView} />
      </header>

      {linkedJobWithoutStep ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
          <p className="min-w-0">
            Nothing booked yet for{" "}
            <span className="font-medium">{linkedJobWithoutStep.company}</span>{" "}
            — {linkedJobWithoutStep.role}. Book a stage date to start a prep
            workspace for it.
          </p>
          <Button
            size="sm"
            className="h-7 shrink-0 text-xs"
            onClick={() => setSelectedId(linkedJobWithoutStep.id)}
          >
            Open job
          </Button>
        </div>
      ) : null}

      {view === "agenda" ? (
        <AgendaView
          steps={[...upcoming, ...pastSteps]}
          jobs={jobs ?? []}
          aiEnabled={aiStatus?.enabled}
          onOpen={setSelectedId}
          highlightJobId={jobParam}
        />
      ) : view === "checklist" ? (
        <ChecklistView
          steps={upcoming}
          jobs={jobs ?? []}
          onOpen={setSelectedId}
        />
      ) : (
        <>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing booked ahead. When you schedule a screen or interview
              on a job, it appears here with room for prep notes.
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
                  highlighted={step.jobId === jobParam}
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
                    highlighted={step.jobId === jobParam}
                  />
                ))}
              </div>
            </>
          ) : null}
        </>
      )}

      <JobDrawer jobId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}

export default function PrepPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-muted-foreground">Loading prep…</div>
      }
    >
      <PrepView />
    </Suspense>
  );
}
