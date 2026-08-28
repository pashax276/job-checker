"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DueBadge, StatusBadge, TierBadge } from "@/components/badges";
import { JobDrawer } from "@/components/job-drawer";
import { MonthCalendar } from "@/components/month-calendar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useJobs, useStats } from "@/hooks/use-jobs";
import {
  ACTIVE_EXCLUDED_STATUSES,
  LOOP_STATUSES,
  PIPELINE_FLOW,
  type Status,
} from "@/lib/constants";
import { daysSinceApplied, isFollowUpDue } from "@/lib/dates";
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
  const addedThisWeek = jobs.filter(
    (j) => today.getTime() - new Date(j.createdAt).getTime() < 7 * 86_400_000,
  ).length;
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
          sub={
            addedThisWeek > 0
              ? `+${addedThisWeek} added this week`
              : "tier ≠ Closed, not Skipped/Rejected"
          }
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

      {/* Offer comparison — appears once offers exist */}
      {offers.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Offer comparison
              {offers.length < 2 ? (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  one offer so far — comparison lights up with a second
                </span>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-xs text-muted-foreground [&>th]:pb-1.5 [&>th]:font-medium">
                  <th>Company</th>
                  <th>Role</th>
                  <th>Base</th>
                  <th>Bonus</th>
                  <th>Equity</th>
                  <th>Notes</th>
                  <th>Resume</th>
                  <th className="text-right">Days in process</th>
                </tr>
              </thead>
              <tbody>
                {offers.map((job) => (
                  <tr
                    key={job.id}
                    onClick={() => setSelectedId(job.id)}
                    className="cursor-pointer border-t transition-colors hover:bg-accent/50 [&>td]:py-1.5 [&>td]:pr-2"
                  >
                    <td className="font-medium">{job.company}</td>
                    <td className="max-w-48 truncate text-muted-foreground">
                      {job.role}
                    </td>
                    <td className="font-data text-xs">{job.compBase ?? "—"}</td>
                    <td className="font-data text-xs">{job.compBonus ?? "—"}</td>
                    <td className="font-data text-xs">{job.compEquity ?? "—"}</td>
                    <td className="max-w-40 truncate text-xs text-muted-foreground">
                      {job.compNotes ?? "—"}
                    </td>
                    <td className="font-data text-xs">
                      {job.resumeVersion ?? "—"}
                    </td>
                    <td className="font-data text-right text-xs">
                      {daysSinceApplied(job.dateApplied, today) ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}

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

          <div className="grid grid-cols-2 gap-3 max-xl:grid-cols-1">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                Conversion funnel
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  where each job stands now
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="pb-1 text-[10px] leading-tight text-muted-foreground">
                Each job counts at the last stage it occupied — moving a card
                backward corrects the funnel. Closed jobs (skipped/rejected)
                credit the stage they dropped off at, and are totalled again
                below as terminal outcomes.
              </p>
              {stats.funnel.map((stage) => {
                const total = stats.funnel[0]?.reached ?? 1;
                const width = total > 0 ? (stage.reached / total) * 100 : 0;
                return (
                  <div key={stage.status} className="flex items-center gap-2">
                    <span className="w-24 shrink-0 truncate text-[11px] text-muted-foreground">
                      {stage.status}
                    </span>
                    <span className="h-3 min-w-0 flex-1 rounded-sm bg-muted">
                      <span
                        className="block h-full rounded-sm"
                        style={{
                          width: `${width}%`,
                          background: STATUS_VAR[stage.status],
                          minWidth: stage.reached > 0 ? 3 : 0,
                        }}
                      />
                    </span>
                    <span className="font-data w-8 shrink-0 text-right text-xs">
                      {stage.reached}
                    </span>
                    <span className="font-data w-10 shrink-0 text-right text-[10px] text-muted-foreground">
                      {stage.conversion !== null
                        ? `${Math.round(stage.conversion * 100)}%`
                        : ""}
                    </span>
                  </div>
                );
              })}
              {stats.terminal.length > 0 ? (
                <div className="space-y-1 border-t pt-1.5">
                  {stats.terminal.map((outcome) => {
                    const total = stats.funnel[0]?.reached ?? 0;
                    const width =
                      total > 0 ? (outcome.count / total) * 100 : 0;
                    return (
                      <div
                        key={outcome.status}
                        className="flex items-center gap-2"
                      >
                        <span className="w-24 shrink-0 truncate text-[11px] text-muted-foreground">
                          {outcome.status}
                        </span>
                        <span className="h-3 min-w-0 flex-1 rounded-sm bg-muted">
                          <span
                            className="block h-full rounded-sm"
                            style={{
                              width: `${width}%`,
                              background: STATUS_VAR[outcome.status],
                              minWidth: outcome.count > 0 ? 3 : 0,
                            }}
                          />
                        </span>
                        <span className="font-data w-8 shrink-0 text-right text-xs">
                          {outcome.count}
                        </span>
                        <span className="font-data w-10 shrink-0 text-right text-[10px] text-muted-foreground">
                          {outcome.share !== null
                            ? `${Math.round(outcome.share * 100)}%`
                            : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : null}
              {stats.roundStats.length > 0 ? (
                <div className="space-y-0.5 border-t pt-1.5">
                  {stats.roundStats.map((round) => {
                    const held = round.passed + round.failed;
                    return (
                      <p
                        key={round.stage}
                        className="flex items-center gap-2 text-[11px] text-muted-foreground"
                      >
                        <span className="w-24 truncate">{round.stage}</span>
                        <span className="font-data">
                          {round.passed}/{held} passed (
                          {Math.round((round.passed / held) * 100)}%)
                        </span>
                      </p>
                    );
                  })}
                </div>
              ) : null}
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
          </Card>          </div>

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

        {/* Right 1/3: calendar, follow-up queue, stage mix, aging */}
        <div className="space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                Calendar
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  booked steps &amp; follow-ups
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MonthCalendar events={stats.events} onSelect={setSelectedId} />
            </CardContent>
          </Card>

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
                Response rate
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  Applied → any reply
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {stats.response.applied === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No applications with dates yet.
                </p>
              ) : (
                <>
                  <p className="text-sm">
                    <span className="font-data text-lg">
                      {stats.response.rate !== null
                        ? `${Math.round(stats.response.rate * 100)}%`
                        : "—"}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {stats.response.advanced}/{stats.response.applied} advanced
                      {stats.response.avgDaysToFirstResponse !== null
                        ? ` · ~${stats.response.avgDaysToFirstResponse}d to first response`
                        : ""}
                    </span>
                  </p>
                  <div className="space-y-0.5">
                    {stats.response.byTier
                      .filter((t) => t.applied > 0)
                      .map((t) => (
                        <p
                          key={t.tier}
                          className="flex items-center gap-2 text-[11px] text-muted-foreground"
                        >
                          <span className="w-16">{t.tier}</span>
                          <span className="font-data">
                            {t.advanced}/{t.applied}
                          </span>
                        </p>
                      ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                Momentum
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  weekly snapshots
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.trend.length < 2 ? (
                <p className="text-xs text-muted-foreground">
                  Collecting one snapshot per week
                  {stats.trend.length === 1
                    ? ` — first: ${stats.trend[0].activeTotal} active / ${stats.trend[0].totalJobs} total`
                    : ""}
                  . Trends appear from week two.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={120}>
                  <LineChart
                    data={stats.trend}
                    margin={{ top: 4, right: 8, bottom: 0, left: -22 }}
                  >
                    <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" />
                    <XAxis
                      dataKey="weekStart"
                      tick={{ fill: "var(--muted-foreground)", fontSize: 9 }}
                      tickFormatter={(v: string) => v.slice(5).replace("-", "/")}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "var(--muted-foreground)", fontSize: 9 }}
                      axisLine={false}
                      tickLine={false}
                      width={40}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        fontSize: 12,
                        color: "var(--popover-foreground)",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="activeTotal"
                      name="active"
                      stroke="var(--chart-1)"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="totalJobs"
                      name="total"
                      stroke="var(--chart-5)"
                      strokeWidth={1.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
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

        </div>
      </div>

      <JobDrawer jobId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
