"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Play, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { ATS_TYPES } from "@/lib/discovery-schemas";
import { APP_VERSION } from "@/lib/version";

interface WatchlistEntry {
  id: string;
  displayName: string;
  atsType: string;
  boardSlug: string;
  enabled: boolean;
}

interface SourceCounts {
  fetched: number;
  matched: number;
  deduped: number;
  created: number;
}

interface AlertQuery {
  label: string;
  query: string;
}

interface SettingsData {
  rssFeeds: string[];
  profileBlurb: string;
  alertQueries: AlertQuery[];
  lastDiscoveryRun: {
    startedAt: string;
    atsPoll: SourceCounts;
    alertsRss: SourceCounts;
    boardErrors: Array<{ board: string; status: number }>;
  } | null;
}

export default function SettingsPage() {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["watchlist"] });
    void qc.invalidateQueries({ queryKey: ["settings"] });
    void qc.invalidateQueries({ queryKey: ["leads"] });
    void qc.invalidateQueries({ queryKey: ["stats"] });
  };

  const { data: watchlist } = useQuery({
    queryKey: ["watchlist"],
    queryFn: () => api<WatchlistEntry[]>("/api/watchlist"),
  });
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<SettingsData>("/api/settings"),
  });

  const [newEntry, setNewEntry] = useState({
    displayName: "",
    atsType: "greenhouse",
    boardSlug: "",
  });
  const [feedsDraft, setFeedsDraft] = useState<string | null>(null);
  const [blurbDraft, setBlurbDraft] = useState<string | null>(null);
  const [queriesDraft, setQueriesDraft] = useState<AlertQuery[] | null>(null);

  const addEntry = useMutation({
    mutationFn: () =>
      api<WatchlistEntry>("/api/watchlist", {
        method: "POST",
        body: JSON.stringify(newEntry),
      }),
    onSuccess: () => {
      setNewEntry({ displayName: "", atsType: "greenhouse", boardSlug: "" });
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const patchEntry = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api<WatchlistEntry>(`/api/watchlist/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      }),
    onSuccess: invalidate,
    onError: (err: Error) => toast.error(err.message),
  });

  const removeEntry = useMutation({
    mutationFn: (id: string) =>
      api<unknown>(`/api/watchlist/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
    onError: (err: Error) => toast.error(err.message),
  });

  const saveSettings = useMutation({
    mutationFn: (payload: {
      rssFeeds?: string[];
      profileBlurb?: string;
      alertQueries?: AlertQuery[];
    }) =>
      api<unknown>("/api/settings", {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success("Settings saved");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const runNow = useMutation({
    mutationFn: () =>
      api<SettingsData["lastDiscoveryRun"]>("/api/discovery/run", {
        method: "POST",
      }),
    onSuccess: (result) => {
      toast.success(
        `Discovery: ${result?.atsPoll.created ?? 0} watchlist + ${result?.alertsRss.created ?? 0} alert leads created`,
      );
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const feeds = feedsDraft ?? settings?.rssFeeds.join("\n") ?? "";
  const blurb = blurbDraft ?? settings?.profileBlurb ?? "";
  const last = settings?.lastDiscoveryRun ?? null;

  return (
    <div className="max-w-3xl space-y-4 p-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm">Discovery</CardTitle>
          <Button
            size="sm"
            className="h-7 gap-1.5 text-xs"
            disabled={runNow.isPending}
            onClick={() => runNow.mutate()}
          >
            <Play className="size-3.5" aria-hidden />
            {runNow.isPending ? "Running…" : "Run discovery now"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-1 text-xs text-muted-foreground">
          {last ? (
            <>
              <p className="font-data">
                last run {new Date(last.startedAt).toLocaleString()}
              </p>
              <p>
                Watchlist: {last.atsPoll.fetched} fetched · {last.atsPoll.matched}{" "}
                matched · {last.atsPoll.deduped} deduped ·{" "}
                <span className="text-foreground">{last.atsPoll.created} created</span>
              </p>
              <p>
                Alerts: {last.alertsRss.fetched} fetched · {last.alertsRss.matched}{" "}
                matched · {last.alertsRss.deduped} deduped ·{" "}
                <span className="text-foreground">
                  {last.alertsRss.created} created
                </span>
              </p>
              {last.boardErrors.length > 0 ? (
                <p className="text-destructive">
                  Board errors:{" "}
                  {last.boardErrors
                    .map((b) => `${b.board} (${b.status || "network"})`)
                    .join(", ")}
                </p>
              ) : null}
            </>
          ) : (
            <p>
              Never run. Scheduled via DISCOVERY_CRON when DISCOVERY_ENABLED=true
              (Docker) or the Helm CronJob (Kubernetes).
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">ATS watchlist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(watchlist ?? []).map((entry) => (
            <div key={entry.id} className="flex items-center gap-3 rounded-md border px-3 py-2">
              <Checkbox
                checked={entry.enabled}
                onCheckedChange={(v) =>
                  patchEntry.mutate({ id: entry.id, enabled: v === true })
                }
                aria-label={`Enable ${entry.displayName}`}
              />
              <span className="min-w-0 flex-1 truncate text-sm">
                {entry.displayName}
              </span>
              <span className="font-data text-xs text-muted-foreground">
                {entry.atsType}/{entry.boardSlug}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-destructive hover:text-destructive"
                onClick={() => removeEntry.mutate(entry.id)}
                aria-label={`Remove ${entry.displayName}`}
              >
                <Trash2 className="size-3.5" aria-hidden />
              </Button>
            </div>
          ))}
          <form
            className="flex items-end gap-2 pt-1"
            onSubmit={(e) => {
              e.preventDefault();
              addEntry.mutate();
            }}
          >
            <div className="flex-1 space-y-1">
              <Label htmlFor="wl-name" className="text-xs">
                Company
              </Label>
              <Input
                id="wl-name"
                className="h-8 text-sm"
                value={newEntry.displayName}
                onChange={(e) =>
                  setNewEntry((s) => ({ ...s, displayName: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">ATS</Label>
              <Select
                value={newEntry.atsType}
                onValueChange={(v) =>
                  setNewEntry((s) => ({ ...s, atsType: v ?? s.atsType }))
                }
              >
                <SelectTrigger size="sm" className="w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ATS_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="text-xs">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-1">
              <Label htmlFor="wl-slug" className="text-xs">
                Board slug
              </Label>
              <Input
                id="wl-slug"
                className="h-8 text-sm"
                placeholder="e.g. platformscience"
                value={newEntry.boardSlug}
                onChange={(e) =>
                  setNewEntry((s) => ({ ...s, boardSlug: e.target.value }))
                }
              />
            </div>
            <Button
              type="submit"
              size="sm"
              className="h-8 gap-1 text-xs"
              disabled={
                addEntry.isPending ||
                !newEntry.displayName.trim() ||
                !newEntry.boardSlug.trim()
              }
            >
              <Plus className="size-3.5" aria-hidden />
              Add
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">
            Note: Coinbase (custom careers site) and Workday-based companies have
            no stable public posting API — cover those with Google Alerts feeds
            below.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Google Alerts queries</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            The app never runs these against Google — they are the recipes for
            your Google Alerts. Create/update each Alert with “Deliver to: RSS
            feed”, then paste the feed URLs into the next card. Edit them here
            when your search terms change.
          </p>
          {(queriesDraft ?? settings?.alertQueries ?? []).map((entry, i) => (
            <div key={i} className="space-y-1 rounded-md border p-2">
              <div className="flex items-center gap-2">
                <Input
                  aria-label="Query label"
                  className="h-7 w-40 text-xs"
                  value={entry.label}
                  onChange={(e) =>
                    setQueriesDraft((d) => {
                      const base = d ?? settings?.alertQueries ?? [];
                      return base.map((q, j) =>
                        j === i ? { ...q, label: e.target.value } : q,
                      );
                    })
                  }
                />
                <div className="flex-1" />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 text-xs"
                  onClick={() => {
                    void navigator.clipboard.writeText(entry.query);
                    toast.success(`${entry.label} query copied`);
                  }}
                >
                  <Copy className="size-3" aria-hidden />
                  Copy
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-destructive hover:text-destructive"
                  aria-label={`Remove ${entry.label} query`}
                  onClick={() =>
                    setQueriesDraft((d) =>
                      (d ?? settings?.alertQueries ?? []).filter((_, j) => j !== i),
                    )
                  }
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </Button>
              </div>
              <Textarea
                aria-label={`${entry.label} query`}
                rows={2}
                className="font-data text-xs"
                value={entry.query}
                onChange={(e) =>
                  setQueriesDraft((d) => {
                    const base = d ?? settings?.alertQueries ?? [];
                    return base.map((q, j) =>
                      j === i ? { ...q, query: e.target.value } : q,
                    );
                  })
                }
              />
            </div>
          ))}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-xs"
              onClick={() =>
                setQueriesDraft((d) => [
                  ...(d ?? settings?.alertQueries ?? []),
                  { label: "New query", query: "" },
                ])
              }
            >
              <Plus className="size-3.5" aria-hidden />
              Add query
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={saveSettings.isPending || queriesDraft === null}
              onClick={() =>
                queriesDraft &&
                saveSettings.mutate({
                  alertQueries: queriesDraft.filter(
                    (q) => q.label.trim() && q.query.trim(),
                  ),
                })
              }
            >
              Save queries
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Google Alerts RSS feeds</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            In Google Alerts, set “Deliver to: RSS feed” on your saved site:
            queries and paste the feed URLs here, one per line.
          </p>
          <Textarea
            rows={4}
            className="font-data text-xs"
            placeholder="https://www.google.com/alerts/feeds/…"
            value={feeds}
            onChange={(e) => setFeedsDraft(e.target.value)}
          />
          <Button
            size="sm"
            className="h-7 text-xs"
            disabled={saveSettings.isPending || feedsDraft === null}
            onClick={() =>
              saveSettings.mutate({
                rssFeeds: feeds
                  .split("\n")
                  .map((l) => l.trim())
                  .filter(Boolean),
              })
            }
          >
            Save feeds
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Profile blurb</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Used by the optional AI fit summary when ANTHROPIC_API_KEY is
            configured.
          </p>
          <Textarea
            rows={3}
            className="text-sm"
            value={blurb}
            onChange={(e) => setBlurbDraft(e.target.value)}
          />
          <Button
            size="sm"
            className="h-7 text-xs"
            disabled={saveSettings.isPending || blurbDraft === null}
            onClick={() => saveSettings.mutate({ profileBlurb: blurb })}
          >
            Save blurb
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">About</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-xs text-muted-foreground">
          <p className="font-data">
            Pipeline v{APP_VERSION}
          </p>
          <p>
            <a
              href="https://github.com/pashax276/job-checker/releases"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Release notes on GitHub
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
