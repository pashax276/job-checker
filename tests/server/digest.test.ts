import { beforeEach, describe, expect, it } from "vitest";
import { createDb, migrateDb, type DB } from "@/db/client";
import { jobCreateSchema } from "@/lib/schemas";
import { buildDigestText, sendDigest } from "@/server/digest";
import { createJob } from "@/server/jobs";
import { upsertStageSchedule } from "@/server/schedule";

const TODAY = new Date(2026, 6, 20, 12, 0, 0);

let db: DB;

beforeEach(() => {
  db = createDb(":memory:");
  migrateDb(db);
});

describe("buildDigestText", () => {
  it("summarizes today's steps, due follow-ups, and new-lead count", () => {
    const a = createJob(
      db,
      jobCreateSchema.parse({ company: "TFN", role: "Staff Infra", status: "Screen" }),
    );
    upsertStageSchedule(db, a.id, "Screen", "2026-07-20");
    createJob(
      db,
      jobCreateSchema.parse({
        company: "MOXFIVE",
        role: "R",
        status: "Applied",
        followUpDate: "2026-07-13",
      }),
    );
    const text = buildDigestText(db, TODAY);
    expect(text).toContain("TFN");
    expect(text).toMatch(/Screen/);
    expect(text).toContain("MOXFIVE");
    expect(text).toMatch(/follow/i);
    expect(text).toMatch(/Mon.*Jul.*20|Jul 20/);
  });

  it("says all clear on an empty day", () => {
    const text = buildDigestText(db, TODAY);
    expect(text).toMatch(/nothing scheduled|all clear/i);
  });
});

describe("sendDigest", () => {
  it("POSTs the digest text to the webhook", async () => {
    const calls: Array<{ url: string; body: string }> = [];
    const fakeFetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), body: String(init?.body) });
      return new Response("ok", { status: 200 });
    }) as unknown as typeof fetch;
    await sendDigest(db, "https://ntfy.example/jobs", fakeFetch, TODAY);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://ntfy.example/jobs");
    expect(calls[0].body.length).toBeGreaterThan(10);
  });
});
