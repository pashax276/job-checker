"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Columns, FileDown, Radar, Rows3 } from "lucide-react";
import { useState } from "react";
import { DueBadge, TierBadge } from "@/components/badges";
import { JobDrawer } from "@/components/job-drawer";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useJobs, useStats, useUpdateJob } from "@/hooks/use-jobs";
import { composeComp } from "@/lib/comp";
import { STATUSES, type Status } from "@/lib/constants";
import { isFollowUpDue } from "@/lib/dates";
import type { Job } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_TOP: Record<Status, string> = {
  Evaluating: "border-t-status-evaluating",
  Applied: "border-t-status-applied",
  Screen: "border-t-status-screen",
  Assessment: "border-t-status-assessment",
  "HM Interview": "border-t-status-hm-interview",
  Panel: "border-t-status-panel",
  Offer: "border-t-status-offer",
  Skipped: "border-t-status-skipped",
  Rejected: "border-t-status-rejected",
};

// Spec nice-to-have: WIP-style aging warnings, amber past the threshold.
const WIP_THRESHOLDS: Partial<Record<Status, number>> = {
  Evaluating: 21,
  Applied: 14,
  Screen: 10,
  Assessment: 10,
  "HM Interview": 10,
  Panel: 10,
  Offer: 7,
};

function JobCard({
  job,
  onOpen,
  dragging,
  compact,
  agingDays,
}: {
  job: Job;
  onOpen?: (id: string) => void;
  dragging?: boolean;
  compact?: boolean;
  agingDays?: number;
}) {
  const due = isFollowUpDue(job.followUpDate, new Date());
  const threshold = WIP_THRESHOLDS[job.status];
  const stale =
    agingDays !== undefined && threshold !== undefined && agingDays >= threshold;
  const sourceIcon =
    job.source === "discovery" ? (
      <Radar
        className="size-3 shrink-0 text-primary/70"
        aria-label="Found by discovery"
      />
    ) : job.source === "import" ? (
      <FileDown
        className="size-3 shrink-0 text-muted-foreground/70"
        aria-label="Imported from tracker"
      />
    ) : null;
  if (compact) {
    return (
      <button
        type="button"
        onClick={() => onOpen?.(job.id)}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-left shadow-xs transition-colors hover:border-ring/40",
          due && "border-l-2 border-l-due",
          dragging && "opacity-90 shadow-lg",
        )}
      >
        <span className="min-w-0 flex-1 truncate text-xs leading-tight">
          {job.company}
        </span>
        {sourceIcon}
        <TierBadge tier={job.priorityTier} className="px-1 text-[9px]" />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onOpen?.(job.id)}
      className={cn(
        "w-full rounded-md border bg-card p-2.5 text-left shadow-xs transition-colors hover:border-ring/40",
        due && "border-l-2 border-l-due",
        dragging && "opacity-90 shadow-lg",
      )}
    >
      <span className="flex items-center gap-1.5">
        <span className="min-w-0 flex-1 truncate text-[13px] leading-tight font-medium">
          {job.company}
        </span>
        {sourceIcon}
      </span>
      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
        {job.role}
      </span>
      <span className="mt-1.5 flex items-center gap-1.5">
        <TierBadge tier={job.priorityTier} />
        {due ? <DueBadge /> : null}
        {stale ? (
          <span
            title={`${agingDays} days in ${job.status}`}
            className="font-data inline-flex items-center rounded-sm border border-status-assessment/40 bg-status-assessment/10 px-1 text-[10px] text-status-assessment"
          >
            {agingDays}d
          </span>
        ) : null}
        {composeComp(job) ? (
          <span className="font-data min-w-0 flex-1 truncate text-right text-[10px] text-muted-foreground">
            {composeComp(job)}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function DraggableCard({
  job,
  onOpen,
  compact,
  agingDays,
}: {
  job: Job;
  onOpen: (id: string) => void;
  compact?: boolean;
  agingDays?: number;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: job.id,
  });
  return (
    <li
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(isDragging && "opacity-30")}
    >
      <JobCard job={job} onOpen={onOpen} compact={compact} agingDays={agingDays} />
    </li>
  );
}

function Column({
  status,
  jobs,
  onOpen,
  compact,
  agingById,
}: {
  status: Status;
  jobs: Job[];
  onOpen: (id: string) => void;
  compact?: boolean;
  agingById?: Map<string, number>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      aria-label={`${status} column`}
      className={cn(
        "flex w-60 shrink-0 flex-col rounded-lg border border-t-2 bg-muted/40",
        STATUS_TOP[status],
        isOver && "ring-2 ring-ring/50",
      )}
    >
      <header className="flex items-center justify-between px-3 py-2">
        <h2 className="text-xs font-medium">{status}</h2>
        <span className="font-data text-xs text-muted-foreground">
          {jobs.length}
        </span>
      </header>
      <ul
        className={cn(
          "flex min-h-16 flex-1 flex-col overflow-y-auto p-2 pt-0",
          compact ? "gap-1" : "gap-1.5",
        )}
      >
        {jobs.map((job) => (
          <DraggableCard
            key={job.id}
            job={job}
            onOpen={onOpen}
            compact={compact}
            agingDays={agingById?.get(job.id)}
          />
        ))}
      </ul>
    </section>
  );
}

const HIDDEN_COLUMNS_KEY = "board-hidden-columns";

function loadHiddenColumns(): Set<Status> {
  // Safe in the initializer: the board renders a loading state on both the
  // server and the first client paint, so no hydration divergence.
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(HIDDEN_COLUMNS_KEY);
    return raw ? new Set(JSON.parse(raw) as Status[]) : new Set();
  } catch {
    return new Set();
  }
}

export default function BoardPage() {
  const { data: jobs, isLoading } = useJobs();
  const { data: stats } = useStats();
  const updateJob = useUpdateJob();
  const agingById = new Map(
    (stats?.aging ?? []).map((a) => [a.id, a.daysInCurrentStage]),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [hiddenColumns, setHiddenColumns] = useState<Set<Status>>(loadHiddenColumns);
  const [compact, setCompact] = useState<boolean>(
    () =>
      typeof window !== "undefined" &&
      window.localStorage.getItem("board-density") === "compact",
  );

  const toggleDensity = () => {
    setCompact((prev) => {
      window.localStorage.setItem("board-density", prev ? "normal" : "compact");
      return !prev;
    });
  };

  const toggleColumn = (status: Status, visible: boolean) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (visible) next.delete(status);
      else next.add(status);
      window.localStorage.setItem(HIDDEN_COLUMNS_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  // Distance activation keeps plain clicks working as "open drawer".
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  if (isLoading || !jobs) {
    return <div className="p-6 text-sm text-muted-foreground">Loading board…</div>;
  }

  const byStatus = new Map<Status, Job[]>(
    STATUSES.map((s) => [s, jobs.filter((j) => j.status === s)]),
  );

  const onDragStart = (event: DragStartEvent) => {
    setActiveJob(jobs.find((j) => j.id === event.active.id) ?? null);
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActiveJob(null);
    const target = event.over?.id as Status | undefined;
    const job = jobs.find((j) => j.id === event.active.id);
    if (!target || !job || job.status === target) return;
    updateJob.mutate({ id: job.id, patch: { status: target } });
  };

  const visibleStatuses = STATUSES.filter((s) => !hiddenColumns.has(s));

  return (
    <div className="flex h-full flex-col gap-2 p-4">
      <div className="flex shrink-0 justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={toggleDensity}
        >
          <Rows3 className="size-3.5" aria-hidden />
          {compact ? "Comfortable" : "Compact"}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" />
            }
          >
            <Columns className="size-3.5" aria-hidden />
            Columns
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {STATUSES.map((status) => (
              <DropdownMenuCheckboxItem
                key={status}
                checked={!hiddenColumns.has(status)}
                onCheckedChange={(v) => toggleColumn(status, v === true)}
                className="text-xs"
              >
                {status}
                <span className="font-data ml-auto pl-3 text-muted-foreground">
                  {(byStatus.get(status) ?? []).length}
                </span>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="min-h-0 flex-1 overflow-x-auto">
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="flex h-full min-w-max gap-3">
          {visibleStatuses.map((status) => (
            <Column
              key={status}
              status={status}
              jobs={byStatus.get(status) ?? []}
              onOpen={setSelectedId}
              compact={compact}
              agingById={agingById}
            />
          ))}
        </div>
        <DragOverlay>
          {activeJob ? <JobCard job={activeJob} dragging /> : null}
        </DragOverlay>
      </DndContext>
      </div>
      <JobDrawer jobId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
