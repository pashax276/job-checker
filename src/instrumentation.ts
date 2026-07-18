/**
 * Runs once when the Next.js server process starts (nodejs runtime only):
 * apply migrations, then first-run seed import. Discovery cron is started
 * here too so a single deployable artifact needs no sidecars.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { getDb, runMigrations } = await import("@/db/client");
  const { seedIfEmpty } = await import("@/db/seed");
  const { log } = await import("@/lib/log");

  runMigrations();
  const { imported } = seedIfEmpty(getDb());
  if (imported > 0) {
    log.info(`first run: imported ${imported} jobs from seed file`);
  }
}
