"use client";

import { Check, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useJobExtras } from "@/hooks/use-jobs";
import { EDD_STAGES, type EddStage, type Status } from "@/lib/constants";
import { formatStamp, toLocalIsoDate } from "@/lib/dates";
import { defaultEddStage } from "@/lib/edd";
import type { EddReport } from "@/lib/types";
import { cn } from "@/lib/utils";

interface EddSectionProps {
  jobId: string;
  /** The job's current status — the stage offered first. */
  status: Status;
  reports: EddReport[];
}

/**
 * Which stages of this job already went on an EDD certification as a
 * work-search contact, and the control to mark another. One report per
 * stage: marking a reported stage again corrects its date.
 */
export function EddSection({ jobId, status, reports }: EddSectionProps) {
  const { setEddReport, clearEddReport } = useJobExtras(jobId);
  const [picked, setPicked] = useState<EddStage | null>(null);
  const [reportedOn, setReportedOn] = useState(() =>
    toLocalIsoDate(new Date()),
  );

  const byStage = new Map(reports.map((report) => [report.stage, report]));
  const stage =
    picked ??
    defaultEddStage(
      status,
      reports.map((report) => report.stage),
    );
  const alreadyReported = byStage.has(stage);

  return (
    <div className="space-y-2">
      <ul className="flex flex-wrap gap-1.5" aria-label="EDD reports by stage">
        {EDD_STAGES.map((s) => {
          const report = byStage.get(s);
          return report ? (
            <li
              key={s}
              title={`Reported to EDD on ${formatStamp(report.reportedOn)}`}
              className="inline-flex items-center gap-1 rounded-sm border border-primary/40 bg-primary/10 py-px pr-0.5 pl-1.5 text-[11px] leading-4 text-primary"
            >
              <Check className="size-3 shrink-0" aria-hidden />
              <span>{s}</span>
              <span className="font-data text-[10px] text-primary/80">
                {report.reportedOn.slice(5).replace("-", "/")}
              </span>
              <button
                type="button"
                aria-label={`Remove EDD report for ${s}`}
                className="rounded-sm p-0.5 text-primary/60 transition-colors hover:text-destructive"
                disabled={clearEddReport.isPending}
                onClick={() => clearEddReport.mutate(s)}
              >
                <X className="size-3" aria-hidden />
              </button>
            </li>
          ) : (
            <li key={s}>
              <button
                type="button"
                aria-pressed={stage === s}
                title={`Not reported to EDD — select ${s}`}
                className={cn(
                  "rounded-sm border px-1.5 py-px text-[11px] leading-4 text-muted-foreground transition-colors hover:border-ring/40 hover:text-foreground",
                  stage === s && "border-ring/60 text-foreground",
                )}
                onClick={() => setPicked(s)}
              >
                {s}
              </button>
            </li>
          );
        })}
      </ul>
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!reportedOn) return;
          setEddReport.mutate(
            { stage, reportedOn },
            { onSuccess: () => setPicked(null) },
          );
        }}
      >
        <Select
          value={stage}
          onValueChange={(v) => v && setPicked(v as EddStage)}
        >
          <SelectTrigger
            size="sm"
            aria-label="EDD stage"
            className="h-7 min-w-0 flex-1 text-xs"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EDD_STAGES.map((s) => (
              <SelectItem key={s} value={s} className="text-xs">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          aria-label="Date reported to EDD"
          className="h-7 min-w-0 flex-1 text-xs"
          value={reportedOn}
          onChange={(e) => setReportedOn(e.target.value)}
        />
        <Button
          type="submit"
          size="sm"
          variant="outline"
          className="h-7 shrink-0 text-xs"
          disabled={setEddReport.isPending || !reportedOn}
        >
          {alreadyReported ? "Update date" : "Mark reported"}
        </Button>
      </form>
    </div>
  );
}
