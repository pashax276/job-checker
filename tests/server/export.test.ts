import fs from "node:fs";
import os from "node:os";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, migrateDb, type DB } from "@/db/client";
import { jobCreateSchema, listQuerySchema } from "@/lib/schemas";
import type { Job } from "@/lib/types";
import { createDocument } from "@/server/documents";
import { setEddReport } from "@/server/edd";
import { buildExportJobs } from "@/server/export";
import { createJob, listJobs, updateJob } from "@/server/jobs";
import { addQuestion, upsertStageSchedule } from "@/server/schedule";

let db: DB;
let jobId: string;

const tmpDir = () => {
  const dir = `${os.tmpdir()}/export-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

function exportedJobs(): ReturnType<typeof buildExportJobs> {
  const jobs = listJobs(db, listQuerySchema.parse({})) as Job[];
  return buildExportJobs(db, jobs);
}

beforeEach(() => {
  db = createDb(":memory:");
  migrateDb(db);
  jobId = createJob(
    db,
    jobCreateSchema.parse({ company: "Acme", role: "Senior SRE" }),
  ).id;
});

describe("buildExportJobs", () => {
  it("nulls resume/coverLetter and an empty prep array when nothing is attached", () => {
    const [exported] = exportedJobs();
    expect(exported.company).toBe("Acme");
    expect(exported.resume).toBeNull();
    expect(exported.coverLetter).toBeNull();
    expect(exported.prep).toEqual([]);
  });

  it("embeds full resume and cover letter content, not a truncated excerpt", async () => {
    const dir = tmpDir();
    const longText = "Built EKS platform on AWS. ".repeat(200); // > 2500 chars
    const resume = await createDocument(
      db,
      {
        kind: "resume",
        name: "v3-platform",
        fileName: "resume.txt",
        mimeType: "text/plain",
        data: Buffer.from(longText),
      },
      dir,
    );
    const coverLetter = await createDocument(
      db,
      {
        kind: "cover-letter",
        name: "cover-v1",
        fileName: "cover.txt",
        mimeType: "text/plain",
        data: Buffer.from("Dear hiring manager..."),
      },
      dir,
    );
    updateJob(db, jobId, {
      resumeId: resume.id,
      coverLetterId: coverLetter.id,
    });

    const [exported] = exportedJobs();
    expect(exported.resume).not.toBeNull();
    expect(exported.resume!.id).toBe(resume.id);
    expect(exported.resume!.name).toBe("v3-platform");
    expect(exported.resume!.extractedText).toBe(longText);
    expect(exported.resume!.extractedText.length).toBeGreaterThan(2500);
    expect(exported.resume!.skills).toContain("AWS");
    expect(exported.coverLetter!.id).toBe(coverLetter.id);
    expect(exported.coverLetter!.extractedText).toBe("Dear hiring manager...");
  });

  it("embeds prep stages with their structured questions, direction preserved", () => {
    upsertStageSchedule(db, jobId, "Screen", "2026-08-01", "Brief notes");
    addQuestion(db, jobId, "Screen", "Is this remote?");
    addQuestion(
      db,
      jobId,
      "Screen",
      "How do you handle prod incidents?",
      "interviewer",
    );

    const [exported] = exportedJobs();
    expect(exported.prep).toHaveLength(1);
    expect(exported.prep[0]).toMatchObject({
      stage: "Screen",
      scheduledFor: "2026-08-01",
      prepNotes: "Brief notes",
      outcome: null,
    });
    expect(exported.prep[0].questions).toHaveLength(2);
    expect(exported.prep[0].questions[0].askedBy).toBe("me");
    expect(exported.prep[0].questions[1].askedBy).toBe("interviewer");
  });

  it("exports an empty EDD list for a job that was never reported", () => {
    const [exported] = exportedJobs();
    expect(exported.eddReports).toEqual([]);
  });

  it("embeds EDD reports so a backup keeps which stages were reported", () => {
    setEddReport(
      db,
      jobId,
      { stage: "Screen", reportedOn: "2026-10-12" },
      new Date("2026-10-12T19:00:00Z"),
    );
    setEddReport(
      db,
      jobId,
      { stage: "Applied", reportedOn: "2026-10-05" },
      new Date("2026-10-05T18:00:00Z"),
    );

    const [exported] = exportedJobs();
    // only what a restore needs — row ids are regenerated, jobId is implied
    expect(exported.eddReports).toEqual([
      {
        stage: "Applied",
        reportedOn: "2026-10-05",
        createdAt: "2026-10-05T18:00:00.000Z",
      },
      {
        stage: "Screen",
        reportedOn: "2026-10-12",
        createdAt: "2026-10-12T19:00:00.000Z",
      },
    ]);
  });
});
