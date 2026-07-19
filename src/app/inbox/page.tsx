"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, ExternalLink, MapPin } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { StatusBadge } from "@/components/badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import type { Reminder } from "@/lib/types";

interface Lead {
  id: string;
  url: string;
  title: string;
  company: string | null;
  source: "ats-poll" | "alerts-rss";
  atsType: string | null;
  locationClass: "San Diego" | "Remote-US" | "Unverified";
  matchedKeywords: string | null;
  fetchedAt: string;
}

const GROUPS: Array<Lead["locationClass"]> = [
  "San Diego",
  "Remote-US",
  "Unverified",
];

function keywords(lead: Lead): string[] {
  try {
    return lead.matchedKeywords ? (JSON.parse(lead.matchedKeywords) as string[]) : [];
  } catch {
    return [];
  }
}

const RULE_LABEL: Record<Reminder["rule"], string> = {
  "no-reply": "No reply",
  "thank-you": "Thank-you note",
  "stale-evaluating": "Stale",
};

function RemindersSection() {
  const qc = useQueryClient();
  const { data: reminders } = useQuery({
    queryKey: ["reminders"],
    queryFn: () => api<Reminder[]>("/api/reminders"),
  });
  const dismiss = useMutation({
    mutationFn: (key: string) =>
      api("/api/reminders", {
        method: "PATCH",
        body: JSON.stringify({ key, action: "dismiss" }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["reminders"] }),
    onError: (err: Error) => toast.error(err.message),
  });

  if (!reminders || reminders.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <BellRing className="size-3.5 text-muted-foreground" aria-hidden />
          Reminders
          <span className="font-data text-xs text-muted-foreground">
            {reminders.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {reminders.map((reminder) => (
          <div
            key={reminder.key}
            className="flex items-center gap-3 rounded-md border px-3 py-2"
          >
            <Badge variant="outline" className="font-data shrink-0 text-[10px]">
              {RULE_LABEL[reminder.rule]}
            </Badge>
            <span className="min-w-0 flex-1">
              <Link
                href={`/table?q=${encodeURIComponent(reminder.company)}`}
                className="block truncate text-sm hover:underline"
              >
                {reminder.company} — {reminder.role}
              </Link>
              <span className="block truncate text-xs text-muted-foreground">
                {reminder.message}
              </span>
            </span>
            <StatusBadge status={reminder.status} />
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              disabled={dismiss.isPending}
              onClick={() => dismiss.mutate(reminder.key)}
            >
              Dismiss
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function InboxPage() {
  const qc = useQueryClient();
  const { data: leads, isLoading } = useQuery({
    queryKey: ["leads", "new"],
    queryFn: () => api<Lead[]>("/api/leads?status=new"),
  });

  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "promote" | "dismiss" }) =>
      api<unknown>(`/api/leads/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      }),
    onSuccess: (_data, { action }) => {
      toast.success(action === "promote" ? "Lead promoted to pipeline" : "Lead dismissed");
      void qc.invalidateQueries({ queryKey: ["leads"] });
      void qc.invalidateQueries({ queryKey: ["jobs"] });
      void qc.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading || !leads) {
    return <div className="p-6 text-sm text-muted-foreground">Loading inbox…</div>;
  }

  return (
    <div className="space-y-4 p-4">
      <RemindersSection />
      {leads.length === 0 ? (
        <p className="px-2 text-sm text-muted-foreground">
          No new leads. Configure the watchlist and alert feeds in Settings,
          then use “Run discovery now”.
        </p>
      ) : null}
      {GROUPS.map((group) => {
        const grouped = leads.filter((l) => l.locationClass === group);
        if (grouped.length === 0) return null;
        return (
          <Card key={group}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <MapPin className="size-3.5 text-muted-foreground" aria-hidden />
                {group}
                <span className="font-data text-xs text-muted-foreground">
                  {grouped.length}
                </span>
                {group === "Unverified" ? (
                  <span className="text-xs font-normal text-muted-foreground">
                    location not stated in posting — verify before applying
                  </span>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {grouped.map((lead) => (
                <div
                  key={lead.id}
                  className="flex items-center gap-3 rounded-md border px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <a
                      href={lead.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex max-w-full items-center gap-1.5 text-sm hover:underline"
                    >
                      <span className="truncate">
                        {lead.company ? `${lead.company} — ` : ""}
                        {lead.title}
                      </span>
                      <ExternalLink
                        className="size-3 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                    </a>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="font-data text-[10px]">
                        {lead.source === "ats-poll" ? "watchlist" : "alerts"}
                      </Badge>
                      {lead.atsType ? (
                        <Badge variant="outline" className="font-data text-[10px]">
                          {lead.atsType}
                        </Badge>
                      ) : null}
                      {keywords(lead).map((k) => (
                        <span key={k} className="text-[10px] text-muted-foreground">
                          {k}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    disabled={act.isPending}
                    onClick={() => act.mutate({ id: lead.id, action: "promote" })}
                  >
                    Promote
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    disabled={act.isPending}
                    onClick={() => act.mutate({ id: lead.id, action: "dismiss" })}
                  >
                    Dismiss
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
