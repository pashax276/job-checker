import type { ZodError } from "zod";
import { log } from "@/lib/log";

/** Consistent JSON envelope for every API response. */
export interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

export function apiOk<T>(data: T, status = 200): Response {
  const body: ApiEnvelope<T> = { success: true, data, error: null };
  return Response.json(body, { status });
}

export function apiError(error: string, status: number): Response {
  const body: ApiEnvelope<never> = { success: false, data: null, error };
  return Response.json(body, { status });
}

export function apiZodError(error: ZodError): Response {
  const message = error.issues
    .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
    .join("; ");
  return apiError(message, 400);
}

/**
 * Wrap a route handler so an unexpected throw becomes a logged 500 carrying
 * the real reason, instead of Next's bare 500 with an empty body.
 *
 * Written after a Docker volume remounted read-only: SQLite refused every
 * write, "Add job" surfaced only "Request failed with status 500", and the
 * container log had nothing at all to go on. Domain errors that routes
 * already catch (a missing job, an unbooked stage) keep their own statuses —
 * this is the backstop for the failures nobody enumerated.
 */
export function withRouteErrors<A extends unknown[]>(
  handler: (request: Request, ...rest: A) => Promise<Response>,
): (request: Request, ...rest: A) => Promise<Response> {
  return async (request: Request, ...rest: A): Promise<Response> => {
    try {
      return await handler(request, ...rest);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      let path = request.url;
      try {
        path = new URL(request.url).pathname;
      } catch {
        // Relative or malformed URL in a test — the raw value still logs.
      }
      log.error(
        `${request.method} ${path} failed: ${message}`,
        err instanceof Error ? (err.stack ?? "") : "",
      );
      return apiError(message, 500);
    }
  };
}
