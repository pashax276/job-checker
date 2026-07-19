import os from "node:os";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, migrateDb, type DB } from "@/db/client";
import { jobCreateSchema } from "@/lib/schemas";
import { parseStoredSkillMatch } from "@/lib/skill-match";
import { createDocument } from "@/server/documents";
import { createJob, getJob } from "@/server/jobs";
import { refreshSkillMatch } from "@/server/skill-match";

const JD = "<html><body>We need AWS, Kubernetes, Terraform, and Prometheus.</body></html>";

const fakeFetch = (body: string, status = 200) =>
  (async () => new Response(body, { status })) as unknown as typeof fetch;

let db: DB;
let dir: string;

beforeEach(() => {
  db = createDb(":memory:");
  migrateDb(db);
  dir = `${os.tmpdir()}/sm-${Date.now()}-${Math.random().toString(36).slice(2)}`;
});

async function makeResume() {
  return createDocument(
    db,
    {
      kind: "resume",
      name: "v1",
      fileName: "r.txt",
      mimeType: "text/plain",
      data: Buffer.from("AWS Kubernetes Terraform expert"),
    },
    dir,
  );
}

describe("refreshSkillMatch", () => {
  it("computes, stores, and returns the match using the assigned resume", async () => {
    const doc = await makeResume();
    const job = createJob(
      db,
      jobCreateSchema.parse({
        company: "A",
        role: "R",
        postingUrl: "https://example.com/jd",
        resumeId: doc.id,
      }),
    );
    const match = await refreshSkillMatch(db, job.id, fakeFetch(JD));
    expect(match.matched).toEqual(
      expect.arrayContaining(["AWS", "Kubernetes", "Terraform"]),
    );
    expect(match.missing).toContain("Prometheus");
    const stored = parseStoredSkillMatch(getJob(db, job.id)!.skillMatch);
    expect(stored?.score).toBeCloseTo(match.score);
  });

  it("falls back to the latest resume when none is assigned", async () => {
    await makeResume();
    const job = createJob(
      db,
      jobCreateSchema.parse({
        company: "A",
        role: "R",
        postingUrl: "https://example.com/jd",
      }),
    );
    const match = await refreshSkillMatch(db, job.id, fakeFetch(JD));
    expect(match.score).toBeGreaterThan(0);
  });

  it("rejects jobs without a posting URL", async () => {
    await makeResume();
    const job = createJob(db, jobCreateSchema.parse({ company: "A", role: "R" }));
    await expect(refreshSkillMatch(db, job.id, fakeFetch(JD))).rejects.toThrow(
      /posting url/i,
    );
  });

  it("rejects when no resume with skills exists", async () => {
    const job = createJob(
      db,
      jobCreateSchema.parse({
        company: "A",
        role: "R",
        postingUrl: "https://example.com/jd",
      }),
    );
    await expect(refreshSkillMatch(db, job.id, fakeFetch(JD))).rejects.toThrow(
      /resume/i,
    );
  });

  it("surfaces posting fetch failures", async () => {
    await makeResume();
    const job = createJob(
      db,
      jobCreateSchema.parse({
        company: "A",
        role: "R",
        postingUrl: "https://example.com/jd",
      }),
    );
    await expect(refreshSkillMatch(db, job.id, fakeFetch("", 403))).rejects.toThrow(
      /403/,
    );
  });
});
