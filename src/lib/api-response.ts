import type { ZodError } from "zod";

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
