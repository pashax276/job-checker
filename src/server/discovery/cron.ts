import { getDb } from "@/db/client";
import { log } from "@/lib/log";
import { runDiscovery } from "@/server/discovery/run";

declare global {
  var __discoveryCronStarted: boolean | undefined;
  var __backupCronStarted: boolean | undefined;
}

/**
 * Nightly database backup — ON by default (yesterday's disk incident is why).
 * Disable with BACKUP_ENABLED=false; schedule via BACKUP_CRON (default 09:00
 * UTC = 2:00 AM Pacific).
 */
export async function startBackupCron(): Promise<void> {
  if (process.env.BACKUP_ENABLED === "false") return;
  if (globalThis.__backupCronStarted) return;

  const { default: cron } = await import("node-cron");
  const expression = process.env.BACKUP_CRON ?? "0 9 * * *";
  if (!cron.validate(expression)) {
    log.error(`invalid BACKUP_CRON expression: ${expression}`);
    return;
  }
  globalThis.__backupCronStarted = true;
  cron.schedule(expression, () => {
    import("@/server/backup")
      .then(({ runBackup }) => runBackup(getDb()))
      .then((dest) => log.info(`nightly backup written: ${dest}`))
      .catch((err: unknown) =>
        log.error(
          `backup failed: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
  });
  log.info(`backup cron scheduled (${expression})`);
}

/**
 * In-process scheduler for Docker deployments. Disabled unless
 * DISCOVERY_ENABLED=true — on Kubernetes the Helm CronJob calls
 * POST /api/discovery/run instead and this stays off.
 */
export async function startDiscoveryCron(): Promise<void> {
  if (process.env.DISCOVERY_ENABLED !== "true") return;
  if (globalThis.__discoveryCronStarted) return;

  const { default: cron } = await import("node-cron");
  const expression = process.env.DISCOVERY_CRON ?? "0 14 * * *";
  if (!cron.validate(expression)) {
    log.error(`invalid DISCOVERY_CRON expression: ${expression}`);
    return;
  }
  globalThis.__discoveryCronStarted = true;
  cron.schedule(expression, () => {
    runDiscovery(getDb())
      .then((result) =>
        log.info(
          `discovery run: ats ${result.atsPoll.created} created / rss ${result.alertsRss.created} created`,
        ),
      )
      .catch((err: unknown) =>
        log.error(
          `discovery run failed: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
  });
  log.info(`discovery cron scheduled (${expression})`);
}
