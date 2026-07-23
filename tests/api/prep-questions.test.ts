import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDb, runMigrations } from "@/db/client";
import * as jobsRoute from "@/app/api/jobs/route";
import * as scheduleRoute from "@/app/api/jobs/[id]/schedule/route";
import * as questionsRoute from "@/app/api/jobs/[id]/schedule/questions/route";

type Envelope<T> = { success: boolean; data: T; error: string | null };
type Question = { id: string; text: string; response: string | null };

const byId = (id: string) => ({ params: Promise.resolve({ id }) });

const post = (body: unknown) =>
  jobsRoute.POST(
    new Request("http://test/api/jobs", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }),
  );

async function createOne(): Promise<string> {
  const res = await post({ company: "Acme", role: "Senior SRE" });
  const body = (await res.json()) as Envelope<{ id: string }>;
  return body.data.id;
}

function jsonRequest(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    headers: { "content-type": "application/json" },
  });
}

beforeAll(() => {
  runMigrations();
});

beforeEach(() => {
  const raw = getDb().$client;
  raw.prepare("DELETE FROM status_history").run();
  raw.prepare("DELETE FROM leads").run();
  raw.prepare("DELETE FROM stage_schedule").run();
  raw.prepare("DELETE FROM jobs").run();
});

describe("POST/PATCH/DELETE /api/jobs/:id/schedule/questions", () => {
  it("adds, updates (records a response), and removes a question", async () => {
    const jobId = await createOne();
    await scheduleRoute.PUT(
      jsonRequest(
        "PUT",
        "http://test/api/jobs/x/schedule",
        { stage: "Screen", scheduledFor: "2026-08-01" },
      ),
      byId(jobId),
    );

    const addRes = await questionsRoute.POST(
      jsonRequest("POST", "http://test/api/jobs/x/schedule/questions", {
        stage: "Screen",
        text: "Is this role remote?",
      }),
      byId(jobId),
    );
    expect(addRes.status).toBe(200);
    const added = (await addRes.json()) as Envelope<Question[]>;
    expect(added.data).toHaveLength(1);
    const questionId = added.data[0].id;

    const patchRes = await questionsRoute.PATCH(
      jsonRequest("PATCH", "http://test/api/jobs/x/schedule/questions", {
        stage: "Screen",
        questionId,
        response: "Yes, fully remote",
      }),
      byId(jobId),
    );
    expect(patchRes.status).toBe(200);
    const patched = (await patchRes.json()) as Envelope<Question[]>;
    expect(patched.data[0].response).toBe("Yes, fully remote");

    const delRes = await questionsRoute.DELETE(
      new Request(
        `http://test/api/jobs/x/schedule/questions?stage=Screen&questionId=${questionId}`,
        { method: "DELETE" },
      ),
      byId(jobId),
    );
    expect(delRes.status).toBe(200);
    const afterDelete = (await delRes.json()) as Envelope<Question[]>;
    expect(afterDelete.data).toHaveLength(0);
  });

  it("PUT bulk-imports questions from parsed markdown text", async () => {
    const jobId = await createOne();
    await scheduleRoute.PUT(
      jsonRequest(
        "PUT",
        "http://test/api/jobs/x/schedule",
        { stage: "Screen", scheduledFor: "2026-08-01" },
      ),
      byId(jobId),
    );
    const res = await questionsRoute.PUT(
      jsonRequest("PUT", "http://test/api/jobs/x/schedule/questions", {
        stage: "Screen",
        texts: ["Is this remote?", "What's the comp range?"],
      }),
      byId(jobId),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Envelope<Question[]>;
    expect(body.data.map((q) => q.text)).toEqual([
      "Is this remote?",
      "What's the comp range?",
    ]);
  });

  it("404s when the step has no booked date", async () => {
    const jobId = await createOne();
    const res = await questionsRoute.POST(
      jsonRequest("POST", "http://test/api/jobs/x/schedule/questions", {
        stage: "Panel",
        text: "x",
      }),
      byId(jobId),
    );
    expect(res.status).toBe(404);
  });

  it("404s for an unknown job", async () => {
    const res = await questionsRoute.POST(
      jsonRequest("POST", "http://test/api/jobs/x/schedule/questions", {
        stage: "Screen",
        text: "x",
      }),
      byId("does-not-exist"),
    );
    expect(res.status).toBe(404);
  });
});
