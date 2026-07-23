"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CoverageMatrix } from "@/app/resumes/coverage-matrix";
import { ListView } from "@/app/resumes/list-view";
import { SplitView } from "@/app/resumes/split-view";
import { UploadZone } from "@/app/resumes/upload-zone";
import { JobDrawer } from "@/components/job-drawer";
import { useJobs } from "@/hooks/use-jobs";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { DocumentMeta } from "@/lib/types";

type ViewMode = "list" | "split" | "matrix";
const VIEW_MODES: Array<{ id: ViewMode; label: string }> = [
  { id: "list", label: "List" },
  { id: "split", label: "Split view" },
  { id: "matrix", label: "Coverage matrix" },
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

export default function ResumesPage() {
  const [view, setView] = useState<ViewMode>("list");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const { data: docs, isLoading } = useQuery({
    queryKey: ["documents", "all"],
    queryFn: () => api<DocumentMeta[]>("/api/documents"),
  });
  const { data: jobs } = useJobs();

  const resumes = (docs ?? []).filter((d) => d.kind === "resume");
  const coverLetters = (docs ?? []).filter((d) => d.kind === "cover-letter");

  return (
    <div className="max-w-6xl space-y-4 p-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Resumes</h1>
          <p className="text-sm text-muted-foreground">
            Versions, what they parse to, and which jobs each one is backing
          </p>
        </div>
        <ViewSwitcher view={view} onChange={setView} />
      </header>

      <UploadZone />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading documents…</p>
      ) : view === "split" ? (
        <SplitView
          docs={docs ?? []}
          jobs={jobs ?? []}
          onOpenJob={setSelectedJobId}
        />
      ) : view === "matrix" ? (
        <CoverageMatrix resumes={resumes} jobs={jobs ?? []} />
      ) : (
        <ListView
          resumes={resumes}
          coverLetters={coverLetters}
          jobs={jobs ?? []}
          onOpenJob={setSelectedJobId}
        />
      )}

      <JobDrawer jobId={selectedJobId} onClose={() => setSelectedJobId(null)} />
    </div>
  );
}
