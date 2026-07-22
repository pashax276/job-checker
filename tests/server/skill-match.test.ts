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

  it("snapshots the posting text on the job (postings disappear)", async () => {
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
    await refreshSkillMatch(db, job.id, fakeFetch(JD));
    const snapshot = getJob(db, job.id)!.jdSnapshot;
    expect(snapshot).toContain("AWS");
    expect(snapshot).not.toContain("<body>");
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

  it("names bot-blocking status codes explicitly, not just the number", async () => {
    await makeResume();
    const job = createJob(
      db,
      jobCreateSchema.parse({
        company: "Coinbase",
        role: "R",
        postingUrl: "https://coinbase.com/careers/positions/1",
      }),
    );
    await expect(
      refreshSkillMatch(db, job.id, fakeFetch("", 403)),
    ).rejects.toThrow(/blocks automated fetches/i);
    await expect(
      refreshSkillMatch(db, job.id, fakeFetch("", 401)),
    ).rejects.toThrow(/blocks automated fetches/i);
  });

  it("reads real JD text from Ashby's board API instead of the JS-shell HTML page", async () => {
    // Reproduces a real bug: jobs.ashbyhq.com pages are client-rendered —
    // a plain fetch returns "You need to enable JavaScript to run this
    // app.", which scored 0% for every Ashby posting. Ashby's public
    // board API (the same one discovery already polls) has the real text.
    await makeResume();
    const postingId = "f0a774bd-d94c-41bc-a657-c85eb625362c";
    const job = createJob(
      db,
      jobCreateSchema.parse({
        company: "Pano AI",
        role: "Platform Engineer",
        postingUrl: `https://jobs.ashbyhq.com/pano-ai/${postingId}`,
      }),
    );
    const spaShell =
      "<html><body>You need to enable JavaScript to run this app.</body></html>";
    const boardPayload = {
      jobs: [
        {
          jobUrl: `https://jobs.ashbyhq.com/pano-ai/${postingId}`,
          title: "Platform Engineer",
          location: "Remote",
          descriptionPlain:
            "We need AWS, Kubernetes, Terraform, and Prometheus.",
        },
      ],
    };
    const fetchFn = (async (url: string) => {
      if (url.includes("api.ashbyhq.com")) {
        return new Response(JSON.stringify(boardPayload), { status: 200 });
      }
      // The HTML fallback must not be reached — if it is, the board API
      // path failed to short-circuit and this scores 0% again.
      return new Response(spaShell, { status: 200 });
    }) as unknown as typeof fetch;

    const match = await refreshSkillMatch(db, job.id, fetchFn);
    expect(match.matched).toEqual(
      expect.arrayContaining(["AWS", "Kubernetes", "Terraform"]),
    );
    expect(match.score).toBeGreaterThan(0);
    const snapshot = getJob(db, job.id)!.jdSnapshot;
    expect(snapshot).not.toContain("enable JavaScript");
  });

  it("falls back to raw HTML fetch when the board API has no matching posting", async () => {
    await makeResume();
    const job = createJob(
      db,
      jobCreateSchema.parse({
        company: "Pano AI",
        role: "Platform Engineer",
        postingUrl: "https://jobs.ashbyhq.com/pano-ai/missing-id",
      }),
    );
    const fetchFn = (async (url: string) => {
      if (url.includes("api.ashbyhq.com")) {
        return new Response(JSON.stringify({ jobs: [] }), { status: 200 });
      }
      return new Response(JD, { status: 200 });
    }) as unknown as typeof fetch;

    const match = await refreshSkillMatch(db, job.id, fetchFn);
    expect(match.matched).toEqual(expect.arrayContaining(["AWS"]));
  });

  it("skips the board API entirely for non-ATS posting URLs", async () => {
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

  it("leaves other fetch failures with the plain status message", async () => {
    await makeResume();
    const job = createJob(
      db,
      jobCreateSchema.parse({
        company: "A",
        role: "R",
        postingUrl: "https://example.com/jd",
      }),
    );
    await expect(
      refreshSkillMatch(db, job.id, fakeFetch("", 500)),
    ).rejects.toThrow("Posting fetch failed (500)");
  });
});
