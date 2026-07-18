/**
 * Minimal stdout/stderr logger for a single-container app. Twelve-factor:
 * the container runtime owns log shipping; we just write structured lines.
 */
export const log = {
  info(message: string, ...rest: unknown[]): void {
    console.info(`[tracker] ${message}`, ...rest);
  },
  warn(message: string, ...rest: unknown[]): void {
    console.warn(`[tracker] ${message}`, ...rest);
  },
  error(message: string, ...rest: unknown[]): void {
    console.error(`[tracker] ${message}`, ...rest);
  },
};
