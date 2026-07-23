import { IcsButton, ResearchLinks } from "@/app/prep/research-links";
import type { BookedStep } from "@/app/prep/types";
import { PrepQuestionsList } from "@/components/prep-questions-list";
import { splitPrepNotes } from "@/lib/prep-notes";
import type { Job } from "@/lib/types";

/** Research links, JD snapshot, skill gaps, and the structured questions
 * list — shared between the Stack view's per-card rail and the Agenda
 * view's detail pane, so both stay in sync automatically. */
export function PrepRail({
  step,
  job,
  missing,
}: {
  step: BookedStep;
  job?: Job;
  missing: string[];
}) {
  const { sidebar } = splitPrepNotes(step.prepNotes ?? "");
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          Research
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <ResearchLinks company={step.company} />
          <IcsButton step={step} />
        </div>
      </div>
      {job?.jdSnapshot ? (
        <details>
          <summary className="cursor-pointer text-[10px] font-medium tracking-wide text-primary uppercase hover:underline">
            JD snapshot
          </summary>
          <p className="mt-1 max-h-48 overflow-y-auto rounded-md border bg-muted/40 p-2 text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {job.jdSnapshot}
          </p>
        </details>
      ) : null}
      {missing.length > 0 ? (
        <div className="space-y-1">
          <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            Study up
          </p>
          <p className="flex flex-wrap items-center gap-1">
            {missing.map((skill) => (
              <span
                key={skill}
                className="rounded-sm border border-status-assessment/40 bg-status-assessment/10 px-1 text-[10px] text-status-assessment"
              >
                {skill}
              </span>
            ))}
          </p>
        </div>
      ) : null}
      <PrepQuestionsList
        jobId={step.jobId}
        stage={step.stage}
        questions={step.questions}
        markdownFallback={sidebar}
      />
    </div>
  );
}
