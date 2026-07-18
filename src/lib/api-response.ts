import type { ZodError } from "zod";

/** Consistent JSON envelope for every API response. */
export interface ApiEnvelope<T> {
  ok: boolean;
  data: T | null;
  error: string | null;
}

export function apiOk<T>(data: T, status = 200): Response {
  const body: ApiEnvelope<T> = { ok: true, data, error: null };
  return Response.json(body, { status });
}

export function apiError(error: string, status: number): Response {
  const body: ApiEnvelope<never> = { ok: false, data: null, error };
  return Response.json(body, { status });
}

export function apiZodError(error: ZodError): Response {
  const message = error.issues
    .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
    .join("; ");
  return apiError(message, 400);
}
