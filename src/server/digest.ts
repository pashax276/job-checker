import type { DB } from "@/db/client";
import { toLocalIsoDate } from "@/lib/dates";
import { getStats } from "@/server/stats";
import { computeReminders } from "@/server/reminders";

/** Plain-text morning digest — ntfy/Slack-webhook friendly. */
export function buildDigestText(db: DB, today = new Date()): string {
  const todayIso = toLocalIsoDate(today);
  const stats = getStats(db, today);
  const reminders = computeReminders(db, today);

  const todaysSteps = stats.events.filter(
    (e) => e.date === todayIso && e.kind !== "Follow-up",
  );
  const dueFollowUps = stats.overdue;

  const lines: string[] = [
    today.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    }) + " — job pipeline",
  ];

  if (todaysSteps.length > 0) {
    lines.push(
      `Today: ${todaysSteps.map((e) => `${e.company} (${e.kind})`).join(", ")}`,
    );
  }
  if (dueFollowUps.length > 0) {
    lines.push(
      `Follow-ups due: ${dueFollowUps.map((o) => o.company).join(", ")}`,
    );
  }
  if (stats.newLeads > 0) {
    lines.push(`New leads in the inbox: ${stats.newLeads}`);
  }
  if (reminders.length > 0) {
    lines.push(`Reminders: ${reminders.length} open`);
  }
  if (lines.length === 1) {
    lines.push("Nothing scheduled, nothing due — all clear.");
  }
  lines.push(`Active pipeline: ${stats.activeTotal}`);
  return lines.join("\n");
}

export async function sendDigest(
  db: DB,
  webhookUrl: string,
  fetchFn: typeof fetch = fetch,
  today = new Date(),
): Promise<void> {
  const res = await fetchFn(webhookUrl, {
    method: "POST",
    headers: { "content-type": "text/plain", title: "Job pipeline digest" },
    body: buildDigestText(db, today),
  });
  if (!res.ok) throw new Error(`Digest webhook responded ${res.status}`);
}
