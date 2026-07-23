import { Check, X } from "lucide-react";
import { fmtDay, type BookedStep } from "@/app/prep/types";
import { StatusBadge } from "@/components/badges";
import { cn } from "@/lib/utils";
import type { Job } from "@/lib/types";

interface ChecklistItem {
  label: string;
  done: boolean;
}

function readinessItems(step: BookedStep, job?: Job): ChecklistItem[] {
  return [
    { label: "Resume assigned", done: !!job?.resumeId },
    { label: "JD snapshot saved", done: !!job?.jdSnapshot },
    { label: "Skill match checked", done: !!job?.skillMatch },
    { label: "Questions prepared", done: step.questions.length > 0 },
  ];
}

function ReadinessRow({
  step,
  job,
  onOpen,
}: {
  step: BookedStep;
  job?: Job;
  onOpen: (id: string) => void;
}) {
  const items = readinessItems(step, job);
  const doneCount = items.filter((i) => i.done).length;
  return (
    <div className="rounded-md border p-2.5">
      <div className="flex items-center gap-2">
        <StatusBadge status={step.stage} />
        <p className="min-w-0 flex-1 truncate text-sm font-medium">
          {step.company}
          <span className="ml-2 font-normal text-muted-foreground">
            {step.role}
          </span>
        </p>
        <span className="font-data shrink-0 text-xs text-muted-foreground">
          {fmtDay(step.scheduledFor)}
        </span>
        <span
          className={cn(
            "font-data shrink-0 rounded-sm border px-1 text-[10px]",
            doneCount === items.length
              ? "border-status-offer/40 bg-status-offer/10 text-status-offer"
              : "border-status-assessment/40 bg-status-assessment/10 text-status-assessment",
          )}
        >
          {doneCount}/{items.length}
        </span>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {items.map((item) => (
          <li key={item.label}>
            {item.done ? (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Check className="size-3 text-status-offer" aria-hidden />
                {item.label}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onOpen(step.jobId)}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary"
              >
                <X className="size-3 text-due" aria-hidden />
                {item.label}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ChecklistView({
  steps,
  jobs,
  onOpen,
}: {
  steps: BookedStep[];
  jobs: Job[];
  onOpen: (id: string) => void;
}) {
  if (steps.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing booked ahead — nothing to check readiness for yet.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {steps.map((step) => (
        <ReadinessRow
          key={`${step.jobId}-${step.stage}`}
          step={step}
          job={jobs.find((j) => j.id === step.jobId)}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}
