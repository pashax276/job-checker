"use client";

import { useState } from "react";
import { DocumentCard } from "@/app/resumes/document-card";
import { computeSkillUniverse, resumeCoverage } from "@/app/resumes/skill-universe";
import { cn } from "@/lib/utils";
import type { DocumentMeta, Job } from "@/lib/types";

export function SplitView({
  docs,
  jobs,
  onOpenJob,
}: {
  docs: DocumentMeta[];
  jobs: Job[];
  onOpenJob: (id: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | undefined>(docs[0]?.id);
  const selected = docs.find((d) => d.id === selectedId) ?? docs[0];
  const universe = computeSkillUniverse(jobs);

  if (docs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing uploaded yet. Add your current resume to start linking
        versions to jobs.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
      <div className="space-y-1">
        {docs.map((doc) => {
          const usedByCount = jobs.filter(
            (j) => j.resumeId === doc.id || j.coverLetterId === doc.id,
          ).length;
          const coverage =
            doc.kind === "resume" ? resumeCoverage(doc.skills, universe) : null;
          return (
            <button
              key={doc.id}
              type="button"
              onClick={() => setSelectedId(doc.id)}
              className={cn(
                "block w-full rounded-md border p-2.5 text-left transition-colors hover:border-ring/40",
                doc.id === selected?.id
                  ? "border-primary bg-primary/5"
                  : "border-transparent",
              )}
            >
              <p className="truncate text-sm font-medium">{doc.name}</p>
              <p className="font-data text-xs text-muted-foreground">
                {usedByCount} job{usedByCount === 1 ? "" : "s"}
                {coverage && coverage.total > 0
                  ? ` · ${coverage.covered}/${coverage.total} skills`
                  : ""}
              </p>
            </button>
          );
        })}
      </div>
      {selected ? (
        <div className="rounded-lg border p-3">
          <DocumentCard doc={selected} jobs={jobs} onOpenJob={onOpenJob} bare />
        </div>
      ) : null}
    </div>
  );
}
