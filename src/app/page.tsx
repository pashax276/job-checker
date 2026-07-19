"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DueBadge, StatusBadge, TierBadge } from "@/components/badges";
import { JobDrawer } from "@/components/job-drawer";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useJobs, useStats } from "@/hooks/use-jobs";
import {
  ACTIVE_EXCLUDED_STATUSES,
  LOOP_STATUSES,
  PIPELINE_FLOW,
  type Status,
} from "@/lib/constants";
import { isFollowUpDue } from "@/lib/dates";
import type { Job } from "@/lib/types";

const STATUS_VAR: Record<Status, string> = {
  Evaluating: "var(--status-evaluating)",
  Applied: "var(--status-applied)",
  Screen: "var(--status-screen)",
  Assessment: "var(--status-assessment)",
  "HM Interview": "var(--status-hm-interview)",
  Panel: "var(--status-panel)",
  Offer: "var(--status-offer)",
  Skipped: "var(--status-skipped)",
  Rejected: "var(--status-rejected)",
};

const MAX_AGING_ROWS = 12;
const MAX_PIPELINE_ROWS = 10;

const fmtShort = (iso: string): string =>
  new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

const isActive = (job: Job): boolean =>
  job.priorityTier !== "Closed" &&
  !ACTIVE_EXCLUDED_STATUSES.includes(job.status);

function SummaryCard({
  label,
  value,
  sub,
  valueClass,
}: {
  label: string;
  value: number;
  sub: string;
  valueClass?: string;
}) {
  return (
    <Card className="gap-1 py-4">
      <CardHeader className="pb-0">
        <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`font-data text-2xl ${valueClass ?? ""}`}>{value}</div>
        <p className="truncate text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: stats } = useStats();
  const { data: jobs } = useJobs();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!stats || !jobs) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Loading dashboard…</div>
    );
  }

  const today = new Date();
  const active = jobs.filter(isActive);
  const inLoops = active.filter((j) => LOOP_STATUSES.includes(j.status));
  const offers = active.filter((j) => j.status === "Offer");

  const queue = active
    .filter((j): j is Job & { followUpDate: string } => j.followUpDate !== null)
    .sort((a, b) => a.followUpDate.localeCompare(b.followUpDate))
    .slice(0, 8);
  const nextUpcoming = queue.find((j) => !isFollowUpDue(j.followUpDate, today));

  const agingById = new Map(stats.aging.map((a) => [a.id, a.daysInCurrentStage]));
  const pipelineRows = [...active]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_PIPELINE_ROWS);

  const closedRecently = jobs
    .filter((j) => !isActive(j))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 6);

  const mix = PIPELINE_FLOW.map((status) => ({
    status,
    n: active.filter((j) => j.status === status).length,
  })).filter((m) => m.n > 0);

  const loopBreakdown =
    LOOP_STATUSES.map(
      (s) => `${inLoops.filter((j) => j.status === s).length} ${s.toLowerCase()}`,
    ).join(" · ") || "none yet";

  const agingRows = stats.aging.slice(0, MAX_AGING_ROWS).map((a) => ({
    ...a,
    label: `${a.company} · ${a.status}`,
  }));

  const subtitle = `${today.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  })} · ${stats.activeTotal} active applications · ${stats.overdue.length} follow-ups due`;

  return (
    <div className="space-y-4 p-4">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </header>

      {/* Summary row */}
      <div className="grid grid-cols-5 gap-3 max-xl:grid-cols-2 max-sm:grid-cols-1">
        <SummaryCard
          label="Active pipeline"
          value={stats.activeTotal}
          sub="tier ≠ Closed, not Skipped/Rejected"
        />
        <SummaryCard
          label="In interview loops"
          value={inLoops.length}
          sub={loopBreakdown}
        />
        <SummaryCard
          label="Follow-ups due"
          value={stats.overdue.length}
          valueClass={stats.overdue.length > 0 ? "text-due" : undefined}
          sub={
            nextUpcoming
              ? `next: ${nextUpcoming.company}, ${fmtShort(nextUpcoming.followUpDate)}`
              : "nothing scheduled next"
          }
        />
        <SummaryCard
          label="Offers open"
          value={offers.length}
          sub={
            offers.length > 0
              ? offers.map((o) => o.company).join(", ")
              : "keep pushing"
          }
        />
        <SummaryCard
          label="New leads"
          value={stats.newLeads}
          sub="in the discovery inbox"
        />
      </div>

      <div className="grid grid-cols-3 gap-3 max-lg:grid-cols-1">
        {/* Left 2/3: active pipeline + closed recently */}
        <div className="col-span-2 space-y-3 max-lg:col-span-1">
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm">
                Active pipeline
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  most recent activity first
                </span>
              </CardTitle>
              <Link
                href="/table"
                className="text-xs text-primary hover:underline"
              >
                View table
              </Link>
            </CardHeader>
            <CardContent>
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="text-xs text-muted-foreground [&>th]:pb-1.5 [&>th]:font-medium">
                    <th>Company</th>
                    <th>Role</th>
                    <th>Tier</th>
                    <th>Status</th>
                    <th className="text-right">Days</th>
                    <th className="text-right">Follow-up</th>
                  </tr>
                </thead>
                <tbody>
                  {pipelineRows.map((job) => {
                    const due = isFollowUpDue(job.followUpDate, today);
                    return (
                      <tr
                        key={job.id}
                        onClick={() => setSelectedId(job.id)}
                        className="cursor-pointer border-t transition-colors hover:bg-accent/50"
                      >
                        <td className="py-1.5 pr-2 font-medium">{job.company}</td>
                        <td className="max-w-56 truncate py-1.5 pr-2 text-muted-foreground">
                          {job.role}
                        </td>
                        <td className="py-1.5 pr-2">
                          <TierBadge tier={job.priorityTier} />
                        </td>
                        <td className="py-1.5 pr-2">
                          <StatusBadge status={job.status} />
                        </td>
                        <td className="font-data py-1.5 pr-2 text-right text-xs">
                          {agingById.get(job.id) ?? "—"}
                        </td>
                        <td className="py-1.5 text-right">
                          {due ? (
                            <DueBadge />
                          ) : job.followUpDate ? (
                            <span className="font-data text-xs text-muted-foreground">
                              {fmtShort(job.followUpDate)}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                Closed recently
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  latest first
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {closedRecently.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing closed yet.</p>
              ) : (
                closedRecently.map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => setSelectedId(job.id)}
                    className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent/50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px]">
                        {job.company}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {job.role}
                      </span>
                    </span>
                    <Badge variant="outline" className="font-data text-[10px]">
                      {job.priorityTier === "Closed" ? "Closed" : job.priorityTier}
                    </Badge>
                    <StatusBadge status={job.status} />
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right 1/3: follow-up queue, stage mix, aging */}
        <div className="space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                Follow-up queue
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  next touchpoints
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {queue.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No follow-up dates set on active jobs.
                </p>
              ) : (
                queue.map((job) => {
                  const due = isFollowUpDue(job.followUpDate, today);
                  return (
                    <button
                      key={job.id}
                      type="button"
                      onClick={() => setSelectedId(job.id)}
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent/50 ${
                        due ? "border-l-2 border-due bg-due/5" : ""
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px]">
                          {job.company}
                        </span>
                        {job.nextAction ? (
                          <span className="block truncate text-xs text-muted-foreground">
                            {job.nextAction}
                          </span>
                        ) : null}
                      </span>
                      {due ? (
                        <DueBadge />
                      ) : (
                        <span className="font-data shrink-0 text-xs text-muted-foreground">
                          {fmtShort(job.followUpDate)}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                Stage mix
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {stats.activeTotal} active
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div
                className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted"
                role="img"
                aria-label="Distribution of active jobs across stages"
              >
                {mix.map((m) => (
                  <span
                    key={m.status}
                    style={{
                      width: `${(m.n / Math.max(1, active.length)) * 100}%`,
                      background: STATUS_VAR[m.status],
                    }}
                  />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {mix.map((m) => (
                  <span
                    key={m.status}
                    className="flex items-center justify-between text-xs"
                  >
                    <StatusBadge status={m.status} />
                    <span className="font-data text-muted-foreground">{m.n}</span>
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                Days in current stage
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  active jobs, longest first
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {agingRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active jobs yet.</p>
              ) : (
                <ResponsiveContainer
                  width="100%"
                  height={agingRows.length * 24 + 28}
                >
                  <BarChart
                    data={agingRows}
                    layout="vertical"
                    margin={{ top: 0, right: 28, bottom: 0, left: 0 }}
                    barCategoryGap={2}
                  >
                    <CartesianGrid
                      horizontal={false}
                      stroke="var(--border)"
                      strokeDasharray="2 4"
                    />
                    <XAxis
                      type="number"
                      tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      unit="d"
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={150}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--accent)" }}
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        fontSize: 12,
                        color: "var(--popover-foreground)",
                      }}
                      formatter={(value) => [`${String(value)} days`, "in stage"]}
                      labelFormatter={(label) => String(label)}
                    />
                    <Bar
                      dataKey="daysInCurrentStage"
                      radius={[0, 4, 4, 0]}
                      maxBarSize={8}
                      onClick={(entry) => {
                        const row = entry as unknown as { id?: string };
                        if (row.id) setSelectedId(row.id);
                      }}
                    >
                      {agingRows.map((row) => (
                        <Cell key={row.id} fill="var(--chart-1)" cursor="pointer" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <JobDrawer jobId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
