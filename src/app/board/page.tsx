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
import { useState } from "react";
import { DueBadge, TierBadge } from "@/components/badges";
import { JobDrawer } from "@/components/job-drawer";
import { useJobs, useUpdateJob } from "@/hooks/use-jobs";
import { STATUSES, type Status } from "@/lib/constants";
import { isFollowUpDue } from "@/lib/dates";
import type { Job } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_TOP: Record<Status, string> = {
  Evaluating: "border-t-status-evaluating",
  Applied: "border-t-status-applied",
  Screen: "border-t-status-screen",
  Assessment: "border-t-status-assessment",
  Panel: "border-t-status-panel",
  Offer: "border-t-status-offer",
  Skipped: "border-t-status-skipped",
  Rejected: "border-t-status-rejected",
};

function JobCard({
  job,
  onOpen,
  dragging,
}: {
  job: Job;
  onOpen?: (id: string) => void;
  dragging?: boolean;
}) {
  const due = isFollowUpDue(job.followUpDate, new Date());
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
      <span className="block truncate text-[13px] leading-tight font-medium">
        {job.company}
      </span>
      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
        {job.role}
      </span>
      <span className="mt-1.5 flex items-center gap-1.5">
        <TierBadge tier={job.priorityTier} />
        {due ? <DueBadge /> : null}
      </span>
    </button>
  );
}

function DraggableCard({
  job,
  onOpen,
}: {
  job: Job;
  onOpen: (id: string) => void;
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
      <JobCard job={job} onOpen={onOpen} />
    </li>
  );
}

function Column({
  status,
  jobs,
  onOpen,
}: {
  status: Status;
  jobs: Job[];
  onOpen: (id: string) => void;
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
      <ul className="flex min-h-16 flex-1 flex-col gap-1.5 overflow-y-auto p-2 pt-0">
        {jobs.map((job) => (
          <DraggableCard key={job.id} job={job} onOpen={onOpen} />
        ))}
      </ul>
    </section>
  );
}

export default function BoardPage() {
  const { data: jobs, isLoading } = useJobs();
  const updateJob = useUpdateJob();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<Job | null>(null);

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

  return (
    <div className="h-full overflow-x-auto p-4">
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="flex h-full min-w-max gap-3">
          {STATUSES.map((status) => (
            <Column
              key={status}
              status={status}
              jobs={byStatus.get(status) ?? []}
              onOpen={setSelectedId}
            />
          ))}
        </div>
        <DragOverlay>
          {activeJob ? <JobCard job={activeJob} dragging /> : null}
        </DragOverlay>
      </DndContext>
      <JobDrawer jobId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
