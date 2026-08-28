import { afterEach, describe, expect, it, vi } from "vitest";
import { apiOk, withRouteErrors } from "@/lib/api-response";
import { log } from "@/lib/log";

type Envelope = { success: boolean; data: unknown; error: string | null };

afterEach(() => vi.restoreAllMocks());

describe("withRouteErrors", () => {
  it("passes a successful response through untouched", async () => {
    const handler = withRouteErrors(async () => apiOk({ id: "job-1" }, 201));
    const res = await handler(new Request("http://test/api/jobs"));
    expect(res.status).toBe(201);
    expect(((await res.json()) as Envelope).data).toEqual({ id: "job-1" });
  });

  it("turns a thrown error into a 500 envelope carrying the real reason", async () => {
    // The incident: SQLite refused the write, the route had no catch, and the
    // UI got a bare "Request failed with status 500" with an empty body.
    vi.spyOn(log, "error").mockImplementation(() => {});
    const handler = withRouteErrors(async () => {
      throw new Error("attempt to write a readonly database");
    });
    const res = await handler(new Request("http://test/api/jobs", { method: "POST" }));
    expect(res.status).toBe(500);
    const body = (await res.json()) as Envelope;
    expect(body.success).toBe(false);
    expect(body.data).toBeNull();
    expect(body.error).toBe("attempt to write a readonly database");
  });

  it("logs the failure server-side with the method and path", async () => {
    const spy = vi.spyOn(log, "error").mockImplementation(() => {});
    const handler = withRouteErrors(async () => {
      throw new Error("disk exploded");
    });
    await handler(new Request("http://test/api/jobs?x=1", { method: "POST" }));
    expect(spy).toHaveBeenCalledOnce();
    const line = spy.mock.calls[0].join(" ");
    expect(line).toContain("POST");
    expect(line).toContain("/api/jobs");
    expect(line).toContain("disk exploded");
  });

  it("handles a non-Error throw without losing the response contract", async () => {
    vi.spyOn(log, "error").mockImplementation(() => {});
    const handler = withRouteErrors(async () => {
      throw "just a string";
    });
    const res = await handler(new Request("http://test/api/jobs"));
    expect(res.status).toBe(500);
    expect(((await res.json()) as Envelope).error).toContain("just a string");
  });

  it("forwards every handler argument, so [id] routes keep their context", async () => {
    const handler = withRouteErrors(
      async (_req: Request, ctx: { params: Promise<{ id: string }> }) =>
        apiOk(await ctx.params),
    );
    const res = await handler(new Request("http://test/api/jobs/abc"), {
      params: Promise.resolve({ id: "abc" }),
    });
    expect(((await res.json()) as Envelope).data).toEqual({ id: "abc" });
  });
});
