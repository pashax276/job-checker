import os from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDb, migrateDb, type DB } from "@/db/client";
import { jobCreateSchema } from "@/lib/schemas";
import {
  aiEnabled,
  assessLeadFit,
  draftFollowUp,
  generatePrepQuestions,
} from "@/server/ai";
import { createDocument } from "@/server/documents";
import { createJob } from "@/server/jobs";
import { createLeadIfNew, listLeads } from "@/server/leads";

let db: DB;

beforeEach(() => {
  db = createDb(":memory:");
  migrateDb(db);
  process.env.ANTHROPIC_API_KEY = "test-key";
});

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
});

const fakeComplete = (canned: string) => {
  const calls: string[] = [];
  const fn = async (prompt: string) => {
    calls.push(prompt);
    return canned;
  };
  return { fn, calls };
};

describe("ai gating", () => {
  it("is disabled without the key and throws a clear error", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(aiEnabled()).toBe(false);
    const job = createJob(db, jobCreateSchema.parse({ company: "A", role: "R" }));
    await expect(
      draftFollowUp(db, job.id, async () => "x"),
    ).rejects.toThrow(/ANTHROPIC_API_KEY/);
  });
});

describe("generatePrepQuestions", () => {
  it("feeds job + resume + missing skills into the prompt", async () => {
    const doc = await createDocument(
      db,
      {
        kind: "resume",
        name: "v1",
        fileName: "r.txt",
        mimeType: "text/plain",
        data: Buffer.from("• Built EKS platform on AWS"),
      },
      `${os.tmpdir()}/ai-${Date.now()}`,
    );
    const job = createJob(
      db,
      jobCreateSchema.parse({
        company: "Qualcomm",
        role: "Senior Platform Engineer",
        resumeId: doc.id,
      }),
    );
    const { fn, calls } = fakeComplete("Q1...");
    const result = await generatePrepQuestions(db, job.id, "HM Interview", fn);
    expect(result).toBe("Q1...");
    expect(calls[0]).toContain("Qualcomm");
    expect(calls[0]).toContain("HM Interview");
    expect(calls[0]).toContain("Built EKS platform");
  });
});

describe("assessLeadFit", () => {
  it("fetches the posting, completes, and stores the summary", async () => {
    createLeadIfNew(
      db,
      {
        url: "https://boards.greenhouse.io/x/1",
        title: "Senior SRE",
        company: "NewCo",
        description: "AWS",
        location: "Remote - US",
        atsType: "greenhouse",
      },
      "ats-poll",
    );
    const lead = listLeads(db, "new")[0];
    const { fn } = fakeComplete("Fit: Strong. Great match.");
    const fakeFetch = (async () =>
      new Response("<html>AWS Kubernetes</html>", { status: 200 })) as unknown as typeof fetch;
    const summary = await assessLeadFit(db, lead.id, fn, fakeFetch);
    expect(summary).toContain("Fit: Strong");
    expect(listLeads(db, "new")[0].fitSummary).toContain("Fit: Strong");
  });
});
