import type { ApiEnvelope } from "@/lib/api-response";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Fetch wrapper that unwraps the API envelope and throws on failure. */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  let body: ApiEnvelope<T> | null = null;
  try {
    body = (await res.json()) as ApiEnvelope<T>;
  } catch {
    // fall through to error below
  }
  if (!res.ok || !body || !body.success || body.data === null) {
    throw new ApiError(
      body?.error ?? `Request failed with status ${res.status}`,
      res.status,
    );
  }
  return body.data;
}
