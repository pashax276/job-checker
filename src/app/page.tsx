"use client";

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
import { DueBadge, StatusBadge } from "@/components/badges";
import { JobDrawer } from "@/components/job-drawer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStats } from "@/hooks/use-jobs";
import { STATUSES, type Status } from "@/lib/constants";

const STATUS_DOT: Record<Status, string> = {
  Evaluating: "var(--status-evaluating)",
  Applied: "var(--status-applied)",
  Screen: "var(--status-screen)",
  Assessment: "var(--status-assessment)",
  Panel: "var(--status-panel)",
  Offer: "var(--status-offer)",
  Skipped: "var(--status-skipped)",
  Rejected: "var(--status-rejected)",
};

const MAX_AGING_ROWS = 15;

export default function DashboardPage() {
  const { data: stats, isLoading } = useStats();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (isLoading || !stats) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Loading dashboard…</div>
    );
  }

  const agingRows = stats.aging.slice(0, MAX_AGING_ROWS).map((a) => ({
    ...a,
    label: `${a.company} · ${a.status}`,
  }));

  return (
    <div className="space-y-4 p-4">
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3 max-lg:grid-cols-1">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Active pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="font-data text-2xl">{stats.activeTotal}</span>
            <span className="ml-2 text-xs text-muted-foreground">
              jobs in play (tier ≠ Closed, not Skipped/Rejected)
            </span>
          </CardContent>
        </Card>
        <Card className={stats.overdue.length > 0 ? "border-due/40" : undefined}>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Overdue follow-ups
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="font-data text-2xl text-due">
              {stats.overdue.length}
            </span>
            <span className="ml-2 text-xs text-muted-foreground">
              waiting on you
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              New leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="font-data text-2xl">{stats.newLeads}</span>
            <span className="ml-2 text-xs text-muted-foreground">
              in the inbox
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Per-status counts */}
      <div className="grid grid-cols-8 gap-2 max-xl:grid-cols-4 max-sm:grid-cols-2">
        {STATUSES.map((status) => (
          <Card key={status} className="py-3">
            <CardContent className="flex items-center justify-between px-3">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  aria-hidden
                  className="size-1.5 rounded-full"
                  style={{ background: STATUS_DOT[status] }}
                />
                {status}
              </span>
              <span className="font-data text-lg">
                {stats.statusCounts[status]}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 max-lg:grid-cols-1">
        {/* Overdue list, oldest first */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Overdue follow-ups</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {stats.overdue.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing overdue. Add follow-up dates to jobs to see them here.
              </p>
            ) : (
              stats.overdue.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className="flex w-full items-center gap-3 rounded-md border-l-2 border-due bg-due/5 px-3 py-2 text-left transition-colors hover:bg-due/10"
                >
                  <span className="font-data w-24 shrink-0 text-xs text-due">
                    {item.followUpDate}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">
                      {item.company} — {item.role}
                    </span>
                    {item.nextAction ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.nextAction}
                      </span>
                    ) : null}
                  </span>
                  <StatusBadge status={item.status} />
                  <DueBadge />
                </button>
              ))
            )}
          </CardContent>
        </Card>

        {/* Aging chart */}
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
              <p className="text-sm text-muted-foreground">
                No active jobs yet.
              </p>
            ) : (
              <ResponsiveContainer
                width="100%"
                height={agingRows.length * 26 + 30}
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
                    width={170}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
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
                    maxBarSize={10}
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

      <JobDrawer jobId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
