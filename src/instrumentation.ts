/**
 * Runs once when the Next.js server process starts (nodejs runtime only):
 * apply migrations, then first-run seed import. Discovery cron is started
 * here too so a single deployable artifact needs no sidecars.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { getDb, runMigrations } = await import("@/db/client");
  const { seedIfEmpty, seedWatchlistIfEmpty } = await import("@/db/seed");
  const { log } = await import("@/lib/log");
  const { startBackupCron, startDigestCron, startDiscoveryCron } = await import(
    "@/server/discovery/cron"
  );

  runMigrations();
  const { imported } = seedIfEmpty(getDb());
  if (imported > 0) {
    log.info(`first run: imported ${imported} jobs from seed file`);
  }
  const watch = seedWatchlistIfEmpty(getDb());
  if (watch.imported > 0) {
    log.info(`first run: seeded ${watch.imported} watchlist companies`);
  }
  const { ensureWeeklySnapshot } = await import("@/server/snapshots");
  ensureWeeklySnapshot(getDb());

  await startDiscoveryCron();
  await startBackupCron();
  await startDigestCron();
}

/**
 * Every server-side error Next catches, on any route — including throws no
 * route handler wrapped. Without this the container log stayed silent through
 * a total write outage, which is what made a read-only volume look like an
 * application bug.
 */
export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routeType: string },
): Promise<void> {
  const { log } = await import("@/lib/log");
  const message = error instanceof Error ? error.message : String(error);
  log.error(
    `unhandled ${context.routeType} error: ${request.method} ${request.path}: ${message}`,
    error instanceof Error ? (error.stack ?? "") : "",
  );
}
