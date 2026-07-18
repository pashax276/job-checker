"use client";

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink, Columns } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { DueBadge, TierBadge } from "@/components/badges";
import { JobDrawer } from "@/components/job-drawer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useJobs, useUpdateJob } from "@/hooks/use-jobs";
import { STATUSES, TIERS, type Status, type Tier } from "@/lib/constants";
import { isFollowUpDue } from "@/lib/dates";
import type { Job } from "@/lib/types";

const ALL = "__all__";

function SortIcon({ dir }: { dir: false | "asc" | "desc" }) {
  if (dir === "asc") return <ArrowUp className="size-3" aria-hidden />;
  if (dir === "desc") return <ArrowDown className="size-3" aria-hidden />;
  return <ArrowUpDown className="size-3 opacity-40" aria-hidden />;
}

function InlineStatus({ job }: { job: Job }) {
  const updateJob = useUpdateJob();
  return (
    <Select
      value={job.status}
      onValueChange={(v) =>
        updateJob.mutate({ id: job.id, patch: { status: v as Status } })
      }
    >
      <SelectTrigger
        size="sm"
        className="h-7 w-32 border-transparent bg-transparent text-xs hover:border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUSES.map((s) => (
          <SelectItem key={s} value={s} className="text-xs">
            {s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function TableView() {
  const params = useSearchParams();
  const q = params.get("q") ?? undefined;
  const [status, setStatus] = useState<Status | undefined>(undefined);
  const [tier, setTier] = useState<Tier | undefined>(undefined);
  const [dueOnly, setDueOnly] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: jobs, isLoading } = useJobs({ status, tier, q, dueOnly });

  const columns = useMemo<ColumnDef<Job>[]>(
    () => [
      { accessorKey: "company", header: "Company" },
      { accessorKey: "role", header: "Role" },
      {
        accessorKey: "priorityTier",
        header: "Tier",
        cell: ({ row }) => <TierBadge tier={row.original.priorityTier} />,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <InlineStatus job={row.original} />,
      },
      {
        accessorKey: "dateApplied",
        header: "Applied",
        cell: ({ getValue }) => (
          <span className="font-data text-xs">
            {(getValue() as string | null) ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "followUpDate",
        header: "Follow-up",
        cell: ({ row }) => {
          const v = row.original.followUpDate;
          const due = isFollowUpDue(v, new Date());
          return (
            <span className="flex items-center gap-1.5">
              <span className="font-data text-xs">{v ?? "—"}</span>
              {due ? <DueBadge /> : null}
            </span>
          );
        },
      },
      {
        accessorKey: "nextAction",
        header: "Next action",
        cell: ({ getValue }) => (
          <span className="block max-w-52 truncate text-xs text-muted-foreground">
            {(getValue() as string | null) ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "compNotes",
        header: "Comp",
        cell: ({ getValue }) => (
          <span className="font-data text-xs">
            {(getValue() as string | null) ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "contact",
        header: "Contact",
        cell: ({ getValue }) => (
          <span className="block max-w-36 truncate text-xs">
            {(getValue() as string | null) ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "notes",
        header: "Notes",
        cell: ({ getValue }) => (
          <span className="block max-w-60 truncate text-xs text-muted-foreground">
            {(getValue() as string | null) ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "postingUrl",
        header: "Posting",
        enableSorting: false,
        cell: ({ getValue }) => {
          const url = getValue() as string | null;
          return url ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer noopener"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              open <ExternalLink className="size-3" aria-hidden />
            </a>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          );
        },
      },
    ],
    [],
  );

  const table = useReactTable({
    data: jobs ?? [],
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={status ?? ALL}
          onValueChange={(v) => setStatus(v === ALL ? undefined : (v as Status))}
        >
          <SelectTrigger size="sm" className="w-36 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL} className="text-xs">
              All statuses
            </SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="text-xs">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={tier ?? ALL}
          onValueChange={(v) => setTier(v === ALL ? undefined : (v as Tier))}
        >
          <SelectTrigger size="sm" className="w-36 text-xs">
            <SelectValue placeholder="Tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL} className="text-xs">
              All tiers
            </SelectItem>
            {TIERS.map((t) => (
              <SelectItem key={t} value={t} className="text-xs">
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Label className="flex items-center gap-2 text-xs">
          <Checkbox
            checked={dueOnly}
            onCheckedChange={(c) => setDueOnly(c === true)}
          />
          Follow-up due
        </Label>
        {q ? (
          <span className="text-xs text-muted-foreground">
            searching “{q}”
          </span>
        ) : null}
        <div className="flex-1" />
        <span className="font-data text-xs text-muted-foreground">
          {table.getRowModel().rows.length} jobs
        </span>
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
            {table
              .getAllLeafColumns()
              .map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(v) => column.toggleVisibility(v === true)}
                  className="text-xs capitalize"
                >
                  {column.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id} className="text-xs">
                    {header.column.getCanSort() ? (
                      <button
                        type="button"
                        className="flex items-center gap-1 hover:text-foreground"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        <SortIcon dir={header.column.getIsSorted()} />
                      </button>
                    ) : (
                      flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center text-sm text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center text-sm text-muted-foreground">
                  No jobs match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedId(row.original.id)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-1.5 text-[13px]">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <JobDrawer jobId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}

export default function TablePage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-muted-foreground">Loading table…</div>
      }
    >
      <TableView />
    </Suspense>
  );
}
